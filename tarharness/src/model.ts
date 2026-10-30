/**
 * Bounded language model work for the site agent.
 *
 * The model writes original prose, in batches, over slots code has already
 * placed. Code validates every value, keeps prices, policy and permissions out
 * of model reach, and repairs at most once. A sentence that asserts a fact
 * becomes a claim, and an unchecked claim blocks publication.
 */

import { unavailable } from './errors.ts';

export const SITE_MODEL_FALLBACKS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct-fast',
] as const;

export interface ModelUsage {
  calls: number;
  prompt: number;
  output: number;
  ms: number;
}

export interface ModelBudget {
  readonly calls: number;
  readonly output: number;
  readonly ms: number;
}

export const DEFAULT_BUDGET: ModelBudget = { calls: 6, output: 12_000, ms: 120_000 };

export class BudgetExceeded extends Error {
  constructor(readonly reason: string) { super(reason); }
}

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function text(value: unknown, max = 400): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_DEFAULT_MODEL = 'qwen/qwen3.8-27b';

/** Onboarding prose prefers the strongest model the account can actually run. */
export const ONBOARDING_MODEL_DEFAULT = 'openai/gpt-oss-120b';
export const ONBOARDING_MODEL_RANKED = [
  ONBOARDING_MODEL_DEFAULT,
  'qwen/qwen3.8-27b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
] as const;

export interface GroqProbe {
  readonly status: 'ok' | 'unconfigured' | 'error';
  readonly model: string;
}

let groqProbeCache: { at: number; value: GroqProbe } | null = null;

/** Check the key and pick the best model the account lists. No tokens spent. */
export async function probeGroq(apiKey: string | undefined, preferred?: string): Promise<GroqProbe> {
  const fallback = preferred || ONBOARDING_MODEL_DEFAULT;
  if (!apiKey) return { status: 'unconfigured', model: fallback };
  if (groqProbeCache && Date.now() - groqProbeCache.at < 10 * 60_000) return groqProbeCache.value;
  let value: GroqProbe;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) value = { status: 'error', model: fallback };
    else {
      const payload = object(await response.json());
      const ids = (Array.isArray(payload.data) ? payload.data : []).map((entry) => object(entry).id).filter((id): id is string => typeof id === 'string');
      const ranked = [preferred, ...ONBOARDING_MODEL_RANKED].find((id) => id && ids.includes(id));
      const text = ids.find((id) => !/(whisper|tts|audio|guard|safeguard|compound)/i.test(id));
      value = { status: ids.length ? 'ok' : 'error', model: ranked ?? text ?? fallback };
    }
  } catch {
    value = { status: 'error', model: fallback };
  }
  groqProbeCache = { at: Date.now(), value };
  return value;
}

export async function bestGroqModel(apiKey: string | undefined, preferred?: string): Promise<string> {
  return (await probeGroq(apiKey, preferred)).model;
}

async function callGroq(apiKey: string, model: string, messages: { role: string; content: string }[], maxTokens: number, temperature: number, timeoutMs = 15_000): Promise<{ content: string; promptTokens: number; outputTokens: number }> {
  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages,
      model,
      temperature,
      max_completion_tokens: maxTokens,
      top_p: 0.95,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Groq API error (${response.status}): ${errorText.slice(0, 300)}`);
  }
  const payload = object(await response.json());
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = object(choices[0]);
  const message = object(firstChoice.message);
  const content = typeof message.content === 'string' ? message.content : '';
  const usage = object(payload.usage);
  return {
    content,
    promptTokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
    outputTokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0,
  };
}

/** Run one JSON-mode completion with an optional single repair pass. */
export class ModelRunner {
  constructor(
    private readonly ai?: Ai,
    readonly model: string = SITE_MODEL_FALLBACKS[0],
    private readonly budget: ModelBudget = DEFAULT_BUDGET,
    private readonly groqApiKey?: string,
  ) {}

  private readonly usage: ModelUsage = { calls: 0, prompt: 0, output: 0, ms: 0 };

  spent(): ModelUsage {
    return { ...this.usage };
  }

  async json<T>(input: { system: string; prompt: string; read: (value: Record<string, unknown>) => T | null; maxTokens?: number; temperature?: number }): Promise<T> {
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (this.usage.calls >= this.budget.calls) throw new BudgetExceeded('This run used its model call budget.');
      if (this.usage.ms > this.budget.ms) throw new BudgetExceeded('This run used its time budget.');
      const started = Date.now();
      let rawContent = '';
      try {
        if (this.groqApiKey) {
          const result = await callGroq(
            this.groqApiKey,
            this.model || GROQ_DEFAULT_MODEL,
            [
              { role: 'system', content: input.system },
              { role: 'user', content: attempt === 0 ? input.prompt : `${input.prompt}\n\nYour previous answer was rejected: ${lastError}\nReturn corrected JSON only.` },
            ],
            Math.min(input.maxTokens || 2_048, Math.max(256, this.budget.output - this.usage.output)),
            input.temperature ?? 0.6,
          );
          rawContent = result.content;
          this.usage.prompt += result.promptTokens;
          this.usage.output += result.outputTokens;
        } else if (this.ai) {
          // `this.model` is a Groq-style id (e.g. qwen/qwen3.8-27b); it is not valid
          // on Workers AI, so the AI lane always uses the Workers AI fallback list.
          const aiModel: string = SITE_MODEL_FALLBACKS[Math.min(attempt, SITE_MODEL_FALLBACKS.length - 1)];
          const runPromise = this.ai.run(aiModel, {
            messages: [
              { role: 'system', content: input.system },
              { role: 'user', content: attempt === 0 ? input.prompt : `${input.prompt}\n\nYour previous answer was rejected: ${lastError}\nReturn corrected JSON only.` },
            ],
            response_format: { type: 'json_object' },
            max_tokens: Math.min(input.maxTokens || 2_400, Math.max(256, this.budget.output - this.usage.output)),
            temperature: input.temperature ?? 0.4,
          });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Model call timed out')), 15_000));
          const answer = await Promise.race([runPromise, timeoutPromise]);
          const raw = (answer as { response?: unknown })?.response ?? answer;
          rawContent = typeof raw === 'string' ? raw : JSON.stringify(raw);
        } else {
          throw new Error('No AI provider or Groq API key configured.');
        }
      } catch (cause) {
        lastError = cause instanceof Error ? cause.message : 'the model call failed';
        if (attempt === 1) throw unavailable('Site composition could not reach the model. Try again shortly.', cause);
        continue;
      }
      this.usage.calls += 1;
      this.usage.ms += Date.now() - started;
      const payload = safeJson(rawContent);
      try {
        const parsed = input.read(payload);
        if (parsed) return parsed;
        lastError = 'the JSON did not match the required shape';
      } catch (cause) {
        lastError = cause instanceof Error ? cause.message.slice(0, 300) : 'the JSON failed validation';
      }
    }
    throw unavailable('Site composition returned an unusable answer.');
  }
}

function safeJson(value: string): Record<string, unknown> {
  const cleaned = value.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think>/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return {};
  try { return object(JSON.parse(cleaned.slice(start, end + 1))); } catch { return {}; }
}

const SYSTEM = `You compose a marketing website draft as strict JSON. Rules:
- Use only facts supplied in the prompt. Never invent prices, stock, reviews, credentials, addresses, awards or customer names.
- Write plain, concrete copy; no lorem ipsum; no placeholder brackets.
- Ids are single lowercase words or kebab-case, starting with a letter, at most 40 characters, unique.
- Allowed node kinds: heading, text, image, list, link, button, divider, spacer, flex, grid, stack, card, collection, navigation, footer, menu, tabs, accordion, gallery, search, form.
- Exactly one heading with level 1 per page.
- Layout kinds for sections: flow, flex, grid, stack.
- Return JSON only.`;

const LOCALE_NAMES: Record<string, string> = { en: 'English', ta: 'Tamil' };

/** Prose follows the brief locale; structure, tokens and prices stay neutral. */
function languageRule(locale?: string): string {
  if (!locale) return '';
  const name = LOCALE_NAMES[locale.slice(0, 2).toLowerCase()];
  return name ? ` Write every text in ${name}.` : '';
}

export interface ProseSlot {
  id: string;
  purpose: string;
  current: string;
  limit: number;
}

export interface CopyInput {
  brief: { goal: string; audience: string; tone: string };
  voice: string;
  locale?: string;
  facts: Record<string, unknown>;
  slots: ProseSlot[];
}

/**
 * One batched prose pass. The model rewrites the supplied copy slots only; it
 * never sees layout, tokens, prices or permissions, and code drops any slot it
 * did not answer instead of failing the build.
 */
export async function writeCopy(runner: ModelRunner, input: CopyInput): Promise<Record<string, string>> {
  const slots = input.slots.slice(0, 12);
  if (!slots.length) return {};
  return runner.json<Record<string, string>>({
    system: SYSTEM,
    prompt: `Write the copy for these site slots. Brief: ${JSON.stringify(input.brief)}. Voice: ${input.voice}. Approved facts: ${JSON.stringify(input.facts)}.${languageRule(input.locale)}
Slots: ${JSON.stringify(slots.map((slot) => ({ id: slot.id, purpose: slot.purpose, current: slot.current })))}.
Return JSON: { "texts": [ { "id": string, "text": string, "claims": [ { "text": string, "evidence": string } ] } ] }.
Rules: one entry per slot id, plain concrete copy within the slot's own length, no invented facts, and list every factual sentence as a claim with the fact it comes from.`,
    maxTokens: 2_400,
    temperature: 0.6,
    read: (value) => {
      const entries = Array.isArray(value.texts) ? value.texts : [];
      const byId = new Map(slots.map((slot) => [slot.id, slot]));
      const texts: Record<string, string> = {};
      for (const entry of entries) {
        const slot = object(entry);
        const id = text(slot.id, 80);
        const found = byId.get(id);
        if (!found) continue;
        const next = text(slot.text, found.limit);
        if (next) texts[id] = next;
      }
      return Object.keys(texts).length ? texts : null;
    },
  });
}

/** Claims the prose pass asserts, so code can check each against supplied facts. */
export async function readClaims(runner: ModelRunner, input: { brief: CopyInput['brief']; texts: string[] }): Promise<{ text: string; evidence: string }[]> {
  if (!input.texts.length) return [];
  return runner.json<{ text: string; evidence: string }[]>({
    system: SYSTEM,
    prompt: `List each factual assertion in these site sentences: ${JSON.stringify(input.texts)}. Brief: ${JSON.stringify(input.brief)}.
Return JSON: { "claims": [ { "text": string, "evidence": string } ] }. Evidence must quote the brief or a supplied fact; use an empty string when nothing supports it.`,
    maxTokens: 800,
    temperature: 0.2,
    read: (value) => {
      const claims = Array.isArray(value.claims) ? value.claims : [];
      const parsed = claims.map((entry) => {
        const claim = object(entry);
        return { text: text(claim.text, 300), evidence: text(claim.evidence, 400) };
      }).filter((claim) => claim.text);
      return parsed.slice(0, 12);
    },
  });
}

/** Write replacement copy for one element; never states facts that were not supplied. */
export async function draftCopy(runner: ModelRunner, input: { instruction: string; current: string; facts: Record<string, unknown>; locale?: string; limit?: number }): Promise<string> {
  return runner.json<string>({
    system: SYSTEM,
    prompt: `Rewrite the copy for one site element. Instruction: ${input.instruction}. Current text: ${JSON.stringify(input.current)}. Approved facts: ${JSON.stringify(input.facts)}.${languageRule(input.locale)}
Return JSON: { "text": string } within ${input.limit || 300} characters.`,
    maxTokens: 400,
    temperature: 0.6,
    read: (value) => {
      const next = text(value.text, input.limit || 300);
      return next ? next : null;
    },
  });
}
