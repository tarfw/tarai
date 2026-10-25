// The 14-tool registry: one row per tool, the only menu. A tool is an entry,
// never a screen; the shape (list, sale, chat, sheet) decides the route. At
// birth Jev names the nature and code deals the cards from the recipes; after
// that, Add-a-Card browses this file with zero model calls.

import type { Client } from '@libsql/client/web';

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
  { id: 'pos', reach: 'money', shape: 'sale', rowType: 'order', card: card('Counter Sales', 'salesToday', 'billsToday', 'New Sale', 'sale.write'),
    actions: ['sale.write'], natures: [] },
  { id: 'order', reach: 'customer', shape: 'list', rowType: 'order', card: card('Orders and Dispatch', 'toPackValue', 'toPackCount', 'Open Queue', 'order.create'),
    actions: ['order.create', 'order.fulfill', 'order.cancel'], natures: [] },
  { id: 'invoice', reach: 'money', shape: 'list', rowType: 'invoice', card: card('Billing and GST', 'receivable', 'billsIssued', 'Issue Bill', 'invoice.issue'),
    actions: ['invoice.issue'], natures: [] },
  { id: 'payment', reach: 'money', shape: 'list', rowType: 'payment', card: card('Payments and UPI', 'receivedToday', 'receiptsToday', 'Record Receipt', 'payment.record'),
    actions: ['payment.record', 'refund.record', 'purchase.pay'], natures: [] },
  { id: 'register', reach: 'money', shape: 'list', rowType: 'register', card: card('Cash Drawer', 'cashOnHand', 'cashOnHand', 'Count Cash', 'register.count'),
    actions: ['register.open', 'register.close', 'register.count'], natures: [] },
  { id: 'catalog', reach: 'data', shape: 'list', rowType: 'item', card: card('Products and Prices', 'itemCount', 'itemCount', 'Add Item', 'catalog.item.save'),
    actions: ['catalog.item.save', 'catalog.variant.save', 'price.set'], natures: [] },
  { id: 'stock', reach: 'data', shape: 'list', rowType: 'stock', card: card('Inventory and Warehouse', 'lowStock', 'lowStock', 'Adjust Stock', 'stock.adjust'),
    actions: ['stock.adjust'], natures: ['shop', 'general'] },
  { id: 'purchase', reach: 'money', shape: 'list', rowType: 'purchase', card: card('Supplier POs and GRN', 'openPoValue', 'openPoCount', 'New PO', 'purchase.create'),
    actions: ['purchase.create', 'purchase.receive'], natures: ['shop', 'general'] },
  { id: 'expense', reach: 'money', shape: 'list', rowType: 'expense', card: card('Daily Expenses', 'spentToday', 'spentToday', 'Log Expense', 'expense.record'),
    actions: ['expense.record', 'expense.reverse'], natures: [] },
  { id: 'contact', reach: 'customer', shape: 'list', rowType: 'person', card: card('Customers and Leads', 'contactCount', 'contactCount', 'Add Contact', 'contact.create'),
    actions: ['contact.create', 'organization.create', 'relationship.create', 'relationship.end', 'consent.record'], natures: [] },
  { id: 'member', reach: 'data', shape: 'list', rowType: 'party', card: card('Team and Shifts', 'onDuty', 'onDuty', 'Manage Members'),
    actions: [], natures: [] },
  { id: 'site', reach: 'customer', shape: 'site', rowType: 'site', card: card('Online Storefront', 'visitsToday', 'visitsToday', 'View Store'),
    actions: ['site.generate', 'site.designs', 'site.scout', 'site.edit', 'site.ask', 'site.undo', 'site.brief.add', 'site.brief.remove', 'site.notice.set', 'site.sections.set', 'site.checks', 'site.releases', 'site.compile', 'site.publish', 'site.publishLatest', 'site.rollback', 'site.refresh', 'site.unpublish', 'site.design.import', 'site.asset.upload', 'site.asset.generate', 'site.assets'], natures: [] },
  { id: 'task', reach: 'none', shape: 'list', rowType: 'task', card: card('Manual Tasks', 'openTasks', 'openTasks', 'Mark Done', 'task.complete'),
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

/** The workspace's dealt deck lives in current(kind='deck'): one row, toggled by Add-a-Card. */
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
      number: raw === undefined || raw === null ? null : String(raw),
      pendingLine: entry && typeof entry.pending === 'string' && entry.pending ? String(entry.pending) : null,
    });
  }
  return views;
}
