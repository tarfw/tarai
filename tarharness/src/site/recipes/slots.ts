/**
 * Slot resolution (parai §5.2). A recipe names where its content comes from; this module is
 * the only reader of that grammar, both at build time — so a recipe that could never be
 * filled is excluded before it reaches a merchant — and in the renderer, where a resolved
 * slot becomes the text a section shows.
 */

import type { SiteDocument } from '../document.ts';
import type { Recipe } from './recipe.ts';

/** Everything a store can put on the table, in the shape the grammar addresses. */
export interface SlotFacts {
  brief: Record<string, unknown>;
  facts: Record<string, unknown>;
  route: Record<string, unknown>;
  photos: string[];
  items: Record<string, unknown>[];
  services: Record<string, unknown>[];
}

const SOURCE = /^(?<root>brief|facts|route)\.(?<key>[a-z][a-z0-9]{0,23})$|^(?<list>photos|items|services)\[(?<from>\d{1,3})(?:\.\.(?<to>\d{1,3}))?\]$/;

const filled = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

/** `brief.goal`, `photos[0]`, `items[0..3]` → the value, or undefined when absent. */
export function resolveSlot(source: string, facts: SlotFacts): unknown {
  const match = SOURCE.exec(source);
  if (!match?.groups) return undefined;
  const { root, key, list, from, to } = match.groups as Record<string, string>;
  if (root && key) {
    const bag = facts[root as 'brief' | 'facts' | 'route'];
    return bag ? bag[key] : undefined;
  }
  if (!list) return undefined;
  const entries = (facts[list as 'photos' | 'items' | 'services'] || []) as unknown[];
  const start = Number(from);
  if (to === undefined) return entries[start];
  return entries.slice(start, Number(to) + 1);
}

/**
 * Where a store's own pages can be pointed at, read from the document rather than configured:
 * the section anchors on the home page, plus the contact page a merchant may have.
 */
export function routesOf(doc: SiteDocument): Record<string, string> {
  const sections = doc.pages[0]?.sections || [];
  const anchor = (purpose: string): string => {
    const section = sections.find((entry) => entry.purpose === purpose);
    return section?.id ? `#${section.id}` : '';
  };
  const shop = anchor('menu') || anchor('booking') || anchor('catalog') || anchor('spotlight');
  const page = (prefix: string): string => doc.pages.find((entry) => entry.path.startsWith(prefix))?.path || '';
  return {
    primary: shop || anchor('contact') || page('/contact') || '/',
    catalog: anchor('catalog') || page('/catalog'),
    menu: anchor('menu'),
    booking: anchor('booking'),
    story: anchor('story'),
    contact: anchor('contact') || page('/contact') || '/contact',
  };
}

export interface RecipeEligibility {
  ok: boolean;
  /** Required slots the store cannot fill, by slot name. */
  missing: string[];
}

/** A recipe is eligible when every slot it cannot do without resolves from the facts. */
export function recipeEligible(recipe: Recipe, facts: SlotFacts): RecipeEligibility {
  const missing: string[] = [];
  for (const [name, slot] of Object.entries(recipe.slots)) {
    if (recipe.needs[name] === 'optional') continue;
    if (!filled(resolveSlot(slot.source, facts))) missing.push(name);
  }
  return { ok: !missing.length, missing };
}

/** A recipe names a token as `color.ink`; the renderer asks for it as a `token:` reference. */
export function tokenRef(path: string): string {
  return path.startsWith('token:') ? path : `token:${path}`;
}
