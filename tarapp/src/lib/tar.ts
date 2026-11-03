// One door: the TAR actor. The app is a window — a session, a slice, intents.
// It never holds a database token, never syncs, never mirrors.
// Transport: the workspace actor on Rivet (1 workspace = 1 actor + 1 SQLite).

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { createClient } from 'rivetkit/client';

const APP_URL = process.env.EXPO_PUBLIC_TAR_APP_URL || 'https://tars93k.onrivet.dev';
const API_URL = process.env.EXPO_PUBLIC_TAR_API_URL || 'https://tars93k-api.onrivet.dev';
const SESSION_KEY = 'tar_session_v2';
const REGISTRY_KEY = 'tar_ws_registry';

export interface TarWorkspace { id: string; name: string; slug: string; mode: 'personal' | 'work'; role: string; state: string; badge: number }
export interface InboxRow { id: string; tool: string; reach: string; due: number | null; status: string; title: string; urgent: boolean; action: string | null; input: Record<string, unknown>; created: number }
export interface CardView { tool: string; title: string; reach: string; shape: string; tap: { action: string | null; label: string }; number: string | null; pendingLine: string | null }
export interface SkillView { id: string; title: string; shape?: string; trigger: { type: string; at?: string; on?: string }; steps: { action: string; input: Record<string, unknown>; auto?: boolean }[] }
export interface Slice {
  version: string | null;
  next: InboxRow | null;
  inbox: InboxRow[];
  cards: CardView[];
  skills: SkillView[];
  workspace: { id: string; name: string; slug: string; mode: string; role: string };
}

export class TarError extends Error {
  constructor(readonly status: number, message: string, readonly body: Record<string, unknown> = {}) { super(message); }
}

// --- session: a gateway token minted by the actor node ---

interface Session { token: string; expiresAt: number; engine?: string }
let cachedClient: { token: string; client: any } | null = null;

export async function sessionToken(): Promise<string> { return ensureSession(); }

async function ensureSession(): Promise<string> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (raw) {
    try {
      const session = JSON.parse(raw) as Session;
      // Sessions minted before the Rivet transport carry no engine marker; the
      // old HS256 token can never authenticate against the engine.
      if (session.engine === 'rivet' && session.expiresAt > Date.now() + 60_000) return session.token;
    } catch { /* re-mint */ }
  }
  const session = await mintSession();
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session.token;
}

async function mintSession(): Promise<Session> {
  const response = await fetch(`${APP_URL}/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'tar-phone' }),
  });
  const text = await response.text();
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }
  if (!response.ok || !parsed.token) throw new TarError(response.status, 'Could not reach the workspace.');
  // Rivet's expires_ts is epoch milliseconds (a 1 hour token). Cap the cache at
  // 50 minutes so a wrong unit can never leave the device holding a dead token.
  const hardCap = Date.now() + 50 * 60_000;
  return { token: parsed.token as string, expiresAt: Math.min(Number(parsed.expires_ts), hardCap), engine: 'rivet' };
}

export async function signOutSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  cachedClient = null;
}

async function client(): Promise<any> {
  const token = await ensureSession();
  if (cachedClient?.token === token) return cachedClient.client;
  // createClient() takes ONE config object; a second argument is ignored and
  // the request goes unauthenticated ("Authentication token is invalid").
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = (createClient as any)({ endpoint: API_URL, token, namespace: "default" });
  cachedClient = { token, client: created };
  return created;
}

// --- the local workspace registry (which workspaces this device owns/joins) ---

interface WsReg { slug: string; name: string; type: string; role: string; memberId: string }

async function registryList(): Promise<WsReg[]> {
  const raw = await SecureStore.getItemAsync(REGISTRY_KEY);
  return raw ? JSON.parse(raw) as WsReg[] : [];
}

async function registrySave(list: WsReg[]): Promise<void> {
  await SecureStore.setItemAsync(REGISTRY_KEY, JSON.stringify(list));
}

export async function registerWorkspace(entry: WsReg): Promise<void> {
  const list = await registryList();
  if (!list.some((w) => w.slug === entry.slug)) {
    list.push(entry);
    await registrySave(list);
  }
}

async function handle(slug: string) {
  const c = await client();
  return c.workspace.getOrCreate([slug]);
}

async function memberOf(slug: string): Promise<string> {
  const entry = (await registryList()).find((w) => w.slug === slug);
  if (!entry) throw new TarError(404, 'Workspace not on this phone.');
  return entry.memberId;
}

// --- reads ---

// The actor sends one integer per card; the words are ours. The label names the
// section, the caption names the figure, so no word repeats.
const CARD_COPY: Record<string, { label: string; caption: string; money?: boolean }> = {
  sell: { label: 'Sales', caption: 'today', money: true },
  deliveries: { label: 'Deliveries', caption: 'today' },
  trips: { label: 'Trips', caption: 'today' },
  jobs: { label: 'Jobs', caption: 'today' },
  tasks: { label: 'Tasks', caption: 'today' },
  stock: { label: 'Stock', caption: 'low' },
  money: { label: 'Money', caption: 'in hand', money: true },
  reach: { label: 'Link', caption: 'orders' },
  people: { label: 'People', caption: 'customers' },
  health: { label: 'Health', caption: 'open' },
  plans: { label: 'Plans', caption: 'open' },
};

const money = (minor: number) => `Rs ${(minor / 100).toFixed(2)}`;

function toCard(raw: { tool: string; title: string; reach?: string; shape?: string; tap?: { action: string | null; label: string }; value?: number | null }): CardView {
  const copy = CARD_COPY[raw.title] ?? { label: raw.title, caption: '' };
  const value = typeof raw.value === 'number' ? raw.value : null;
  return {
    tool: raw.tool,
    title: copy.label,
    reach: raw.reach ?? '',
    shape: raw.shape ?? '',
    tap: raw.tap ?? { action: null, label: 'Open' },
    number: value === null ? null : (copy.money ? money(value) : String(value)),
    pendingLine: value === null ? null : copy.caption || null,
  };
}

export async function me(): Promise<{ user: { id: string; email: string; name: string | null }; workspaces: TarWorkspace[] }> {
  const list = await registryList();
  return {
    user: { id: 'local', email: 'local@tar.app', name: 'Owner' },
    workspaces: list.map((w) => ({
      id: w.slug, name: w.name, slug: w.slug,
      mode: w.type === 'personal' ? 'personal' as const : 'work' as const,
      role: w.role, state: '', badge: 0,
    })),
  };
}

export async function slice(ws: string, _etag?: string | null): Promise<Slice> {
  const [w, memberId] = await Promise.all([handle(ws), memberOf(ws)]);
  const raw = await w.slice({ byId: memberId });
  return {
    version: raw.version,
    next: raw.next ?? null,
    inbox: raw.inbox ?? [],
    cards: (raw.cards ?? []).map(toCard),
    skills: raw.skills ?? [],
    workspace: {
      id: ws, name: raw.workspace.name, slug: ws,
      mode: raw.workspace.type === 'personal' ? 'personal' : 'work',
      role: raw.workspace.role,
    },
  };
}

export async function toolRows(ws: string, toolId: string, q = '', offset = 0) {
  const [w, memberId] = await Promise.all([handle(ws), memberOf(ws)]);
  return w.toolRows({ byId: memberId, toolId, q, offset });
}

export async function record(ws: string, id: string) {
  const [w, memberId] = await Promise.all([handle(ws), memberOf(ws)]);
  return w.record({ byId: memberId, id });
}

// --- onboarding: deterministic chips (0ms, works offline); Jev refines later ---

export interface PlanCard { id: string; title: string }
export interface OnboardingPlan {
  name: string;
  summary: string;
  nature: 'food' | 'shop' | 'service' | 'general';
  confidence: number;
  doubt: boolean;
  risk: number;
  work: string[];
  personal: string[];
  catalog: PlanCard[];
  models: { llm: string | null; jev: string | null };
}

const TYPE_CARDS: Record<string, string[]> = {
  store: ['sell', 'stock', 'money', 'reach', 'people'],
  delivery: ['deliveries', 'stock', 'money', 'people'],
  taxi: ['trips', 'money', 'people'],
  service: ['jobs', 'stock', 'money', 'people'],
  personal: ['tasks', 'health', 'plans'],
};
const CARD_LABEL: Record<string, string> = {
  sell: 'Sell', stock: 'Stock', money: 'Money', reach: 'Reach', people: 'People',
  deliveries: 'Deliveries', trips: 'Trips', jobs: 'Jobs', tasks: 'Tasks', health: 'Health', plans: 'Plans',
};

function detectType(words: string): string {
  const l = words.toLowerCase();
  if (/(personal|habit|health|routine|todo|my tasks)/.test(l)) return 'personal';
  if (/(taxi|cab\b|auto stand|ola|uber|rickshaw)/.test(l)) return 'taxi';
  if (/(courier|deliver|parcel|swiggy|zomato|shipment)/.test(l)) return 'delivery';
  if (/(repair|garage|service|plumb|electric|salon|workshop|tailor)/.test(l)) return 'service';
  return 'store';
}

export async function planOnboarding(words: string, _audience: string): Promise<OnboardingPlan> {
  const type = detectType(words);
  const nature = type === 'taxi' || type === 'delivery' || type === 'service' ? 'service'
    : type === 'personal' ? 'general' : 'shop';
  const first = words.split(/[.\n]/)[0].replace(/\s+/g, ' ').trim();
  const name = (first.length > 48 ? first.slice(0, 48).replace(/\s+\S*$/, '') : first) || 'My workspace';
  const work = TYPE_CARDS[type === 'personal' ? 'personal' : type];
  return {
    name,
    summary: `A ${type === 'personal' ? 'personal' : type} workspace: cards, sections and Ask — ready.`,
    nature: nature as OnboardingPlan['nature'],
    confidence: 1,
    doubt: false,
    risk: 0,
    work,
    personal: [],
    catalog: work.map((id) => ({ id, title: CARD_LABEL[id] ?? id })),
    models: { llm: null, jev: null },
  };
}

export interface OnboardingSelection { cards: string[]; personalCards: string[]; nature: OnboardingPlan['nature'] }

function typeFromCards(cards: string[] | undefined): string {
  const set = new Set(cards ?? []);
  if (set.has('trips')) return 'taxi';
  if (set.has('deliveries')) return 'delivery';
  if (set.has('jobs')) return 'service';
  if (set.has('sell')) return 'store';
  return 'personal';
}

export async function createWorkspace(name: string, _words: string, plan?: OnboardingSelection): Promise<{ workspace?: { slug?: string } }> {
  const type = plan ? typeFromCards(plan.cards) : 'store';
  const slug = Crypto.randomUUID().slice(0, 8);
  const w = await handle(slug);
  const born: any = await w.createWorkspace({ name, type, ownerName: 'Owner' });
  await registerWorkspace({ slug, name, type, role: 'owner', memberId: born.ownerId });
  // Personal is always present (same flow, its own actor)
  const list = await registryList();
  if (!list.some((x) => x.type === 'personal')) {
    const pSlug = Crypto.randomUUID().slice(0, 8);
    const pw = await handle(pSlug);
    const pBorn: any = await pw.createWorkspace({ name: 'Personal', type: 'personal', ownerName: 'Owner' });
    await registerWorkspace({ slug: pSlug, name: 'Personal', type: 'personal', role: 'owner', memberId: pBorn.ownerId });
  }
  return { workspace: { slug } };
}

// --- Ask: deterministic answers; the Jev conversation returns later ---

export type RunStatus = 'ready' | 'waiting' | 'done' | 'failed';
export interface RunView { id: string; skill: string; title: string; step: number; status: RunStatus; key: string }

export async function startSkill(ws: string, skillId: string): Promise<RunView> {
  const [w, memberId] = await Promise.all([handle(ws), memberOf(ws)]);
  const output = await w.runAutomation(skillId);
  return { id: skillId, skill: skillId, title: String(output ?? 'Done'), step: 1, status: 'done', key: skillId };
}

export async function advanceSkill(ws: string, runId: string, _confirmed = false): Promise<RunView> {
  return startSkill(ws, runId);
}

/** A custom card is hidden for good; the row stays. */
export async function dropSkill(ws: string, id: string) {
  const [w, memberId] = await Promise.all([handle(ws), memberOf(ws)]);
  return w.intent({ byId: memberId, action: 'automation.remove', input: { id }, key: `drop-${id}` });
}

export interface PlanTurn { who: 'you' | 'tar'; text: string }

export type CardPlan =
  | { kind: 'known'; tools: string[]; titles: string[]; message: string }
  | { kind: 'none'; reason?: string };

/** Deterministic Ask today: the actor answers; Jev plans cards in a later phase. */
export async function planCard(ws: string, words: string, _history: PlanTurn[] = []): Promise<CardPlan> {
  const [w, memberId] = await Promise.all([handle(ws), memberOf(ws)]);
  const answer = await w.ask({ byId: memberId, q: words });
  return { kind: 'known', tools: [], titles: [], message: String(answer) };
}

export async function confirmCard(_ws: string, _plan: unknown): Promise<Record<string, unknown>> {
  return {};
}

// --- writes: intent -> gate -> one confirm ---

export interface IntentOutcome {
  gate?: 'ask' | 'approve';
  missing?: string[];
  action?: string;
  reach?: string;
  result?: Record<string, unknown>;
  version?: string | null;
}

export async function intent(ws: string, action: string, input: Record<string, unknown>, key: string, confirmed = false): Promise<IntentOutcome> {
  const [w, memberId] = await Promise.all([handle(ws), memberOf(ws)]);
  const result = await w.intent({ byId: memberId, action, input, key, confirmed });
  return { result: (result?.result ?? {}) as Record<string, unknown> };
}

// --- later-phase features: present but honest stubs ---

export async function uploadMedia(_ws: string, _mime: string, _base64: string): Promise<string> {
  throw new TarError(501, 'Media upload comes later.');
}

export async function draftItem(_ws: string, _name: string): Promise<{ category?: string; unit?: string; tax?: number }> {
  return {};
}

export async function importRows(_ws: string, _rows: { name: string; price?: unknown }[]): Promise<Record<string, unknown>> {
  return {};
}

export async function importImage(_ws: string, _imageBase64: string): Promise<{ rows?: { name: string; price: string | null; doubt: boolean }[] }> {
  return { rows: [] };
}

export async function hire(_ws: string, _words: string): Promise<{ role: string; confidence: number; tools: string[]; model: string | null }> {
  throw new TarError(501, 'Hiring comes later.');
}

export async function actionCatalogs(ws: string) {
  const [w, memberId] = await Promise.all([handle(ws), memberOf(ws)]);
  return w.actionCatalogs({ byId: memberId });
}
