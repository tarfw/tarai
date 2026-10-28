import { File, Paths } from 'expo-file-system';
import type { Database } from '@tursodatabase/sync-react-native';
import { getCurrentUser } from './auth';
import { harness, type HarnessWorkspace, type NowFeed, type NowRow } from './harness';

type Snapshot = {
  user: string;
  personal: string;
  url: string | null;
  feed: NowFeed;
  workspaces: HarnessWorkspace[];
};

type SyncCredentials = Awaited<ReturnType<typeof harness.nowSync>>;
const databases = new Map<string, Promise<Database>>();
const credentials = new Map<string, SyncCredentials>();
const credentialRequests = new Map<string, Promise<SyncCredentials>>();
const pulls = new Map<string, Promise<boolean>>();
const feedRequests = new Map<string, Promise<NowFeed>>();
const safe = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '');
const key = (user: string, personal: string) => `${safe(user)}-${safe(personal)}`;
const file = (user: string, personal: string) => new File(Paths.document, `inbox-${key(user, personal)}.json`);

type TursoRuntime = {
  Database: new (options: {
    path: string;
    url: string;
    authToken: () => Promise<string>;
    bootstrapIfEmpty: boolean;
    longPollTimeoutMs: number;
    clientName: string;
  }) => Database;
  getDbPath: (name: string) => string;
};

let turso: TursoRuntime | null | undefined;

/** The binary is only present in builds made after Turso was added; otherwise fall back to the Gateway feed. */
function tursoRuntime(): TursoRuntime | null {
  if (turso !== undefined) return turso;
  try {
    turso = require('@tursodatabase/sync-react-native') as TursoRuntime;
  } catch (cause) {
    if (__DEV__) console.warn('[Now] Turso sync is unavailable in this build; using the Gateway feed.', cause);
    turso = null;
  }
  return turso;
}

async function readSnapshot(personal: string): Promise<Snapshot | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const saved = file(user.id, personal);
  if (!saved.exists) return null;
  try {
    const snapshot = JSON.parse(await saved.text()) as Snapshot;
    return snapshot.user === user.id && snapshot.personal === personal ? snapshot : null;
  } catch { return null; }
}

async function writeSnapshot(personal: string, snapshot: Snapshot): Promise<void> {
  const saved = file(snapshot.user, personal);
  saved.write(JSON.stringify(snapshot));
}

async function syncCredentials(snapshot: Snapshot): Promise<SyncCredentials> {
  const id = key(snapshot.user, snapshot.personal);
  const saved = credentials.get(id);
  if (saved && saved.expiresAt > Date.now() + 30_000) return saved;
  const pending = credentialRequests.get(id);
  if (pending) return pending;
  const request = harness.nowSync().then((result) => {
    if (result.database !== snapshot.personal) throw new Error('Now sync identity changed.');
    credentials.set(id, result);
    return result;
  }).finally(() => { credentialRequests.delete(id); });
  credentialRequests.set(id, request);
  return request;
}

function openDatabase(snapshot: Snapshot): Promise<Database> {
  const id = key(snapshot.user, snapshot.personal);
  const existing = databases.get(id);
  if (existing) return existing;
  if (!snapshot.url) return Promise.reject(new Error('Now sync URL is unavailable.'));
  const runtime = tursoRuntime();
  if (!runtime) return Promise.reject(new Error('Now sync is unavailable in this build.'));
  const db = new runtime.Database({
    path: runtime.getDbPath(`inbox-${id}.db`),
    url: snapshot.url,
    authToken: async () => (await syncCredentials(snapshot)).authToken,
    // Open the local file without waiting for a remote bootstrap; pull below hydrates it.
    bootstrapIfEmpty: false,
    longPollTimeoutMs: 1_000,
    clientName: `tar-now-${safe(snapshot.user)}`,
  });
  const opening = db.connect().then(() => db).catch((cause) => {
    db.close();
    databases.delete(id);
    throw cause;
  });
  databases.set(id, opening);
  return opening;
}

function pullDatabase(snapshot: Snapshot, db: Database): Promise<boolean> {
  const id = key(snapshot.user, snapshot.personal);
  const existing = pulls.get(id);
  if (existing) return existing;
  const pending = db.pull().finally(() => { pulls.delete(id); });
  pulls.set(id, pending);
  return pending;
}

async function waitForPull(pull: Promise<boolean>): Promise<'done' | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pull.then(() => 'done' as const), new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), 6_000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

function retainKnown(feed: NowFeed, candidates: (NowFeed | null | undefined)[]): NowFeed {
  if (!feed.partial || !feed.failed.length) return feed;
  const failed = new Set(feed.failed);
  const present = new Set(feed.rows.map((row) => row.id));
  const retained: NowRow[] = [];
  for (const candidate of candidates) for (const row of candidate?.rows || []) {
    if (!failed.has(row.source) || candidate?.grants?.[row.source] !== feed.grants?.[row.source]
      || !feed.grants?.[row.source] || present.has(row.id)) continue;
    retained.push(row);
    present.add(row.id);
  }
  return retained.length ? { ...feed, rows: [...feed.rows, ...retained],
    sync: { ...Object.assign({}, ...candidates.map((candidate) => candidate?.sync || {})), ...feed.sync } } : feed;
}

function gatewayNow(personal: string, refresh?: string): Promise<NowFeed> {
  const id = `${personal}:${refresh || ''}`;
  const existing = feedRequests.get(id);
  if (existing) return existing;
  const request = harness.now(refresh).finally(() => {
    if (feedRequests.get(id) === request) feedRequests.delete(id);
  });
  feedRequests.set(id, request);
  return request;
}

const string = (value: unknown) => String(value ?? '');
const nullable = (value: unknown) => value === null || value === undefined ? null : String(value);
const number = (value: unknown) => Number(value || 0);

async function readDatabase(db: Database, snapshot: Snapshot, cached = false): Promise<NowFeed> {
  const [rows, projections] = await Promise.all([
    db.all(`SELECT * FROM inbox ORDER BY CASE WHEN due IS NULL THEN 1 ELSE 0 END,due,
      CASE lane WHEN 'mine' THEN 0 WHEN 'available' THEN 1 ELSE 2 END,
      updated DESC,source,parent,ordinal,id`),
    db.all('SELECT source,updated,authority FROM projection'),
  ]);
  const workspaces = new Map(snapshot.workspaces.map((workspace) => [workspace.id, workspace]));
  const authority = Object.fromEntries(projections.map((row) => [string(row.source), string(row.authority)]));
  const grants = snapshot.feed.grants || {};
  const visible = rows.filter((row) => workspaces.has(string(row.source)) && grants[string(row.source)] === authority[string(row.source)]);
  const mapped: NowRow[] = visible.map((row) => ({
    id: string(row.id), source: string(row.source), target: string(row.target),
    kind: string(row.kind) as NowRow['kind'], role: string(row.role), lane: string(row.lane) as NowRow['lane'],
    title: string(row.title), parent: nullable(row.parent), quantity: row.quantity == null ? null : number(row.quantity),
    state: string(row.state), due: row.due == null ? null : number(row.due), version: number(row.version),
    action: nullable(row.action), input: JSON.parse(string(row.input) || '{}') as Record<string, unknown>,
    updated: number(row.updated), workspace: workspaces.get(string(row.source))!,
  }));
  return { ...snapshot.feed, rows: mapped, sync: Object.fromEntries(projections.map((row) => [string(row.source), number(row.updated)])),
    partial: cached || snapshot.feed.partial, next: cached ? null : snapshot.feed.next };
}

export async function cachedNow(personal: string): Promise<NowFeed | null> {
  const snapshot = await readSnapshot(personal);
  if (!snapshot) return null;
  const saved = { ...snapshot.feed, partial: true, next: null };
  if (!snapshot.url) return saved;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const local = openDatabase(snapshot).then((db) => readDatabase(db, snapshot, true))
      .then((feed) => feed.rows.length === 0 && saved.rows.length > 0 ? saved : feed)
      .catch(() => saved);
    return await Promise.race([local, new Promise<NowFeed>((resolve) => {
      timer = setTimeout(() => resolve(saved), 350);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export async function refreshNow(personal: string, workspaces: HarnessWorkspace[], refresh?: string, onFeed?: (feed: NowFeed) => void, known?: NowFeed): Promise<NowFeed> {
  // The Gateway refreshes source projections; the device pulls the per-user Now database.
  const remote = await gatewayNow(personal, refresh);
  const user = await getCurrentUser();
  if (!user) return remote;
  const previous = await readSnapshot(personal);
  const feed = retainKnown(remote, [known, previous?.feed]);
  onFeed?.(feed);
  const snapshot: Snapshot = { user: user.id, personal, url: previous?.url || null, feed, workspaces };
  try {
    const access = await syncCredentials(snapshot);
    snapshot.url = access.url;
    await writeSnapshot(personal, snapshot);
    const db = await openDatabase(snapshot);
    const completion = await waitForPull(pullDatabase(snapshot, db));
    if (__DEV__ && completion === 'timeout') console.warn('[Now] Turso pull is still running; the current Gateway feed remains available.');
    if (completion === 'done') {
      const synced = retainKnown(await readDatabase(db, snapshot), [feed]);
      const caughtUp = Object.entries(feed.sync).every(([source, updated]) => (synced.sync[source] || 0) >= updated);
      if (caughtUp) {
        snapshot.feed = synced;
        await writeSnapshot(personal, snapshot);
        onFeed?.(synced);
        return synced;
      }
    }
    return feed;
  } catch (cause) {
    await writeSnapshot(personal, snapshot);
    if (__DEV__) console.warn('[Now] Turso sync pull failed; using Gateway feed.', cause);
    return feed;
  }
}

export async function cachedWorkspaces(): Promise<HarnessWorkspace[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  for (const entry of Paths.document.list()) {
    if (!(entry instanceof File) || !entry.name.startsWith(`inbox-${safe(user.id)}-`) || !entry.name.endsWith('.json')) continue;
    try {
      const snapshot = JSON.parse(await entry.text()) as Snapshot;
      if (snapshot.user === user.id && snapshot.workspaces.length) return snapshot.workspaces;
    } catch { /* Ignore an incomplete snapshot. */ }
  }
  return null;
}

export async function clearNowStorage(userId: string): Promise<void> {
  const prefix = `${safe(userId)}-`;
  for (const [id, opening] of databases) if (id.startsWith(prefix)) {
    try { (await opening).close(); } catch { /* A failed connection has nothing to close. */ }
    databases.delete(id);
  }
  for (const id of credentials.keys()) if (id.startsWith(prefix)) credentials.delete(id);
  for (const id of credentialRequests.keys()) if (id.startsWith(prefix)) credentialRequests.delete(id);
  for (const id of pulls.keys()) if (id.startsWith(prefix)) pulls.delete(id);
  feedRequests.clear();
  for (const entry of Paths.document.list()) {
    if (entry instanceof File && ['inbox', 'now'].some((prefix) => entry.name.startsWith(`${prefix}-${safe(userId)}-`)) && entry.name.endsWith('.json')) entry.delete();
  }
  const runtime = tursoRuntime();
  if (!runtime) return;
  try {
    const directory = new File(`file://${runtime.getDbPath('inbox.db')}`).parentDirectory;
    for (const entry of directory.list()) {
      if (entry instanceof File && ['inbox', 'now'].some((prefix) => entry.name.startsWith(`${prefix}-${safe(userId)}-`))) entry.delete();
    }
  } catch (cause) {
    if (__DEV__) console.warn('[Now] Could not remove the local sync files.', cause);
  }
}
