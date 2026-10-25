// Runs: one execution of a skill. A log, never a resume — the run table
// records where a run stands; the steps themselves are moves in the ledger.

import type { Client } from '@libsql/client/web';
import { badRequest, conflict, notFound } from '../errors.ts';
import type { AccessContext } from '../types.ts';
import { findAction } from '../registry/catalog.ts';
import { ask as askSkill, type SkillRecord, type Trigger } from './engine.ts';

export type RunStatus = 'ready' | 'waiting' | 'done' | 'failed';

export interface RunView {
  readonly id: string;
  readonly skill: string;
  readonly title: string;
  readonly step: number;
  readonly status: RunStatus;
  readonly key: string;
}

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const json = (value: unknown) => JSON.stringify(value);

export function isDue(trigger: Trigger, zoneNow: Date): boolean {
  if (trigger.type !== 'schedule') return false;
  const [hours, minutes] = trigger.at.split(':').map(Number);
  return zoneNow.getHours() === hours && zoneNow.getMinutes() === minutes;
}

/** Start a run. Same key never starts twice (the run table's law). */
export async function startRun(client: Client, context: AccessContext, skill: SkillRecord, key: string, input: Record<string, unknown> = {}): Promise<RunView> {
  if (!key) throw badRequest('A run key is required.');
  const existing = await client.execute({ sql: 'SELECT id,skill,step,status,key FROM run WHERE key=?', args: [key] });
  if (existing.rows[0]) return rowToView(existing.rows[0], skill);
  const id = `run_${crypto.randomUUID()}`;
  await client.execute({
    sql: 'INSERT INTO run(id,skill,step,status,key,input,created) VALUES (?,?,0,?,?,?,?)',
    args: [id, skill.id, 'ready', key, json(input), Date.now()],
  });
  return { id, skill: skill.id, title: skill.title, step: 0, status: 'ready', key };
}

interface Stepper { readonly execute: (actionId: string, input: Record<string, unknown>, key: string) => Promise<Record<string, unknown>> }

/**
 * Advance a run: execute the current step through the caller's executor
 * (which is the gateway, gates and all). Auto steps keep advancing until an
 * ask/approve step or the end; ask steps park the run as waiting.
 */
export async function advanceRun(client: Client, context: AccessContext, runId: string, stepper: Stepper, confirmedInput?: Record<string, unknown>): Promise<RunView> {
  const runRow = await client.execute({ sql: 'SELECT id,skill,step,status,key,input FROM run WHERE id=?', args: [runId] });
  const row = runRow.rows[0];
  if (!row) throw notFound('Run not found.');
  if (String(row[3]) === 'done') return rowToView(row);
  if (String(row[3]) === 'failed') throw conflict('This run failed. Start it again with a new key.');
  const skillRow = await client.execute({ sql: 'SELECT data FROM skill WHERE id=?', args: [String(row[1])] });
  if (!skillRow.rows[0]) throw notFound('The skill behind this run is gone.');
  const data = object(JSON.parse(String(skillRow.rows[0][0])));
  const steps = Array.isArray(data.steps) ? data.steps.map(object) : [];
  let step = Number(row[2]);
  const input = { ...object(JSON.parse(String(row[5]))), ...(confirmedInput ?? {}) };
  // waiting runs resume only with the member's supplied input
  if (String(row[3]) === 'waiting' && !confirmedInput) throw conflict('This step needs your answer.');
  let status: RunStatus = 'ready';
  while (step < steps.length) {
    const current = steps[step];
    const action = findAction(String(current.action || ''));
    if (!action) throw badRequest('This skill uses an unregistered action.');
    const isResume = step === Number(row[2]) && confirmedInput !== undefined;
    if (current.auto === true || isResume) {
      const result = await stepper.execute(action.id, { ...object(current.input), ...input }, `run:${runId}:${step}`);
      void result;
      step += 1;
      continue;
    }
    // a person-step parks the run
    status = 'waiting';
    break;
  }
  if (step >= steps.length) status = 'done';
  await client.execute({ sql: 'UPDATE run SET step=?, status=? WHERE id=?', args: [step, status, runId] });
  return { id: runId, skill: String(row[1]), title: String(data.title ?? 'Skill'), step, status, key: String(row[4]) };
}

function rowToView(row: { [index: number]: unknown }, skill?: SkillRecord): RunView {
  return { id: String(row[0]), skill: String(row[1]), title: skill?.title ?? 'Skill', step: Number(row[2]), status: String(row[3]) as RunStatus, key: String(row[4]) };
}

/** A member's open runs, newest first. */
export async function listRuns(client: Client): Promise<RunView[]> {
  const result = await client.execute("SELECT r.id,r.skill,r.step,r.status,r.key,s.data FROM run r LEFT JOIN skill s ON s.id=r.skill WHERE r.status IN ('ready','waiting') ORDER BY r.created DESC LIMIT 50");
  return result.rows.map((row) => {
    const data = object(JSON.parse(String(row[5] ?? '{}')));
    return { id: String(row[0]), skill: String(row[1]), title: String(data.title ?? 'Skill'), step: Number(row[2]), status: String(row[3]) as RunStatus, key: String(row[4]) };
  });
}
