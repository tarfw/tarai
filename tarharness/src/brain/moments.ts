// Jev speaks at birth, at import, at hire, and when the owner grows a deck.
// Nowhere else. One call, many verdicts, in parallel. Doubt (a noul near one
// half) escalates to the one confirm — never a silent middle answer.

import { askSystemOne, choiceOf, noulOf } from './systemone.ts';
import { fallbackTrade } from './trade.ts';
import { findTool, PERSONAL_CANDIDATES, TOOL_IDS, cardDeck, dealDeck, type ToolId } from '../tools/registry.ts';

export type Nature = 'food' | 'shop' | 'service' | 'general';
export const NATURES: readonly Nature[] = ['food', 'shop', 'service', 'general'];

/** Jev needs descriptions, not bare ids, to tell the natures apart. */
const NATURE_CRITERIA: Record<Nature, string> = {
  food: 'Cooks, bakes or serves food and drink: cafe, restaurant, bakery, cloud kitchen, catering.',
  shop: 'Sells physical goods: boutique, retail store, grocery, pharmacy, hardware, online shop.',
  service: 'Sells work or expertise: salon, repair, studio, consulting, agency, tuition, clinic.',
  general: 'None of the above clearly fits.',
};

export interface BirthVerdict {
  readonly nature: Nature;
  readonly confidence: number;
  readonly risk: number;
  /** a spread without a winner, or risk near one half — the one confirm decides */
  readonly doubt: boolean;
  readonly model: string | null;
}

function mapTrade(trade: string): Nature {
  if (trade === 'food') return 'food';
  if (['apparel', 'grocery', 'jewellery', 'electronics'].includes(trade)) return 'shop';
  if (trade === 'services') return 'service';
  return 'general';
}

/** Birth: which nature is this business, and how risky are the words. One Jev call, two verdicts. */
export async function birthMoment(typesafeKey: string | undefined, words: string): Promise<BirthVerdict> {
  const fallback = fallbackTrade(words);
  if (!typesafeKey) return { nature: mapTrade(fallback.id), confidence: fallback.confidence, risk: 0, doubt: false, model: null };
  const outcome = await askSystemOne(typesafeKey, {
    state: { words },
    questions: {
      nature: { type: 'choice', instructions: 'A member describes their business. Which nature fits best?', criteria: NATURE_CRITERIA },
      risk: { type: 'noul', instructions: 'The description is abuse, spam or a harmful business.' },
    },
  });
  if (!outcome.ok) return { nature: mapTrade(fallback.id), confidence: fallback.confidence, risk: 0, doubt: false, model: null };
  const nature = choiceOf(outcome.value.answers.nature);
  const risk = noulOf(outcome.value.answers.risk);
  const pick = NATURES.find((candidate) => candidate === nature.choice) ?? mapTrade(fallback.id);
  const confidence = nature.probabilities[pick] ?? fallback.confidence;
  const riskScore = risk.probability ?? 0;
  const ranked = Object.values(nature.probabilities).sort((a, b) => b - a);
  const margin = ranked.length > 1 ? ranked[0] - ranked[1] : 1;
  return { nature: pick, confidence, risk: riskScore, doubt: margin < 0.3 || riskScore > 0.45, model: outcome.value.model };
}

const TOOL_PURPOSE: Record<ToolId, string> = {
  pos: 'take a sale, a payment and a bill at the counter',
  order: 'pack and dispatch customer orders',
  invoice: 'issue GST bills and track receivables',
  payment: 'record UPI, cash or card receipts and refunds',
  register: 'track cash in the drawer and shifts',
  catalog: 'keep products, prices and photos',
  stock: 'track inventory and low stock',
  purchase: 'raise supplier purchase orders and receive goods',
  expense: 'record daily business expenses',
  contact: 'keep customers, leads and their history',
  member: 'manage staff, roles and shifts',
  site: 'publish an online storefront',
  task: 'keep a manual to-do list',
  channel: 'read and send customer messages',
};

const PERSONAL_PURPOSE: Partial<Record<ToolId, string>> = {
  task: 'keep personal to-dos',
  expense: 'record personal spending',
  contact: 'keep personal contacts',
  catalog: 'keep a personal list of things with prices',
  order: 'track things ordered online',
  payment: 'record money paid or received personally',
};

export interface PlanVerdict extends BirthVerdict {
  /** the business deck: the nature recipe plus cards Jev judged needed */
  readonly work: readonly ToolId[];
  /** the private deck: cards Jev judged useful for life admin */
  readonly personal: readonly ToolId[];
}

/**
 * The onboarding plan: one Jev call, many verdicts. Nature, risk and one
 * yes/no per candidate card for both the business and the personal space.
 * Code owns the deck; a missing key or a failed call falls back to the recipe.
 */
export async function planMoment(typesafeKey: string | undefined, words: string, audience = ''): Promise<PlanVerdict> {
  const fallback = fallbackTrade(words);
  const fallbackNature = mapTrade(fallback.id);
  const home: PlanVerdict = {
    nature: fallbackNature, confidence: fallback.confidence, risk: 0, doubt: false, model: null,
    work: cardDeck(fallbackNature), personal: ['task', 'expense'],
  };
  if (!typesafeKey) return home;
  const questions: Record<string, { type: 'choice' | 'noul'; instructions: string; criteria?: readonly string[] | Record<string, string> }> = {
    nature: { type: 'choice', instructions: 'A member describes their business. Which nature fits best?', criteria: NATURE_CRITERIA },
    risk: { type: 'noul', instructions: 'The description is abuse, spam or a harmful business.' },
  };
  for (const id of TOOL_IDS) {
    questions[`work_${id}`] = { type: 'noul', instructions: `This business needs the "${findTool(id)?.card.title}" card to ${TOOL_PURPOSE[id]}.` };
  }
  for (const id of PERSONAL_CANDIDATES) {
    questions[`personal_${id}`] = { type: 'noul', instructions: `The owner needs a personal "${findTool(id)?.card.title}" card to ${PERSONAL_PURPOSE[id] ?? id}.` };
  }
  const outcome = await askSystemOne(typesafeKey, { state: { words, audience }, questions, timeout: 12_000 });
  if (!outcome.ok) return home;
  const natureAnswer = choiceOf(outcome.value.answers.nature);
  const pick = NATURES.find((candidate) => candidate === natureAnswer.choice) ?? fallbackNature;
  const confidence = natureAnswer.probabilities[pick] ?? fallback.confidence;
  const risk = noulOf(outcome.value.answers.risk).probability ?? 0;
  const ranked = Object.values(natureAnswer.probabilities).sort((a, b) => b - a);
  const margin = ranked.length > 1 ? ranked[0] - ranked[1] : 1;
  const selectedWork = TOOL_IDS.filter((id) => (noulOf(outcome.value.answers[`work_${id}`]).probability ?? 0) >= 0.55);
  const selectedPersonal = PERSONAL_CANDIDATES.filter((id) => (noulOf(outcome.value.answers[`personal_${id}`]).probability ?? 0) >= 0.55);
  return {
    nature: pick, confidence, risk, doubt: margin < 0.3 || risk > 0.45, model: outcome.value.model,
    work: dealDeck(pick, selectedWork, 10),
    personal: selectedPersonal.length ? selectedPersonal.slice(0, 3) : ['task'],
  };
}

export interface CardChangeVerdict {
  /** cards the owner's words ask for and the deck does not carry */
  readonly add: readonly ToolId[];
  /** cards the owner's words no longer need */
  readonly remove: readonly ToolId[];
  readonly confidence: number;
  readonly model: string | null;
}

/**
 * Growth: the owner names a job, Jev types the card change. One call over the
 * cards this workspace could add and the cards it carries. Code validates and
 * applies; a custom card is proposed only when no core card fits.
 */
export async function cardMoment(typesafeKey: string | undefined, words: string, deck: readonly ToolId[], mode: 'work' | 'personal'): Promise<CardChangeVerdict> {
  const candidates = (mode === 'personal' ? PERSONAL_CANDIDATES : TOOL_IDS).filter((id) => !findTool(id)?.deferred);
  const carried = new Set(deck);
  const addable = candidates.filter((id) => !carried.has(id));
  const removable = deck.filter((id) => candidates.includes(id));
  const empty: CardChangeVerdict = { add: [], remove: [], confidence: 0, model: null };
  if (!typesafeKey || (!addable.length && !removable.length)) return empty;
  const questions: Record<string, { type: 'noul'; instructions: string }> = {};
  for (const id of addable) {
    const purpose = mode === 'personal' ? PERSONAL_PURPOSE[id] : TOOL_PURPOSE[id];
    questions[`add_${id}`] = { type: 'noul', instructions: `The owner's words ask this workspace to add the "${findTool(id)?.card.title}" card to ${purpose ?? id}.` };
  }
  for (const id of removable) {
    questions[`drop_${id}`] = { type: 'noul', instructions: `The owner's words say this workspace no longer needs the "${findTool(id)?.card.title}" card.` };
  }
  const outcome = await askSystemOne(typesafeKey, { state: { words, mode }, questions, timeout: 10_000 });
  if (!outcome.ok) return empty;
  const yes = (prefix: 'add' | 'drop', id: ToolId) => noulOf(outcome.value.answers[`${prefix}_${id}`]).probability ?? 0;
  const add = addable.filter((id) => yes('add', id) >= 0.55);
  const remove = removable.filter((id) => yes('drop', id) >= 0.55);
  const scores = [...add.map((id) => yes('add', id)), ...remove.map((id) => yes('drop', id))];
  return { add, remove, confidence: scores.length ? Math.max(...scores) : 0, model: outcome.value.model };
}

export interface ImportRow {
  readonly name: string;
  readonly price: string | null;
  readonly doubt: boolean;
}

/** Import: one Jev call, one noul per row — is this price sane, this row believable. */
export async function importMoment(typesafeKey: string | undefined, rows: readonly { name: string; price?: unknown }[]): Promise<ImportRow[]> {
  const capped = rows.slice(0, 50);
  if (!capped.length) return [];
  const base = capped.map((row) => ({
    name: row.name,
    price: row.price === undefined || row.price === null || row.price === '' ? null : String(row.price),
    doubt: row.price === undefined || row.price === null || row.price === '',
  }));
  if (!typesafeKey) return base;
  const outcome = await askSystemOne(typesafeKey, {
    state: { rows: capped.map((row) => ({ name: row.name, price: row.price === undefined || row.price === null || row.price === '' ? null : String(row.price) })) },
    questions: Object.fromEntries(capped.map((row, index) => [String(index), {
      type: 'noul' as const,
      instructions: 'Is this catalog row believable: a real item name and a sane price?',
    }])),
  });
  if (!outcome.ok) return base.map((row) => ({ ...row, doubt: true }));
  return base.map((row, index) => {
    const verdict = noulOf(outcome.value.answers[String(index)]);
    return { ...row, doubt: verdict.probability === null ? true : verdict.probability < 0.55 };
  });
}

export const HIRE_ROLES = ['cashier', 'manager', 'cook', 'packer', 'driver', 'general'] as const;
export type HireRole = typeof HIRE_ROLES[number];

export const ROLE_TOOLS: Record<HireRole, readonly string[]> = {
  cashier: ['pos', 'register', 'order', 'contact', 'task'],
  manager: ['*'],
  cook: ['order', 'task'],
  packer: ['order', 'task'],
  driver: ['order', 'task'],
  general: ['task', 'contact'],
};

/** Hire: which job does this person do, straight from the owner's words. */
export async function hireMoment(typesafeKey: string | undefined, words: string): Promise<{ role: HireRole; confidence: number; tools: readonly string[]; model: string | null }> {
  if (!typesafeKey) return { role: 'general', confidence: 0, tools: ROLE_TOOLS.general, model: null };
  const outcome = await askSystemOne(typesafeKey, {
    state: { words },
    questions: { role: { type: 'choice', instructions: 'A member is being hired. Which job fits their duties?', criteria: HIRE_ROLES } },
  });
  if (!outcome.ok) return { role: 'general', confidence: 0, tools: ROLE_TOOLS.general, model: null };
  const answer = choiceOf(outcome.value.answers.role);
  const pick = HIRE_ROLES.find((role) => role === answer.choice) ?? 'general';
  return { role: pick, confidence: answer.probabilities[pick] ?? 0, tools: ROLE_TOOLS[pick], model: outcome.value.model };
}
