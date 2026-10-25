import { describe, expect, it } from 'vitest';
import { canExecute } from '../src/access.ts';
import type { Member } from '../src/types.ts';

const member = (over: Partial<Member> & { workRole?: string; access?: readonly string[] }): Member => ({
  workspaceId: 'ws', userId: 'u1', role: 'member', state: 'active', workRole: 'general', ...over,
} as Member);

describe('access v2: grants choose the stack', () => {
  it('owners and admins act through every registered action', () => {
    expect(canExecute({ ...member({ role: 'owner' }), workRole: undefined }, 'sale.write')).toBe(true);
    expect(canExecute({ ...member({ role: 'admin' }), workRole: undefined }, 'site.publish')).toBe(true);
  });

  it('a member acts exactly through their hired role tools', () => {
    const cashier = member({ workRole: 'cashier' });
    expect(canExecute(cashier, 'sale.write')).toBe(true);
    expect(canExecute(cashier, 'register.count')).toBe(true);
    expect(canExecute(cashier, 'order.create')).toBe(true);
    expect(canExecute(cashier, 'purchase.create')).toBe(false);
    expect(canExecute(cashier, 'stock.adjust')).toBe(false);
    const general = member({ workRole: 'general' });
    expect(canExecute(general, 'task.create')).toBe(true);
    expect(canExecute(general, 'sale.write')).toBe(false);
  });

  it('an explicit tool whitelist wins over the hired role, with legacy ids mapped', () => {
    const whitelisted = member({ workRole: 'cashier', access: ['pos'] });
    expect(canExecute(whitelisted, 'sale.write')).toBe(true);
    expect(canExecute(whitelisted, 'register.count')).toBe(false);
    const legacy = member({ workRole: 'general', access: ['human', 'order'] });
    expect(canExecute(legacy, 'task.create')).toBe(true); // human -> task
    expect(canExecute(legacy, 'order.create')).toBe(true);
    expect(canExecute(legacy, 'sale.write')).toBe(false);
    // catalog.item.save stays out of reach: its roles are owner/admin, and
    // grants never widen roles
    expect(canExecute(legacy, 'catalog.item.save')).toBe(false);
  });

  it('unregistered or guest-level requests never pass', () => {
    expect(canExecute(member({ workRole: 'manager' }), 'pos.checkout')).toBe(false);
    expect(canExecute({ ...member({ role: 'guest' }), workRole: undefined }, 'task.create')).toBe(false);
    expect(canExecute(member({ state: 'revoked', workRole: 'cashier' }), 'sale.write')).toBe(false);
  });
});
