/**
 * Shortlist and Jev #2 guards (parai §6, D6/D7). These pin the two rules that keep a model
 * honest: it only ever chooses from a list code built, and palette/spacing are projected from
 * the chosen design rather than asked. The judgeLook cases run with no API key, so they exercise
 * the deterministic default path — the one a real store hits when TypeSafe is unreachable.
 */

import { describe, expect, it } from 'vitest';
import type { DesignIndex, DesignIndexRow } from '../src/site/designs/contract.ts';
import { libraryDefault, libraryDesignIds, libraryIndex } from '../src/site/designs/library.ts';
import { DEFAULT_RECIPE, recipesFor } from '../src/site/recipes/library.ts';
import { classifyType, presentSectionTypes, projectLook, shortlistDesigns, shortlistRecipes } from '../src/site/shortlist.ts';
import { judgeLook } from '../src/site/judgment.ts';

function row(partial: Partial<DesignIndexRow> & { id: string }): DesignIndexRow {
  return {
    label: partial.id,
    desc: '',
    tone: 'light',
    density: 'balanced',
    industries: ['general'],
    models: ['products'],
    imagery: 'product',
    contrast: 5,
    swatches: [],
    ...partial,
  } as DesignIndexRow;
}

function index(rows: DesignIndexRow[], def = rows[0]?.id || ''): DesignIndex {
  return { version: 1, default: def, designs: rows };
}

const ids = (rows: DesignIndexRow[]): string[] => rows.map((entry) => entry.id);

describe('shortlistDesigns ranking', () => {
  const synthetic = index([
    row({ id: 'a', tone: 'dark', density: 'compact', contrast: 5 }),
    row({ id: 'b', tone: 'light', density: 'airy', contrast: 20 }),
    row({ id: 'c', tone: 'dark', density: 'airy', contrast: 1 }),
  ], 'a');

  it('ranks by contrast then id when nothing is wanted', () => {
    expect(ids(shortlistDesigns(synthetic, ['products'], 'general'))).toEqual(['b', 'a', 'c']);
  });

  it('outranks contrast with a tone match, and a density match after it', () => {
    // c scores 3 (tone+2, density+1), a scores 2 (tone), b scores 1 (density).
    expect(ids(shortlistDesigns(synthetic, ['products'], 'general', { tone: 'dark', density: 'airy' }))).toEqual(['c', 'a', 'b']);
  });

  it('breaks a score tie on contrast', () => {
    // a and c both score 2 on tone; a wins on contrast (5 > 1), then b at 0.
    expect(ids(shortlistDesigns(synthetic, ['products'], 'general', { tone: 'dark' }))).toEqual(['a', 'c', 'b']);
  });

  it('never returns more than the cap', () => {
    expect(ids(shortlistDesigns(synthetic, ['products'], 'general', undefined, 2))).toEqual(['b', 'a']);
  });
});

describe('shortlistDesigns relax chain', () => {
  const real = libraryIndex();

  it('matches on model and industry first', () => {
    expect(ids(shortlistDesigns(real, ['products'], 'general'))).toEqual(['luxury']);
    expect(ids(shortlistDesigns(real, ['food'], 'food'))).toEqual(['bold', 'warm']);
  });

  it('relaxes to model-only when no design names the industry', () => {
    expect(ids(shortlistDesigns(real, ['digital'], 'food'))).toEqual(['luxury']);
  });

  it('relaxes to industry-only when no design serves the model', () => {
    expect(ids(shortlistDesigns(real, ['booking'], 'services'))).toEqual(['warm']);
  });

  it('falls back to the library default when nothing matches', () => {
    expect(ids(shortlistDesigns(real, ['booking'], 'aerospace'))).toEqual([libraryDefault()]);
  });

  it('returns nothing for an empty library rather than throwing', () => {
    expect(shortlistDesigns(index([]), ['products'], 'general')).toEqual([]);
  });
});

describe('shortlistRecipes', () => {
  it('offers every recipe for a type when no model filters it', () => {
    expect(shortlistRecipes('hero', []).map((option) => option.id).sort()).toEqual(recipesFor('hero').map((recipe) => recipe.id).sort());
  });

  it('returns id and structural pattern, and a model only ever narrows the list', () => {
    const all = shortlistRecipes('hero', []);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((option) => typeof option.pattern === 'string' && option.pattern.length > 0)).toBe(true);
    const products = shortlistRecipes('hero', ['products']);
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((option) => all.some((entry) => entry.id === option.id))).toBe(true);
  });
});

describe('presentSectionTypes', () => {
  it('unions the required sections with the optional candidates, in sequence', () => {
    expect(presentSectionTypes(['products'])).toEqual(['header', 'announcement', 'hero', 'spotlight', 'catalog', 'story', 'policy', 'contact', 'footer']);
    expect(presentSectionTypes(['food'])).toEqual(['header', 'announcement', 'hero', 'spotlight', 'menu', 'story', 'location', 'contact', 'footer']);
  });

  it('adds trust only when there is proof', () => {
    expect(presentSectionTypes(['products'], { proofs: ['Silk Mark'] })).toContain('trust');
    expect(presentSectionTypes(['products'], { proofs: [] })).not.toContain('trust');
  });
});

describe('projected look', () => {
  it('classifies a display font without letting "sans-serif" read as serif', () => {
    expect(classifyType('"Lora", Georgia, serif')).toBe('serif');
    expect(classifyType('"Space Grotesk", sans-serif')).toBe('grotesk');
    expect(classifyType('"Inter Variable", "Inter", sans-serif')).toBe('sans');
    expect(classifyType('"Plus Jakarta Sans", sans-serif')).toBe('sans');
    expect(classifyType('')).toBe('sans');
  });

  it('projects density from the reviewed row and tone to the page canvas', () => {
    expect(projectLook('luxury')).toMatchObject({ tone: 'canvas', density: 2, typography: 'sans' });
    expect(projectLook('warm').density).toBe(3);
  });

  it('resolves a legacy id and survives an unknown one', () => {
    expect(projectLook('dark-luxury')).toMatchObject({ tone: 'canvas', density: 2 });
    expect(projectLook('nonsense')).toMatchObject({ tone: 'canvas', density: 2, typography: 'sans' });
  });
});

describe('judgeLook deterministic path', () => {
  it('picks the top shortlisted design and the default recipe per present type', async () => {
    const look = await judgeLook(undefined, {}, { models: ['products'], industry: 'general', facts: { items: 3 }, brief: { goal: 'Sell sarees' } });
    expect(libraryDesignIds()).toContain(look.design);
    expect(look.design).toBe('luxury');
    expect(look.lead).toBe('catalog');
    expect(look.spotlight).toBe(false);
    expect(look.story).toBe(true);
    expect(look.trust).toBe(false);
    for (const type of presentSectionTypes(['products'])) expect(look.recipes[type]).toBe(DEFAULT_RECIPE[type]);
  });

  it('leaves story off when there is no goal to tell', async () => {
    const look = await judgeLook(undefined, {}, { models: ['products'], industry: 'general', facts: {} });
    expect(look.story).toBe(false);
  });

  it('honours a design override and records it as fixed', async () => {
    const look = await judgeLook(undefined, {}, { models: ['products'], industry: 'general', facts: {}, overrides: { design: 'warm', recipes: { hero: 'commerce' } } });
    expect(look.design).toBe('warm');
    expect(look.recipes.hero).toBe('commerce');
    expect(look.fixed.design).toBe('warm');
    expect(look.fixed.recipes.hero).toBe('commerce');
  });

  it('drops an avoided design, canonicalising a legacy id', async () => {
    const shortlist = ids(shortlistDesigns(libraryIndex(), ['products'], 'apparel'));
    expect(shortlist).toEqual(['luxury', 'warm']);
    const look = await judgeLook(undefined, {}, { models: ['products'], industry: 'apparel', facts: {}, avoid: ['dark-luxury'] });
    expect(look.design).toBe('warm');
  });
});
