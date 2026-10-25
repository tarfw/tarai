import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { ask, confirmSkill, validatePlan } from '../src/skill/engine.ts';
import { startRun, advanceRun, listRuns } from '../src/skill/run.ts';
import type { AccessContext } from '../src/types.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => { clients.splice(0).forEach((client) => client.close()); });
const owner: AccessContext = {
  identity: { id: 'owner', email: 'owner@example.com', name: 'Owner' },
  workspace: { id: 'ws', name: 'Stall', slug: 'stall', mode: 'work', databaseName: 's', databaseHost: 's', state: 'active' },
  member: { workspaceId: 'ws', userId: 'owner', role: 'owner', state: 'active' },
};

async function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'tar-skill-test-'));
  const client = createClient({ url: pathToFileURL(join(directory, 'workspace.db')).href }); clients.push(client);
  for (const sql of WORKSPACE_SCHEMA) await client.execute(sql);
  return client;
}

const PROPOSER = async () => ({ title: 'Daily sales report', trigger: { type: 'schedule', at: '10:00' } as const, steps: [{ action: 'task.create', input: { title: 'Send the sales report' } }] });

describe('skills: words to plan to card', () => {
  it('refuses plans with unregistered actions and caps length at twelve', async () => {
    expect(() => validatePlan([{ action: 'make.coffee' }])).toThrow('unregistered');
    expect(() => validatePlan(Array.from({ length: 13 }, () => ({ action: 'task.create', input: {} })))).toThrow('twelve');
    expect(validatePlan([{ action: 'task.create', input: { title: 'x' } }])).toHaveLength(1);
  });

  it('L2 proposes, the confirm remembers, L1 and L0 run free after', async () => {
    const client = await workspace();
    const first = await ask(client, 'every day 10am send me the sales report', PROPOSER);
    expect(first.ladder).toBe('L2');
    expect(first.draft!.steps[0].action).toBe('task.create');
    const confirmed = await confirmSkill(client, 'owner', first.draft!, 'confirm-1');
    expect(confirmed.confirmed).toBe(true);
    // same words again: L0, zero calls
    const literal = await ask(client, 'every day 10am send me the sales report', async () => { throw new Error('proposer must not run'); });
    expect(literal.ladder).toBe('L0');
    expect(literal.skill!.id).toBe(confirmed.id);
    // same shape, different words: L1, zero calls
    const shape = await ask(client, 'send me a sales report every morning at ten', async () => ({ title: 'Whatever', trigger: { type: 'schedule', at: '10:00' }, steps: [{ action: 'task.create', input: {} }] }));
    expect(shape.ladder).toBe('L1');
  });

  it('a run advances through auto steps and parks on a person step', async () => {
    const client = await workspace();
    const draft = await ask(client, 'close the day', async () => ({ title: 'Evening close', trigger: { type: 'tap' } as const, steps: [
      { action: 'task.create', input: { title: 'Count the drawer' }, auto: true },
      { action: 'task.complete', input: {} },
    ] }));
    const skill = await confirmSkill(client, 'owner', draft.draft!, 'confirm-run');
    const executed: string[] = [];
    const run = await startRun(client, owner, skill, 'run-key-1');
    expect(run.status).toBe('ready');
    const advanced = await advanceRun(client, owner, run.id, { execute: async (actionId) => { executed.push(actionId); return {}; } });
    // step 0 was auto, step 1 needs a person
    expect(advanced).toMatchObject({ status: 'waiting', step: 1 });
    expect(executed).toEqual(['task.create']);
    const open = await listRuns(client);
    expect(open).toHaveLength(1);
    // same key never starts twice
    const again = await startRun(client, owner, skill, 'run-key-1');
    expect(again.id).toBe(run.id);
  });
});
