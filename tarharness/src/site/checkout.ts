/**
 * Public checkout (parai §10, gap 1): the buyer's cart becomes an order.
 *
 * Money stays code-owned. The storefront sends variant ids and quantities only; this
 * module re-prices every line from current catalog truth through the same `order.create`
 * kernel the counter uses, so a tampered cart can change what is ordered but never the
 * price. It resolves the workspace from the published site, refuses stores that have not
 * turned ordering on, and never records a payment — money is confirmed by the merchant or
 * a gateway, both of which hold the reference this endpoint deliberately does not accept.
 */

import type { Client } from '@libsql/client/web';
import { badRequest, conflict, notFound } from '../errors.ts';
import type { AccessContext } from '../types.ts';
import { executeCommerce } from '../commerce/store.ts';

export interface CheckoutInput {
  /** Published workspace slug, resolved by the storefront edge and trusted only as a key. */
  slug: string;
  /** Variant id and quantity per line, as the browser sent them. */
  lines: unknown;
  /** Buyer's own words; stored so the merchant knows who to reach. */
  name?: unknown;
  phone?: unknown;
  note?: unknown;
  /** Hidden field a bot fills; a human leaves it empty. */
  extra?: unknown;
  /** Idempotency key so a double tap is one order. */
  key: string;
}

export interface PublicSite {
  readonly owner: string;
  readonly name: string;
  readonly slug: string;
  readonly databaseName: string;
  readonly databaseHost: string;
}

export interface CheckoutResult {
  readonly order: { id: string; state: string; total: number; currency: string };
  readonly lines: { title: string; quantity: number; price: number }[];
}

const text = (value: unknown, max = 200): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const json = (value: unknown) => JSON.stringify(value);

/** Parse the cart the browser posted: ids and counts only, never prices. */
export function parseCart(raw: unknown): { variant: string; quantity: number }[] {
  let source = raw;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch { throw badRequest('The cart is not valid.'); }
  }
  if (!Array.isArray(source) || !source.length || source.length > 50) throw badRequest('Add between 1 and 50 items.');
  const lines = source.map((entry) => {
    const line = entry !== null && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const variant = text(line.variant ?? line.id, 160);
    const quantity = Number(line.quantity ?? line.count);
    if (!variant) throw badRequest('Every cart line needs an item.');
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) throw badRequest('Choose a quantity between 1 and 999.');
    return { variant, quantity };
  });
  if (new Set(lines.map((line) => line.variant)).size !== lines.length) throw badRequest('Combine duplicate items into one line.');
  return lines;
}

/** A checkout is public, but a store must have published and turned ordering on. */
export async function resolvePublicSite(control: D1Database, slug: string): Promise<PublicSite> {
  const row = await control.withSession('first-primary').prepare(
    "SELECT w.owner_id,w.name,w.slug,w.database_name,w.database_host FROM workspaces w JOIN sites s ON s.workspace=w.id WHERE w.slug=? AND w.state='active' AND s.status='active' AND s.release<>'' LIMIT 1",
  ).bind(slug).first<{ owner_id: string; name: string; slug: string; database_name: string; database_host: string | null }>();
  if (!row || !row.database_host) throw notFound('This store is not open for orders.');
  return { owner: row.owner_id, name: row.name, slug: row.slug, databaseName: row.database_name, databaseHost: row.database_host };
}

/** The owner's stored policy and price channel, read from the live document (D11). */
export async function checkoutPolicy(client: Client): Promise<{ open: boolean; channel: string }> {
  const found = await client.execute("SELECT data FROM records WHERE type='site' AND archived IS NULL ORDER BY CASE WHEN state='live' THEN 0 ELSE 1 END,updated DESC LIMIT 1");
  if (!found.rows[0]) return { open: false, channel: 'default' };
  try {
    const doc = JSON.parse(String(found.rows[0].data)) as {
      policy?: { publicOrdering?: boolean };
      pages?: { sections?: { bindings?: { params?: { channel?: string } }[] }[] }[];
    };
    // The buyer pays the price the storefront showed: the channel its catalog is bound to.
    const channel = doc.pages?.flatMap((page) => page.sections || [])
      .flatMap((section) => section.bindings || [])
      .map((binding) => binding.params?.channel)
      .find((value): value is string => typeof value === 'string' && value.length > 0) || 'default';
    return { open: doc.policy?.publicOrdering === true, channel };
  } catch {
    return { open: false, channel: 'default' };
  }
}

/** The buyer becomes a contact the merchant can reach, reused when the phone already is one. */
async function customerFor(client: Client, site: PublicSite, name: string, phone: string, note: string): Promise<string> {
  const digits = phone.replace(/[^0-9]/g, '');
  const existing = await client.execute({
    sql: "SELECT id FROM records WHERE type='person' AND json_extract(data,'$.phone')=? AND archived IS NULL LIMIT 1",
    args: [phone],
  });
  if (existing.rows[0]) return String(existing.rows[0].id);
  const id = `rec_${crypto.randomUUID()}`;
  const at = Date.now();
  await client.execute({
    sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES(?,'person',?,'active',?,?,1,?,?)",
    args: [id, name.slice(0, 160), json({ phone, ...(note ? { note } : {}), source: 'web', digits }), site.owner, at, at],
  });
  return id;
}

/**
 * Place one order from a public cart. Pricing, stock reservation and the order record come
 * from `order.create`, so the storefront and the counter cannot disagree about money.
 */
export async function placeOrder(client: Client, site: PublicSite, input: CheckoutInput): Promise<CheckoutResult> {
  if (text(input.extra)) throw badRequest('This order was rejected.');
  const policy = await checkoutPolicy(client);
  if (!policy.open) throw conflict('This store is not taking orders online yet.');
  const lines = parseCart(input.lines);
  const name = text(input.name, 120);
  const phone = text(input.phone, 40);
  if (!name || phone.replace(/[^0-9]/g, '').length < 6) throw badRequest('Add your name and a phone number so the shop can reach you.');

  const customer = await customerFor(client, site, name, phone, text(input.note, 300));

  // The order is committed as the owner's, so it lands in their Now feed like any counter sale.
  const context: AccessContext = {
    identity: { id: site.owner, email: '', name },
    workspace: { id: '', name: site.name, slug: site.slug, mode: 'work', databaseName: site.databaseName, databaseHost: site.databaseHost, state: 'active' },
    member: { workspaceId: '', userId: site.owner, role: 'owner', state: 'active' },
  };
  const result = await executeCommerce(client, context, 'order.create', {
    lines,
    channel: policy.channel,
    location: 'main',
    customer,
  }, input.key, `public:${input.key}`) as { order: { id: string; state: string; data: Record<string, unknown> } };

  const data = result.order.data || {};
  const priced = Array.isArray(data.lines) ? data.lines as Record<string, unknown>[] : [];
  return {
    order: {
      id: result.order.id,
      state: result.order.state,
      total: Number(data.total || 0),
      currency: String(data.currency || 'INR'),
    },
    lines: priced.map((line) => ({
      title: String(line.title || 'Item'),
      quantity: Number(line.quantity || 0),
      price: Number(line.total || 0),
    })),
  };
}