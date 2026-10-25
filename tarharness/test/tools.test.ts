import { createClient } from '@libsql/client';
import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { canExecute } from '../src/access.ts';
import { executeGateway } from '../src/gateway/actions.ts';
import { readWorkspaceTools } from '../src/registry/tools.ts';
import type { AccessContext } from '../src/types.ts';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => { while (clients.length) clients.pop()?.close(); });
async function workspace() {
  const client = createClient({ url: 'file::memory:' }); clients.push(client);
  for (const statement of WORKSPACE_SCHEMA) await client.execute(statement);
  return client;
}
const owner: AccessContext = {
  identity: { id: 'owner', email: 'owner@example.com', name: 'Owner' },
  workspace: { id: 'personal', name: 'Personal', slug: 'personal', mode: 'personal', databaseName: 'personal', databaseHost: 'test', state: 'active' },
  member: { workspaceId: 'personal', userId: 'owner', role: 'owner', state: 'active' },
};

describe('workspace Tools eligibility', () => {
  it('keeps POS and commerce out of Personal until a capability is enabled', async () => {
    const client = await workspace();
    const initial = await readWorkspaceTools(client, owner);
    expect(initial.tools.map((tool) => tool.id)).toContain('human');
    expect(initial.tools.map((tool) => tool.id)).toContain('contact');
    expect(initial.tools.map((tool) => tool.id)).not.toContain('chat');
    expect(initial.tools.map((tool) => tool.id)).not.toContain('members');
    expect(initial.tools.map((tool) => tool.id)).not.toContain('inbox');
    expect(initial.tools.map((tool) => tool.id)).not.toContain('telegram');
    expect(initial.tools.map((tool) => tool.id)).not.toContain('pos');
    expect(initial.tools.map((tool) => tool.id)).not.toContain('register');
    expect(initial.tools.map((tool) => tool.id)).not.toContain('site');

    await Effect.runPromise(executeGateway(client, owner, { actionId: 'capability.save', idempotencyKey: 'enable-pos', input: { module: 'pos', enabled: true, baseVersion: 0 } }));
    const enabled = await readWorkspaceTools(client, owner);
    expect(enabled.tools.map((tool) => tool.id)).toContain('pos');
    expect(enabled.tools.map((tool) => tool.id)).toContain('register');
    expect(enabled.version).toBe(1);

    await Effect.runPromise(executeGateway(client, owner, { actionId: 'capability.save', idempotencyKey: 'disable-pos', input: { module: 'pos', enabled: false, baseVersion: 1 } }));
    expect((await readWorkspaceTools(client, owner)).tools.map((tool) => tool.id)).not.toContain('pos');
    expect((await readWorkspaceTools(client, owner)).tools.map((tool) => tool.id)).not.toContain('register');
  });

  it('verifies the trimmed tool catalog', async () => {
    const client = await workspace();
    const workContext: AccessContext = {
      ...owner,
      workspace: { id: 'work', name: 'Work Shop', slug: 'work', mode: 'work', databaseName: 'work', databaseHost: 'test', state: 'active' },
    };
    await Effect.runPromise(executeGateway(client, workContext, { actionId: 'capability.save', idempotencyKey: 'enable-pos', input: { module: 'pos', enabled: true, baseVersion: 0 } }));
    await Effect.runPromise(executeGateway(client, workContext, { actionId: 'capability.save', idempotencyKey: 'enable-site', input: { module: 'site', enabled: true, baseVersion: 1 } }));
    const result = await readWorkspaceTools(client, workContext);

    const toolIds = result.tools.map((tool) => tool.id);
    const expected = ['pos', 'register', 'item', 'inventory', 'order', 'invoice', 'payment', 'expense', 'purchase', 'members', 'contact', 'human', 'site'];
    for (const id of expected) {
      expect(toolIds).toContain(id);
    }
    expect(result.tools.length).toBe(13);

  });

  it('respects member explicit access whitelist and allows pos, register, chat', async () => {
    const client = await workspace();
    await Effect.runPromise(executeGateway(client, owner, { actionId: 'capability.save', idempotencyKey: 'enable-pos', input: { module: 'pos', enabled: true, baseVersion: 0 } }));

    const memberWithAccess: AccessContext = {
      ...owner,
      workspace: { ...owner.workspace, mode: 'work' },
      member: {
        ...owner.member,
        role: 'member',
        workRole: 'cashier',
        access: ['pos', 'register'],
      },
    };

    const toolsResult = await readWorkspaceTools(client, memberWithAccess);
    const toolIds = toolsResult.tools.map((t) => t.id);
    expect(toolIds).toContain('pos');
    expect(toolIds).toContain('register');
    expect(toolIds).not.toContain('site');
    expect(toolIds).not.toContain('purchase');
    expect(toolIds).not.toContain('expense');
  });

  it('requires management access and the current version to change capabilities', async () => {
    const client = await workspace();
    const member: AccessContext = { ...owner, member: { ...owner.member, role: 'member', workRole: 'cashier', roles: ['cashier'] } };
    await expect(Effect.runPromise(executeGateway(client, member, { actionId: 'capability.save', idempotencyKey: 'member-save', input: { module: 'pos', enabled: true, baseVersion: 0 } }))).rejects.toThrow();
    await Effect.runPromise(executeGateway(client, owner, { actionId: 'capability.save', idempotencyKey: 'owner-save', input: { module: 'pos', enabled: true, baseVersion: 0 } }));
    await expect(Effect.runPromise(executeGateway(client, owner, { actionId: 'capability.save', idempotencyKey: 'stale-save', input: { module: 'site', enabled: true, baseVersion: 0 } }))).rejects.toThrow('Tools changed');
    const cashier = await readWorkspaceTools(client, member);
    expect(cashier.tools.map((tool) => tool.id)).toContain('pos');
    expect(cashier.tools.map((tool) => tool.id)).toContain('register');
    expect(cashier.tools.map((tool) => tool.id)).not.toContain('inventory');
    expect(cashier.tools.map((tool) => tool.id)).not.toContain('site');
    expect(cashier.canManage).toBe(false);
  });

  it('toolActionMap permits POS counter actions and blocks ungranted tools for member with pos access', () => {
    const member: AccessContext['member'] = {
      workspaceId: 'work1',
      userId: 'user1',
      role: 'member',
      workRole: 'general',
      state: 'active',
      access: ['pos'],
    };
    expect(canExecute(member, 'pos.open')).toBe(true);
    expect(canExecute(member, 'pos.customer.save')).toBe(true);
    expect(canExecute(member, 'pos.order.save')).toBe(true);
    expect(canExecute(member, 'pos.checkout')).toBe(true);
    expect(canExecute(member, 'purchase.create')).toBe(false);
    expect(canExecute(member, 'expense.record')).toBe(false);
    expect(canExecute(member, 'stock.adjust')).toBe(false);
  });

  it('blocks all execution and hides tools when member has explicit empty access list', async () => {
    const client = await workspace();
    await Effect.runPromise(executeGateway(client, owner, { actionId: 'capability.save', idempotencyKey: 'enable-pos', input: { module: 'pos', enabled: true, baseVersion: 0 } }));

    const memberEmptyAccess: AccessContext = {
      ...owner,
      workspace: { ...owner.workspace, mode: 'work' },
      member: {
        ...owner.member,
        role: 'member',
        workRole: 'cashier',
        access: [],
      },
    };

    expect(canExecute(memberEmptyAccess.member, 'pos.open')).toBe(false);
    expect(canExecute(memberEmptyAccess.member, 'pos.customer.save')).toBe(false);

    const toolsResult = await readWorkspaceTools(client, memberEmptyAccess);
    expect(toolsResult.tools.length).toBe(0);
  });

  it('executeGateway enforces Turso party record access whitelist', async () => {
    const client = await workspace();
    await Effect.runPromise(executeGateway(client, owner, { actionId: 'capability.save', idempotencyKey: 'enable-pos', input: { module: 'pos', enabled: true, baseVersion: 0 } }));

    const partyId = 'party_test_123';
    const stamp = Date.now();
    await client.execute({
      sql: `INSERT INTO records(id, type, title, state, data, owner, assignee, due, version, created, updated)
            VALUES(?, 'party', 'member@example.com', 'active', ?, 'owner', NULL, NULL, 1, ?, ?)`,
      args: [
        partyId,
        JSON.stringify({ kind: 'member', userId: 'restricted-user', email: 'member@example.com', role: 'member', workrole: 'cashier', brief: 'Support chat only', access: ['chat'] }),
        stamp,
        stamp,
      ],
    });

    const restrictedContext: AccessContext = {
      identity: { id: 'restricted-user', email: 'member@example.com', name: 'Restricted Member' },
      workspace: { id: 'work1', name: 'Work', slug: 'work', mode: 'work', databaseName: 'work', databaseHost: 'test', state: 'active' },
      member: { workspaceId: 'work1', userId: 'restricted-user', role: 'member', workRole: 'cashier', state: 'active' },
    };

    const contactResult = await Effect.runPromise(executeGateway(client, restrictedContext, {
      actionId: 'contact.create',
      idempotencyKey: 'contact-key-1',
      input: { name: 'Customer Test', phone: '+919876543210' },
    }));
    expect(contactResult).toBeDefined();

    await expect(Effect.runPromise(executeGateway(client, restrictedContext, {
      actionId: 'pos.open',
      idempotencyKey: 'pos-key-1',
      input: {},
    }))).rejects.toThrow();
  });
});
