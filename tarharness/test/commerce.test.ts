import { createClient } from '@libsql/client';
import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { executeGateway } from '../src/gateway/actions.ts';
import type { AccessContext } from '../src/types.ts';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.close()));
const access: AccessContext = {
  identity: { id: 'owner', email: 'owner@example.com', name: 'Owner' },
  workspace: { id: 'ws', name: 'Business', slug: 'business', mode: 'work', databaseName: 'business', databaseHost: 'db', state: 'active' },
  member: { workspaceId: 'ws', userId: 'owner', role: 'owner', state: 'active', workRole: 'general' },
};

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'tar-commerce-test-'));
  const client = createClient({ url: pathToFileURL(join(directory, 'workspace.db')).href }); clients.push(client);
  for (const sql of WORKSPACE_SCHEMA) await client.execute(sql);
  const run = (actionId: any, input: Record<string, unknown>, key: string = crypto.randomUUID()) => Effect.runPromise(executeGateway(client, access, { actionId, input, idempotencyKey: key }));
  const supplier = (await run('organization.create', { name: 'Supplier' })).record as { id: string };
  const item = (await run('catalog.item.save', { name: 'Tea', sku: 'TEA' })).item as { id: string };
  const variant = (await run('catalog.variant.save', { item: item.id, name: 'Tea 250g', sku: 'TEA-250' })).variant as { id: string };
  await run('price.set', { variant: variant.id, amount: 12500, currency: 'INR' });
  await run('stock.adjust', { variant: variant.id, quantity: 10, reason: 'Opening count' });
  return { client, run, supplier, item, variant };
}

describe('commerce core', { timeout: 60000 }, () => {
  it('reserves, fulfils, invoices, receives payment and records a balanced refund', async () => {
    const { client, run, variant } = await fixture();
    const order = (await run('order.create', { lines: [{ variant: variant.id, quantity: 2 }] }, 'order-once')).order as { id: string; version: number; data: { total: number } };
    expect((await run('order.create', { lines: [{ variant: variant.id, quantity: 2 }] }, 'order-once')).order).toEqual(order);
    expect(order.data.total).toBe(25000);
    await run('order.fulfill', { order: order.id, version: order.version });
    const invoice = (await run('invoice.issue', { order: order.id })).invoice as { id: string };
    const paid = await run('payment.record', { invoice: invoice.id, amount: 25000, method: 'upi', reference: 'pay-1' });
    const payment = paid.payment as { id: string };
    expect(paid.invoice).toMatchObject({ state: 'paid', paid: 25000 });
    expect((await run('refund.record', { payment: payment.id, amount: 5000, reason: 'Partial return', reference: 'refund-1' })).invoice).toMatchObject({ state: 'paid', paid: 20000, refunded: 5000, net: 20000 });
    const stock = await client.execute({ sql: "SELECT data FROM records WHERE type='stock' AND json_extract(data,'$.variant')=?", args: [variant.id] });
    expect(JSON.parse(String(stock.rows[0].data))).toMatchObject({ onhand: 8, reserved: 0 });
    const postings = await client.execute("SELECT data FROM records WHERE type='posting'");
    expect(postings.rows).toHaveLength(3);
    for (const row of postings.rows) { const data = JSON.parse(String(row.data)); expect(data.debit).toBe(data.credit); }
  });

  it('receives a purchase atomically and rejects over-receipt', async () => {
    const { client, run, supplier, variant } = await fixture();
    const purchase = (await run('purchase.create', { supplier: supplier.id, currency: 'INR', lines: JSON.stringify([{ variant: variant.id, quantity: 5, cost: 8000 }]) })).purchase as { id: string; version: number };
    await expect(run('purchase.receive', { purchase: purchase.id, version: purchase.version, lines: [{ variant: variant.id, quantity: 6 }] })).rejects.toThrow('exceeds');
    const partial = await run('purchase.receive', { purchase: purchase.id, version: purchase.version, lines: [{ variant: variant.id, quantity: 2 }] });
    expect(partial.purchase).toMatchObject({ state: 'partial', version: purchase.version + 1 });
    expect((partial.receipt as { data: { amount: number } }).data.amount).toBe(16000);
    const received = await run('purchase.receive', { purchase: purchase.id, version: purchase.version + 1 });
    expect(received.purchase).toMatchObject({ state: 'received' });
    const stock = await client.execute({ sql: "SELECT data FROM records WHERE type='stock' AND json_extract(data,'$.variant')=?", args: [variant.id] });
    expect(JSON.parse(String(stock.rows[0].data)).onhand).toBe(15);
    const posting = await client.execute("SELECT data FROM records WHERE type='posting'");
    expect(posting.rows).toHaveLength(2);
    expect(posting.rows.map((row) => JSON.parse(String(row.data)).debit)).toEqual([16000, 24000]);
  });

  it('revises catalog records with versions and prevents duplicate identifiers', async () => {
    const { run, item, variant } = await fixture();
    const current = (await run('catalog.variant.save', { id: variant.id, version: 1, item: item.id, name: 'Tea 250g', sku: 'TEA-250', barcode: '8901', attributes: { size: '250g' } })).variant as { id: string; version: number; data: { barcode: string } };
    expect(current).toMatchObject({ id: variant.id, version: 2, data: { barcode: '8901' } });
    await expect(run('catalog.variant.save', { id: variant.id, version: 1, item: item.id, name: 'Stale', sku: 'TEA-250' })).rejects.toThrow('changed');
    await expect(run('catalog.variant.save', { item: item.id, name: 'Duplicate', sku: 'TEA-250' })).rejects.toThrow('already belongs');
  });

  it('keeps prices and stock scoped by channel and location, and rejects unavailable lines atomically', async () => {
    const { client, run, variant } = await fixture();
    await run('stock.adjust', { variant: variant.id, location: 'warehouse', quantity: 4, reason: 'Opening count' });
    await run('price.set', { variant: variant.id, amount: 15000, currency: 'INR', channel: 'web' });
    const web = (await run('order.create', { lines: [{ variant: variant.id, quantity: 3 }], location: 'warehouse', channel: 'web' })).order as { data: { total: number; location: string; channel: string } };
    expect(web.data).toMatchObject({ total: 45000, location: 'warehouse', channel: 'web' });
    await expect(run('order.create', { lines: [{ variant: variant.id, quantity: 2 }], location: 'warehouse', channel: 'web' })).rejects.toThrow('insufficient');
    const stocks = await client.execute({ sql: "SELECT data FROM records WHERE type='stock' AND json_extract(data,'$.variant')=?", args: [variant.id] });
    expect(stocks.rows.map((row) => JSON.parse(String(row.data)))).toEqual(expect.arrayContaining([
      expect.objectContaining({ location: 'main', onhand: 10, reserved: 0 }),
      expect.objectContaining({ location: 'warehouse', onhand: 4, reserved: 3 }),
    ]));
  });

  it('deduplicates provider references and keeps invoice balance aligned with refunds', async () => {
    const { run, variant } = await fixture();
    const order = (await run('order.create', { lines: [{ variant: variant.id, quantity: 1 }] })).order as { id: string; version: number };
    await run('order.fulfill', { order: order.id, version: order.version });
    const invoice = (await run('invoice.issue', { order: order.id })).invoice as { id: string; data: { total: number; lines: unknown[] } };
    expect(invoice.data.lines).toHaveLength(1);
    const first = (await run('payment.record', { invoice: invoice.id, amount: 5000, method: 'upi', provider: 'bank', reference: 'u-1' })).payment as { id: string };
    await expect(run('payment.record', { invoice: invoice.id, amount: 1000, method: 'upi', provider: 'bank', reference: 'u-1' })).rejects.toThrow('already recorded');
    const second = (await run('payment.record', { invoice: invoice.id, amount: 7500, method: 'cash' })).payment as { id: string };
    await run('refund.record', { payment: first.id, amount: 2000, reason: 'Return', provider: 'bank', reference: 'r-1' });
    await expect(run('refund.record', { payment: second.id, amount: 1000, reason: 'Return', provider: 'bank', reference: 'r-1' })).rejects.toThrow('already recorded');
    await expect(run('payment.record', { invoice: invoice.id, amount: 1, method: 'cash' })).rejects.toThrow('open invoice balance');
  });

  it('creates product bundle with variants, price and stock atomically', async () => {
    const { client, run } = await fixture();
    const result = await run('catalog.item.save', {
      name: 'Semparuthi Pattu Selai',
      sku: 'SEMP-PATTU',
      category: 'Kaithari Pattu Selaigal',
      price: 820000,
      mrp: 950000,
      stock: 12,
      tax: 500,
      photoUrl: 'https://example.com/pattu.jpg',
      variants: [
        { name: 'Semparuthi Pattu Selai (4-Muzham)', option: '4-Muzham', dimension: 'length', price: 450000, stock: 5 },
        { name: 'Semparuthi Pattu Selai (8-Muzham)', option: '8-Muzham', dimension: 'length', price: 820000, stock: 7 },
      ],
    });
    const item = result.item as { id: string; title: string; data: { sku: string; category: string; price: number } };
    expect(item.title).toBe('Semparuthi Pattu Selai');
    expect(item.data.category).toBe('Kaithari Pattu Selaigal');
    expect(item.data.price).toBe(820000);

    // Verify variants created
    const variants = await client.execute({ sql: "SELECT * FROM records WHERE type='variant' AND json_extract(data,'$.item')=?", args: [item.id] });
    expect(variants.rows).toHaveLength(2);

  });
});
