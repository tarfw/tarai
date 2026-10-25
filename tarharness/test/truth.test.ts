import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { commitWrite, completeInboxStatement, currentStatement, findMoveReplay, inboxStatement, lastMoveId, moveHash, moveStatement, readInbox } from '../src/truth/write.ts';
import { deriveGate, floorGate, mayExecute, missingFields } from '../src/truth/gate.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => { clients.splice(0).forEach((client) => client.close()); });

async function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'tar-truth-test-'));
  const client = createClient({ url: pathToFileURL(join(directory, 'workspace.db')).href }); clients.push(client);
  for (const sql of WORKSPACE_SCHEMA) await client.execute(sql);
  return client;
}

const record = (id: string) => ({
  sql: `INSERT INTO records (id,type,title,state,data,owner,assignee,due,version,created,updated) VALUES (?,'task',?,'open',?, 'owner', NULL, NULL, 1, ?, ?)`,
  args: [id, 'Count drawer', JSON.stringify({ note: 'shift 14' }), Date.now(), Date.now()],
});

describe('truth engine', () => {
  it('one transaction writes record + move + current + inbox, or nothing', async () => {
    const client = await workspace();
    const hash = await moveHash({ actor: 'owner', action: 'task.create', input: { title: 'Count drawer' } });
    const statements = [
      record('task_1'),
      moveStatement({ kind: 'task.create', actor: 'owner', key: 'tap-1', hash, result: { id: 'task_1' }, recordId: 'task_1', action: 'task.create' }),
      currentStatement('card', 'task', { open: 1 }),
      inboxStatement({ member: 'owner', tool: 'task', reach: 'none', title: 'Count drawer', due: Date.now() + 3600_000, action: 'task.complete', input: { taskId: 'task_1' } }),
    ];
    await commitWrite(client, statements);
    const rows = await client.execute('SELECT kind, record_id FROM move');
    expect(rows.rows).toHaveLength(1);
    const card = await client.execute("SELECT data FROM current WHERE kind='card' AND key='task'");
    expect(JSON.parse(String(card.rows[0][0]))).toEqual({ open: 1 });
    const inbox = await readInbox(client, 'owner');
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ tool: 'task', title: 'Count drawer', action: 'task.complete', status: 'pending' });

    // A failing statement rolls the whole write back: nothing lands.
    await expect(commitWrite(client, [
      record('task_2'),
      { sql: 'INSERT INTO move (id,kind,state,input_hash,idempotency_key,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', args: ['bad', 'x', 'accepted', 'h', 'tap-1', '{}', 1, 1] }, // duplicate key
    ])).rejects.toThrow();
    const tasks = await client.execute("SELECT id FROM records WHERE type='task'");
    expect(tasks.rows).toHaveLength(1);
  });

  it('replays the saved result for the same key and rejects a changed input', async () => {
    const client = await workspace();
    const hash = await moveHash({ actor: 'owner', action: 'a', input: { n: 1 } });
    await commitWrite(client, [moveStatement({ kind: 'a', actor: 'owner', key: 'tap-9', hash, result: { done: true } })]);
    expect(await findMoveReplay(client, 'tap-9', hash)).toEqual({ done: true });
    expect(await findMoveReplay(client, 'missing', hash)).toBeNull();
    const other = await moveHash({ actor: 'owner', action: 'a', input: { n: 2 } });
    await expect(findMoveReplay(client, 'tap-9', other)).rejects.toThrow('already used');
  });

  it('the event feed reads move through the view', async () => {
    const client = await workspace();
    const hash = await moveHash({ actor: 'owner', action: 'task.create', input: {} });
    await commitWrite(client, [moveStatement({ kind: 'task.create', actor: 'owner', key: 'tap-v', hash, result: { ok: 1 }, amount: 4500, why: 'drawer variance' })]);
    const view = await client.execute('SELECT kind, actor_id, idempotency_key, amount FROM events');
    expect(view.rows[0]).toMatchObject({ 0: 'task.create', 1: 'owner', 2: 'tap-v', 3: 4500 });
  });

  it('lastMoveId is the slice version and moves when a write lands', async () => {
    const client = await workspace();
    expect(await lastMoveId(client)).toBeNull();
    const hash = await moveHash({ actor: 'owner', action: 'a', input: {} });
    await commitWrite(client, [moveStatement({ kind: 'a', actor: 'owner', key: 'v1', hash, result: {} })]);
    const first = await lastMoveId(client);
    expect(first).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await commitWrite(client, [moveStatement({ kind: 'a', actor: 'owner', key: 'v2', hash, result: {} })]);
    expect(await lastMoveId(client)).not.toBe(first);
  });

  it('completing an inbox row closes only that row', async () => {
    const client = await workspace();
    const hash = await moveHash({ actor: 'owner', action: 'task.create', input: {} });
    await commitWrite(client, [
      inboxStatement({ member: 'owner', tool: 'task', reach: 'none', title: 'One' }),
      inboxStatement({ member: 'owner', tool: 'task', reach: 'none', title: 'Two' }),
      moveStatement({ kind: 'seed', actor: 'owner', key: 'seed', hash, result: {} }),
    ]);
    const rows = await readInbox(client, 'owner');
    await commitWrite(client, [completeInboxStatement(rows[0].id)]);
    const open = await readInbox(client, 'owner');
    expect(open).toHaveLength(1);
    expect(open[0].title).not.toBe(rows[0].title);
  });
});

describe('gates', () => {
  it('ask when a required input is missing', () => {
    expect(deriveGate({ action: { reach: 'data', requiredFields: ['name'] }, input: {} })).toBe('ask');
    expect(missingFields(['name', 'phone'], { name: 'Ada', phone: ' ' })).toEqual(['phone']);
  });

  it('approve for money and customer, auto only for none and data', () => {
    expect(deriveGate({ action: { reach: 'money', requiredFields: [] }, input: {} })).toBe('approve');
    expect(deriveGate({ action: { reach: 'customer', requiredFields: [] }, input: {} })).toBe('approve');
    expect(deriveGate({ action: { reach: 'data', requiredFields: [] }, input: {} })).toBe('auto');
    expect(deriveGate({ action: { reach: 'none', requiredFields: [] }, input: {} })).toBe('auto');
  });

  it('the floor keeps money off the auto path and demands the confirm', () => {
    expect(floorGate('money', 'auto')).toBe('approve');
    expect(floorGate('data', 'auto')).toBe('auto');
    expect(mayExecute('money', 'approve', undefined)).toBe(false);
    expect(mayExecute('money', 'approve', true)).toBe(true);
    expect(mayExecute('data', 'auto', undefined)).toBe(true);
  });
});
