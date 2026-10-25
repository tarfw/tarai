import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { buildClose, monthlyWriteCount, pruneHotWindow } from '../src/cost/close.ts';
import { commitWrite, moveHash, moveStatement } from '../src/truth/write.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => { clients.splice(0).forEach((client) => client.close()); });

async function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'tar-cost-test-'));
  const client = createClient({ url: pathToFileURL(join(directory, 'workspace.db')).href }); clients.push(client);
  for (const sql of WORKSPACE_SCHEMA) await client.execute(sql);
  return client;
}

const OLD = Date.now() - 120 * 24 * 60 * 60_000; // beyond the 90-day window

describe('cost guard', () => {
  it('aggregates the month, seals it, and the seal covers the prune', async () => {
    const client = await workspace();
    const oldHash = await moveHash({ actor: 'owner', action: 'sale.write', input: { n: 1 } });
    const nowHash = await moveHash({ actor: 'owner', action: 'sale.write', input: { n: 2 } });
    await commitWrite(client, [
      moveStatement({ kind: 'sale.write', actor: 'owner', key: 'old-1', hash: oldHash, result: { posting: { data: { lines: [{ account: 'cash', debit: 100 }, { account: 'revenue', credit: 100 }] } } }, createdAt: OLD } as never),
    ]);
    await client.execute({ sql: 'UPDATE move SET created_at=? WHERE idempotency_key=?', args: [OLD, 'old-1'] });
    await commitWrite(client, [moveStatement({ kind: 'sale.write', actor: 'owner', key: 'now-1', hash: nowHash, result: {} })]);

    const month = new Date(OLD); const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
    const seal = await buildClose(client, 'ws_test', key);
    expect(seal).not.toBeNull();
    expect(seal!.moveCount).toBe(1);
    expect(seal!.totals).toEqual({ cash: 100, revenue: -100 });
    expect(seal!.hash).toMatch(/^[0-9a-f]{64}$/);

    // stamp the close (the R2 put is skipped in test), then prune
    await client.execute({ sql: `INSERT INTO current (kind,key,data) VALUES ('close',?,?) ON CONFLICT(kind,key) DO UPDATE SET data=excluded.data`, args: [key, JSON.stringify({ hash: seal!.hash })] });
    const pruned = await pruneHotWindow(client);
    expect(pruned).toBe(1);
    const remaining = await client.execute('SELECT idempotency_key FROM move');
    expect(remaining.rows.map((row) => String(row[0]))).toEqual(['now-1']);
  });

  it('the ceiling counts this month\u2019s writes only', async () => {
    const client = await workspace();
    expect(await monthlyWriteCount(client)).toBe(0);
    const hash = await moveHash({ actor: 'owner', action: 'a', input: {} });
    await commitWrite(client, [moveStatement({ kind: 'a', actor: 'owner', key: 'c-1', hash, result: {} })]);
    expect(await monthlyWriteCount(client)).toBe(1);
    const oldHash = await moveHash({ actor: 'owner', action: 'a', input: { x: 1 } });
    await commitWrite(client, [moveStatement({ kind: 'a', actor: 'owner', key: 'c-old', hash: oldHash, result: {} })]);
    await client.execute({ sql: 'UPDATE move SET created_at=? WHERE idempotency_key=?', args: [OLD, 'c-old'] });
    expect(await monthlyWriteCount(client)).toBe(1);
  });
});
