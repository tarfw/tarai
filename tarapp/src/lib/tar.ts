// One door: the TAR API. The app is a window — a session, a slice, intents.
// It never holds a database token, never syncs, never mirrors.

import * as SecureStore from 'expo-secure-store';
import { getValidIdToken } from './auth';

const HARNESS = process.env.EXPO_PUBLIC_TARHARNESS_URL || 'https://tarharness.tar-54d.workers.dev';
const SESSION_KEY = 'tar_session';

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

interface Session { token: string; expiresAt: number }

export class TarError extends Error {
  constructor(readonly status: number, message: string, readonly body: Record<string, unknown> = {}) { super(message); }
}

/** The TAR session token, minted when needed. */
export async function sessionToken(): Promise<string> { return ensureSession(); }

async function ensureSession(): Promise<string> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (raw) {
    try {
      const session = JSON.parse(raw) as Session;
      if (session.expiresAt > Date.now() + 60_000) return session.token;
    } catch { /* re-mint */ }
  }
  const google = await getValidIdToken();
  if (!google) throw new TarError(401, 'Sign in first.');
  const response = await request('POST', '/v1/auth/session', undefined, google);
  const session = { token: response.token as string, expiresAt: Number(response.expiresAt) };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session.token;
}

export async function signOutSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function request(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, authorization?: string, extraHeaders: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const token = authorization ?? await ensureSession();
  const response = await fetch(`${HARNESS}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const parsed: Record<string, unknown> = text ? safeJson(text) : {};
  if (!response.ok) throw new TarError(response.status, String(parsed.error || response.statusText), parsed);
  return parsed;
}

function safeJson(text: string): Record<string, unknown> {
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; }
}

// --- reads ---

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

/** Read-only: Groq writes the name and sentence, Jev types both decks. */
export async function planOnboarding(words: string, audience: string): Promise<OnboardingPlan> {
  return request('POST', '/v1/onboarding/plan', { words, audience }) as unknown as Promise<OnboardingPlan>;
}

export interface OnboardingSelection { cards: string[]; personalCards: string[]; nature: OnboardingPlan['nature'] }

export async function createWorkspace(name: string, words: string, plan?: OnboardingSelection): Promise<{ workspace?: { slug?: string } }> {
  return request('POST', '/v1/workspaces', { name, words, ...(plan || {}) }) as Promise<{ workspace?: { slug?: string } }>;
}

export async function me(): Promise<{ user: { id: string; email: string; name: string | null }; workspaces: TarWorkspace[] }> {
  return request('GET', '/v1/me') as Promise<{ user: { id: string; email: string; name: string | null }; workspaces: TarWorkspace[] }>;
}

/** The slice. Pass the version you hold: a 304 answers null and costs nothing. */
export async function slice(ws: string, etag?: string | null): Promise<Slice | null> {
  const token = await ensureSession();
  const response = await fetch(`${HARNESS}/v1/slice?ws=${encodeURIComponent(ws)}`, {
    headers: { Authorization: `Bearer ${token}`, ...(etag ? { 'If-None-Match': etag } : {}) },
  });
  if (response.status === 304) return null;
  const parsed = safeJson(await response.text());
  if (!response.ok) throw new TarError(response.status, String(parsed.error || response.statusText), parsed);
  return parsed as unknown as Slice;
}

export async function toolRows(ws: string, toolId: string, q = '', offset = 0) {
  return request('GET', `/v1/workspaces/${ws}/tool/${toolId}/rows?q=${encodeURIComponent(q)}&offset=${offset}`);
}

export async function record(ws: string, id: string) {
  return request('GET', `/v1/workspaces/${ws}/records/${encodeURIComponent(id)}`);
}

// --- cards: Jev's stack, grown by one confirmed plan ---

export interface CardChanges {
  kind: 'card';
  add: string[];
  remove: string[];
  changes: string[];
  confidence: number;
}

export interface CustomCard {
  kind: 'skill';
  draft: { title: string; words: string; trigger: Record<string, unknown>; steps: { action: string; input: Record<string, unknown>; auto?: boolean }[]; shape: string };
}

export type CardPlan = CardChanges | CustomCard | { kind: 'none' };

/** The owner names a job; Jev types the change or proposes a custom card. */
export async function planCard(ws: string, words: string): Promise<CardPlan> {
  return request('POST', `/v1/workspaces/${ws}/cards/plan`, { words }) as Promise<CardPlan>;
}

export async function confirmCard(ws: string, plan: { add?: string[]; remove?: string[] } | { draft: CustomCard['draft'] }) {
  return request('POST', `/v1/workspaces/${ws}/cards/confirm`, plan);
}

export type RunStatus = 'ready' | 'waiting' | 'done' | 'failed';
export interface RunView { id: string; skill: string; title: string; step: number; status: RunStatus; key: string }

/** A skill card taps through two calls: start the run, then advance it. */
export async function startSkill(ws: string, skillId: string): Promise<RunView> {
  const key = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const started = await request('POST', `/v1/workspaces/${ws}/runs/${skillId}/advance`, {}, undefined, { 'Idempotency-Key': key }) as { run?: RunView };
  if (!started.run) throw new TarError(500, 'The card did not start.');
  return advanceSkill(ws, started.run.id);
}

/** A waiting run resumes with one confirm; money and customer still ask once. */
export async function advanceSkill(ws: string, runId: string, confirmed = false): Promise<RunView> {
  const result = await request('POST', `/v1/workspaces/${ws}/runs/${runId}/advance`, { confirmed }) as { run?: RunView };
  if (!result.run) throw new TarError(500, 'The card did not run.');
  return result.run;
}

// --- writes: intent -> gate -> one confirm ---

export interface IntentOutcome {
  /** 202: the gate asks first */
  gate?: 'ask' | 'approve';
  missing?: string[];
  action?: string;
  reach?: string;
  result?: Record<string, unknown>;
  version?: string | null;
}

export async function intent(ws: string, action: string, input: Record<string, unknown>, key: string, confirmed = false): Promise<IntentOutcome> {
  return request('POST', '/v1/intent', { ws, action, input, key, confirmed }) as Promise<IntentOutcome>;
}

/** Store an item photo; returns its public immutable URL for photoUrl fields. */
export async function uploadMedia(ws: string, mime: string, base64: string): Promise<string> {
  const result = await request('POST', '/v1/workspaces/media', { ws, mime, data: base64 }) as { url?: string };
  if (!result.url) throw new TarError(500, 'Media upload failed.');
  return result.url;
}

/** Jev suggests item fields from the name; missing answers come back undefined. */
export async function draftItem(ws: string, name: string): Promise<{ category?: string; unit?: string; tax?: number }> {
  try {
    return await request('POST', '/v1/workspaces/draft-item', { ws, name }) as { category?: string; unit?: string; tax?: number };
  } catch { return {}; }
}

// --- ask / skills ---

export async function ask(ws: string, words: string): Promise<{ ladder: string; skill: SkillView | null; draft: { title: string; words: string; trigger: Record<string, unknown>; steps: { action: string; input: Record<string, unknown>; auto?: boolean }[]; shape: string } | null }> {
  return request('POST', `/v1/workspaces/${ws}/ask`, { words }) as ReturnType<typeof ask>;
}

export async function confirmSkill(ws: string, draft: Record<string, unknown>) {
  return request('POST', `/v1/workspaces/${ws}/skill/confirm`, { draft });
}

export async function importRows(ws: string, rows: { name: string; price?: unknown }[]) {
  return request('POST', `/v1/workspaces/${ws}/import`, { rows });
}

/** A photo becomes rows: the harness vision model reads it, Jev judges each row. */
export async function importImage(ws: string, imageBase64: string) {
  return request('POST', `/v1/workspaces/${ws}/import`, { image: imageBase64 }) as Promise<{ rows?: { name: string; price: string | null; doubt: boolean }[] }>;
}

export async function hire(ws: string, words: string): Promise<{ role: string; confidence: number; tools: string[]; model: string | null }> {
  return request('POST', `/v1/workspaces/${ws}/hire`, { words }) as Promise<{ role: string; confidence: number; tools: string[]; model: string | null }>;
}

export async function actionCatalogs(ws: string) {
  return request('GET', `/v1/workspaces/${ws}/actions`);
}
