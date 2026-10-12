/**
 * Site document reader.
 *
 * A stored record is read as the current v2 document model and auto-healed on
 * read: route gaps become pages and an older blueprint becomes the current
 * blueprint contract. Nothing is rewritten on write, and anything that is not a
 * v2 document is rejected.
 */

import { badRequest } from '../errors.ts';
import { DOCUMENT_VERSION, type Node, type Page, type SiteDocument } from './document.ts';
import {
  COMMERCE_MODELS,
  SECTION_KINDS,
  defaultBlueprint,
  kindForModels,
  normalizeOverrides,
  type Blueprint,
  type CommerceModel,
  type GateResult,
  type ModelProfile,
  type SectionKind,
} from './blueprint.ts';
import { canonicalDesignId, tokensFor } from './designs/library.ts';
import { canonicalRecipeId } from './recipes/library.ts';

export function isV2(source: unknown): source is SiteDocument {
  return Boolean(source) && (source as SiteDocument).schema === DOCUMENT_VERSION;
}

function walkNodes(nodes: Node[] | undefined): Node[] {
  return (nodes || []).flatMap((node) => [node, ...walkNodes(node.children)]);
}

/** Section names retired by the model contract, mapped to their replacement. */
const LEGACY_SECTIONS: Record<string, SectionKind> = {
  notice: 'announcement',
  services: 'catalog',
  collection: 'catalog',
};

/** The business kind a pre-model blueprint carried maps onto the model set. */
const MODELS_BY_KIND: Record<string, CommerceModel[]> = {
  goods: ['products'],
  food: ['food'],
  services: ['booking', 'quote'],
  wholesale: ['bulk'],
};

/** A stored gate is either the old boolean or the current `{ ok, missing }`. */
function readGate(value: unknown): GateResult {
  if (value && typeof value === 'object') {
    const gate = value as { ok?: unknown; missing?: unknown };
    const missing = Array.isArray(gate.missing)
      ? gate.missing.filter((entry): entry is GateResult['missing'][number] => Boolean(entry) && typeof entry === 'object' && typeof (entry as { need?: unknown }).need === 'string' && COMMERCE_MODELS.includes((entry as { model?: CommerceModel }).model as CommerceModel))
      : [];
    return { ok: gate.ok !== false, missing: gate.ok === true ? [] : missing };
  }
  return { ok: value === true, missing: [] };
}
function readModels(value: unknown, kind: string): CommerceModel[] {
  const found = Array.isArray(value)
    ? value.filter((model): model is CommerceModel => COMMERCE_MODELS.includes(model as CommerceModel))
    : [];
  if (found.length) return [...new Set(found)];
  return MODELS_BY_KIND[kind] || ['products'];
}

/** A stored blueprint's section picks, keeping only the pairs it can actually hold. */
function rawRecipes(raw: Record<string, unknown>): Partial<Record<SectionKind, string>> {
  const value = raw.recipes && typeof raw.recipes === 'object' ? raw.recipes as Record<string, unknown> : {};
  const out: Partial<Record<SectionKind, string>> = {};
  for (const [type, id] of Object.entries(value)) {
    if ((SECTION_KINDS as readonly string[]).includes(type) && typeof id === 'string') out[type as SectionKind] = id;
  }
  return out;
}

/** Older blueprints are healed into the current contract rather than rejected. */
export function normalizeBlueprint(value: unknown): Blueprint {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const base = defaultBlueprint();
  const stored = (raw.profile && typeof raw.profile === 'object' ? raw.profile : {}) as Partial<ModelProfile>;
  const kind = typeof raw.kind === 'string' ? raw.kind : '';
  const models = readModels(stored.models, kind);
  const profile: ModelProfile = {
    models,
    industry: typeof stored.industry === 'string' ? stored.industry : 'general',
    capabilities: { ...base.profile.capabilities, ...(stored.capabilities || {}) },
    confidence: { ...base.profile.confidence, ...(stored.confidence || {}) },
    ask: stored.ask === true,
  };
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .map((section) => LEGACY_SECTIONS[String(section)] || String(section))
    .filter((section): section is SectionKind => (SECTION_KINDS as readonly string[]).includes(section));
  const overrides = normalizeOverrides(raw.overrides);
  const rest = { ...raw };
  delete rest.overrides;
  // The option fields a blueprint carried before recipes are folded into `recipes` on read, so
  // a pre-recipe draft keeps its look and the current model speaks one vocabulary (parai §3.6).
  const recipes: Partial<Record<SectionKind, string>> = { ...rawRecipes(raw) };
  for (const [field, type] of [['headerStyle', 'header'], ['heroPattern', 'hero'], ['footerStyle', 'footer']] as const) {
    delete rest[field];
    const value = raw[field];
    // A section pick written before recipes survives; one already in `recipes` wins.
    if (typeof value === 'string' && !recipes[type]) recipes[type] = canonicalRecipeId(type, value);
  }
  return {
    ...base,
    ...rest,
    kind: kindForModels(models),
    profile,
    ...(Object.keys(recipes).length ? { recipes } : {}),
    sections: sections.length ? [...new Set(sections)] : base.sections,
    // A document that predates the gate was never checked, so it is not a closed gate
    // with nothing missing: that reading would refuse to publish and say why in no words.
    gate: raw.gate === undefined ? base.gate : readGate(raw.gate),
    ...(Object.keys(overrides).length ? { overrides } : {}),
  } as Blueprint;
}

/**
 * A stored document can carry a design id that the library migration retired. Only ids the
 * library recognises are rewritten, so readers see a library id and no client needs an alias
 * table (parai §3.6); an unknown id stays as written and the renderer falls back.
 */
function libraryDesignId(id?: string | null): string | null | undefined {
  return id && tokensFor(id) ? canonicalDesignId(id) : id;
}

function withLibraryDesignId(doc: SiteDocument): SiteDocument {
  const theme = libraryDesignId(doc.design?.theme);
  const style = libraryDesignId(doc.blueprint?.style);
  if (theme === doc.design?.theme && style === doc.blueprint?.style) return doc;
  return {
    ...doc,
    design: doc.design && theme ? { ...doc.design, theme } : doc.design,
    blueprint: doc.blueprint && style ? { ...doc.blueprint, style } : doc.blueprint,
  };
}

export function normalizeDocument(source: SiteDocument): SiteDocument {
  const doc = withLibraryDesignId(source);
  const brand = doc.pages[0]?.title || doc.brief?.goal?.slice(0, 40) || 'Storefront';
  const pages = doc.pages;
  // Every document carries a blueprint, so an override always has somewhere to live and
  // a reader never has to ask whether the store has a model set. A stored one is healed.
  const blueprint = normalizeBlueprint(doc.blueprint);

  const existingPaths = new Set(pages.map((p) => p.path));
  const existingRedirects = new Set(doc.redirects.map((r) => r.from));
  const missingPaths: string[] = [];

  const allNodes = pages.flatMap((page) => page.sections.flatMap((section) => walkNodes(section.nodes)));
  for (const node of allNodes) {
    if (node.kind === 'link' || node.kind === 'button') {
      const href = typeof node.props?.href === 'string' ? node.props.href : '';
      if (href.startsWith('/') && !existingPaths.has(href) && !existingRedirects.has(href) && !href.startsWith('/#')) {
        if (!missingPaths.includes(href)) missingPaths.push(href);
      }
    }
    const links = node.kind === 'navigation' || node.kind === 'footer' || node.kind === 'menu' ? node.props?.links : undefined;
    if (Array.isArray(links)) {
      for (const link of links as { href?: string }[]) {
        const href = typeof link.href === 'string' ? link.href : '';
        if (href.startsWith('/') && !existingPaths.has(href) && !existingRedirects.has(href) && !href.startsWith('/#')) {
          if (!missingPaths.includes(href)) missingPaths.push(href);
        }
      }
    }
  }

  if (!missingPaths.length) return { ...doc, blueprint, pages };

  const navLinks = pages.map((p) => ({ label: p.path === '/' ? 'Home' : p.path.slice(1), href: p.path }));

  const synthesizedPages: Page[] = missingPaths.map((path) => {
    const rawSlug = path.replace(/^\/+/, '').replace(/[^a-z0-9-]/gi, '-');
    const id = rawSlug || 'page';
    const title = id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
    return {
      id,
      path,
      title,
      meta: { description: `${title} — ${brand}` },
      sections: [
        {
          id: `${id}-hero`,
          purpose: 'hero',
          layout: { kind: 'stack' },
          style: { base: { pad: 'token:space.section' } },
          nodes: [
            { id: `${id}-title`, kind: 'heading', props: { text: title, level: 1 } },
            { id: `${id}-body`, kind: 'text', props: { text: `${brand} ${title}` } },
          ],
        },
        {
          id: `${id}-contact`,
          purpose: 'contact',
          layout: { kind: 'stack' },
          style: { base: { pad: 'token:space.unit' } },
          nodes: [{ id: `${id}-end`, kind: 'button', props: { label: 'Chat on WhatsApp', href: 'https://wa.me/', variant: 'filled' } }],
        },
      ],
    };
  });

  const allPages = [...doc.pages, ...synthesizedPages];

  // Purge legacy sections (chrome, categories, recommendations, press, etc.)
  const cleanPages: Page[] = allPages.map((page) => {
    const cleanSections = page.sections.flatMap((s) => {
      if (s.purpose === 'chrome' || s.purpose === 'categories' || s.purpose === 'recommendations' || s.purpose === 'press') {
        return [];
      }
      if (s.purpose === 'introduction') {
        return [{ ...s, id: 'hero', purpose: 'hero' }];
      }
      if (s.purpose === 'collection') {
        return [{ ...s, purpose: 'catalog' }];
      }
      if (s.purpose === 'notice') {
        return [{ ...s, purpose: 'announcement' }];
      }
      if (s.purpose === 'promo') {
        return [{ ...s, purpose: 'spotlight' }];
      }
      if (s.purpose === 'action') {
        return [{ ...s, purpose: 'contact' }];
      }
      return [s];
    });

    return { ...page, sections: cleanSections };
  });

  return {
    ...doc,
    blueprint,
    pages: cleanPages,
  };
}

/** Read a stored site record as a current document, auto-healing route gaps. */
export function readDocument(value: unknown): { doc: SiteDocument } {
  if (isV2(value)) return { doc: normalizeDocument(value) };
  throw badRequest('Site definition is invalid.');
}
