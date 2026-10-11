/**
 * Bounded Jev judgments for the autonomous site workflow.
 *
 * Implements the 1 batched parallel System One Jev request:
 * Facts (records) + Brief (bullets) -> 1 Jev fan-out -> Blueprint.
 *
 * Code owns thresholds, permissions and verification; models never touch money.
 */

import { askSystemOne, choiceOf, noulOf, scoreOf, JEV_MODEL, type SystemOneQuestion } from '../brain/systemone.ts';
import type { BusinessKind, DensityToken, HeroPattern, LeadSection, ToneToken, TypographyToken } from './blueprint.ts';

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

export interface CreateJudgment {
  kind: BusinessKind | null;
  style?: string | null;
  spotlight: boolean;
  story: boolean;
  trust: boolean;
  lead: LeadSection | null;
  typography: TypographyToken | null;
  tone: ToneToken | null;
  density: DensityToken | null;
  heroPattern?: HeroPattern | null;
}

/**
 * Single batched parallel Jev System One fan-out (agenticsite.md §5).
 * Questions run in parallel over the same state; code applies the answers.
 */
export async function fanOut(
  apiKey: string | undefined,
  cache: JudgmentCache,
  input: {
    trade?: string;
    facts: { items?: number | unknown[]; proofs?: string[]; season?: string; [key: string]: unknown };
    brief?: { goal: string; audience: string; tone: string; bullets?: readonly string[] };
    assets?: readonly { id: string; description: string }[];
    avoid?: readonly string[];
    purposes?: readonly string[];
  },
): Promise<CreateJudgment> {
  const bullets = [...(input.brief?.bullets || [])];
  if (!bullets.length && input.brief?.goal) bullets.push(input.brief.goal);
  if (input.brief?.tone) bullets.push(input.brief.tone);

  const itemCount = Array.isArray(input.facts.items) ? input.facts.items.length : Number(input.facts.items || 0);
  const proofs = Array.isArray(input.facts.proofs) ? input.facts.proofs : [];
  const season = typeof input.facts.season === 'string' ? input.facts.season : '';
  const trade = input.trade || input.brief?.audience || 'Retail & Trade';

  const hasProof = proofs.length > 0;

  const questions: Record<string, SystemOneQuestion> = {
    kind: {
      type: 'choice',
      instructions: 'What does this business mainly do?',
      criteria: {
        goods: 'Sells physical goods',
        food: 'Sells prepared food',
        services: 'Sells time or skill',
        wholesale: 'Sells in bulk',
      },
    },
    style: {
      type: 'choice',
      instructions: 'Which store design system best matches the trade, products, and brand vibe?',
      criteria: {
        'dark-luxury': 'Luxury & High-End Retail (Mollie): Paper canvas, black ink, oat surface, ledger brown controls, copper links. Ideal for fine silk sarees, jewelry, watches, atelier, premium craftsmanship.',
        'neon-pop': 'Neon Pop & Playful Energy (Magic Spoon): Lilac canvas, deep concord ink, marshmallow cards, electric grape gradients, chunky pill buttons. Ideal for confectionery, snacks, youth streetwear, playful modern brands.',
        'harvest-editorial': 'Sunlit Harvest & Earth Editorial (arte*): Wheat cream canvas, harvest copper ink, citron beam accent, rounded display typography. Ideal for heritage craft, organic farm, bakeries, cafes, handloom.',
      },
    },
    spotlight: {
      type: 'noul',
      instructions: 'Do the brief or season call for a festival or offer section now?',
    },
    story: {
      type: 'noul',
      instructions: 'Do the brief or facts call for a craft or owner story?',
    },
    lead: {
      type: 'choice',
      instructions: 'What should lead the page after the header?',
      criteria: {
        spotlight: 'Festival or offer',
        catalog: 'Products first',
        story: 'Craft story',
      },
    },
    typography: {
      type: 'choice',
      instructions: 'Which heading style fits the brief?',
      criteria: {
        serif: 'Classic display',
        sans: 'Clean modern',
        grotesk: 'Bold geometric',
      },
    },
    tone: {
      type: 'choice',
      instructions: 'Which surface tone fits the brief?',
      criteria: {
        ink: 'Dark luxury',
        canvas: 'Light clean',
        surface: 'Warm tinted',
      },
    },
    density: {
      type: 'score',
      instructions: 'How airy should spacing be?',
      criteria: ['1: Compact', '2: Balanced', '3: Airy'],
    },
    heroPattern: {
      type: 'choice',
      instructions: 'Which hero section pattern fits the brief, trade and media?',
      criteria: {
        split: 'Split 50/50: editorial headline left with visual right (#4)',
        commerce: 'Commerce hero: product spotlight with price pill and direct order CTA (#16)',
        typography: 'Typography hero: oversized serif statement, dark luxury ink canvas (#24)',
        bg_image: 'Atmospheric hero: full background photography with auto-contrast scrim (#7)',
        minimal: 'Minimal hero: clean balanced spacing and refined navigation (#23)',
      },
    },
  };

  // Trust is asked ONLY if code finds proof. Never inferred without proof!
  if (hasProof) {
    questions.trust = {
      type: 'noul',
      instructions: 'Is the listed proof strong enough to show a trust section?',
    };
  }

  const statePayload = {
    trade,
    bullets,
    facts: {
      items: itemCount,
      proofs,
      ...(season ? { season } : {}),
    },
  };

  const result = await answers(apiKey, cache, 'site.fanout', statePayload, questions);
  if (!result) {
    return {
      kind: 'goods',
      style: 'dark-luxury',
      spotlight: false,
      story: Boolean(input.brief?.goal),
      trust: false,
      lead: 'catalog',
      typography: 'sans',
      tone: 'canvas',
      density: 2,
      heroPattern: 'split',
    };
  }

  const kindChoice = choiceOf(result.kind);
  const styleChoice = choiceOf(result.style);
  const spotlightProb = noulOf(result.spotlight).probability ?? 0;
  const storyProb = noulOf(result.story).probability ?? 0;
  const trustProb = hasProof ? (noulOf(result.trust).probability ?? 0) : 0;
  const leadChoice = choiceOf(result.lead);
  const typeChoice = choiceOf(result.typography);
  const toneChoice = choiceOf(result.tone);
  const densityScore = scoreOf(result.density);
  const heroChoice = choiceOf(result.heroPattern);

  const kind: BusinessKind = (kindChoice.choice === 'food' || kindChoice.choice === 'services' || kindChoice.choice === 'wholesale')
    ? kindChoice.choice
    : 'goods';

  const style = (styleChoice.choice === 'neon-pop' || styleChoice.choice === 'harvest-editorial')
    ? styleChoice.choice
    : 'dark-luxury';

  const spotlight = spotlightProb >= JUDGMENT.noulThreshold;
  const story = storyProb >= JUDGMENT.noulThreshold;
  const trust = hasProof && trustProb >= JUDGMENT.noulThreshold;

  const lead: LeadSection = (leadChoice.choice === 'spotlight' && spotlight)
    ? 'spotlight'
    : (leadChoice.choice === 'story' && story)
      ? 'story'
      : 'catalog';

  const typography: TypographyToken = (typeChoice.choice === 'serif' || typeChoice.choice === 'grotesk')
    ? typeChoice.choice
    : (style === 'harvest-editorial' ? 'serif' : style === 'neon-pop' ? 'grotesk' : 'sans');

  const tone: ToneToken = (toneChoice.choice === 'surface' || toneChoice.choice === 'ink')
    ? toneChoice.choice
    : (style === 'neon-pop' || style === 'harvest-editorial' ? 'surface' : 'canvas');

  const densityVal = densityScore.score;
  const density: DensityToken = densityVal === 1 ? 1 : densityVal === 3 ? 3 : 2;

  const heroPattern: HeroPattern = (
    heroChoice.choice === 'commerce' ||
    heroChoice.choice === 'typography' ||
    heroChoice.choice === 'bg_image' ||
    heroChoice.choice === 'minimal'
  )
    ? heroChoice.choice
    : 'split';

  return { kind, style, spotlight, story, trust, lead, typography, tone, density, heroPattern };
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
