// The L2 proposer: the only place words become a plan. It sees the registry
// and nothing else; it proposes registered actions or the plan is refused.

import { actionCatalog } from '../registry/catalog.ts';
import { toolForAction } from '../tools/registry.ts';
import type { SkillStep, Trigger } from './engine.ts';

interface Proposal { title?: unknown; trigger?: unknown; steps?: unknown }

const REGISTRY_DIGEST = actionCatalog
  .filter((action) => action.type !== 'agent' || action.id.startsWith('site.'))
  .map((action) => `${action.id} (${toolForAction(action.id) ?? 'control'}): ${action.title} — fields: ${action.fields.map((field) => field.key).join(', ') || 'none'}`)
  .join('\n');

/**
 * Propose a plan from words. Deterministic fallback when no model is bound:
 * a single task.create step carrying the words — the member edits it in the
 * confirm.
 */
export async function proposePlan(ai: Ai | undefined, words: string): Promise<{ title: string; trigger: Trigger; steps: SkillStep[] }> {
  if (!ai) {
    return { title: words.slice(0, 60), trigger: { type: 'tap' }, steps: [{ action: 'task.create', input: { title: words.slice(0, 200) } }] };
  }
  const answer = await ai.run('@cf/meta/llama-3.1-8b-instruct-fast', {
    messages: [
      {
        role: 'system',
        content: [
          'You propose short plans for a shop tool. Choose ONLY from these registered actions:',
          REGISTRY_DIGEST,
          'Rules: at most 12 steps; every step uses an action id from the list, never an invented one;',
          'a step is auto:true only when its inputs are fully known and it touches no money and no customer;',
          'money or customer steps are never auto. Reply with JSON only:',
          '{"title":string,"trigger":{"type":"tap"|"schedule","at":"HH:mm" only for schedule},"steps":[{"action":string,"input":object,"auto":boolean?}]}',
        ].join('\n'),
      },
      { role: 'user', content: words },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 900,
  });
  const raw = typeof answer === 'object' && answer !== null && 'response' in answer ? String(answer.response) : '';
  let proposal: Proposal;
  try { proposal = JSON.parse(raw) as Proposal; } catch { return { title: words.slice(0, 60), trigger: { type: 'tap' }, steps: [{ action: 'task.create', input: { title: words.slice(0, 200) } }] }; }
  const trigger = readTrigger(proposal.trigger);
  return { title: typeof proposal.title === 'string' && proposal.title.trim() ? proposal.title.trim().slice(0, 80) : words.slice(0, 60), trigger, steps: Array.isArray(proposal.steps) ? proposal.steps as SkillStep[] : [] };
}

function readTrigger(value: unknown): Trigger {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const trigger = value as { type?: unknown; at?: unknown };
    if (trigger.type === 'schedule' && typeof trigger.at === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(trigger.at)) return { type: 'schedule', at: trigger.at };
    if (trigger.type === 'event' && typeof (trigger as { on?: unknown }).on === 'string') return { type: 'event', on: (trigger as { on: string }).on.slice(0, 60) };
  }
  return { type: 'tap' };
}
