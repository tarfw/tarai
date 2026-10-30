import { createClient } from '@libsql/client';
import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { executeGateway } from '../src/gateway/actions.ts';
import { cardDeck, deckStatement } from '../src/tools/registry.ts';
import { commitWrite, readInbox } from '../src/truth/write.ts';
import type { AccessContext } from '../src/types.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => { clients.splice(0).forEach((client) => client.close()); });
const owner: AccessContext = {
  identity: { id: 'owner', email: 'owner@example.com', name: 'Owner' },
  workspace: { id: 'ws', name: 'Tea Stall', slug: 'tea', mode: 'work', databaseName: 'tea', databaseHost: 'tea', state: 'active' },
  member: { workspaceId: 'ws', userId: 'owner', role: 'owner', state: 'active' },
};

async function stall() {
  const directory = mkdtempSync(join(tmpdir(), 'tar-sale-test-'));
  const client = createClient({ url: pathToFileURL(join(directory, 'workspace.db')).href }); clients.push(client);
  for (const sql of WORKSPACE_SCHEMA) await client.execute(sql);
  await commitWrite(client, [deckStatement(cardDeck('food'))]);
  const run = (actionId: any, input: Record<string, unknown>, key: string = crypto.randomUUID(), context = owner) =>
    Effect.runPromise(executeGateway(client, context, { actionId, input, idempotencyKey: key }));
  await run('catalog.item.save', { name: 'Chai', sku: 'CHAI', price: 1000, stock: 10, tax: 500 });
  const variant = await client.execute("SELECT id FROM records WHERE type='variant' AND archived IS NULL LIMIT 1");
  return { client, run, variantId: String(variant.rows[0][0]) };
}

describe('the counter sale, end to end', () => {
  it('one tap writes order + invoice + payment + stock + posting, refreshes cards, keeps replay safe', async () => {
    const { client, run, variantId } = await stall();
    const first = await run('sale.write', { lines: [{ variant: variantId, quantity: 2 }], method: 'cash', tendered: 2500 }, 'tap-1');
    const sale = first.sale as { total: number; tax: number; change: number };
    // 2 x Rs 10 + 5% tax = Rs 21; change from Rs 25 = Rs 4
    expect(sale).toMatchObject({ total: 2100, tax: 100, change: 400 });
    // one commit, one ledger row, balanced postings
    const moves = await client.execute("SELECT kind, action_id FROM move WHERE action_id='sale.write'");
    expect(moves.rows).toHaveLength(1);
    const postings = await client.execute("SELECT data FROM records WHERE type='posting'");
    const lines = JSON.parse(String(postings.rows[0][0])).lines as { account: string; debit?: number; credit?: number }[];
    expect(lines).toEqual([{ account: 'cash', debit: 2100 }, { account: 'revenue', credit: 2000 }, { account: 'tax', credit: 100 }]);
    // stock consumed, never negative
    const stock = JSON.parse(String((await client.execute("SELECT data FROM records WHERE type='stock' AND archived IS NULL LIMIT 1")).rows[0][0]));
    expect(stock.onhand).toBe(8);
    // the card numbers moved with the sale
    const pos = JSON.parse(String((await client.execute("SELECT data FROM current WHERE kind='card' AND key='pos'")).rows[0][0]));
    expect(pos.salesToday).toBe(2100);
    expect(pos.billsToday).toBe('1');
    // no drawer is open in this test, so the register card tells the truth
    const register = JSON.parse(String((await client.execute("SELECT data FROM current WHERE kind='card' AND key='register'")).rows[0][0]));
    expect(register.cashOnHand).toBe('closed');
    // replay returns the same sale, writes nothing new
    const replay = await run('sale.write', { lines: [{ variant: variantId, quantity: 2 }], method: 'cash', tendered: 2500 }, 'tap-1');
    expect((replay.sale as { total: number }).total).toBe(2100);
    const after = await client.execute("SELECT COUNT(*) FROM move WHERE action_id='sale.write'");
    expect(Number(after.rows[0][0])).toBe(1);
    // a sale past the stock floor refuses everything
    await expect(run('sale.write', { lines: [{ variant: variantId, quantity: 99 }], method: 'cash' })).rejects.toThrow('insufficient');
    const stillOpen = await client.execute("SELECT COUNT(*) FROM records WHERE type='order'");
    expect(Number(stillOpen.rows[0][0])).toBe(1);
  });

  it('register open, count and close: expected cash follows the sale, variance alerts the owner', async () => {
    const { client, run, variantId } = await stall();
    await run('register.open', { opening: 5000 }, 'reg-1');
    await run('sale.write', { lines: [{ variant: variantId, quantity: 1 }], method: 'cash' }, 'sale-a');
    const registerRow = await client.execute("SELECT id FROM records WHERE type='register' AND state='open'");
    const registerId = String(registerRow.rows[0][0]);
    const counted = await run('register.count', { register: registerId, counted: 6050 }, 'cnt-1');
    // opening 50 + sale 10.50 = 60.50 expected; counted 60.50 = no variance
    expect(counted.register).toMatchObject({ expected: 6050, counted: 6050, variance: 0 });
    const closed = await run('register.close', { register: registerId, counted: 7000 }, 'close-1');
    expect(closed.register).toMatchObject({ state: 'closed', variance: 950 });
    // the variance is the owner's urgent NEXT row
    const rows = await readInbox(client, 'owner');
    const alert = rows.find((row) => row.tool === 'register');
    expect(alert).toMatchObject({ urgent: true, title: 'Cash drawer out Rs. 9.50' });
  });
});
