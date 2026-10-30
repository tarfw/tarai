// The core comes first: when words name a card, the change is a deck change,
// not a plan. Zero model calls, by law (tarfw: the core is the only menu).
//
// The matcher is deliberately narrow. Every word must be a card name, an
// alias, or request filler; one job word ("ordering", "send") and the request
// is a flow, which belongs to the plan path.

import { TOOL_IDS, findTool, type ToolId } from './registry.ts';

/** Merchant words for each core card, alongside the id and the card title. */
export const TOOL_ALIASES: Record<ToolId, readonly string[]> = {
  pos: ['pos', 'sale', 'sales', 'counter sale', 'counter sales', 'checkout', 'sell'],
  order: ['order', 'orders', 'dispatch', 'packing', 'pack', 'shipping', 'fulfil', 'fulfill'],
  invoice: ['invoice', 'invoices', 'bill', 'bills', 'billing', 'gst'],
  payment: ['payment', 'payments', 'upi', 'receipt', 'receipts', 'refund', 'refunds'],
  register: ['register', 'cash', 'till', 'drawer', 'counter', 'cash drawer'],
  catalog: ['catalog', 'catalogue', 'product', 'products', 'item', 'items', 'price', 'prices', 'price list'],
  stock: ['stock', 'inventory', 'warehouse', 'godown'],
  purchase: ['purchase', 'purchases', 'supplier', 'suppliers', 'po', 'purchase order', 'grn'],
  expense: ['expense', 'expenses', 'spend', 'spends', 'spending'],
  contact: ['contact', 'contacts', 'customer', 'customers', 'lead', 'leads', 'client', 'clients'],
  member: ['member', 'members', 'team', 'staff', 'employee', 'employees', 'hire', 'shift', 'shifts'],
  site: ['site', 'sites', 'website', 'websites', 'web site', 'storefront', 'online store', 'online shop', 'url'],
  task: ['task', 'tasks', 'todo', 'todos', 'to do', 'checklist'],
  channel: ['message', 'messages', 'chat', 'chats', 'whatsapp', 'telegram'],
};

const FILLER = new Set([
  'add', 'adds', 'the', 'a', 'an', 'please', 'new', 'open', 'show', 'my', 'me', 'for', 'to',
  'on', 'canvas', 'home', 'i', 'us', 'some', 'and', 'of', 'card', 'cards', 'want', 'need', 'give',
]);

/** A schedule or a sequence means a plan, even when a card is named. */
export function defersToFlow(words: string): boolean {
  return /\b(every|daily|weekly|monthly|each|then|after|when|before|morning|evening|tomorrow|remind|schedule|repeat|remove|drop|delete|hide|no longer|don'?t)\b|at \d/i.test(words.toLowerCase());
}

const PHRASES: readonly { phrase: string; tool: ToolId }[] = TOOL_IDS.flatMap((id) => [
  ...TOOL_ALIASES[id],
  findTool(id)?.card.title.toLowerCase() ?? id,
].map((phrase) => ({ phrase, tool: id }))).sort((a, b) => b.phrase.split(' ').length - a.phrase.split(' ').length);

const phraseFor = (words: string) => PHRASES.find((entry) => entry.phrase === words);

/**
 * The core cards the words name, in registry order. Empty unless the whole
 * request is a card name: "add site", "the storefront card", "add billing".
 */
export function matchCoreTools(words: string): ToolId[] {
  const text = words.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const tokens = text.split(' ');
  const hits = new Set<ToolId>();
  for (let index = 0; index < tokens.length;) {
    const pair = tokens[index + 1] ? phraseFor(`${tokens[index]} ${tokens[index + 1]}`) : undefined;
    if (pair) { hits.add(pair.tool); index += 2; continue; }
    const single = phraseFor(tokens[index]);
    if (single) { hits.add(single.tool); index += 1; continue; }
    // a word outside the card vocabulary: this is a job, not a card name
    if (!FILLER.has(tokens[index]) && !TOOL_IDS.includes(tokens[index] as ToolId)) return [];
    index += 1;
  }
  return TOOL_IDS.filter((id) => hits.has(id));
}
