// One door for growth: words become a core card change, a custom card plan,
// a question, or nothing. The core is matched by code first (zero model
// calls); the model only plans the jobs no card covers.

import { findTool, PERSONAL_CANDIDATES, TOOL_IDS, type ToolId } from '../tools/registry.ts';
import { defersToFlow, matchCoreTools } from '../tools/match.ts';
import type { CardChangeVerdict } from '../brain/moments.ts';
import { shapeOf, validatePlan, type Draft } from './engine.ts';
import { assertCard, coreTapOf, planPreview } from './cards.ts';
import type { Proposal, Turn } from './propose.ts';

export type CardPlanOutcome =
  | { readonly kind: 'card'; readonly add: ToolId[]; readonly remove: ToolId[]; readonly changes: string[]; readonly confidence: number }
  | { readonly kind: 'known'; readonly tools: ToolId[]; readonly titles: string[]; readonly message: string }
  | { readonly kind: 'skill'; readonly draft: Draft & { readonly preview: string[] } }
  | { readonly kind: 'question'; readonly text: string }
  | { readonly kind: 'none'; readonly reason: string };

const titleOf = (id: ToolId) => findTool(id)?.card.title ?? id;
const joinTitles = (titles: readonly string[]) => titles.length <= 1 ? titles.join('') : `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;

/** Add the named core cards, or say they are already there. */
function deckOutcome(tools: readonly ToolId[], deck: readonly ToolId[], allowed: readonly ToolId[]): CardPlanOutcome {
  const usable = tools.filter((id) => allowed.includes(id));
  if (!usable.length) {
    return { kind: 'none', reason: 'That card is for work workspaces, not this one.' };
  }
  const add = usable.filter((id) => !deck.includes(id));
  if (!add.length) {
    const titles = usable.map(titleOf);
    return {
      kind: 'known',
      tools: usable,
      titles,
      message: `${joinTitles(titles)} ${usable.length > 1 ? 'are' : 'is'} already on your canvas.`,
    };
  }
  return { kind: 'card', add, remove: [], changes: add.map((id) => `+ ${titleOf(id)}`), confidence: 1 };
}

export interface PlanInput {
  readonly words: string;
  readonly history?: readonly Turn[];
  readonly deck: readonly ToolId[];
  readonly mode: 'work' | 'personal';
  readonly moment: (words: string) => Promise<CardChangeVerdict>;
  readonly propose: (words: string, history: readonly Turn[]) => Promise<Proposal>;
}

export async function planCardChange(input: PlanInput): Promise<CardPlanOutcome> {
  const { words, deck, mode } = input;
  const history = input.history ?? [];
  const allowed: readonly ToolId[] = mode === 'personal' ? PERSONAL_CANDIDATES : TOOL_IDS;
  const flowish = defersToFlow(words);

  // The core first: a card name is a deck change, zero model calls.
  const named = flowish ? [] : matchCoreTools(words);
  if (named.length) return deckOutcome(named, deck, allowed);

  // Jev types a core change when the words describe a job the deck lacks.
  if (!flowish) {
    const verdict = await input.moment(words);
    const add = verdict.add.filter((id) => allowed.includes(id) && !deck.includes(id));
    const remove = verdict.remove.filter((id) => allowed.includes(id));
    if (add.length || remove.length) {
      return {
        kind: 'card',
        add,
        remove,
        changes: [...add.map((id) => `+ ${titleOf(id)}`), ...remove.map((id) => `− ${titleOf(id)}`)],
        confidence: verdict.confidence,
      };
    }
  }

  // No core card fits: a plan, or one plain question. Never a made-up card.
  try {
    const proposal = await input.propose(words, history);
    if (proposal.kind === 'question') return { kind: 'question', text: proposal.text };
    // a lone tap that is a core card (by action or by name) is that card
    if (proposal.trigger.type === 'tap' && proposal.steps.length === 1) {
      const single = coreTapOf(proposal.steps[0]);
      if (single) return deckOutcome([single], deck, allowed);
      const namedTitle = matchCoreTools(proposal.title);
      if (namedTitle.length) return deckOutcome(namedTitle, deck, allowed);
    } else if (!flowish) {
      const redirect = matchCoreTools(`${proposal.title} ${words}`);
      if (redirect.length) return deckOutcome(redirect, deck, allowed);
    }
    const steps = validatePlan(proposal.steps);
    const draft: Draft = { title: proposal.title, words, trigger: proposal.trigger, steps, shape: await shapeOf(proposal.trigger, steps) };
    assertCard(draft);
    return { kind: 'skill', draft: { ...draft, preview: planPreview(draft) } };
  } catch (cause) {
    const reason = cause instanceof Error && cause.message.trim() ? cause.message : 'I cannot plan that yet. Try naming the work in a few more words.';
    return { kind: 'none', reason };
  }
}
