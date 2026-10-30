// The 14-tool registry: one row per tool, the only menu. A tool is an entry,
// never a screen; the shape (list, sale, chat, sheet) decides the route. At
// birth Jev names the nature and code deals the cards from the recipes; after
// that cards are Jev's stack — the owner names a job, one plan is confirmed.

import type { Client } from '@libsql/client/web';
import { badRequest } from '../errors.ts';
import { formatMoney } from '../money.ts';

export const TOOL_IDS = ['pos', 'order', 'invoice', 'payment', 'register', 'catalog', 'stock', 'purchase', 'expense', 'contact', 'member', 'site', 'task', 'channel'] as const;
export type ToolId = typeof TOOL_IDS[number];

export type Shape = 'list' | 'sale' | 'chat' | 'sheet' | 'site';
export type ToolReach = 'none' | 'data' | 'customer' | 'money';
export type Nature = 'food' | 'shop' | 'service' | 'general';

export interface ToolTap {
  readonly action: string | null;
  readonly label: string;
}

export interface ToolCard {
  /** Card title, uppercase on the Canvas */
  readonly title: string;
  /** The ONE number, chosen by role: money for the owner, counts for the member. */
  readonly number: { readonly owner: string; readonly member: string };
  readonly tap: ToolTap;
}

export interface ToolDefinition {
  readonly id: ToolId;
  readonly reach: ToolReach;
  /** list | sale | chat | sheet — the route this tool renders through */
  readonly shape: Shape;
  /** record type the list shape lists (rows + the number + the one tap) */
  readonly rowType: string | null;
  readonly card: ToolCard;
  /** every registered action this tool owns. an action belongs to exactly one tool */
  readonly actions: readonly string[];
  /** natures whose birth recipe deals this card. empty = every nature */
  readonly natures: readonly Nature[];
  /** a tool with no core flow is deferred, not built */
  readonly deferred?: boolean;
}

const card = (title: string, owner: string, member: string, label: string, action: string | null = null): ToolCard => ({ title, number: { owner, member }, tap: { action, label } });

export const TOOLS: readonly ToolDefinition[] = [
  { id: 'pos', reach: 'money', shape: 'sale', rowType: 'order', card: card('Sales', 'salesToday', 'billsToday', 'New Sale', 'sale.write'),
    actions: ['sale.write'], natures: [] },
  { id: 'order', reach: 'customer', shape: 'list', rowType: 'order', card: card('Orders', 'toPackValue', 'toPackCount', 'Open Queue', 'order.create'),
    actions: ['order.create', 'order.fulfill', 'order.cancel'], natures: [] },
  { id: 'invoice', reach: 'money', shape: 'list', rowType: 'invoice', card: card('Billing', 'receivable', 'billsIssued', 'Issue Bill', 'invoice.issue'),
    actions: ['invoice.issue'], natures: [] },
  { id: 'payment', reach: 'money', shape: 'list', rowType: 'payment', card: card('Payments', 'receivedToday', 'receiptsToday', 'Record Receipt', 'payment.record'),
    actions: ['payment.record', 'refund.record', 'purchase.pay'], natures: [] },
  { id: 'register', reach: 'money', shape: 'list', rowType: 'register', card: card('Cash', 'cashOnHand', 'cashOnHand', 'Count Cash', 'register.count'),
    actions: ['register.open', 'register.close', 'register.count'], natures: [] },
  { id: 'catalog', reach: 'data', shape: 'list', rowType: 'item', card: card('Products', 'itemCount', 'itemCount', 'Add Item', 'catalog.item.save'),
    actions: ['catalog.item.save', 'catalog.variant.save', 'price.set'], natures: [] },
  { id: 'stock', reach: 'data', shape: 'list', rowType: 'stock', card: card('Inventory', 'lowStock', 'lowStock', 'Adjust Stock', 'stock.adjust'),
    actions: ['stock.adjust'], natures: ['shop', 'general'] },
  { id: 'purchase', reach: 'money', shape: 'list', rowType: 'purchase', card: card('Purchases', 'openPoValue', 'openPoCount', 'New PO', 'purchase.create'),
    actions: ['purchase.create', 'purchase.receive'], natures: ['shop', 'general'] },
  { id: 'expense', reach: 'money', shape: 'list', rowType: 'expense', card: card('Expenses', 'spentToday', 'spentToday', 'Log Expense', 'expense.record'),
    actions: ['expense.record', 'expense.reverse'], natures: [] },
  { id: 'contact', reach: 'customer', shape: 'list', rowType: 'person', card: card('Customers', 'contactCount', 'contactCount', 'Add Contact', 'contact.create'),
    actions: ['contact.create', 'organization.create', 'relationship.create', 'relationship.end', 'consent.record'], natures: [] },
  { id: 'member', reach: 'data', shape: 'list', rowType: 'party', card: card('Team', 'onDuty', 'onDuty', 'Manage Members'),
    actions: [], natures: [] },
  { id: 'site', reach: 'customer', shape: 'site', rowType: 'site', card: card('Storefront', 'visitsToday', 'visitsToday', 'View Store'),
    actions: ['site.generate', 'site.compile', 'site.publish', 'site.publishLatest', 'site.rollback', 'site.refresh', 'site.unpublish', 'site.asset.upload', 'site.assets'], natures: [] },
  { id: 'task', reach: 'none', shape: 'list', rowType: 'task', card: card('Tasks', 'openTasks', 'openTasks', 'Mark Done', 'task.complete'),
    actions: ['task.create', 'task.complete', 'record.create', 'record.update'], natures: [] },
  { id: 'channel', reach: 'customer', shape: 'chat', rowType: 'channel.message', card: card('Messages', 'pendingChats', 'pendingChats', 'Open Chat', 'channel.send'),
    actions: ['channel.log', 'channel.send'], natures: [] },
];

const byId = new Map(TOOLS.map((tool) => [tool.id, tool]));

export function findTool(id: string): ToolDefinition | undefined { return byId.get(id as ToolId); }

/** An action belongs to exactly one tool. The map is the law. */
const actionOwner = new Map<string, ToolId>(TOOLS.flatMap((tool) => tool.actions.map((action) => [action, tool.id] as const)));
export function toolForAction(actionId: string): ToolId | null { return actionOwner.get(actionId) ?? null; }

/** Birth recipes: the nature's tools, dealt by code the moment Jev names it. */
export const NATURE_RECIPES: Record<Nature, readonly ToolId[]> = {
  food: ['pos', 'catalog', 'expense', 'task', 'order'],
  shop: ['pos', 'catalog', 'stock', 'payment', 'invoice', 'expense', 'purchase'],
  service: ['invoice', 'contact', 'task', 'site'],
  general: ['pos', 'catalog', 'expense'],
};

/** Birth dealing: the nature's recipe, plus the cards every workspace carries. */
export function cardDeck(nature: Nature): readonly ToolId[] {
  const dealt = new Set<ToolId>([...NATURE_RECIPES[nature], 'contact', 'member']);
  return TOOL_IDS.filter((id) => dealt.has(id) && !findTool(id)?.deferred);
}

/** Tools Jev may pick for the owner's private space. Life admin, not the business. */
export const PERSONAL_CANDIDATES: readonly ToolId[] = ['task', 'expense', 'contact', 'catalog', 'order', 'payment'];

/** Owner- or Jev-chosen cards, validated against the registry and capped. */
export function normalizeDeck(value: unknown, limit: number = TOOL_IDS.length): ToolId[] {
  const requested = new Set((Array.isArray(value) ? value : []).map(String));
  return TOOL_IDS.filter((id) => requested.has(id) && !findTool(id)?.deferred).slice(0, Math.max(1, limit));
}

/** The nature recipe is a floor; chosen cards add to it. */
export function dealDeck(nature: Nature, additions: readonly ToolId[] = [], limit = 10): ToolId[] {
  const dealt = new Set<ToolId>([...NATURE_RECIPES[nature], 'contact', 'member', ...additions]);
  return TOOL_IDS.filter((id) => dealt.has(id) && !findTool(id)?.deferred).slice(0, Math.max(1, limit));
}

export interface InboxSeed {
  readonly tool: ToolId;
  readonly reach: ToolReach;
  readonly title: string;
  readonly action: string | null;
}

/** The first NEXT row points at a card the workspace actually carries. */
export function firstInboxSeed(deck: readonly ToolId[]): InboxSeed | null {
  const catalog = deck.includes('catalog') ? findTool('catalog') : undefined;
  const tool = catalog ?? deck.map((id) => findTool(id)).find((candidate) => Boolean(candidate?.card.tap.action));
  if (!tool) return null;
  return { tool: tool.id, reach: tool.reach, title: catalog ? 'Add your first item' : tool.card.tap.label, action: tool.card.tap.action };
}

/** One confirmed card change: add missing, drop dealt, registry order, never empty. */
export function nextDeck(deck: readonly ToolId[], add: readonly ToolId[], remove: ReadonlySet<string>): ToolId[] {
  const next = TOOL_IDS.filter((id) => (deck.includes(id) || add.includes(id)) && !remove.has(id));
  if (!next.length) throw badRequest('A Canvas needs one card.');
  return next;
}

/** The workspace's dealt deck lives in current(kind='deck'): one row, grown by one confirmed plan. */
export async function readDeck(client: Pick<Client, 'execute'>): Promise<readonly ToolId[]> {
  const result = await client.execute({ sql: "SELECT data FROM current WHERE kind='deck' AND key='cards'", args: [] });
  const row = result.rows[0];
  if (!row) return [];
  try {
    const parsed = JSON.parse(String(row[0])) as { tools?: unknown };
    const tools = Array.isArray(parsed.tools) ? parsed.tools.map(String) : [];
    return TOOL_IDS.filter((id) => tools.includes(id));
  } catch { return []; }
}

export function deckStatement(tools: readonly ToolId[]): import('@libsql/client/web').InStatement {
  return {
    sql: `INSERT INTO current (kind,key,data) VALUES ('deck','cards',?)
      ON CONFLICT(kind,key) DO UPDATE SET data=excluded.data`,
    args: [JSON.stringify({ tools })],
  };
}

export interface CardView {
  readonly tool: ToolId;
  readonly title: string;
  readonly reach: ToolReach;
  readonly shape: Shape;
  readonly tap: ToolTap;
  /** the one number for this member's role; null until the tool's first write maintains current */
  readonly number: string | null;
  readonly pendingLine: string | null;
}

/**
 * The card stack for a member: every tool the workspace has dealt (its card
 * exists in current) or the recipe dealt at birth, each with the one number
 * chosen by role. Numbers read `current(kind='card', key=tool)`, maintained by
 * the tool's writes (Tile 2) — derived, never duplicated.
 */
export async function readCardStack(client: Client, role: 'owner' | 'admin' | 'member' | 'guest', dealt: readonly ToolId[]): Promise<CardView[]> {
  const memberLike = role === 'member' || role === 'guest';
  const result = await client.execute({
    sql: `SELECT key, data FROM current WHERE kind='card' AND key IN (${dealt.map(() => '?').join(',') || "''"})`,
    args: [...dealt],
  });
  const numbers = new Map<string, Record<string, unknown>>();
  for (const row of result.rows) {
    try { numbers.set(String(row[0]), JSON.parse(String(row[1])) as Record<string, unknown>); } catch { /* skip */ }
  }
  const views: CardView[] = [];
  for (const id of dealt) {
    const tool = findTool(id);
    if (!tool || tool.deferred) continue;
    const entry = numbers.get(id);
    const field = memberLike ? tool.card.number.member : tool.card.number.owner;
    const raw = entry ? entry[field] : undefined;
    views.push({
      tool: tool.id, title: tool.card.title, reach: tool.reach, shape: tool.shape, tap: tool.card.tap,
      number: raw === undefined || raw === null ? null : typeof raw === 'number' ? formatMoney(raw) : String(raw),
      pendingLine: entry && typeof entry.pending === 'string' && entry.pending ? String(entry.pending) : null,
    });
  }
  return views;
}
