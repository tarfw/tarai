// The cost guard: writes and models share the monthly ceiling; the hot
// window is 90 days; every month closes hash-sealed to R2. current is always
// close + bounded move, rebuildable.

import type { Client } from '@libsql/client/web';

interface CloseTotals { [account: string]: number }

export interface CloseSeal {
  readonly workspace: string;
  readonly month: string; // YYYY-MM
  readonly moveCount: number;
  readonly totals: CloseTotals;
  readonly sealedAt: number;
  readonly hash: string;
}

const monthKey = (at: number) => {
  const date = new Date(at);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Aggregate one closed month from the move ledger. */
export async function buildClose(client: Client, workspace: string, month: string): Promise<CloseSeal | null> {
  const from = Date.parse(`${month}-01T00:00:00Z`);
  if (!Number.isFinite(from)) return null;
  const to = monthEnd(from);
  const moves = await client.execute({ sql: 'SELECT COUNT(*) FROM move WHERE created_at>=? AND created_at<?', args: [from, to] });
  const moveCount = Number(moves.rows[0]?.[0] ?? 0);
  if (!moveCount) return null;
  const postings = await client.execute({
    sql: "SELECT json_extract(data,'$.result.posting.data.lines') AS lines FROM move WHERE created_at>=? AND created_at<? AND json_extract(data,'$.result.posting.data.lines') IS NOT NULL",
    args: [from, to],
  });
  const totals: CloseTotals = {};
  for (const row of postings.rows) {
    try {
      const lines = JSON.parse(String(row[0])) as { account: string; debit?: number; credit?: number }[];
      for (const line of lines) {
        totals[line.account] = (totals[line.account] ?? 0) + Number(line.debit ?? 0) - Number(line.credit ?? 0);
      }
    } catch { /* skip unreadable */ }
  }
  const sealedAt = Date.now();
  const body = JSON.stringify({ workspace, month, moveCount, totals });
  return { workspace, month, moveCount, totals, sealedAt, hash: await sha256Hex(body) };
}

function monthEnd(from: number): number {
  const date = new Date(from);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

/** Seal one month to R2 and stamp current; the moves it covers may leave the hot window. */
export async function sealClose(client: Client, archive: R2Bucket, seal: CloseSeal): Promise<boolean> {
  const key = `archive/workspaces/${seal.workspace}/closes/${seal.month}.json`;
  await archive.put(key, JSON.stringify(seal), { httpMetadata: { contentType: 'application/json' }, customMetadata: { workspace: seal.workspace, month: seal.month, hash: seal.hash } });
  await client.execute({
    sql: `INSERT INTO current (kind,key,data) VALUES ('close', ?, ?)
      ON CONFLICT(kind,key) DO UPDATE SET data=excluded.data`,
    args: [seal.month, JSON.stringify({ hash: seal.hash, sealedAt: seal.sealedAt, moveCount: seal.moveCount, key })],
  });
  return true;
}

/** The hot window: 90 days. Moves older than that AND covered by a seal leave the workspace DB (they live in R2). */
export async function pruneHotWindow(client: Client, now = Date.now()): Promise<number> {
  const boundary = now - 90 * 24 * 60 * 60_000;
  const sealed = await client.execute("SELECT key FROM current WHERE kind='close'");
  const sealedMonths = sealed.rows.map((row) => String(row[0])).sort();
  if (!sealedMonths.length) return 0;
  const oldestSealEnd = monthEnd(Date.parse(`${sealedMonths[0]}-01T00:00:00Z`));
  const cutoff = Math.min(boundary, oldestSealEnd);
  if (!Number.isFinite(cutoff)) return 0;
  const before = await client.execute({ sql: 'SELECT COUNT(*) FROM move WHERE created_at<?', args: [cutoff] });
  await client.execute({ sql: 'DELETE FROM move WHERE created_at<?', args: [cutoff] });
  return Number(before.rows[0]?.[0] ?? 0);
}

/** The ceiling: writes and models share it. Reads never stop. */
export async function monthlyWriteCount(client: Client, now = Date.now()): Promise<number> {
  const month = monthKey(now);
  const from = Date.parse(`${month}-01T00:00:00Z`);
  const result = await client.execute({ sql: 'SELECT COUNT(*) FROM move WHERE created_at>=?', args: [from] });
  return Number(result.rows[0]?.[0] ?? 0);
}
