// Derived card numbers and inbox seeds: current is the number now, rebuildable
// from records at any time. After a successful write the gateway refreshes the
// owning tool's card (and pos, which every money move touches) and seeds the
// rows other members must act on.

import type { Client } from '@libsql/client/web';
import type { AccessContext } from '../types.ts';
import { TOOL_IDS, findTool, type ToolId } from '../tools/registry.ts';
import { commitWrite, currentStatement, inboxStatement } from './write.ts';

type Row = unknown[];

async function scalar(client: Client, sql: string, args: (string | number | null)[] = []): Promise<number> {
  const result = await client.execute({ sql, args });
  return Number(result.rows[0]?.[0] ?? 0);
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** INR display for now; locale arrives with birth (Tile 8). Paise only when they exist. */
export function money(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const paise = Math.abs(minor % 100);
  const base = whole.toLocaleString('en-IN');
  return paise === 0 ? `Rs. ${base}` : `Rs. ${base}.${String(paise).padStart(2, '0')}`;
}

const count = (n: number) => String(n);

interface CardMetrics { [field: string]: string }

/** One metric set per tool. Both roles' fields are computed and stored. */
export async function computeCard(client: Client, tool: ToolId): Promise<CardMetrics> {
  switch (tool) {
    case 'pos': {
      const sod = startOfToday();
      const sales = await scalar(client, "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) FROM records WHERE type='payment' AND json_extract(data,'$.invoice') IS NOT NULL AND created>=?", [sod]);
      const bills = await scalar(client, "SELECT COUNT(*) FROM records WHERE type='invoice' AND created>=?", [sod]);
      return { salesToday: money(sales), billsToday: count(bills) };
    }
    case 'order': {
      const toPack = await scalar(client, "SELECT COUNT(*) FROM records WHERE type='order' AND state='open'");
      const value = await scalar(client, "SELECT COALESCE(SUM(json_extract(data,'$.total')),0) FROM records WHERE type='order' AND state='open'");
      return { toPackCount: count(toPack), toPackValue: money(value) };
    }
    case 'invoice': {
      const receivable = await scalar(client, "SELECT COALESCE(SUM(json_extract(data,'$.net')-json_extract(data,'$.paid')-json_extract(data,'$.refunded')),0) FROM records WHERE type='invoice' AND state IN ('issued','partial')");
      const issued = await scalar(client, "SELECT COUNT(*) FROM records WHERE type='invoice' AND created>=?", [startOfToday()]);
      return { receivable: money(receivable), billsIssued: count(issued) };
    }
    case 'payment': {
      const received = await scalar(client, "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) FROM records WHERE type='payment' AND json_extract(data,'$.invoice') IS NOT NULL AND created>=?", [startOfToday()]);
      const receipts = await scalar(client, "SELECT COUNT(*) FROM records WHERE type='payment' AND json_extract(data,'$.invoice') IS NOT NULL AND created>=?", [startOfToday()]);
      return { receivedToday: money(received), receiptsToday: count(receipts) };
    }
    case 'register': {
      const open = await client.execute("SELECT data FROM records WHERE type='register' AND state='open' AND archived IS NULL LIMIT 1");
      const row = open.rows[0];
      if (!row) return { cashOnHand: 'closed' };
      const data = JSON.parse(String(row[0])) as { opening?: number };
      const opened = await client.execute("SELECT json_extract(data,'$.opened') FROM records WHERE type='register' AND state='open' AND archived IS NULL LIMIT 1");
      const since = Number(opened.rows[0]?.[0] ?? 0);
      const cashIn = await scalar(client, "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) FROM records WHERE type='payment' AND json_extract(data,'$.method')='cash' AND json_extract(data,'$.invoice') IS NOT NULL AND created>=?", [since]);
      const cashOut = await scalar(client, "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) FROM records WHERE ((type='refund' AND json_extract(data,'$.method')='cash') OR (type='expense' AND state='recorded')) AND created>=? AND archived IS NULL", [since]);
      return { cashOnHand: money(Number(data.opening || 0) + cashIn - cashOut) };
    }
    case 'catalog': {
      const items = await scalar(client, "SELECT COUNT(*) FROM records WHERE type='item' AND state='active' AND archived IS NULL");
      return { itemCount: count(items) };
    }
    case 'stock': {
      const units = await scalar(client, "SELECT COALESCE(SUM(json_extract(data,'$.onhand')),0) FROM records WHERE type='stock' AND archived IS NULL");
      return { lowStock: count(units) };
    }
    case 'purchase': {
      const open = await scalar(client, "SELECT COUNT(*) FROM records WHERE type='purchase' AND state IN ('ordered','partial')");
      const value = await scalar(client, "SELECT COALESCE(SUM(json_extract(data,'$.total')),0) FROM records WHERE type='purchase' AND state IN ('ordered','partial')");
      return { openPoCount: count(open), openPoValue: money(value) };
    }
    case 'expense': {
      const spent = await scalar(client, "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) FROM records WHERE type='expense' AND state='recorded' AND created>=?", [startOfToday()]);
      return { spentToday: money(spent) };
    }
    case 'contact': {
      const contacts = await scalar(client, "SELECT COUNT(*) FROM records WHERE type IN ('person','organization') AND archived IS NULL");
      return { contactCount: count(contacts) };
    }
    case 'member': {
      const members = await scalar(client, "SELECT COUNT(*) FROM records WHERE type='party' AND archived IS NULL");
      return { onDuty: count(members) };
    }
    case 'task': {
      const open = await scalar(client, "SELECT COUNT(*) FROM records WHERE type='task' AND state='open' AND archived IS NULL");
      return { openTasks: count(open) };
    }
    case 'channel': {
      const pending = await scalar(client, "SELECT COUNT(*) FROM records WHERE type='channel.message' AND state='received' AND archived IS NULL");
      return { pendingChats: count(pending) };
    }
    case 'site':
      return {};
  }
}

/** Refresh the card numbers for the tools a write touched. Derived, best-effort: never fails the write. */
export async function refreshCards(client: Client, tools: readonly ToolId[]): Promise<void> {
  const statements = [];
  for (const tool of tools) {
    if (!findTool(tool)) continue;
    const metrics = await computeCard(client, tool);
    if (Object.keys(metrics).length) statements.push(currentStatement('card', tool, metrics));
  }
  if (statements.length) await commitWrite(client, statements);
}

/** The tools whose numbers a given action can move. */
export function toolsTouchedBy(actionId: string): ToolId[] {
  const owner = TOOL_IDS.find((id) => findTool(id)?.actions.includes(actionId));
  const touched = new Set<ToolId>();
  if (owner) touched.add(owner);
  // every money move moves the register and the day's sales picture
  if (owner === 'pos' || owner === 'payment' || owner === 'expense' || owner === 'register' || owner === 'invoice' || owner === 'order') {
    touched.add('pos'); touched.add('register'); touched.add('payment');
  }
  if (owner === 'stock' || owner === 'purchase' || owner === 'catalog') touched.add('stock');
  if (owner === 'channel') touched.add('channel');
  return [...touched];
}

/** Inbox seeds: the rows other members must act on. Best-effort like cards. */
export async function seedInbox(client: Client, context: AccessContext, actionId: string, result: Record<string, unknown>): Promise<void> {
  const statements = [];
  if (actionId === 'order.create' || actionId === 'sale.write') {
    const order = result.order as { id: string; state?: string; version?: number } | undefined;
    if (order && actionId === 'order.create') {
      statements.push(inboxStatement({ member: ownerOf(context), tool: 'order', reach: 'customer', title: 'Pack the new order', action: 'order.fulfill', input: { order: order.id, version: order.version ?? 1 }, due: Date.now() + 3600_000 }));
    }
  }
  if (actionId === 'task.create') {
    const task = result.record as { id: string } | undefined;
    if (task) statements.push(inboxStatement({ member: assignedOf(context, result), tool: 'task', reach: 'none', title: String((result.record as { title?: string })?.title || 'Task'), action: 'task.complete', input: { taskId: task.id } }));
  }
  if (actionId === 'register.close' || actionId === 'register.count') {
    const register = result.register as { variance?: number } | undefined;
    if (register && Number(register.variance ?? 0) !== 0) {
      statements.push(inboxStatement({ member: ownerOf(context), tool: 'register', reach: 'money', title: `Cash drawer out ${money(Math.abs(Number(register.variance)))}`, urgent: true }));
    }
  }
  if (statements.length) await commitWrite(client, statements);
}

function ownerOf(context: AccessContext): string {
  // The workspace owner sees money alerts even when a member acts. The D1
  // owner id is not in the workspace context, so members' alerts go to the
  // actor; Tile 8's hire wiring stores the owner id in current('workspace').
  return context.identity.id;
}

function assignedOf(context: AccessContext, result: Record<string, unknown>): string {
  const record = result.record as { assignee?: string | null } | undefined;
  return record?.assignee || context.identity.id;
}
