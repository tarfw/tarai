/**
 * Shortlists (parai §6.1, D6). Jev only ever chooses from a list code built here: the designs
 * that fit the commerce models and trade, the recipes that fit a section type, and the section
 * types a store will actually present. Ranking is deterministic, so the same store shortlists
 * the same way with or without a model, and a model can never invent an option.
 */

import type { DesignIndex, DesignIndexRow, DensityWord, ToneWord } from './designs/contract.ts';
import type { CommerceModel, DensityToken, SectionKind, ToneToken, TypographyToken } from './blueprint.ts';
import { SECTION_SEQUENCE, sectionsForModels } from './blueprint.ts';
import type { SiteFacts } from './blueprint.ts';
import { DEFAULT_RECIPE, recipeOptions } from './recipes/library.ts';
import { canonicalDesignId, libraryRows, tokensFor } from './designs/library.ts';

/** A merchant's stated lean, used only to rank; it never adds an option. */
export interface DesignWant {
  tone?: ToneWord;
  density?: DensityWord;
}

/** The design a trade falls back to when neither model nor industry matches. Authored, small. */
export const INDUSTRY_DEFAULT: Record<string, string> = {};

function rankDesigns(rows: DesignIndexRow[], want?: DesignWant): DesignIndexRow[] {
  const score = (row: DesignIndexRow): number =>
    (want?.tone && row.tone === want.tone ? 2 : 0) + (want?.density && row.density === want.density ? 1 : 0);
  return [...rows].sort((left, right) => {
    const byScore = score(right) - score(left);
    if (byScore) return byScore;
    const byContrast = right.contrast - left.contrast;
    if (byContrast) return byContrast;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

/**
 * At most `max` designs Jev may choose from. Filter by model and industry, then relax to
 * model-only, then industry-only, then the authored default, then everything — so the list is
 * never empty while a reviewed design exists.
 */
export function shortlistDesigns(
  index: DesignIndex,
  models: readonly CommerceModel[],
  industry: string,
  want?: DesignWant,
  max = 6,
): DesignIndexRow[] {
  const rows = index.designs;
  if (!rows.length) return [];
  const byModel = (row: DesignIndexRow): boolean => !models.length || row.models.some((model) => models.includes(model as CommerceModel));
  const byIndustry = (row: DesignIndexRow): boolean => row.industries.includes(industry);

  let pool = rows.filter((row) => byModel(row) && byIndustry(row));
  if (!pool.length) pool = rows.filter(byModel);
  if (!pool.length) pool = rows.filter(byIndustry);
  if (!pool.length) {
    const fallback = INDUSTRY_DEFAULT[industry] || index.default;
    pool = rows.filter((row) => row.id === fallback);
    if (!pool.length) pool = rows;
  }
  return rankDesigns(pool, want).slice(0, Math.max(1, max));
}

/** The recipes for one section type a store's models can actually use. */
export function shortlistRecipes(type: SectionKind, models: readonly CommerceModel[] = []): { id: string; pattern: string }[] {
  return recipeOptions(type, models);
}

/** The recipe id a type falls back to when Jev does not choose one. */
export function defaultRecipe(type: SectionKind): string {
  return DEFAULT_RECIPE[type];
}

/**
 * Every section type a store will present: the sections its models require, plus the optional
 * ones worth a recipe choice. `trust` is dropped without proof, matching the only-ask-with-proof
 * rule the judgment keeps.
 */
export function presentSectionTypes(models: readonly CommerceModel[], facts: SiteFacts = {}): SectionKind[] {
  const { required, optional } = sectionsForModels(models);
  const present = new Set<SectionKind>(required);
  for (const kind of optional as readonly SectionKind[]) {
    if (kind === 'trust' && !(facts.proofs?.length ?? 0)) continue;
    present.add(kind);
  }
  return SECTION_SEQUENCE.filter((kind) => present.has(kind));
}

const SERIF = /(serif|lora|playfair|georgia|garamond|caslon|baskerville|didot|times)/i;
const GROTESK = /(grotesk|grotesque)/i;

/** The heading family a design's display font implies; only `createDesign` still reads it. */
export function classifyType(display = ''): TypographyToken {
  // Drop the generic `sans`/`sans-serif` tail so its `serif` substring cannot fool the match.
  const family = display.replace(/sans-serif/gi, '').replace(/\bsans\b/gi, '');
  if (GROTESK.test(family)) return 'grotesk';
  if (SERIF.test(family)) return 'serif';
  return 'sans';
}

export interface ProjectedLook {
  typography: TypographyToken;
  tone: ToneToken;
  density: DensityToken;
}

/**
 * Palette and spacing are the design's, not a model's (D7). Code projects the three legacy
 * blueprint knobs from the chosen design's reviewed row and tokens: density from the row's word,
 * the heading family from the display font, and tone to the page canvas — which is dark on a dark
 * design and light on a light one, so sections always sit on the design's own background.
 */
export function projectLook(id: string): ProjectedLook {
  const canonical = canonicalDesignId(id);
  const row = libraryRows().find((entry) => entry.id === canonical);
  const density: DensityToken = row?.density === 'airy' ? 3 : row?.density === 'compact' ? 1 : 2;
  return { typography: classifyType(tokensFor(canonical)?.type.display), tone: 'canvas', density };
}

