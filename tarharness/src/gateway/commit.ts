import type { Client, InStatement } from '@libsql/client/web';
import { conflict } from '../errors.ts';

export type DB = Pick<Client, 'execute'>;

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const json = (value: unknown) => JSON.stringify(value);
export const stamp = () => Date.now();

export async function fingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(json(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function findReplay(db: DB, key: string, inputHash: string): Promise<Record<string, unknown> | null> {
  const result = await db.execute({ sql: 'SELECT input_hash,data FROM events WHERE idempotency_key=?', args: [key] });
  if (!result.rows[0]) return null;
  if (String(result.rows[0][0]) !== inputHash) throw conflict('This idempotency key was already used with different input.');
  return object(JSON.parse(String(result.rows[0][1])));
}

export interface EventInput {
  readonly action: string;
  readonly actor: string;
  readonly key: string;
  readonly hash: string;
  readonly result: Record<string, unknown>;
  readonly recordId?: string | null;
  readonly runId?: string | null;
}

export function eventStatement(input: EventInput): InStatement {
  const at = stamp();
  return {
    sql: `INSERT INTO move (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      VALUES (?,?,?,?,?,'accepted',?,?,?,?,?,?)`,
    args: [`evt_${crypto.randomUUID()}`, 'action', input.runId ?? null, input.recordId ?? null, input.action, input.actor, input.hash, input.key, json({ result: input.result }), at, at],
  };
}

export async function appendEvent(db: DB, input: EventInput): Promise<void> {
  await db.execute(eventStatement(input));
}

export interface RunInput {
  readonly id?: string;
  readonly flowId: string;
  readonly flowVersion: number;
  readonly occurrence: string;
  readonly actionId: string | null;
  readonly context: Record<string, unknown>;
  readonly recordId?: string | null;
  readonly state?: string;
  readonly startedAt?: number | null;
  readonly finishedAt?: number | null;
}

export function runStatement(input: RunInput): InStatement {
  const at = stamp();
  return {
    sql: `INSERT INTO runs (id,flow_id,flow_version,occurrence,record_id,state,action_id,context,version,started_at,finished_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?)`,
    args: [input.id ?? `run_${crypto.randomUUID()}`, input.flowId, input.flowVersion, input.occurrence, input.recordId ?? null, input.state ?? 'ready', input.actionId, json(input.context), input.startedAt ?? null, input.finishedAt ?? null, at, at],
  };
}

export function stepStatement(run: string, occurrence: number, action: string, input: Record<string, unknown>, output: Record<string, unknown>, at = stamp()): InStatement {
  return {
    sql: `INSERT INTO steps (id,run,action,occurrence,state,input,output,version,created,updated)
      SELECT ?, ?, ?, ?, 'accepted', ?, ?, 1, ?, ? WHERE changes()=1`,
    args: [crypto.randomUUID(), run, action, occurrence, json(input), json(output), at, at],
  };
}

export async function appendRun(db: DB, input: RunInput): Promise<string> {
  const id = input.id ?? `run_${crypto.randomUUID()}`;
  await db.execute(runStatement({ ...input, id }));
  return id;
}
