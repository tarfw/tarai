// The truth engine: one write = record + move + current + inbox, one
// transaction (the cost-guard law). Actions compose their statements through
// these helpers so the pattern cannot drift per action.
//
//   record  every fact, versioned, archived never deleted
//   move    every change ever. append-only. the event feed is a view over it
//   current the number now. derived, rebuildable from close + bounded move
//   inbox   each member's rows, typed by tool

import type { InStatement } from '@libsql/client/web';
import type { Client } from '@libsql/client/web';
import { conflict } from '../errors.ts';
import { fingerprint, stamp } from '../gateway/commit.ts';

const json = (value: unknown) => JSON.stringify(value);
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export interface MoveInput {
  readonly kind: string;
  readonly actor: string;
  readonly key: string;
  readonly hash: string;
  readonly result: Record<string, unknown>;
  readonly recordId?: string | null;
  readonly runId?: string | null;
  readonly action?: string | null;
  /** money moves carry the signed minor-unit amount */
  readonly amount?: number | null;
  /** the human reason, shown in the feed */
  readonly why?: string | null;
  /** where the change came from: tap, schedule, adapter, undo */
  readonly source?: string | null;
}

/** The append-only ledger row. Everything a reader of "what happened" needs. */
export function moveStatement(input: MoveInput): InStatement {
  const at = stamp();
  return {
    sql: `INSERT INTO move (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,amount,why,source,data,created_at,updated_at)
      VALUES (?,?,?,?,?, 'accepted', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `mov_${crypto.randomUUID()}`, input.kind, input.runId ?? null, input.recordId ?? null, input.action ?? null,
      input.actor, input.hash, input.key, input.amount ?? null, input.why ?? null, input.source ?? 'tap', json({ result: input.result }), at, at,
    ],
  };
}

export async function moveHash(input: { actor: string; action?: string | null; input: Record<string, unknown> }): Promise<string> {
  return fingerprint({ actor: input.actor, action: input.action ?? null, input: input.input });
}

/** current: the number now. Upsert — it is derived, never appended. */
export function currentStatement(kind: string, key: string, data: Record<string, unknown>): InStatement {
  return {
    sql: `INSERT INTO current (kind,key,data) VALUES (?,?,?)
      ON CONFLICT(kind,key) DO UPDATE SET data=excluded.data`,
    args: [kind, key, json(data)],
  };
}

export interface InboxInput {
  readonly member: string;
  readonly moveId?: string | null;
  readonly tool: string;
  readonly reach: 'none' | 'data' | 'customer' | 'money';
  readonly title: string;
  readonly due?: number | null;
  readonly assigned?: string | null;
  /** one tap: the action this row carries, with its bound input */
  readonly action?: string | null;
  readonly input?: Record<string, unknown>;
  readonly urgent?: boolean;
}

export function inboxStatement(input: InboxInput): InStatement {
  return {
    sql: `INSERT INTO inbox (id,member,move,tool,reach,due,assigned,status,data,created)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
    args: [
      `inb_${crypto.randomUUID()}`, input.member, input.moveId ?? null, input.tool, input.reach,
      input.due ?? null, input.assigned ?? null, 'pending',
      json({ title: input.title, urgent: input.urgent === true, ...(input.action ? { action: input.action } : {}), ...(input.input ? { input: input.input } : {}) }),
      stamp(),
    ],
  };
}

/** One transaction: the whole write lands or nothing does. */
export async function commitWrite(db: Pick<Client, 'batch'>, statements: readonly InStatement[]): Promise<void> {
  await db.batch([...statements], 'write');
}

/** Replay guard on the move ledger: same key + same hash returns the saved result. */
export async function findMoveReplay(db: Pick<Client, 'execute'>, key: string, inputHash: string): Promise<Record<string, unknown> | null> {
  const result = await db.execute({ sql: 'SELECT input_hash,data FROM move WHERE idempotency_key=?', args: [key] });
  if (!result.rows[0]) return null;
  if (String(result.rows[0][0]) !== inputHash) throw conflict('This idempotency key was already used with different input.');
  return object(JSON.parse(String(result.rows[0][1]))).result as Record<string, unknown> ?? {};
}

/** The slice version: the newest move id. if-none-match on this is the 20s poll. */
export async function lastMoveId(db: Pick<Client, 'execute'>): Promise<string | null> {
  const result = await db.execute('SELECT id FROM move ORDER BY created_at DESC, id DESC LIMIT 1');
  return result.rows[0] ? String(result.rows[0][0]) : null;
}

export interface InboxRow {
  readonly id: string;
  readonly member: string;
  readonly move: string | null;
  readonly tool: string;
  readonly reach: string;
  readonly due: number | null;
  readonly assigned: string | null;
  readonly status: string;
  readonly title: string;
  readonly urgent: boolean;
  readonly action: string | null;
  readonly input: Record<string, unknown>;
  readonly created: number;
}

/** A member's own rows, open first, urgent on top, due next. */
export async function readInbox(db: Pick<Client, 'execute'>, member: string, limit = 50): Promise<InboxRow[]> {
  const result = await db.execute({
    sql: `SELECT id,member,move,tool,reach,due,assigned,status,data,created FROM inbox
      WHERE member=? AND status='pending' ORDER BY created DESC LIMIT ?`,
    args: [member, limit],
  });
  return result.rows.map((row) => {
    const data = object(JSON.parse(String(row[8])));
    return {
      id: String(row[0]), member: String(row[1]), move: row[2] === null ? null : String(row[2]),
      tool: String(row[3]), reach: String(row[4]), due: row[5] === null ? null : Number(row[5]),
      assigned: row[6] === null ? null : String(row[6]), status: String(row[7]),
      title: String(data.title ?? ''), urgent: data.urgent === true,
      action: typeof data.action === 'string' ? data.action : null,
      input: object(data.input), created: Number(row[9]),
    };
  });
}

/** Completing a row keeps it (history) but closes it. */
export function completeInboxStatement(id: string): InStatement {
  return { sql: "UPDATE inbox SET status='done' WHERE id=? AND status='pending'", args: [id] };
}

export async function findMove(db: Pick<Client, 'execute'>, id: string): Promise<{ id: string; kind: string; recordId: string | null; actionId: string | null; amount: number | null; data: Record<string, unknown> } | null> {
  const result = await db.execute({ sql: 'SELECT id,kind,record_id,action_id,amount,data FROM move WHERE id=?', args: [id] });
  const row = result.rows[0];
  if (!row) return null;
  return { id: String(row[0]), kind: String(row[1]), recordId: row[2] === null ? null : String(row[2]), actionId: row[3] === null ? null : String(row[3]), amount: row[4] === null ? null : Number(row[4]), data: object(JSON.parse(String(row[5]))) };
}
