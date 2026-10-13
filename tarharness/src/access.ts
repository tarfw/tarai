import type { Member, RecordItem } from './types.ts';
import { findAction } from './registry/catalog.ts';

export type WorkRole = string;
export const managesMembers = (member: Member) => member.state === 'active' && (member.role === 'owner' || member.role === 'admin');
const workRole = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const kitchenRoles = new Set(['chef', 'cook', 'kitchen']);
const grantedRoles = (member: Member) => member.roles?.length ? member.roles.map(workRole) : [workRole(member.workRole)];
export const hasWorkRole = (member: Member, role: string) => member.role === 'member' && grantedRoles(member).includes(workRole(role));
export const isCook = (member: Member) => member.role === 'member' && grantedRoles(member).every((role) => kitchenRoles.has(role));
export const isCourier = (member: Member) => member.role === 'member' && grantedRoles(member).every((role) => role === 'courier');
export const isCustomer = (member: Member) => member.role === 'member' && grantedRoles(member).every((role) => role === 'customer');
const cookActions = new Set(['task.complete', 'pos.order.item.update', 'pos.order.handoff']);
const cashierActions = new Set(['task.create', 'task.complete', 'flow.start', 'flow.advance', 'pos.open', 'pos.customer.save', 'pos.order.save', 'pos.order.cancel', 'pos.checkout', 'pos.register.open', 'pos.register.count', 'order.create', 'order.fulfill', 'order.cancel', 'invoice.issue', 'payment.record']);
const courierActions = new Set(['task.create', 'task.complete', 'flow.start', 'flow.advance', 'pos.order.reach', 'pos.order.collect', 'pos.order.deliver']);
const customerActions = new Set(['pos.order.receive', 'pos.order.rate']);
const driverActions = new Set(['task.create', 'task.complete', 'flow.start', 'flow.advance', 'trip.start', 'trip.complete', 'time.record', 'attendance.record']);
const warehouseActions = new Set(['task.create', 'task.complete', 'flow.start', 'flow.advance', 'warehouse.pick', 'warehouse.pack', 'shipment.dispatch', 'shipment.track', 'shipment.deliver', 'stock.transfer', 'quality.inspect', 'time.record', 'attendance.record']);
const domainWorkActions = [
  'expense.record', 'stock.transfer', 'production.start', 'production.complete',
  'booking.create', 'booking.cancel', 'time.record', 'trip.start', 'trip.complete',
  'attendance.record', 'quote.request', 'quote.record', 'purchase.submit',
  'warehouse.pick', 'warehouse.pack', 'shipment.dispatch', 'shipment.track', 'shipment.deliver', 'quality.inspect',
] as const;
const generalWorkActions = new Set([
  'record.create', 'record.update', 'contact.create', 'organization.create', 'relationship.create', 'relationship.end',
  'consent.record', 'task.create', 'task.complete', 'flow.start', 'flow.advance', 'web.search', 'pos.order.handoff',
  'agent.save',
  ...domainWorkActions,
]);
const managerActions = new Set([
  ...generalWorkActions, 'pos.open', 'pos.customer.save', 'pos.order.save', 'pos.order.cancel', 'pos.checkout',
  'pos.register.open', 'pos.register.count', 'pos.register.close', 'order.create', 'order.fulfill', 'order.cancel',
  'invoice.issue', 'payment.record', 'refund.record',
]);
export const workRoleNames = ['general', 'chef', 'cook', 'kitchen', 'cashier', 'manager', 'server', 'floor', 'kds', 'courier', 'customer', 'driver', 'warehouse'] as const;
function workRoleActions(role: string): ReadonlySet<string> {
  if (!role || role === 'general') return generalWorkActions;
  if (kitchenRoles.has(role)) return cookActions;
  if (role === 'cashier') return cashierActions;
  if (role === 'manager') return managerActions;
  if (['server', 'floor', 'kds'].includes(role)) return generalWorkActions;
  if (role === 'courier') return courierActions;
  if (role === 'customer') return customerActions;
  if (role === 'driver') return driverActions;
  if (role === 'warehouse') return warehouseActions;
  return generalWorkActions;
}

export function canUseWorkRole(role: string, actionId: string): boolean {
  const action = findAction(actionId);
  return Boolean(action?.roles.includes('member') && workRoleActions(workRole(role)).has(actionId));
}

const toolActionMap: Record<string, readonly string[]> = {
  pos: [
    'pos.open', 'pos.checkout', 'pos.customer.save', 'pos.order.save',
    'pos.order.item.update', 'pos.order.cancel', 'pos.order.accept',
    'pos.order.handoff', 'pos.order.reject',
  ],
  register: ['pos.register.open', 'pos.register.close', 'pos.register.count'],
  item: ['catalog.item.save', 'catalog.variant.save', 'price.set'],
  inventory: ['stock.adjust'],
  order: [
    'order.create', 'order.fulfill', 'order.cancel', 'pos.order.save',
    'pos.order.item.update', 'pos.order.cancel', 'pos.order.accept',
    'pos.order.handoff', 'pos.order.reject', 'pos.order.reach',
    'pos.order.collect', 'pos.order.deliver',
  ],
  invoice: ['invoice.issue'],
  payment: ['payment.record'],
  expense: ['expense.record'],
  purchase: ['purchase.create', 'purchase.receive', 'purchase.pay'],
  members: ['contact.create'],
  contact: ['contact.create'],
  human: ['task.create', 'task.complete'],
  flow: ['flow.start', 'flow.advance'],
  site: ['site.generate', 'site.compile', 'site.publish', 'site.publishLatest', 'site.edit', 'site.scout', 'site.checks'],
  inbox: ['task.complete'],
  chat: ['contact.create'],
  whatsapp: ['invoice.issue'],
  telegram: ['task.create'],
};

export function canExecute(member: Member, actionId: string): boolean {
  const action = findAction(actionId);
  if (member.state !== 'active' || !action || !action.roles.includes(member.role)) return false;
  if (member.role !== 'member') return true;
  if (member.access !== undefined) {
    if (member.access.includes(actionId)) return true;
    for (const toolId of member.access) {
      if (toolActionMap[toolId]?.includes(actionId)) return true;
    }
    return false;
  }
  return grantedRoles(member).some((role) => workRoleActions(role).has(actionId));
}

export function canRunFlowStep(member: Member, step: Record<string, unknown>, starter: string): boolean {
  const actionId = workRole(step.id);
  if (!actionId || !canExecute(member, actionId)) return false;
  const assigned = workRole(step.role);
  if (assigned === 'any') return member.role !== 'guest';
  if (assigned) return hasWorkRole(member, assigned);
  return member.userId === starter || managesMembers(member);
}

export function canReadRecord(member: Member, record: Pick<RecordItem, 'type' | 'data' | 'assignee'> & { owner?: string | null }): boolean {
  if (member.state !== 'active') return false;
  const roles = grantedRoles(member);
  if (record.type === 'task') {
    if (managesMembers(member)) return true;
    if (record.assignee && record.assignee !== member.userId) return false;
    const required = workRole(record.data.workRole);
    return roles.some((role) => {
      if (!required && !record.assignee && role && role !== 'general') return false;
      return !required || (kitchenRoles.has(required) && kitchenRoles.has(role)) || required === (role || 'general');
    });
  }
  if (member.role === 'guest') return false;
  if (member.role !== 'member') return true;
  if (['pos.register', 'register'].includes(record.type) && grantedRoles(member).some((role) => ['cashier', 'manager'].includes(role))) return true;
  return roles.some((role) => {
    if (!role || role === 'general') return true;
    if (role === 'cashier') return ['contact', 'person', 'pos.order', 'order', 'pos.customer', 'pos.product', 'item', 'variant', 'price', 'stock', 'register', 'pos.register', 'invoice', 'payment'].includes(record.type);
    if (role === 'driver') return ['trip', 'fare', 'task'].includes(record.type);
    if (role === 'warehouse') return ['order', 'stock', 'pick', 'pack', 'shipment', 'movement', 'batch', 'inspection', 'task'].includes(record.type);
    return record.owner === member.userId || record.assignee === member.userId || workRole(record.data.workRole) === role;
  });
}

export function kitchenOrder<T extends { data: Record<string, unknown> }>(order: T): T {
  const lines = Array.isArray(order.data.lines) ? order.data.lines as Record<string, unknown>[] : [];
  return { ...order, data: { orderType: order.data.orderType, table: order.data.table, handedOffAt: order.data.handedOffAt,
    lines: lines.map((line) => ({ productId: line.productId || line.variant, title: line.title, quantity: line.quantity, status: line.status || 'pending' })) } };
}
