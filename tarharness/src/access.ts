import type { Member, RecordItem } from './types.ts';
import { findAction } from './registry/catalog.ts';
import { TOOL_IDS, toolForAction, type ToolId } from './tools/registry.ts';

export type WorkRole = string;

export const managesMembers = (member: Member) => member.state === 'active' && (member.role === 'owner' || member.role === 'admin');
const workRole = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const grantedRoles = (member: Member) => member.roles?.length ? member.roles.map(workRole) : [workRole(member.workRole)];
export const hasWorkRole = (member: Member, role: string) => member.role === 'member' && grantedRoles(member).includes(workRole(role));

// Older party records whitelisted legacy tool ids; they map onto the registry.
const LEGACY_TOOL: Record<string, ToolId> = { item: 'catalog', inventory: 'stock', members: 'member', human: 'task' };
const normalizeTool = (value: string): ToolId | null => {
  const id = LEGACY_TOOL[value] ?? value;
  return (TOOL_IDS as readonly string[]).includes(id) ? id as ToolId : null;
};

// Grants choose the stack: a member's tools come from their explicit
// whitelist or their hired role. Nothing else decides.
const ROLE_TOOLS: Record<string, readonly ToolId[]> = {
  general: ['task', 'contact'],
  cashier: ['pos', 'register', 'order', 'contact', 'task'],
  manager: [...TOOL_IDS],
  kitchen: ['order', 'task'],
  cook: ['order', 'task'],
  chef: ['order', 'task'],
  server: ['pos', 'order', 'task'],
  floor: ['pos', 'order', 'task'],
  kds: ['order', 'task'],
  courier: ['order', 'task'],
  customer: ['task'],
  driver: ['order', 'task'],
  warehouse: ['stock', 'purchase', 'order', 'task'],
};

/** The cards a member's grants carry. The Canvas stack is the deck ∩ this set. */
export function memberTools(member: Member): Set<ToolId> {
  const tools = new Set<ToolId>();
  if (member.access !== undefined) {
    for (const entry of member.access) {
      const tool = normalizeTool(entry);
      if (tool) tools.add(tool);
    }
    return tools;
  }
  for (const role of grantedRoles(member)) {
    for (const tool of ROLE_TOOLS[role] ?? ROLE_TOOLS.general) tools.add(tool);
  }
  return tools;
}

export function canExecute(member: Member, actionId: string): boolean {
  const action = findAction(actionId);
  if (member.state !== 'active' || !action || !action.roles.includes(member.role)) return false;
  if (member.role !== 'member') return true;
  const tool = toolForAction(action.id);
  if (!tool) return true; // control-plane actions gated by roles alone
  return memberTools(member).has(tool);
}

/** A member sees a skill card only when every step is theirs to run. */
export function canRunSkill(member: Member, steps: readonly { readonly action: string }[]): boolean {
  return steps.length > 0 && steps.every((step) => canExecute(member, step.action));
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
      return !required || required === (role || 'general');
    });
  }
  if (member.role === 'guest') return false;
  if (member.role !== 'member') return true;
  if (['register', 'pos.register'].includes(record.type) && roles.some((role) => ['cashier', 'manager'].includes(role))) return true;
  return roles.some((role) => {
    if (!role || role === 'general') return true;
    if (role === 'cashier') return ['contact', 'person', 'order', 'item', 'variant', 'price', 'stock', 'register', 'pos.register', 'invoice', 'payment', 'sale'].includes(record.type);
    if (role === 'warehouse') return ['order', 'stock', 'purchase', 'movement', 'task'].includes(record.type);
    return record.owner === member.userId || record.assignee === member.userId || workRole(record.data.workRole) === role;
  });
}
