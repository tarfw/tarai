import type { Client } from '@libsql/client/web';
import { canExecute, managesMembers } from '../access.ts';
import { commerceActionIds } from '../commerce/catalog.ts';
import type { AccessContext } from '../types.ts';
import { findAction, interfaceCatalog } from './catalog.ts';

export type Module = 'commerce' | 'site' | 'pos';
export type CapabilityState = { enabled: Record<Module, boolean>; version: number };

export type ToolKind = 'tool' | 'human' | 'channel' | 'flow' | 'site';
export type ToolReach = 'none' | 'customer' | 'money' | 'data';

export interface ToolDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly kind: ToolKind;
  readonly reach: ToolReach;
  readonly module: Module | 'core';
  readonly action: string;
  readonly input?: Record<string, unknown>;
  readonly category?: 'work' | 'create' | 'manage' | 'explore';
  readonly personal?: boolean;
  readonly grant?: string;
}

export const canonicalTools: readonly ToolDefinition[] = [
  // 1. pos (Point of sale)
  { id: 'pos', title: 'Point of sale', description: 'Fast counter sales, scan barcode, instant receipt', icon: 'storefront-outline', kind: 'tool', reach: 'money', module: 'commerce', category: 'work', action: 'pos.open', input: { section: 'sell' } },
  // 2. register (Cash drawer)
  { id: 'register', title: 'Cash drawer', description: 'Open shift, log cash in/out, count physical cash', icon: 'cash-outline', kind: 'tool', reach: 'money', module: 'commerce', category: 'work', action: 'pos.register.open' },
  // 3. item (Products)
  { id: 'item', title: 'Products', description: 'Add/edit products, photos, variants, units, prices', icon: 'pricetag-outline', kind: 'tool', reach: 'data', module: 'commerce', category: 'create', action: 'catalog.item.save' },
  // 4. inventory (Stock)
  { id: 'inventory', title: 'Stock', description: 'Count stock, record damage/wastage, transfers', icon: 'layers-outline', kind: 'tool', reach: 'data', module: 'commerce', category: 'manage', action: 'stock.adjust' },
  // 5. order (Orders)
  { id: 'order', title: 'Orders', description: 'Take customer orders, reserve stock, track shipping', icon: 'cart-outline', kind: 'tool', reach: 'customer', module: 'commerce', category: 'create', action: 'order.create' },
  // 6. invoice (Billing)
  { id: 'invoice', title: 'Billing', description: 'Issue commercial bills or GST-ready invoices', icon: 'document-outline', kind: 'tool', reach: 'money', module: 'commerce', category: 'create', action: 'invoice.issue' },
  // 7. payment (Payments)
  { id: 'payment', title: 'Payments', description: 'Record Cash/UPI/Card received, issue refunds', icon: 'card-outline', kind: 'tool', reach: 'money', module: 'commerce', category: 'work', action: 'payment.record' },
  // 8. expense (Expenses)
  { id: 'expense', title: 'Expenses', description: 'Log daily shop expenses (tea, packaging, fuel)', icon: 'wallet-outline', kind: 'tool', reach: 'money', module: 'commerce', category: 'work', action: 'expense.record' },
  // 9. purchase (Purchases)
  { id: 'purchase', title: 'Purchases', description: 'Create supplier purchase orders, request quotes', icon: 'bag-add-outline', kind: 'tool', reach: 'money', module: 'commerce', category: 'create', action: 'purchase.create' },
  // 10. members (Team)
  { id: 'members', title: 'Team', description: 'Manage staff, roles, briefs, and tool permissions', icon: 'people-outline', kind: 'tool', reach: 'data', module: 'core', category: 'manage', action: 'contact.create' },
  // 11. contact (Contacts)
  { id: 'contact', title: 'Contacts', description: 'Save customer, supplier, vendor phone numbers', icon: 'person-add-outline', kind: 'tool', reach: 'customer', module: 'core', category: 'create', action: 'contact.create' },
  // 12. human (You do)
  { id: 'human', title: 'You do', description: 'Physical or manual work (pack, lock shop, call)', icon: 'hand-left-outline', kind: 'human', reach: 'none', module: 'core', category: 'work', action: 'task.create' },
  // 13. flow (Checklist)
  // 14. site (Online store)
  { id: 'site', title: 'Online store', description: 'Autopilot storefront, live catalog sync, edge CDN', icon: 'globe-outline', kind: 'site', reach: 'customer', module: 'site', category: 'manage', action: 'site.generate' },
  // 15. inbox (Team feed)
  // 16. chat (WhatsApp Chat - Manual free)
  // 17. whatsapp (WhatsApp API - Official Meta Cloud API)
  // 18. telegram (Team alerts)
];

export const catalog: readonly ToolDefinition[] = canonicalTools;

const modules = [
  { id: 'commerce', title: 'Commerce', description: 'Sales, POS, catalog, inventory, register, invoices and payments' },
  { id: 'site', title: 'Site Studio', description: 'Public pages and publishing' },
] as const;

export async function readCapabilities(client: Client): Promise<CapabilityState> {
  const [saved, existing] = await Promise.all([
    client.execute("SELECT data,version FROM records WHERE id='capability' AND type='capability' AND archived IS NULL LIMIT 1"),
    client.execute("SELECT type FROM records WHERE type IN ('pos.settings','pos.register','pos.order','pos.product','site','item','variant','price','stock','purchase','order','invoice','payment','refund','expense','statement','reconciliation','period','transfer','batch','recipe','production','booking','time','trip','fare','shift','attendance','payroll','supplier','quote','pick','pack','shipment','return','inspection','quality','forecast','plan') AND archived IS NULL GROUP BY type"),
  ]);
  const found = new Set(existing.rows.map((row) => String(row.type)));
  const inferredCommerce = found.has('pos.settings') || found.has('pos.register') || found.has('pos.order') || found.has('pos.product') || [...found].some((type) => !['site'].includes(type));
  const inferred = { commerce: inferredCommerce, pos: inferredCommerce, site: found.has('site') };
  const row = saved.rows[0];
  if (!row) return { enabled: inferred, version: 0 };
  const data = JSON.parse(String(row.data)) as Record<string, unknown>;
  const commerceEnabled = typeof data.commerce === 'boolean' ? data.commerce : (typeof data.pos === 'boolean' ? data.pos : inferred.commerce);
  return { enabled: {
    commerce: commerceEnabled,
    pos: commerceEnabled,
    site: typeof data.site === 'boolean' ? data.site : inferred.site,
  }, version: Number(row.version) };
}

export async function readWorkspaceTools(client: Client, access: AccessContext) {
  const [state, briefRow] = await Promise.all([
    readCapabilities(client),
    client.execute("SELECT data FROM records WHERE id='brief' AND type='brief' AND archived IS NULL LIMIT 1").catch(() => ({ rows: [] })),
  ]);

  let savedBrief: string[] = [];
  let savedTrade: string | null = null;
  if (briefRow.rows.length > 0) {
    try {
      const parsed = JSON.parse(String(briefRow.rows[0].data));
      if (Array.isArray(parsed.brief)) savedBrief = parsed.brief.map(String);
      if (typeof parsed.trade === 'string') savedTrade = parsed.trade;
      else if (typeof parsed.trade?.title === 'string') savedTrade = parsed.trade.title;
    } catch { /* ignore */ }
  }

  let memberAccess: string[] | null = access.member.access ? [...access.member.access] : null;
  if (!memberAccess && access.member.userId) {
    try {
      const email = access.identity.email ? access.identity.email.trim().toLowerCase() : '';
      const partyRow = await client.execute({
        sql: `SELECT data FROM records WHERE type='party' AND (
          id=? OR owner=? OR json_extract(data, '$.userId')=?
          ${email ? "OR lower(title)=? OR json_extract(data, '$.email')=?" : ''}
        ) AND archived IS NULL LIMIT 1`,
        args: email ? [access.member.userId, access.member.userId, access.member.userId, email, email] : [access.member.userId, access.member.userId, access.member.userId],
      });
      if (partyRow.rows.length > 0) {
        const parsed = JSON.parse(String(partyRow.rows[0].data));
        if (Array.isArray(parsed.access)) {
          memberAccess = parsed.access.map(String);
        }
      }
    } catch { /* ignore */ }
  }

  const tools = catalog.filter((tool) => {
    const action = findAction(tool.action);
    if (tool.module !== 'core' && !state.enabled[tool.module]) return false;
    if (tool.personal && access.workspace.mode !== 'personal') return false;
    if (access.workspace.mode === 'personal' && tool.id === 'members') return false;
    if (Boolean(action) && !interfaceCatalog.some((item) => item.key === action?.interfaceKey)) return false;

    if (access.member.role === 'owner' || access.member.role === 'admin') return true;

    // Explicit access whitelist takes priority if defined on member
    if (memberAccess !== null) {
      return memberAccess.includes(tool.id) || memberAccess.includes(tool.action);
    }

    return canExecute(access.member, tool.action) && (!tool.grant || canExecute(access.member, tool.grant));
  });

  return {
    tools: tools.map(({ id, title, description, icon, kind, reach, module, action, input, category }) => ({
      id, title, description, icon, kind, reach, module, action, category: category || 'work', input: input || {},
    })),
    modules: modules.map((module) => ({ ...module, enabled: state.enabled[module.id] })),
    version: state.version,
    canManage: managesMembers(access.member),
    role: access.member.role === 'member' ? access.member.workRole || 'member' : access.member.role,
    brief: savedBrief,
    trade: savedTrade,
  };
}

export function isModule(value: unknown): value is Module {
  return value === 'pos' || value === 'commerce' || value === 'site';
}

export function moduleForAction(actionId: string): Module | null {
  if (actionId.startsWith('pos.')) return 'commerce';
  if (commerceActionIds.has(actionId)) return 'commerce';
  if (actionId.startsWith('site.')) return 'site';
  return null;
}
