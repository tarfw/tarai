/**
 * Public cart and checkout (parai §10, gap 1 / D11).
 *
 * The storefront shows a price and the buyer posts ids and counts; the order is priced
 * from catalog truth through the same `order.create` kernel the counter uses. These tests
 * pin that invariant: a tampered cart changes what is ordered, never what it costs.
 */

import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { parseCart, placeOrder, resolvePublicSite, type PublicSite } from '../src/site/checkout.ts';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.close()));

const site: PublicSite = {
  owner: 'owner_1', name: 'Slice House', slug: 'slice-house', databaseName: 'slice', databaseHost: 'slice',
};

async function workspace(options: { ordering?: boolean; channel?: string } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'tar-checkout-test-'));
  const client = createClient({ url: pathToFileURL(join(directory, 'workspace.db')).href });
  clients.push(client);
  for (const statement of WORKSPACE_SCHEMA) await client.execute(statement);
  const at = Date.now();
  const order = options.ordering !== false;
  const channel = options.channel || 'default';
  const doc = {
    schema: '2.0.0',
    revision: 1,
    brief: { goal: 'Pizza', audience: '', tone: '' },
    locale: 'en', timezone: 'Asia/Kolkata', currency: 'INR',
    design: {},
    assets: [],
    pages: [{ id: 'home', path: '/', title: 'Slice House', sections: [
      { id: 'catalog', purpose: 'catalog', layout: { kind: 'grid' }, nodes: [],
        bindings: [{ id: 'b', slot: 'items', query: 'catalog.public', version: 1, access: 'public', freshness: 300, params: { records: ['v_garlic'], channel } }] },
    ] }],
    redirects: [], locks: [],
    policy: { publicOrdering: order },
    blueprint: { profile: { models: ['products'] }, gate: { ok: true, missing: [] } },
  };
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('site_1','site','Slice House','live',?,'owner_1',1,?,?)", args: [JSON.stringify(doc), at, at] });
  // The owner publishes a variant with a current price in the public channel.
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('i_garlic','item','Garlic Bread','active','{\"tax\":500}','owner_1',1,?,?)", args: [at, at] });
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('v_garlic','variant','Garlic Bread','active','{\"item\":\"i_garlic\"}','owner_1',1,?,?)", args: [at, at] });
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('p_garlic','price','Price','active',?,'owner_1',1,?,?)",
    args: [JSON.stringify({ variant: 'v_garlic', amount: 15000, currency: 'INR', channel, starts: at - 1000 }), at, at] });
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('s_garlic','stock','Stock','active','{\"variant\":\"v_garlic\",\"location\":\"main\",\"onhand\":50,\"reserved\":0}','owner_1',1,?,?)", args: [at, at] });
  return client;
}

describe('public checkout', () => {
  it('parses only ids and counts, refusing prices or bad quantities from the browser', () => {
    expect(parseCart(JSON.stringify([{ variant: 'v_garlic', quantity: 2 }]))).toEqual([{ variant: 'v_garlic', quantity: 2 }]);
    expect(() => parseCart('not json')).toThrow();
    expect(() => parseCart([])).toThrow();
    expect(() => parseCart([{ variant: 'v_garlic', quantity: 0 }])).toThrow();
    expect(() => parseCart([{ variant: 'v_garlic', quantity: 1.5 }])).toThrow();
    expect(() => parseCart([{ variant: 'v_garlic', quantity: 1000 }])).toThrow();
    expect(() => parseCart([{ quantity: 1 }])).toThrow();
    expect(() => parseCart([{ variant: 'a', quantity: 1 }, { variant: 'a', quantity: 1 }])).toThrow();
  });

  it('places an order priced from catalog truth, ignoring any price the client sent', async () => {
    const client = await workspace();
    const result = await placeOrder(client, site, {
      slug: site.slug,
      // A hostile cart carries a price of 1 rupee; the server must ignore it.
      lines: [{ variant: 'v_garlic', quantity: 2, price: 1 }],
      name: 'Divya', phone: '+91 98765 43210', key: 'web-1',
    });
    // 2 x 15000 + 5% tax = 31500 minor units, from the stored price, not the sent one.
    expect(result.order.total).toBe(31500);
    expect(result.order.currency).toBe('INR');
    expect(result.lines).toEqual([{ title: 'Garlic Bread', quantity: 2, price: 31500 }]);
    const stored = await client.execute("SELECT data FROM records WHERE type='order' LIMIT 1");
    expect(JSON.parse(String(stored.rows[0].data)).total).toBe(31500);
  });

  it('prices in the channel the storefront showed, not a separate web channel', async () => {
    const client = await workspace({ channel: 'web' });
    const result = await placeOrder(client, site, { slug: site.slug, lines: [{ variant: 'v_garlic', quantity: 1 }], name: 'A', phone: '9876543210', key: 'web-2' });
    expect(result.order.total).toBe(15750);
  });

  it('refuses orders when the owner has not turned ordering on', async () => {
    const client = await workspace({ ordering: false });
    await expect(placeOrder(client, site, { slug: site.slug, lines: [{ variant: 'v_garlic', quantity: 1 }], name: 'A', phone: '9876543210', key: 'web-3' }))
      .rejects.toThrow('not taking orders');
  });

  it('requires a reachable buyer and rejects a filled honeypot', async () => {
    const client = await workspace();
    await expect(placeOrder(client, site, { slug: site.slug, lines: [{ variant: 'v_garlic', quantity: 1 }], name: '', phone: '', key: 'web-4' })).rejects.toThrow();
    await expect(placeOrder(client, site, { slug: site.slug, lines: [{ variant: 'v_garlic', quantity: 1 }], name: 'A', phone: '9876543210', extra: 'bot', key: 'web-5' })).rejects.toThrow('rejected');
  });

  it('reuses one contact for a repeat buyer and reserves stock', async () => {
    const client = await workspace();
    const first = await placeOrder(client, site, { slug: site.slug, lines: [{ variant: 'v_garlic', quantity: 1 }], name: 'Divya', phone: '9876543210', key: 'web-6' });
    const second = await placeOrder(client, site, { slug: site.slug, lines: [{ variant: 'v_garlic', quantity: 1 }], name: 'Divya', phone: '9876543210', key: 'web-7' });
    expect(first.order.id).not.toBe(second.order.id);
    const people = await client.execute("SELECT id FROM records WHERE type='person'");
    expect(people.rows).toHaveLength(1);
    const stock = await client.execute("SELECT data FROM records WHERE type='stock' LIMIT 1");
    expect(Number(JSON.parse(String(stock.rows[0].data)).reserved)).toBe(2);
  });

  it('resolves only published, active stores', async () => {
    const control = {
      withSession: () => ({ prepare: () => ({ bind: () => ({ first: async () => ({ owner_id: 'owner_1', name: 'Slice House', slug: 'slice-house', database_name: 'slice', database_host: 'slice' }) }) }) }),
    } as unknown as D1Database;
    expect((await resolvePublicSite(control, 'slice-house')).owner).toBe('owner_1');
    const missing = {
      withSession: () => ({ prepare: () => ({ bind: () => ({ first: async () => null }) }) }),
    } as unknown as D1Database;
    await expect(resolvePublicSite(missing, 'gone')).rejects.toThrow('not open');
  });
});