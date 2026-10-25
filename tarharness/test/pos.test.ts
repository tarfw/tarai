import { createClient } from '@libsql/client';
import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { executeGateway } from '../src/gateway/actions.ts';
import { posSummary, readPos } from '../src/pos/store.ts';
import type { AccessContext } from '../src/types.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.close());
});
const access: AccessContext = {
  identity: { id: 'owner', email: 'owner@example.com', name: 'Owner' },
  workspace: { id: 'ws', name: 'Shop', slug: 'shop', mode: 'work', databaseName: 'shop', databaseHost: 'shop', state: 'active' },
  member: { workspaceId: 'ws', userId: 'owner', role: 'owner', state: 'active' },
};
async function fixture() {
  // The native libsql driver retains transaction handles until process exit on Windows.
  const directory = mkdtempSync(join(tmpdir(), 'tar-pos-test-'));
  const client = createClient({ url: pathToFileURL(join(directory, 'workspace.db')).href }); clients.push(client);
  for (const sql of WORKSPACE_SCHEMA) await client.execute(sql);
  const run = (actionId: string, input: Record<string, unknown>, key: string = crypto.randomUUID(), context = access) =>
    Effect.runPromise(executeGateway(client, context, { actionId, input, idempotencyKey: key }));
  await run('capability.save', { module: 'pos', enabled: true, baseVersion: 0 });
  await run('pos.setup', { name: 'Shop', currency: 'INR', timezone: 'Asia/Kolkata', location: 'Main' });
  const result = await run('pos.product.save', { title: 'Tea', price: 1001, stock: 5, taxBps: 500, lowStock: 2, barcode: 'TEA' });
  const product = result.product as { id: string; version: number };
  await run('pos.register.open', { opening: 10000 });
  const sale = { items: [{ productId: product.id, quantity: 2, version: product.version }], method: 'cash', discountBps: 1000, expectedTotal: 1892, tendered: 2000 };
  return { client, run, product, sale };
}
describe('POS ledger', { timeout: 60000 }, () => {
  it('commits server-priced sale, stock, receipt and cash balance exactly once', async () => {
    const { client, run, product, sale } = await fixture();
    const first = await run('pos.checkout', sale, 'sale-once');
    expect(await run('pos.checkout', sale, 'sale-once')).toEqual(first);
    expect((first.posting as { data: { debit: number; credit: number; lines: { account: string; credit?: number }[] } }).data).toMatchObject({ debit: 1892, credit: 1892 });
    const order = first.order as { data: Record<string, unknown> };
    expect(order.data).toMatchObject({ subtotal: 2002, discount: 200, tax: 90, total: 1892, change: 108 });
    const stock = await client.execute({ sql: 'SELECT data FROM records WHERE id=?', args: [product.id] });
    expect(JSON.parse(String(stock.rows[0].data)).stock).toBe(3);
    const overview = await readPos(client, access, 'overview');
    expect(overview.register).toMatchObject({ expected: 11892 });
    expect(await posSummary(client)).toMatchObject({ sales: 1892, orders: 1, lowStock: 0 });
  });
  it('rolls back a bad total or stock shortage without payments', async () => {
    const { client, run, sale } = await fixture();
    await expect(run('pos.checkout', { ...sale, expectedTotal: 1 })).rejects.toThrow('Total changed');
    await expect(run('pos.checkout', { ...sale, items: [{ ...sale.items[0], quantity: 6 }] })).rejects.toThrow('Not enough stock');
    expect((await client.execute("SELECT id FROM records WHERE type IN ('pos.order','pos.payment')")).rows).toHaveLength(0);
  });
  it('rejects stale products and reuse of a payment key with changed input', async () => {
    const { run, sale, product } = await fixture();
    await run('pos.checkout', sale, 'fixed-key');
    await expect(run('pos.checkout', { ...sale, tendered: 3000 }, 'fixed-key')).rejects.toThrow('different input');
    await expect(run('pos.checkout', { ...sale, items: [{ productId: product.id, quantity: 1, version: product.version }] })).rejects.toThrow('changed');
  });
  it('records UPI separately from cash and rejects duplicate references', async () => {
    const { client, run, sale } = await fixture();
    const upi = { ...sale, method: 'upi', reference: 'UTR-123', received: true };
    await expect(run('pos.checkout', { ...upi, received: false })).rejects.toThrow('Confirm UPI');
    await run('pos.checkout', upi);
    expect((await readPos(client, access, 'overview')).register).toMatchObject({ expected: 10000 });
    await expect(run('pos.checkout', upi)).rejects.toThrow('already recorded');
  });
  it('returns a sale once, restores stock and reconciles the register', async () => {
    const { client, run, sale, product } = await fixture();
    const { order } = await run('pos.checkout', sale) as { order: { id: string } };
    await run('pos.refund', { orderId: order.id, reason: 'Wrong item', restock: true, returned: true });
    const postings = await client.execute("SELECT data FROM records WHERE type='posting'");
    expect(postings.rows).toHaveLength(2);
    expect(postings.rows.map((row) => JSON.parse(String(row.data)).debit)).toEqual([1892, 1892]);
    await expect(run('pos.refund', { orderId: order.id, reason: 'Again', returned: true })).rejects.toThrow('already been returned');
    const stock = await client.execute({ sql: 'SELECT data FROM records WHERE id=?', args: [product.id] });
    expect(JSON.parse(String(stock.rows[0].data)).stock).toBe(5);
    const overview = await readPos(client, access, 'overview');
    const session = overview.register as { id: string };
    const closed = await run('pos.register.close', { registerId: session.id, counted: 9900 });
    expect(closed.register).toMatchObject({ state: 'closed', data: { expected: 10000, difference: -100 } });
    await expect(run('pos.checkout', sale)).rejects.toThrow('Open the register');
  });
  it('protects managed retail records and admin-only actions', async () => {
    const { run, product } = await fixture();
    const member: AccessContext = { ...access, member: { ...access.member, role: 'member' } };
    await expect(run('pos.product.save', {}, undefined, member)).rejects.toThrow();
    await expect(run('record.update', { recordId: product.id, baseVersion: 1, title: 'Tampered' }, undefined, member)).rejects.toThrow();
    await expect(run('record.create', { type: 'pos.product', title: 'Bypass' })).rejects.toThrow();
    await expect(run('pos.setup', { name: 'Shop', currency: 'USD', timezone: 'UTC' })).rejects.toThrow('Currency cannot change');
  });
  it('stores compact catalog fields and enforces unique SKUs', async () => {
    const { client, run } = await fixture();
    await run('pos.product.save', { title: 'Coffee', price: 2500, cost: 1400, stock: 8, taxBps: 500, lowStock: 3, sku: 'COF-250', barcode: '890000000001', category: 'Beverages', brand: 'TAR', unit: 'bag', supplier: 'Local roaster', shortDescription: 'Medium roast coffee.' });
    const products = await readPos(client, access, 'products', 'Coffee') as { items: { data: Record<string, unknown> }[] };
    expect(products.items[0].data).toMatchObject({ cost: 1400, sku: 'COF-250', category: 'Beverages', brand: 'TAR', unit: 'bag', supplier: 'Local roaster' });
    await expect(run('pos.product.save', { title: 'Duplicate', price: 100, stock: 1, taxBps: 0, lowStock: 0, sku: 'COF-250' })).rejects.toThrow('SKU already');
  });
  it('allocates partial refund rounding without over-refunding', async () => {
    const { client, run, sale } = await fixture();
    const { order } = await run('pos.checkout', sale) as { order: { id: string } };
    const input = { orderId: order.id, reason: 'One item', returned: true, restock: true, quantities: { [sale.items[0].productId]: 1 } };
    const partial = await run('pos.refund', input);
    expect(partial.order).toMatchObject({ state: 'partially_refunded', data: { refundedTotal: 946 } });
    await run('pos.refund', input);
    expect(await posSummary(client)).toMatchObject({ sales: 0 });
    await expect(run('pos.refund', input)).rejects.toThrow('already been returned');
  });
  it('records retail mutations directly without manufacturing a Flow run', async () => {
    const { client, run, sale } = await fixture();
    await run('pos.checkout', sale, 'sale-run');
    const runs = await client.execute("SELECT flow_id,state FROM runs WHERE occurrence='sale-run'");
    expect(runs.rows).toHaveLength(0);
    const events = await client.execute("SELECT action_id,run_id FROM events WHERE idempotency_key='sale-run'");
    expect(events.rows[0]).toMatchObject({ action_id: 'pos.checkout', run_id: null });
  });
});
