import { createClient } from '@libsql/client';
import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { executeAutomaticFlowStep, executeGateway } from '../src/gateway/actions.ts';
import type { AccessContext } from '../src/types.ts';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => { while (clients.length) clients.pop()?.close(); vi.unstubAllGlobals(); });

async function workspace() {
  const client = createClient({ url: 'file::memory:' }); clients.push(client);
  for (const statement of WORKSPACE_SCHEMA) await client.execute(statement);
  return client;
}

const access: AccessContext = {
  identity: { id: 'user_1', email: 'owner@example.com', name: 'Owner' },
  workspace: { id: 'ws_1', name: 'Test', slug: 'test', mode: 'work', databaseName: 'test', databaseHost: 'test', state: 'active' },
  member: { workspaceId: 'ws_1', userId: 'user_1', role: 'owner', state: 'active' },
};

describe('mandatory Gateway execution', () => {
  it('commits one Record and returns it for an idempotent replay', async () => {
    const client = await workspace();
    const request = { actionId: 'record.create' as const, idempotencyKey: 'create-contact-1', input: { type: 'contact', title: 'Ada Lovelace', data: { email: 'ada@example.com' } } };
    const first = await Effect.runPromise(executeGateway(client, access, request));
    const replay = await Effect.runPromise(executeGateway(client, access, request));
    expect(first).toEqual(replay);
    const records = await client.execute('SELECT id,title FROM records');
    const events = await client.execute('SELECT id FROM events');
    expect(records.rows).toHaveLength(1);
    expect(events.rows).toHaveLength(1);
  });



  it('rejects reuse of an operation key with different input', async () => {
    const client = await workspace();
    await Effect.runPromise(executeGateway(client, access, { actionId: 'task.create', idempotencyKey: 'task-1', input: { title: 'Review order' } }));
    await expect(Effect.runPromise(executeGateway(client, access, { actionId: 'task.create', idempotencyKey: 'task-1', input: { title: 'Different task' } }))).rejects.toThrow('different input');
  });

  it('requires domain actions for protected record creation and state changes', async () => {
    const client = await workspace();
    await expect(Effect.runPromise(executeGateway(client, access, { actionId: 'record.create', idempotencyKey: 'fake-site', input: { type: 'site', title: 'Unreviewed site' } }))).rejects.toThrow('registered domain action');
    for (const type of ['item', 'price', 'stock', 'purchase', 'order', 'invoice', 'payment', 'refund', 'posting']) {
      await expect(Effect.runPromise(executeGateway(client, access, { actionId: 'record.create', idempotencyKey: `fake-${type}`, input: { type, title: 'Bypass' } }))).rejects.toThrow('registered domain action');
    }
    await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,version,created,updated) VALUES('legacy-order','order','Order','accepted','{}',1,0,0)" });
    await expect(Effect.runPromise(executeGateway(client, access, { actionId: 'record.update', idempotencyKey: 'fake-order-update', input: { recordId: 'legacy-order', baseVersion: 1, title: 'Changed' } }))).rejects.toThrow('registered domain action');
    const created = await Effect.runPromise(executeGateway(client, access, { actionId: 'task.create', idempotencyKey: 'safe-task', input: { title: 'Review quote' } }));
    const task = created.record as { id: string; version: number };
    await expect(Effect.runPromise(executeGateway(client, access, { actionId: 'record.update', idempotencyKey: 'fake-complete', input: { recordId: task.id, baseVersion: task.version, state: 'completed' } }))).rejects.toThrow('registered action');
    expect((await client.execute('SELECT state FROM records WHERE id=?', [task.id])).rows[0].state).toBe('open');
  });





  it('keeps contact identity separate from dated organization experience', async () => {
    const client = await workspace();
    const person = await Effect.runPromise(executeGateway(client, access, { actionId: 'contact.create', idempotencyKey: 'person-1', input: { name: 'Ada Lovelace' } }));
    const organization = await Effect.runPromise(executeGateway(client, access, { actionId: 'organization.create', idempotencyKey: 'organization-1', input: { name: 'Analytical Engines', website: 'https://example.com' } }));
    const personId = (person.record as { id: string }).id;
    const organizationId = (organization.record as { id: string }).id;
    const created = await Effect.runPromise(executeGateway(client, access, { actionId: 'relationship.create', idempotencyKey: 'link-1', input: { source: personId, target: organizationId, role: 'Engineer', since: 100 } }));
    const linkId = (created.link as { id: string }).id;
    await Effect.runPromise(executeGateway(client, access, { actionId: 'relationship.end', idempotencyKey: 'unlink-1', input: { id: linkId, until: 200 } }));
    const history = await client.execute('SELECT source,target,role,since,until FROM links WHERE id=?', [linkId]);
    expect(history.rows[0]).toMatchObject({ source: personId, target: organizationId, role: 'Engineer', since: 100, until: 200 });
  });

  it('records explicit, sourced consent without inferring it from an email address', async () => {
    const client = await workspace();
    const person = await Effect.runPromise(executeGateway(client, access, { actionId: 'contact.create', idempotencyKey: 'consent-person', input: { name: 'Ada', email: 'ada@example.com' } }));
    const contactId = (person.record as { id: string }).id;
    expect((await client.execute('SELECT id FROM consents')).rows).toHaveLength(0);
    await expect(Effect.runPromise(executeGateway(client, access, { actionId: 'consent.record', idempotencyKey: 'consent-no-evidence', input: { contactId, channel: 'email', purpose: 'marketing', state: 'granted', source: 'yes' } }))).rejects.toThrow('evidence');
    const request = { actionId: 'consent.record' as const, idempotencyKey: 'consent-granted', input: { contactId, channel: 'email', purpose: 'marketing', state: 'granted', source: 'Signed paper form on 2026-09-24' } };
    const granted = await Effect.runPromise(executeGateway(client, access, request));
    expect(await Effect.runPromise(executeGateway(client, access, request))).toEqual(granted);
    await Effect.runPromise(executeGateway(client, access, { actionId: 'consent.record', idempotencyKey: 'consent-revoked', input: { contactId, channel: 'email', purpose: 'marketing', state: 'revoked', source: 'Customer requested no further email' } }));
    expect((await client.execute('SELECT state FROM consents WHERE contact=? ORDER BY created,id', [contactId])).rows).toHaveLength(2);
  });


});
