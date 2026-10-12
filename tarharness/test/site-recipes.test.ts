/**
 * The recipe library guards (parai §5.4). Three things are pinned here: the committed import
 * map is byte-identical to a fresh build over the JSON on disk, `checkRecipe` enforces every
 * §5.5 rule on synthetic input, and a hero's copy comes only from settings and fallback —
 * never from a hardcoded template string.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildRecipes } from '../src/site/recipes/build.ts';
import { checkRecipe } from '../src/site/recipes/schema.ts';
import { recipeEligible, resolveSlot, tokenRef } from '../src/site/recipes/slots.ts';
import { GENERATED_RECIPES } from '../src/site/recipes/library.generated.ts';
import type { Recipe } from '../src/site/recipes/recipe.ts';
import type { Section, SiteDocument } from '../src/site/document.ts';
import type { CssCollector } from '../src/site/styles.ts';
import type { RenderContext } from '../src/site/primitives/nodes.ts';
import { RECIPE_DIR, readRecipeSources } from '../scripts/digestsources.ts';
import { sampleFacts } from './fixtures/sample-profile.ts';
import { render as renderSplit } from '../src/site/primitives/hero/split.ts';

const LIBRARY_FILE = path.join(RECIPE_DIR, 'library.generated.ts');

/** A recipe that passes every check; each rule test mutates one field. */
function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'sample',
    type: 'hero',
    models: ['products'],
    needs: { headline: 'required' },
    layout: { kind: 'split', ratio: '50/50' },
    slots: { headline: { source: 'facts.name', max: 60 } },
    tokens: { text: 'color.ink' },
    settings: { label: { type: 'text', default: 'See the shop', max: 30 } },
    fallback: { headline: 'Your store name' },
    source: { pattern: 'a name beside one photo', reference: 'structural pattern only' },
    ...overrides,
  };
}

function problems(recipe: Record<string, unknown>, file = 'hero/sample.json'): string {
  return checkRecipe(recipe, file).problems.join(' ');
}

describe('recipe library drift', () => {
  it('rebuilds the committed import map byte for byte', () => {
    const sources = readRecipeSources();
    const build = buildRecipes(sources, sampleFacts);
    expect(build.errors).toEqual([]);
    expect(build.excluded).toEqual([]);
    expect(build.unfillable).toEqual([]);
    expect(build.recipes.length).toBe(sources.length);
    expect(fs.readFileSync(LIBRARY_FILE, 'utf8')).toBe(build.library);
  });

  it('keeps the generated map in sync with the recipes that shipped', () => {
    const build = buildRecipes(readRecipeSources(), sampleFacts);
    expect(Object.keys(GENERATED_RECIPES).sort()).toEqual(build.recipes.map((entry) => entry.key).sort());
    expect(new Set(build.recipes.map((entry) => entry.recipe.type)).size).toBe(14);
  });
});

describe('checkRecipe', () => {
  it('admits a well-formed recipe', () => {
    const checked = checkRecipe(base(), 'hero/sample.json');
    expect(checked.problems).toEqual([]);
    expect(checked.recipe?.id).toBe('sample');
  });

  it('rejects a hex colour written into a token role', () => {
    expect(problems(base({ tokens: { text: '#ff0000' } }))).toContain('hex value');
  });

  it('rejects a token path no design carries', () => {
    expect(problems(base({ tokens: { text: 'ink' } }))).toContain('no design carries');
  });

  it('rejects an unknown layout kind', () => {
    expect(problems(base({ layout: { kind: 'marquee' } }))).toContain('must name a layout primitive');
  });

  it('rejects a ratio on a layout that is not a split', () => {
    expect(problems(base({ layout: { kind: 'grid', columns: 3, ratio: '50/50' } }))).toContain('ratio belongs to a split');
  });

  it('rejects a slot source outside the grammar', () => {
    expect(problems(base({ slots: { headline: { source: 'weather.today' } } }))).toContain('not in the slot grammar');
  });

  it('rejects a need that names no slot', () => {
    expect(problems(base({ needs: { headline: 'required', body: 'optional' } }))).toContain('which has no slot');
  });

  it('rejects a slot that is not declared in needs', () => {
    const recipe = base({ slots: { headline: { source: 'facts.name' }, body: { source: 'brief.goal' } } });
    expect(problems(recipe)).toContain('is not declared in needs');
  });

  it('rejects an id that is not one lowercase word', () => {
    expect(problems(base({ id: 'dark-luxe' }), 'hero/dark-luxe.json')).toContain('one lowercase word');
  });

  it('rejects a type outside the fourteen section types', () => {
    expect(problems(base({ type: 'widget' }), 'widget/sample.json')).toContain('not one of the 14 section types');
  });

  it('rejects a boolean setting with no default', () => {
    expect(problems(base({ settings: { reverse: { type: 'boolean' } } }))).toContain('default must be true or false');
  });

  it('rejects a measurement smuggled into a setting', () => {
    expect(problems(base({ settings: { gap: { type: 'text', default: '12px' } } }))).toContain('writes a measurement');
  });

  it('rejects a recipe that names no commerce model', () => {
    expect(problems(base({ models: [] }))).toContain('names the commerce models');
  });

  it('rejects an unknown commerce model', () => {
    expect(problems(base({ models: ['subscription'] }))).toContain('Unknown commerce model');
  });

  it('rejects a fallback for a slot that does not exist', () => {
    expect(problems(base({ fallback: { headline: 'Your store name', body: 'Hello' } }))).toContain('is not a slot');
  });
});

describe('slot grammar', () => {
  it('resolves every root the grammar names', () => {
    expect(resolveSlot('brief.goal', sampleFacts)).toBe('Fresh food, made to order');
    expect(resolveSlot('facts.name', sampleFacts)).toBe('Sample Store');
    expect(resolveSlot('route.primary', sampleFacts)).toBe('#menu');
    expect(resolveSlot('photos[0]', sampleFacts)).toBe('sample-photo');
    expect(resolveSlot('items[0..1]', sampleFacts)).toHaveLength(2);
    expect(resolveSlot('services[0]', sampleFacts)).toMatchObject({ title: 'Table for four' });
  });

  it('returns undefined for a source it cannot address', () => {
    expect(resolveSlot('weather.today', sampleFacts)).toBeUndefined();
    expect(resolveSlot('facts.nonsense', sampleFacts)).toBeUndefined();
    expect(resolveSlot('photos[9]', sampleFacts)).toBeUndefined();
  });

  it('prefixes a token path once', () => {
    expect(tokenRef('color.ink')).toBe('token:color.ink');
    expect(tokenRef('token:color.ink')).toBe('token:color.ink');
  });

  it('is eligible only when every required slot fills', () => {
    const valid = checkRecipe(base(), 'hero/sample.json').recipe as Recipe;
    expect(recipeEligible(valid, sampleFacts)).toEqual({ ok: true, missing: [] });

    const hungry = checkRecipe(base({ slots: { headline: { source: 'facts.missing' } } }), 'hero/sample.json').recipe as Recipe;
    expect(recipeEligible(hungry, sampleFacts)).toEqual({ ok: false, missing: ['headline'] });

    const lenient = checkRecipe(base({ needs: { headline: 'optional' }, slots: { headline: { source: 'facts.missing' } } }), 'hero/sample.json').recipe as Recipe;
    expect(recipeEligible(lenient, sampleFacts)).toEqual({ ok: true, missing: [] });
  });
});

describe('hero copy provenance', () => {
  const split = GENERATED_RECIPES['hero/split'];

  function doc(assets: unknown[] = []): SiteDocument {
    return {
      schema: '2.0.0',
      design: {},
      assets,
      redirects: [],
      pages: [{ id: 'home', path: '/', title: 'Loom Studio', sections: [] }],
    } as unknown as SiteDocument;
  }

  function context(document: SiteDocument, recipe?: Recipe): RenderContext {
    const collector: CssCollector = { classes: new Map(), runtime: new Set<string>() };
    return { doc: document, collector, base: '', index: 0, recipe };
  }

  const TEMPLATE_COPY = ['Handcrafted', 'View Collection', 'Verified'];

  it('draws headline, body, cta and media from the section nodes', () => {
    const section: Section = {
      id: 'hero',
      purpose: 'hero',
      layout: { kind: 'split', ratio: '50/50' },
      nodes: [
        { id: 'h', kind: 'heading', props: { text: 'Kanchipuram Weaves' } },
        { id: 'b', kind: 'text', props: { text: 'Direct from the loom' } },
        { id: 'c', kind: 'button', props: { label: 'Explore', href: '#catalog' } },
        { id: 'm', kind: 'image', props: { asset: 'photo1', alt: 'A saree' } },
      ],
    };
    const document = doc([{ id: 'photo1', kind: 'image', mime: 'image/jpeg', width: 800, height: 600, alt: 'A saree' }]);
    const html = renderSplit(section, context(document, split));

    expect(html).toContain('<span class="tar-hero-eyebrow">Now open</span>');
    expect(html).toContain('<h1 class="tar-hero-title">Kanchipuram Weaves</h1>');
    expect(html).toContain('<p class="tar-hero-desc">Direct from the loom</p>');
    expect(html).toContain('<a href="#catalog" class="tar-btn tar-btn-outline">Explore</a>');
    expect(html).toContain('<img src="/media/photo1.jpg" alt="A saree" width="800" height="600" loading="eager" fetchpriority="high">');
    for (const copy of TEMPLATE_COPY) expect(html).not.toContain(copy);
  });

  it('renders the same bytes for the same input', () => {
    const section: Section = {
      id: 'hero',
      purpose: 'hero',
      layout: { kind: 'split', ratio: '50/50' },
      nodes: [{ id: 'h', kind: 'heading', props: { text: 'Kanchipuram Weaves' } }],
    };
    const document = doc();
    const first = renderSplit(section, context(document, split));
    const second = renderSplit(section, context(document, split));
    expect(first).toBe(second);
  });

  it('takes the eyebrow and cta label from settings when the nodes are silent', () => {
    const section: Section = {
      id: 'hero',
      purpose: 'hero',
      layout: { kind: 'split' },
      recipe: { id: 'split', settings: { eyebrow: 'Grand opening', label: 'Shop the loom' } },
      nodes: [
        { id: 'h', kind: 'heading', props: { text: 'Kanchipuram Weaves' } },
        { id: 'b', kind: 'text', props: { text: 'Direct from the loom' } },
      ],
    };
    const html = renderSplit(section, context(doc(), split));
    expect(html).toContain('<span class="tar-hero-eyebrow">Grand opening</span>');
    expect(html).toContain('<a href="#catalog" class="tar-btn tar-btn-outline">Shop the loom</a>');
    expect(html).not.toContain('Now open');
    for (const copy of TEMPLATE_COPY) expect(html).not.toContain(copy);
  });

  it('still renders a neutral shape with no recipe and no nodes', () => {
    const section: Section = { id: 'hero', purpose: 'hero', layout: { kind: 'split' }, nodes: [] };
    const html = renderSplit(section, context(doc()));
    expect(html).toContain('<h1 class="tar-hero-title">Your store name</h1>');
    expect(html).toContain('>See the shop</a>');
    expect(html).toContain('tar-hero-placeholder');
    expect(html).not.toContain('tar-hero-eyebrow');
    for (const copy of TEMPLATE_COPY) expect(html).not.toContain(copy);
  });
});
