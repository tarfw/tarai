/**
 * Verification without a browser (parai §5.4).
 *
 * A structure snapshot is the tag-and-class skeleton of a rendered section: the words may
 * change, the palette may change, the skeleton may not. Every shipped recipe is rendered
 * against the same store the recipe digest checked its slots against, so a recipe that
 * promises content it cannot draw fails here instead of in a merchant's preview. The bundle
 * budgets are the ones the serving worker carries: 150 KB of CSS, 16 KB of runtime.
 */

import { describe, expect, it } from 'vitest';
import { buildSite } from '../src/site/build.ts';
import { COMMERCE_MODELS, defaultBlueprint, type SectionKind } from '../src/site/blueprint.ts';
import type { Section, SiteDocument } from '../src/site/document.ts';
import { GENERATED_RECIPES } from '../src/site/recipes/library.generated.ts';
import { recipeOfType } from '../src/site/recipes/library.ts';
import type { Recipe, SectionType } from '../src/site/recipes/recipe.ts';
import { resolveSlot } from '../src/site/recipes/slots.ts';
import { escapeHtml } from '../src/site/html.ts';
import { getPrimitive } from '../src/site/registry.ts';
import { compileDocument } from '../src/site/compile.ts';
import { compileCss, type CssCollector } from '../src/site/styles.ts';
import { libraryDesignIds } from '../src/site/designs/library.ts';
import { sampleBrief, sampleFacts, samplePhotos, sampleStoreFacts } from './fixtures/sample-profile.ts';

const CSS_BUDGET = 150 * 1024;
const JS_BUDGET = 16 * 1024;

/** The layout classes the grammar owns; their rules must reach for tokens, never for a colour. */
const GRAMMAR = ['tar-row', 'tar-split', 'tar-overlay', 'tar-rail', 'tar-disclosure'] as const;

/**
 * Regenerate by running this file with the hashes cleared: the failing line prints the value
 * it saw. Markup only changes when a recipe's pattern changes, so each entry is a decision.
 */
const STRUCTURE: Record<string, string> = {
  'announcement/bar': 'c810a0bd',
  'announcement/pill': '4615720d',
  'booking/list': '070423cb',
  'booking/tiers': 'e42eb3f1',
  'catalog/grid': '4cc545c5',
  'catalog/rail': 'b9d3f675',
  'contact/form': '544a94d6',
  'contact/whatsapp': '9423cb02',
  'faq/disclosure': '2b5fc85a',
  'footer/card': 'a9369a12',
  'header/brand': 'a431145f',
  'header/minimal': '20361f5b',
  'header/pill': 'ced671e1',
  'hero/commerce': '30a9e5c7',
  'hero/fullscreen': 'e7a4bda7',
  'hero/split': '6c5046fa',
  'hero/typography': 'e5a41e2e',
  'location/card': '5b2f5a7d',
  'menu/list': '7f589466',
  'policy/disclosure': 'd3bb8645',
  'spotlight/banner': '9ace5a96',
  'story/editorial': '7618cfba',
  'trust/proofs': '697f1333',
};

const KINDS = ['header', 'announcement', 'hero', 'spotlight', 'catalog', 'menu', 'booking',
  'story', 'trust', 'faq', 'policy', 'location', 'contact', 'footer'] as SectionKind[];

/** The same ordinary store, drawn in one design with one recipe swapped in. */
function store(style: string, recipes: Partial<Record<SectionType, string>> = {}): SiteDocument {
  const blueprint = {
    ...defaultBlueprint([...COMMERCE_MODELS], sampleStoreFacts.items?.length ?? 0),
    style,
    sections: KINDS,
    recipes,
  };
  return buildSite({ title: 'Sample Store', brief: sampleBrief, facts: sampleStoreFacts, blueprint, assets: samplePhotos }).doc;
}

function render(doc: SiteDocument, recipe: Recipe): string {
  const section = doc.pages[0].sections.find((entry) => entry.purpose === recipe.type) as Section | undefined;
  expect(section, `${recipe.type}/${recipe.id} has no section in the built store`).toBeTruthy();
  const collector: CssCollector = { classes: new Map(), runtime: new Set() };
  return getPrimitive((section as Section).purpose, recipe.id)
    .render(section as Section, { doc, collector, base: '', index: 0, recipe });
}

/** Tags and classes only: text, inline styles and every attribute value are content. */
function skeleton(html: string): string {
  const tags = html.match(/<[a-z][^>]*>/g) || [];
  return tags.map((tag) => {
    const name = /^<([a-z]+)/.exec(tag)?.[1] || '';
    const classes = /class="([^"]*)"/.exec(tag)?.[1]?.split(/\s+/).filter(Boolean).sort().join(' ') || '';
    return classes ? `${name}.${classes}` : name;
  }).join('>');
}

const sketch = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

/** The words a slot source addresses; a section shows a slot when it shows any of them. */
function slotWords(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(slotWords);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(slotWords);
  return [];
}

const designs = libraryDesignIds();
const recipes = Object.entries(GENERATED_RECIPES);

describe('every shipped recipe renders what it promises', () => {
  it.each(recipes)('%s draws its required slots', (_key, recipe) => {
    const html = render(store('luxury', { [recipe.type]: recipe.id }), recipe);
    for (const [name, slot] of Object.entries(recipe.slots)) {
      if (recipe.needs[name] === 'optional') continue;
      const words = slotWords(resolveSlot(slot.source, sampleFacts)).filter((word) => word.trim().length > 2);
      expect(words.length, `${recipe.type}/${recipe.id} requires ${name} but the grammar resolves nothing`).toBeGreaterThan(0);
      const drawn = words.some((word) => html.includes(word) || html.includes(escapeHtml(word)));
      expect(drawn, `${recipe.type}/${recipe.id} never drew the ${name} slot from ${slot.source}`).toBe(true);
    }
  });

  it.each(recipes)('%s keeps its structure', (_key, recipe) => {
    const observed = designs.map((style) => sketch(skeleton(render(store(style, { [recipe.type]: recipe.id }), recipe))));
    expect(new Set(observed).size, `${recipe.type}/${recipe.id} changed markup when the palette changed`).toBe(1);
    expect(observed[0], `${recipe.type}/${recipe.id} structure is ${observed[0]}; update the table if that is the decision`).toBe(STRUCTURE[`${recipe.type}/${recipe.id}`]);
  });
});

describe('a design changes tokens, never the shop', () => {
  it('ships three designs', () => {
    expect(designs).toEqual(['bold', 'luxury', 'warm']);
  });

  it('writes each design into the stylesheet instead of the markup', () => {
    const sheets = designs.map((style) => {
      const doc = store(style);
      const collector: CssCollector = { classes: new Map(), runtime: new Set() };
      for (const section of doc.pages[0].sections) {
        const recipe = recipeOfType(section.purpose as SectionType, section.recipe?.id) as Recipe;
        getPrimitive(section.purpose, section.recipe?.id).render(section, { doc, collector, base: '', index: 0, recipe });
      }
      return compileCss(doc.design, collector);
    });
    expect(new Set(sheets).size).toBe(designs.length);
    for (const sheet of sheets) {
      for (const cls of GRAMMAR) {
        const rules = [...sheet.matchAll(new RegExp(`\\.${cls}[^{]*\\{[^{}]*\\}`, 'g'))].map((match) => match[0]);
        expect(rules.length, `. ${cls} never reached the stylesheet`).toBeGreaterThan(0);
        for (const rule of rules) expect(rule, `${cls} carries a literal colour`).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      }
    }
  });
});

describe('the bundle stays inside what the edge serves', () => {
  it('keeps CSS and the runtime under budget', async () => {
    const compiled = await compileDocument(store('luxury'), { origin: 'https://sample.example' });
    const css = compiled.files.find((file) => file.path === '/style.css');
    const runtime = compiled.files.find((file) => file.path === '/site.js');
    expect(css).toBeTruthy();
    expect((css as unknown as { body: string }).body.length).toBeLessThan(CSS_BUDGET);
    expect(runtime, 'a store with menus must ship its runtime').toBeTruthy();
    expect((runtime as unknown as { body: string }).body.length).toBeLessThan(JS_BUDGET);
  });

  it('renders every kind for every design without dropping a section', async () => {
    for (const style of designs) {
      const compiled = await compileDocument(store(style), { origin: 'https://sample.example' });
      const page = compiled.files.find((file) => file.path === '/index.html');
      const body = String(page?.body || '');
      for (const kind of KINDS) {
        // Every kind, chrome included, has to come out of the document: the compiler invents nothing.
        expect(body, `${style} lost its ${kind === 'header' ? 'header' : kind} section`).toContain(`data-purpose="${kind === 'header' ? 'navigation' : kind}"`);
      }
      expect(body).not.toMatch(/undefined|NaN|\[object Object\]/);
    }
  });
});
