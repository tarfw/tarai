// The L2 proposer: the only place words become a plan. It sees the registry
// and nothing else. It returns a plan, or one plain question a merchant can
// answer — never a made-up card.
//
// It runs on the same model lane as onboarding: Groq when a key is set,
// Workers AI otherwise. A model that cannot be reached is not a plan.

import { badRequest } from '../errors.ts';
import { actionCatalog } from '../registry/catalog.ts';
import { bestGroqModel, ModelRunner } from '../model.ts';
import { TOOL_IDS, findTool, toolForAction } from '../tools/registry.ts';
import type { SkillStep, Trigger } from './engine.ts';

export interface Turn { readonly who: 'you' | 'tar'; readonly text: string }
export type Proposal =
  | { readonly kind: 'plan'; readonly title: string; readonly trigger: Trigger; readonly steps: readonly SkillStep[] }
  | { readonly kind: 'question'; readonly text: string };

const REGISTRY_DIGEST = actionCatalog
  .filter((action) => action.type !== 'agent' || action.id.startsWith('site.'))
  .map((action) => `${action.id} (${toolForAction(action.id) ?? 'control'}): ${action.title} — fields: ${action.fields.map((field) => field.key).join(', ') || 'none'}`)
  .join('\n');

const CORE_CARDS = TOOL_IDS.map((id) => findTool(id)?.card.title ?? id).join(', ');

const SYSTEM = [
  'You plan cards for a small shop workspace. A card is a short job made of registered actions.',
  `The core cards already exist and are added by name: ${CORE_CARDS}. Never build a card that is one of them.`,
  'Choose ONLY from these registered actions:',
  REGISTRY_DIGEST,
  'Rules: a card is 2 to 12 steps, or one step with a schedule. A lone tap step is not a card.',
  'A step is auto:true only when its inputs are fully known and it touches no money and no customer; money or customer steps are never auto.',
  'When a needed input is missing (who, what, when, how much), ask ONE short question in plain shop words, under 20 words. Never name a field, an action id, or a technical word.',
  'Reply with JSON only:',
  '{"kind":"question","text":"..."}',
  'or {"kind":"plan","title":string,"trigger":{"type":"tap"},"steps":[{"action":string,"input":object,"auto":boolean?}]}',
  'A schedule trigger is {"type":"schedule","at":"HH:mm"}.',
].join('\n');

export interface ProposeInput {
  readonly ai?: Ai;
  readonly groqApiKey?: string;
  readonly groqModel?: string;
  readonly words: string;
  readonly history?: readonly Turn[];
}

/**
 * Propose a plan from words, in the conversation so far. The merchant answers
 * in shop words; a question is the whole answer when an input is missing.
 */
export async function proposePlan(input: ProposeInput): Promise<Proposal> {
  const history = (input.history ?? []).slice(-6)
    .map((turn) => `${turn.who === 'you' ? 'Owner' : 'TAR'}: ${turn.text.replace(/\s+/g, ' ').trim().slice(0, 300)}`)
    .filter((line) => line.length > 5);
  const prompt = [
    history.length ? `Conversation so far:\n${history.join('\n')}` : '',
    `Now the owner says: ${JSON.stringify(input.words)}`,
    'Plan the card the owner means. Ask one question if a needed input is missing.',
  ].filter(Boolean).join('\n\n');
  const model = await bestGroqModel(input.groqApiKey, input.groqModel);
  const runner = new ModelRunner(input.ai, model, { calls: 2, output: 900, ms: 20_000 }, input.groqApiKey);
  try {
    return await runner.json<Proposal>({
      system: SYSTEM,
      prompt,
      maxTokens: 700,
      temperature: 0.3,
      read: (value) => readProposal(value, input.words),
    });
  } catch (cause) {
    throw badRequest(cause instanceof Error && /cannot plan/i.test(cause.message)
      ? cause.message
      : 'I cannot plan that yet. Try again in a moment.');
  }
}

function readProposal(value: Record<string, unknown>, words: string): Proposal | null {
  if (value.kind === 'question' && typeof value.text === 'string' && value.text.trim()) {
    return { kind: 'question', text: questionText(value.text) };
  }
  if (!Array.isArray(value.steps) && typeof value.title !== 'string') return null;
  return {
    kind: 'plan',
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim().slice(0, 80) : words.slice(0, 60),
    trigger: readTrigger(value.trigger),
    steps: Array.isArray(value.steps) ? value.steps as SkillStep[] : [],
  };
}

function questionText(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim().slice(0, 160);
  return /[?.!]$/.test(text) ? text : `${text}?`;
}

function readTrigger(value: unknown): Trigger {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const trigger = value as { type?: unknown; at?: unknown; on?: unknown };
    if (trigger.type === 'schedule' && typeof trigger.at === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(trigger.at)) return { type: 'schedule', at: trigger.at };
    if (trigger.type === 'event' && typeof trigger.on === 'string') return { type: 'event', on: trigger.on.slice(0, 60) };
  }
  return { type: 'tap' };
}
