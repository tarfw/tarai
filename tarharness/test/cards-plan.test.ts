import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { confirmSkill, dropSkill, findSkill, listSkills } from '../src/skill/engine.ts';
import { planCardChange, type PlanInput } from '../src/skill/plan.ts';
import { lastMoveId } from '../src/truth/write.ts';
import type { ToolId } from '../src/tools/registry.ts';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => { clients.splice(0).forEach((client) => client.close()); });

async function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'tar-plan-test-'));
  const client = createClient({ url: pathToFileURL(join(directory, 'workspace.db')).href }); clients.push(client);
  for (const sql of WORKSPACE_SCHEMA) await client.execute(sql);
  return client;
}

const noMoment = async () => ({ add: [], remove: [], confidence: 0, model: null });
const noProposer = async (): Promise<never> => { throw new Error('the proposer must not run'); };

const plan = (words: string, deck: ToolId[], overrides: Partial<PlanInput> = {}) => planCardChange({
  words, deck, history: [], mode: 'work', moment: noMoment, propose: noProposer, ...overrides,
});

describe('plan: the core comes first', () => {
  it('adds a named card with zero model calls', async () => {
    const outcome = await plan('add site', ['pos']);
    expect(outcome).toMatchObject({ kind: 'card', add: ['site'], changes: ['+ Storefront'] });
  });

  it('says so when the card is already there', async () => {
    const outcome = await plan('Add site', ['pos', 'site']);
    expect(outcome).toMatchObject({ kind: 'known', message: 'Storefront is already on your canvas.' });
  });

  it('adds two named cards in one plan', async () => {
    const outcome = await plan('add site and billing', ['pos']);
    expect(outcome).toMatchObject({ kind: 'card', add: ['invoice', 'site'] });
  });

  it('asks instead of guessing when a card name is part of a job', async () => {
    const outcome = await plan('add site with ordering', ['pos'], {
      propose: async () => ({ kind: 'question', text: 'Who takes the orders?' }),
    });
    expect(outcome).toMatchObject({ kind: 'question', text: 'Who takes the orders?' });
  });

  it('lets a schedule earn a one-step card, without asking Jev for a deck change', async () => {
    const outcome = await plan('count cash every day at 10', ['pos', 'register'], {
      moment: async () => { throw new Error('a schedule is a plan, not a deck change'); },
      propose: async () => ({ kind: 'plan', title: 'Count the cash', trigger: { type: 'schedule', at: '10:00' }, steps: [{ action: 'register.count', input: {} }] }),
    });
    expect(outcome.kind).toBe('skill');
    if (outcome.kind !== 'skill') return;
    expect(outcome.draft.preview[0]).toBe('Every day at 10:00');
    expect(outcome.draft.preview[1]).toContain('Count');
  });

  it('turns a junk lone tap named like a core card into that card, never a skill', async () => {
    const proposal = { kind: 'plan' as const, title: 'Add site', trigger: { type: 'tap' as const }, steps: [{ action: 'task.create', input: { title: 'Add site' } }] };
    const outcome = await plan('make a card called add site', [], { propose: async () => proposal });
    expect(outcome).toMatchObject({ kind: 'card', add: ['site'] });
    const known = await plan('make a card called add site', ['site'], { propose: async () => proposal });
    expect(known).toMatchObject({ kind: 'known' });
  });

  it('offers the core card when the plan is only that card one tap', async () => {
    const outcome = await plan('do the billing run please', ['pos'], {
      propose: async () => ({ kind: 'plan', title: 'Bill run', trigger: { type: 'tap' }, steps: [{ action: 'invoice.issue', input: {} }] }),
    });
    expect(outcome).toMatchObject({ kind: 'card', add: ['invoice'] });
  });

  it('gives a plain reason when no plan can be made', async () => {
    const outcome = await plan('print labels', ['pos'], {
      propose: async () => { throw new Error('I cannot plan that yet. Try naming the work in a few more words.'); },
    });
    expect(outcome).toMatchObject({ kind: 'none', reason: 'I cannot plan that yet. Try naming the work in a few more words.' });
  });
});

describe('confirm: the card floor', () => {
  const draft = (overrides: Record<string, unknown> = {}) => ({
    title: 'Send the invoice reminder', words: 'remind customers', trigger: { type: 'tap' as const },
    steps: [{ action: 'invoice.issue', input: {} }], shape: 'shape-reminder', ...overrides,
  });

  it('refuses a lone tap on a core card', async () => {
    const client = await workspace();
    await expect(confirmSkill(client, 'owner', draft() as never, 'confirm-junk')).rejects.toThrow('one tap on a card');
  });

  it('refuses a card named like a core card', async () => {
    const client = await workspace();
    await expect(confirmSkill(client, 'owner', draft({ title: 'Storefront', steps: [{ action: 'channel.send', input: {} }] }) as never, 'confirm-name')).rejects.toThrow('Storefront card');
  });

  it('saves a real one-step schedule card', async () => {
    const client = await workspace();
    const saved = await confirmSkill(client, 'owner', draft({ trigger: { type: 'schedule', at: '10:00' } }) as never, 'confirm-ok');
    expect(saved.confirmed).toBe(true);
    expect(await listSkills(client)).toHaveLength(1);
  });
});

describe('drop: a card leaves the canvas for good', () => {
  it('hides the card, moves the version, and stops a run by id', async () => {
    const client = await workspace();
    const before = await lastMoveId(client);
    const saved = await confirmSkill(client, 'owner', {
      title: 'Evening close', words: 'close the day', trigger: { type: 'tap' },
      steps: [{ action: 'task.create', input: { title: 'Count the drawer' } }, { action: 'task.complete', input: {} }],
      shape: 'shape-close',
    }, 'confirm-close');
    expect(await listSkills(client)).toHaveLength(1);
    await dropSkill(client, saved.id, 'owner', 'drop-1');
    expect(await listSkills(client)).toHaveLength(0);
    expect(await findSkill(client, saved.id, true)).toBeNull();
    expect(await lastMoveId(client)).not.toBe(before);
    await expect(dropSkill(client, saved.id, 'owner', 'drop-2')).rejects.toThrow('not on the canvas');
  });
});
