// Jev speaks three times: at birth, at import, at hire. Nowhere else.
// One call, many verdicts, in parallel. Doubt (a noul near one half)
// escalates to the one confirm — never a silent middle answer.

import { askSystemOne, choiceOf, noulOf } from './systemone.ts';
import { fallbackTrade } from './trade.ts';

export type Nature = 'food' | 'shop' | 'service' | 'general';
export const NATURES: readonly Nature[] = ['food', 'shop', 'service', 'general'];

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
      nature: { type: 'choice', instructions: 'A member describes their business. Which nature is it?', criteria: NATURES },
      risk: { type: 'noul', instructions: 'Could this description be abuse, spam or a harmful business?' },
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
