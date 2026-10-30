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

/** Repeated intent check. The move ledger is the single source of truth; the replay
 * lookup targets `move` by idempotency key (the old `events` table is gone, see schema). */
export async function findReplay(db: DB, key: string, inputHash: string): Promise<Record<string, unknown> | null> {
  const result = await db.execute({ sql: 'SELECT input_hash,data FROM move WHERE idempotency_key=?', args: [key] });
  if (!result.rows[0]) return null;
  if (String(result.rows[0][0]) !== inputHash) throw conflict('This idempotency key was already used with different input.');
  return object(JSON.parse(String(result.rows[0][1])));
}

/** An append-only audit row: the event feed is a view over `move`. */
export function eventStatement(input: { action: string; actor: string; key: string; hash: string; result: Record<string, unknown>; recordId?: string | null; runId?: string | null }): InStatement {
  const at = stamp();
  return {
    sql: `INSERT INTO move (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,amount,why,source,data,created_at,updated_at)
      VALUES (?,?,?,?,?, 'accepted', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `evt_${crypto.randomUUID()}`, 'action', input.runId ?? null, input.recordId ?? null, input.action,
      input.actor, input.hash, input.key, null, null, 'tap', json({ result: input.result }), at, at,
    ],
  };
}


