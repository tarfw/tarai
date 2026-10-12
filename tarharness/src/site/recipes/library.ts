/**
 * Reading the generated recipe library. Everything the compiler, the shortlist and the
 * settings editor need about a recipe comes through here, so no caller touches JSON and no
 * renderer has to know which recipes exist.
 */

import type { CommerceModel } from '../blueprint.ts';
import type { Section } from '../document.ts';
import type { Recipe, SectionType } from './recipe.ts';
import { GENERATED_RECIPES } from './library.generated.ts';

/** The layout a store gets when nothing has chosen one: the plainest shape that still fits. */
export const DEFAULT_RECIPE: Record<SectionType, string> = {
  header: 'minimal',
  announcement: 'bar',
  hero: 'split',
  spotlight: 'banner',
  catalog: 'grid',
  menu: 'list',
  booking: 'list',
  story: 'editorial',
  trust: 'proofs',
  faq: 'disclosure',
  policy: 'disclosure',
  location: 'card',
  contact: 'whatsapp',
  footer: 'card',
};

export const RECIPE_KEYS: readonly string[] = Object.keys(GENERATED_RECIPES);

/** Purposes a stored document may still carry, in terms of the section types that own them. */
const LEGACY_TYPE: Record<string, SectionType> = {
  navigation: 'header',
  notice: 'announcement',
  collection: 'catalog',
  services: 'booking',
  promo: 'spotlight',
  introduction: 'hero',
  action: 'contact',
};

/**
 * Option names written before the recipe library existed. They survive only here: a stored
 * document is translated on read, so no renderer or client carries a second vocabulary.
 */
const LEGACY_RECIPE: Partial<Record<SectionType, Record<string, string>>> = {
  header: { split: 'minimal', fullbleed: 'minimal', floating_pill: 'pill', centered_logo: 'brand' },
  hero: {
    minimal: 'split', bg_image: 'fullscreen', fullbleed: 'fullscreen',
    centered_atmospheric: 'fullscreen', atmospheric: 'fullscreen',
  },
  announcement: { scrolling: 'bar', quiz: 'pill', quiz_pill: 'pill' },
  catalog: { flat: 'grid', pills: 'grid', rails: 'rail' },
  footer: { contact_card: 'card' },
};

export function sectionType(purpose: string): SectionType {
  return (LEGACY_TYPE[purpose] || purpose) as SectionType;
}

/** A pre-recipe option name in recipe terms; anything already a recipe id passes through. */
export function canonicalRecipeId(type: SectionType, option: string): string {
  return LEGACY_RECIPE[type]?.[option] || option;
}

export function recipeOfType(type: SectionType, id?: string | null): Recipe | undefined {
  const kind = sectionType(type);
  const named = id ? GENERATED_RECIPES[`${kind}/${canonicalRecipeId(kind, id)}`] : undefined;
  if (named) return named;
  return GENERATED_RECIPES[`${kind}/${DEFAULT_RECIPE[kind]}`];
}

/** The recipe a section should render with: its own stamp first, then the store's choice. */
export function recipeFor(section: Section, recipes?: Partial<Record<SectionType, string>>): Recipe | undefined {
  const kind = sectionType(section.purpose);
  return recipeOfType(kind, section.recipe?.id || recipes?.[kind]);
}

export function recipesFor(type: SectionType): Recipe[] {
  return RECIPE_KEYS.filter((key) => key.startsWith(`${type}/`)).map((key) => GENERATED_RECIPES[key]);
}

/**
 * Recipes a store could actually use: the type, one of its models, and enough content.
 * Only the id and the structural description leave the server (parai D13).
 */
export function recipeOptions(type: SectionType, models: readonly CommerceModel[] = []): { id: string; pattern: string }[] {
  return recipesFor(type)
    .filter((recipe) => !models.length || recipe.models.some((model) => models.includes(model)))
    .map((recipe) => ({ id: recipe.id, pattern: recipe.source.pattern }));
}

/** Every type a merchant editor can change, with the settings each recipe exposes. */
export function recipeSettings(type: SectionType): Record<string, Recipe['settings']> {
  const out: Record<string, Recipe['settings']> = {};
  for (const recipe of recipesFor(type)) out[recipe.id] = recipe.settings;
  return out;
}
