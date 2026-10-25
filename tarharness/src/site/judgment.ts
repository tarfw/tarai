/**
 * Bounded Jev judgments for the autonomous site workflow.
 *
 * Implements the 1 batched parallel System One Jev request:
 * Facts (records) + Brief (bullets) -> 1 Jev fan-out -> Blueprint.
 *
 * Code owns thresholds, permissions and verification; models never touch money.
 */

import { askSystemOne, choiceOf, noulOf, JEV_MODEL, type SystemOneQuestion } from '../brain/systemone.ts';
import { TRADE_TAXONOMY } from '../brain/trade.ts';
import { COMMERCE_MODELS, type CommerceModel, type LeadSection, type ModelProfile, type SectionKind } from './blueprint.ts';
import { MODEL_MEANING, acceptedModels, buildProfile, confidenceIn, fallbackProfile, readIndustry } from './profile.ts';
import { canonicalDesignId, libraryDefault, libraryIndex } from './designs/library.ts';
import { defaultRecipe, presentSectionTypes, shortlistDesigns, shortlistRecipes } from './shortlist.ts';

export const JUDGMENT = {
  noulThreshold: 0.65,
  optionConfidence: 0.55,
  targetConfidence: 0.5,
  claimConfidence: 0.6,
  issueProbability: 0.7,
  timeout: 8_000,
} as const;

export interface JudgmentCache {
  control?: D1Database;
  workspace?: string;
  version?: string;
  ttl?: number;
}

async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Reuse a stable judgment: same workspace, model, question version and state. */
async function answers(
  apiKey: string | undefined,
  cache: JudgmentCache,
  scope: string,
  state: Record<string, unknown>,
  questions: Record<string, SystemOneQuestion>,
  timeout = JUDGMENT.timeout,
): Promise<Record<string, Record<string, unknown>> | null> {
  if (!apiKey) return null;
  const version = cache.version || '1';
  const id = cache.control && cache.workspace ? await digest(`${JEV_MODEL}:${scope}:${version}:${JSON.stringify(state)}`) : '';
  if (id && cache.control) {
    const row = await cache.control.prepare('SELECT data FROM judgments WHERE id=? AND expires>?').bind(id, Date.now()).first<{ data: string }>();
    if (row) {
      try { return JSON.parse(String(row.data)) as Record<string, Record<string, unknown>>; } catch { /* Ignore damaged cache entry. */ }
    }
  }
  const outcome = await askSystemOne(apiKey, { state, questions, timeout });
  if (!outcome.ok) return null;
  if (id && cache.control && cache.workspace) {
    const at = Date.now();
    await cache.control.prepare('INSERT INTO judgments(id,workspace,scope,version,model,data,expires,created) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,expires=excluded.expires')
      .bind(id, cache.workspace, scope, version, outcome.value.model, JSON.stringify(outcome.value.answers), at + (cache.ttl ?? 7 * 86_400_000), at)
      .run().catch(() => undefined);
  }
  return outcome.value.answers;
}

const CAPABILITY_ASK: Record<'pos' | 'commerce' | 'site' | 'team', string> = {
  pos: 'take counter or table payments through a point of sale',
  commerce: 'track catalog, stock, orders, invoices and payments',
  site: 'publish a storefront site for customers',
  team: 'coordinate staff through shared work',
};

/**
 * Jev #1: what this business is. One batched call proposes the commerce model
 * set, the trade and the capabilities; code validates every answer against
 * COMMERCE_MODELS and keeps the set non-empty.
 */
export async function judgeProfile(
  apiKey: string | undefined,
  cache: JudgmentCache,
  input: { description: string; bullets?: readonly string[]; city?: string; hours?: string },
): Promise<ModelProfile> {
  const text = [input.description, ...(input.bullets || [])].filter(Boolean).join('. ').slice(0, 2000);
  const fallback = fallbackProfile(text);
  if (!text) return fallback;

  const questions: Record<string, SystemOneQuestion> = {
    ...Object.fromEntries(COMMERCE_MODELS.map((model) => [model, {
      type: 'noul' as const,
      instructions: `Does this business ${MODEL_MEANING[model]}? Answer yes only when the description or the facts say so.`,
    }])),
    industry: {
      type: 'choice',
      instructions: 'Which trade best names what this business sells or does?',
      criteria: { ...TRADE_TAXONOMY },
    },
    ...Object.fromEntries((Object.keys(CAPABILITY_ASK) as (keyof typeof CAPABILITY_ASK)[]).map((capability) => [capability, {
      type: 'choice' as const,
      instructions: `Does this business need to ${CAPABILITY_ASK[capability]}?`,
      criteria: { include: 'Yes, needed now.', skip: 'No, not needed.', unsure: 'The description does not say.' },
    }])),
  };

  const result = await answers(apiKey, cache, 'site.profile', { description: text, city: input.city || '', hours: input.hours || '' }, questions);
  if (!result) return fallback;

  const probabilities = Object.fromEntries(COMMERCE_MODELS.map((model) => [
    model,
    noulOf(result[model]).probability ?? (fallback.models.includes(model) ? 0.9 : 0.1),
  ])) as Record<CommerceModel, number>;
  const models = acceptedModels(probabilities, JUDGMENT.noulThreshold);

  const industry = choiceOf(result.industry);
  const answer = (capability: keyof typeof CAPABILITY_ASK) => choiceOf(result[capability]).choice;
  const capability = (name: keyof typeof CAPABILITY_ASK, fallbackValue: boolean) => {
    const choice = answer(name);
    return choice === 'include' ? true : choice === 'skip' ? false : fallbackValue;
  };

  return buildProfile({
    models,
    industry: readIndustry(industry.choice, fallback.industry),
    capabilities: {
      pos: capability('pos', fallback.capabilities.pos),
      commerce: capability('commerce', fallback.capabilities.commerce),
      site: capability('site', fallback.capabilities.site),
      team: capability('team', fallback.capabilities.team),
    },
    confidence: {
      models: confidenceIn(probabilities, models),
      industry: industry.confidence ?? fallback.confidence.industry,
    },
  });
}

export interface LookJudgment {
  /** The chosen design id, or null when the caller's own precedence should decide. */
  design: string | null;
  /** Recipe id per present section type; absent means the code default. */
  recipes: Partial<Record<SectionKind, string>>;
  lead: LeadSection;
  spotlight: boolean;
  story: boolean;
  trust: boolean;
  /** Overridden picks, recorded so a repeat generate stays fixed and the cache key moves (D10). */
  fixed: { design?: string; recipes: Partial<Record<SectionKind, string>> };
}

export interface LookInput {
  models: readonly CommerceModel[];
  industry: string;
  facts: { items?: number | unknown[]; proofs?: string[]; season?: string; notice?: string; [key: string]: unknown };
  brief?: { goal?: string; audience?: string; bullets?: readonly string[] };
  avoid?: readonly string[];
  overrides?: { design?: string; recipes?: Partial<Record<SectionKind, string>> };
}

/**
 * Jev #2: how the store looks. One batched call chooses a design and one recipe per present
 * section type from shortlists code built (D6), plus the lead and the optional sections. It
 * never names a colour, a font or a measurement — palette and spacing are projected from the
 * chosen design in code (D7). An answer is taken only when it is one of the offered options and
 * confident enough; otherwise the deterministic default stands, so the no-key path is the tested
 * path and a merchant override is never argued with.
 */
export async function judgeLook(
  apiKey: string | undefined,
  cache: JudgmentCache,
  input: LookInput,
): Promise<LookJudgment> {
  const index = libraryIndex();
  const avoid = new Set((input.avoid || []).map((entry) => canonicalDesignId(entry)));
  const overrideDesign = input.overrides?.design ? canonicalDesignId(input.overrides.design) : undefined;
  const overrideRecipes = input.overrides?.recipes || {};

  const proofs = Array.isArray(input.facts.proofs) ? input.facts.proofs : [];
  const season = typeof input.facts.season === 'string' ? input.facts.season : '';
  const notice = typeof input.facts.notice === 'string' ? input.facts.notice : '';
  const itemCount = Array.isArray(input.facts.items) ? input.facts.items.length : Number(input.facts.items || 0);
  const hasProof = proofs.length > 0;

  const presentTypes = presentSectionTypes(input.models, { proofs });
  const designOptions = shortlistDesigns(index, input.models, input.industry)
    .filter((row) => !avoid.has(row.id) && row.id !== overrideDesign)
    .slice(0, 6);

  const recipeChoices: { type: SectionKind; options: { id: string; pattern: string }[] }[] = [];
  for (const type of presentTypes) {
    if (overrideRecipes[type]) continue;
    const options = shortlistRecipes(type, input.models);
    if (options.length >= 2) recipeChoices.push({ type, options });
  }

  const questions: Record<string, SystemOneQuestion> = {};
  if (!overrideDesign && designOptions.length >= 2) {
    questions.design = {
      type: 'choice',
      instructions: 'Which reviewed design best fits this trade and what it sells? Judge only the supplied descriptions.',
      criteria: Object.fromEntries(designOptions.map((row) => [row.id, `${row.label}: ${row.desc}`])),
    };
  }
  for (const { type, options } of recipeChoices) {
    questions[`recipe:${type}`] = {
      type: 'choice',
      instructions: `Which ${type} layout best presents this store's own content? Judge only the supplied structural descriptions.`,
      criteria: Object.fromEntries(options.map((option) => [option.id, option.pattern])),
    };
  }
  questions.lead = {
    type: 'choice',
    instructions: 'What should lead the page after the header?',
    criteria: { catalog: 'Products or services first', spotlight: 'A festival or offer', story: 'The craft or owner story' },
  };
  questions.spotlight = { type: 'noul', instructions: 'Do the brief or season call for a festival or offer section now?' };
  questions.story = { type: 'noul', instructions: 'Do the brief or facts call for a craft or owner story?' };
  // Trust is asked ONLY when code finds proof. Never inferred without it.
  if (hasProof) questions.trust = { type: 'noul', instructions: 'Is the listed proof strong enough to show a trust section?' };

  const state = {
    models: [...input.models],
    industry: input.industry,
    avoid: [...avoid].sort(),
    design: overrideDesign || '',
    recipes: Object.fromEntries(Object.entries(overrideRecipes).sort()),
    present: presentTypes,
    facts: { items: itemCount, proofs, ...(season ? { season } : {}), ...(notice ? { notice } : {}) },
    brief: { goal: input.brief?.goal || '', audience: input.brief?.audience || '', bullets: [...(input.brief?.bullets || [])] },
  };

  const fallbackRecipes: Partial<Record<SectionKind, string>> = {};
  for (const type of presentTypes) fallbackRecipes[type] = overrideRecipes[type] || defaultRecipe(type);
  const fixed = { design: overrideDesign, recipes: { ...overrideRecipes } };
  const fallback: LookJudgment = {
    design: overrideDesign || designOptions[0]?.id || libraryDefault(),
    recipes: fallbackRecipes,
    lead: 'catalog',
    spotlight: false,
    story: Boolean(input.brief?.goal),
    trust: false,
    fixed,
  };

  const result = await answers(apiKey, cache, 'site.look', state, questions);
  if (!result) return fallback;

  const designIds = new Set(designOptions.map((row) => row.id));
  const designAnswer = choiceOf(result.design);
  const design = overrideDesign
    || (designAnswer.choice && designIds.has(designAnswer.choice) && (designAnswer.confidence ?? 0) >= JUDGMENT.optionConfidence
      ? designAnswer.choice
      : fallback.design);

  const recipes: Partial<Record<SectionKind, string>> = { ...fallbackRecipes };
  for (const { type, options } of recipeChoices) {
    const answer = choiceOf(result[`recipe:${type}`]);
    const ids = new Set(options.map((option) => option.id));
    if (answer.choice && ids.has(answer.choice) && (answer.confidence ?? 0) >= JUDGMENT.optionConfidence) recipes[type] = answer.choice;
  }

  const spotlight = (noulOf(result.spotlight).probability ?? 0) >= JUDGMENT.noulThreshold;
  const story = (noulOf(result.story).probability ?? 0) >= JUDGMENT.noulThreshold;
  const trust = hasProof && (noulOf(result.trust).probability ?? 0) >= JUDGMENT.noulThreshold;

  const leadChoice = choiceOf(result.lead);
  const lead: LeadSection = (leadChoice.choice === 'spotlight' && spotlight)
    ? 'spotlight'
    : (leadChoice.choice === 'story' && story)
      ? 'story'
      : 'catalog';

  return { design, recipes, lead, spotlight, story, trust, fixed };
}

export interface EditJudgment {
  target: string | null;
  values: Record<string, string>;
  open: string[];
}

export interface EditQuestion {
  key: string;
  label: string;
  values: readonly string[];
  instructions?: string;
}

/** One ambiguous edit interpretation in a single batched call. */
export async function interpret(
  apiKey: string | undefined,
  cache: JudgmentCache,
  input: { command: string; targets: readonly { id: string; label: string; purpose?: string }[]; questions: readonly EditQuestion[] },
): Promise<EditJudgment> {
  const questions: Record<string, SystemOneQuestion> = {};
  if (input.targets.length) {
    questions.target = {
      type: 'choice',
      instructions: 'Which supplied section does the request most likely target? Choose exactly one supplied id, or none when no section fits.',
      criteria: { ...Object.fromEntries(input.targets.map((entry) => [entry.id, `${entry.label}${entry.purpose ? ` (${entry.purpose})` : ''}`])), none: 'No supplied section matches.' },
    };
  }
  for (const question of input.questions) {
    if (!question.values.length) continue;
    questions[`q:${question.key}`] = {
      type: 'choice',
      instructions: `${question.instructions || `For "${question.label}", which value does the request ask for?`} Choose one supplied value, keep when unchanged, or none.`,
      criteria: Object.fromEntries([...question.values.map((value) => [value, `${question.label}: ${value}.`]), ['keep', 'Leave it unchanged.'], ['none', 'No supplied value fits.']]),
    };
  }
  const result = await answers(apiKey, cache, 'site.edit', { command: input.command, targets: input.targets.map((entry) => ({ id: entry.id, label: entry.label })), questions: input.questions.map((entry) => ({ key: entry.key, values: entry.values })) }, questions);
  if (!result) return { target: null, values: {}, open: input.questions.map((entry) => entry.key) };
  const target = choiceOf(result.target);
  const values: Record<string, string> = {};
  const open: string[] = [];
  for (const question of input.questions) {
    const answer = choiceOf(result[`q:${question.key}`] || result[question.key]);
    const choice = answer.choice;
    if (choice === 'keep') continue;
    if (!choice || choice === 'none' || !question.values.includes(choice) || (answer.confidence ?? 0) < JUDGMENT.optionConfidence) {
      open.push(question.key);
      continue;
    }
    values[question.key] = choice;
  }
  const chosenTarget = target.choice && input.targets.some((entry) => entry.id === target.choice) ? target.choice : null;
  return {
    target: chosenTarget && (target.confidence ?? 0) >= JUDGMENT.targetConfidence ? chosenTarget : null,
    values,
    open,
  };
}

export type ClaimVerdict = 'supported' | 'contradicted' | 'unsupported';

/** Batched evidence check: every prose claim in one call. Unbacked claims block publish. */
export async function checkClaims(
  apiKey: string | undefined,
  cache: JudgmentCache,
  claims: readonly { text: string; evidence: readonly string[] }[],
): Promise<{ text: string; verdict: ClaimVerdict; confidence: number | null }[]> {
  const entries = claims.slice(0, 12);
  if (!entries.length) return [];
  const questions = Object.fromEntries(entries.map((claim, index) => [`c${index}`, {
    type: 'choice' as const,
    instructions: `Does the evidence supplied for claim ${index} state it (supported), deny it (contradicted), or neither (unsupported)? Judge only the supplied evidence.`,
    criteria: {
      supported: 'The evidence states this claim.',
      contradicted: 'The evidence denies this claim.',
      unsupported: 'The evidence neither states nor denies this claim.',
    },
  }]));
  const result = await answers(apiKey, cache, 'site.claims', { claims: entries.map((claim) => ({ text: claim.text, evidence: claim.evidence.slice(0, 8) })) }, questions);
  return entries.map((claim, index) => {
    const answer = choiceOf(result?.[`c${index}`]);
    const verdict = answer.choice === 'supported' || answer.choice === 'contradicted' || answer.choice === 'unsupported' ? answer.choice : 'unsupported';
    if (verdict !== 'unsupported' && (answer.confidence ?? 0) < JUDGMENT.claimConfidence) return { text: claim.text, verdict: 'unsupported' as const, confidence: answer.confidence };
    if (!claim.evidence.length) return { text: claim.text, verdict: 'unsupported' as const, confidence: null };
    return { text: claim.text, verdict, confidence: answer.confidence };
  });
}

/** One batched drift check: does this copy still hold today? */
export async function flagDrift(
  apiKey: string | undefined,
  cache: JudgmentCache,
  input: { today: string; subjects: readonly { id: string; text: string }[] },
): Promise<string[]> {
  const subjects = input.subjects.slice(0, 8);
  if (!subjects.length) return [];
  const questions = Object.fromEntries(subjects.map((subject, index) => [`d${index}`, {
    type: 'noul' as const,
    instructions: `State says today is ${input.today}. Does this site copy read as stale or expired on that date? Answer yes only when an owner would want to change it.`,
  }]));
  const result = await answers(apiKey, cache, 'site.drift', { today: input.today, subjects: subjects.map((subject) => subject.text) }, questions);
  if (!result) return [];
  return subjects.filter((subject, index) => {
    const probability = noulOf(result[`d${index}`]).probability;
    return probability !== null && probability >= JUDGMENT.issueProbability;
  }).map((subject) => subject.id);
}
