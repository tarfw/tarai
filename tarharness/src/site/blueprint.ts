/**
 * Autonomous Site Blueprint: what Jev decides and code enforces.
 *
 * The commerce model set decides which sections a store must have and what the
 * publish gate demands. Jev proposes models, lead and optional sections; code
 * owns the order, the layout rules, the gate and every money question.
 */

export type BusinessKind = 'goods' | 'food' | 'services' | 'wholesale';
export type LeadSection = 'spotlight' | 'catalog' | 'story';
export type SectionKind =
  | 'header' | 'announcement' | 'hero' | 'spotlight' | 'catalog' | 'menu' | 'booking'
  | 'story' | 'trust' | 'faq' | 'policy' | 'location' | 'contact' | 'footer';
export type TypographyToken = 'serif' | 'sans' | 'grotesk';
export type ToneToken = 'canvas' | 'surface' | 'ink';
export type DensityToken = 1 | 2 | 3;
export type CatalogLayout = 'flat' | 'pills' | 'rails';

/** Axis A: when money moves. A store carries a set of these. */
export type CommerceModel = 'products' | 'food' | 'booking' | 'quote' | 'digital' | 'bulk';
export const COMMERCE_MODELS: readonly CommerceModel[] = ['products', 'food', 'booking', 'quote', 'digital', 'bulk'] as const;

/** Jev #1 proposes this; code validates it and owns every rule that reads it. */
export interface ModelProfile {
  models: CommerceModel[];
  industry: string;
  capabilities: { pos: boolean; commerce: boolean; site: boolean; team: boolean };
  confidence: { models: number; industry: number };
  /** True when the model answer is too weak to build on; the merchant is asked instead. */
  ask: boolean;
}

/** Below this, code asks the merchant rather than guessing the commerce model. */
export const MODEL_CONFIDENCE = 0.6;

/** The only order code allows. A lead section moves up inside it, nothing else moves. */
export const SECTION_SEQUENCE: readonly SectionKind[] = [
  'header', 'announcement', 'hero', 'spotlight', 'catalog', 'menu', 'booking',
  'story', 'trust', 'faq', 'policy', 'location', 'contact', 'footer',
] as const;

/** Axis B evidence: sections each model must present, regardless of what is filled yet. */
export const REQUIRED_SECTIONS: Record<CommerceModel, readonly SectionKind[]> = {
  products: ['header', 'hero', 'catalog', 'policy', 'contact', 'footer'],
  food: ['header', 'hero', 'menu', 'location', 'contact', 'footer'],
  booking: ['header', 'hero', 'booking', 'faq', 'contact', 'footer'],
  quote: ['header', 'hero', 'booking', 'faq', 'contact', 'footer'],
  digital: ['header', 'hero', 'catalog', 'policy', 'faq', 'contact', 'footer'],
  bulk: ['header', 'hero', 'catalog', 'faq', 'contact', 'footer'],
};

/** Optional sections a store may add; facts or Jev yes/no decide, the merchant can override. */
export const OPTIONAL_SECTIONS: readonly SectionKind[] = ['announcement', 'spotlight', 'story', 'trust'] as const;

/** The section set a model set implies, in the order code will render it. */
export function sectionsForModels(models: readonly CommerceModel[]): { required: SectionKind[]; optional: SectionKind[] } {
  const wanted = new Set<SectionKind>();
  for (const model of models) for (const kind of REQUIRED_SECTIONS[model]) wanted.add(kind);
  return {
    required: SECTION_SEQUENCE.filter((kind) => wanted.has(kind)),
    optional: [...OPTIONAL_SECTIONS],
  };
}

/** What a model demands before money can move. */
export interface GateNeed {
  model: CommerceModel;
  need: string;
  message: string;
}

export interface GateResult {
  ok: boolean;
  missing: GateNeed[];
}

export interface SectionSummary {
  kind: SectionKind;
  label: string;
  detail: string;
}

/**
 * What the merchant decided, kept apart from what Jev proposed (parai §8, D10).
 * Every field beats the judgment, survives regeneration, and is stored with the
 * blueprint it feeds so the two can never disagree about a revision.
 */
export interface Overrides {
  design?: string;
  recipes?: Partial<Record<SectionKind, string>>;
  settings?: Partial<Record<SectionKind, Record<string, boolean | string>>>;
  /** Slot id to merchant copy. Never handed to the prose model. */
  text?: Record<string, string>;
  hidden?: SectionKind[];
  /** Optional sections the merchant turned on, so a judgment saying no cannot hide them. */
  shown?: SectionKind[];
  order?: SectionKind[];
  /** Overrides the stored document does not show yet; a regeneration clears them. */
  pending?: string[];
}

const isKind = (value: unknown): value is SectionKind => (SECTION_KINDS as readonly string[]).includes(String(value));
const kinds = (value: unknown, max = SECTION_KINDS.length): SectionKind[] => Array.isArray(value)
  ? [...new Set(value.filter(isKind))].slice(0, max)
  : [];

const words = (value: unknown, max = 40): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== 'string' || !entry.trim()) continue;
    out[key.slice(0, 120)] = entry.trim().slice(0, 4000);
    if (Object.keys(out).length >= max) break;
  }
  return out;
};

const switches = (value: unknown, max = 12): Record<string, boolean | string> => {
  const out: Record<string, boolean | string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'boolean') out[key.slice(0, 60)] = entry;
    else if (typeof entry === 'string') out[key.slice(0, 60)] = entry.trim().slice(0, 300);
    if (Object.keys(out).length >= max) break;
  }
  return out;
};

/**
 * Stored and posted overrides both pass through here, so a damaged record or a
 * field nobody declared cannot ride along into a build.
 */
export function normalizeOverrides(value: unknown): Overrides {
  const raw = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  const overrides: Overrides = {};

  const recipes: Partial<Record<SectionKind, string>> = {};
  if (raw.recipes && typeof raw.recipes === 'object') {
    for (const [kind, id] of Object.entries(raw.recipes as Record<string, unknown>)) {
      if (isKind(kind) && typeof id === 'string' && id.trim()) recipes[kind] = id.trim().slice(0, 60);
    }
  }

  const settings: Partial<Record<SectionKind, Record<string, boolean | string>>> = {};
  if (raw.settings && typeof raw.settings === 'object') {
    for (const [kind, value_] of Object.entries(raw.settings as Record<string, unknown>)) {
      if (!isKind(kind)) continue;
      const turned = switches(value_);
      if (Object.keys(turned).length) settings[kind] = turned;
    }
  }

  const text = words(raw.text);
  const hidden = kinds(raw.hidden);
  const shown = kinds(raw.shown).filter((kind) => OPTIONAL_SECTIONS.includes(kind));
  const order = kinds(raw.order);
  const pending = Array.isArray(raw.pending) ? raw.pending.map(String).filter(Boolean).slice(0, 40) : [];

  if (typeof raw.design === 'string' && raw.design.trim()) overrides.design = raw.design.trim().slice(0, 60);
  if (Object.keys(recipes).length) overrides.recipes = recipes;
  if (Object.keys(settings).length) overrides.settings = settings;
  if (Object.keys(text).length) overrides.text = text;
  if (hidden.length) overrides.hidden = hidden;
  if (shown.length) overrides.shown = shown;
  if (order.length) overrides.order = order;
  if (pending.length) overrides.pending = pending;
  return overrides;
}

/** Slot ids the merchant wrote, so the prose pass is never asked about them. */
export function lockedText(overrides?: Overrides): Set<string> {
  return new Set(Object.keys(overrides?.text || {}));
}

/**
 * Optional sections the merchant turned on. A model set still decides whether the
 * section can be built at all, so this can only add what the store already sells.
 */
export function forcedSections(overrides?: Overrides): Set<SectionKind> {
  const hidden = new Set(overrides?.hidden || []);
  return new Set([...(overrides?.shown || []), ...(overrides?.order || [])].filter((kind) => OPTIONAL_SECTIONS.includes(kind) && !hidden.has(kind)));
}

/**
 * The merchant's page shape over the model's. Required sections cannot be turned off,
 * and code keeps the header first and the footer last whatever order was asked for.
 */
export function applySectionOverrides(
  sections: readonly SectionKind[],
  models: readonly CommerceModel[],
  overrides?: Overrides,
): SectionKind[] {
  const required = new Set(sectionsForModels(models).required);
  const hidden = new Set((overrides?.hidden || []).filter((kind) => !required.has(kind)));
  const forced = forcedSections(overrides);

  // Keep the builder's order — it puts the lead section first — and only drop hidden
  // sections or add forced ones the builder left out. An explicit `order` override then
  // pulls the named kinds to the front, in the order the merchant gave.
  const kept = sections.filter((kind) => !hidden.has(kind));
  const wanted = [...kept, ...[...forced].filter((kind) => !kept.includes(kind))];

  const asked = (overrides?.order || []).filter((kind) => wanted.includes(kind));
  const rest = wanted.filter((kind) => !asked.includes(kind));
  const body = [...asked, ...rest].filter((kind) => kind !== 'header' && kind !== 'footer');
  return [
    ...(wanted.includes('header') ? ['header'] as SectionKind[] : []),
    ...body,
    ...(wanted.includes('footer') ? ['footer'] as SectionKind[] : []),
  ];
}

export interface Blueprint {
  kind: BusinessKind;
  profile: ModelProfile;
  style?: string;
  typography: TypographyToken;
  tone: ToneToken;
  density: DensityToken;
  lead: LeadSection;
  sections: SectionKind[];
  catalogLayout: CatalogLayout;
  /** Recipe id per section type: what was chosen for this store. Absent means the default. */
  recipes?: Partial<Record<SectionKind, string>>;
  /** The merchant's own picks. They beat `recipes`, `style` and the judgment. */
  overrides?: Overrides;
  gate: GateResult;
  hash: string;
  revision: number;
}

export interface SiteFacts {
  items?: Array<{
    id: string;
    title: string;
    price?: number;
    currency?: string;
    image?: string;
    category?: string;
    description?: string;
  }>;
  phone?: string;
  name?: string;
  address?: string;
  city?: string;
  email?: string;
  proofs?: string[];
  season?: string;
  notice?: string;
}

/** The gate reads a wider slice than a draft does: services, hours and trade terms. */
export interface GateFacts extends SiteFacts {
  services?: Array<{ id: string; title: string; price?: number }>;
  hours?: string[];
  minimum?: number | string;
}

export const SECTION_KINDS: readonly SectionKind[] = SECTION_SEQUENCE;

export const BUSINESS_KINDS: readonly BusinessKind[] = ['goods', 'food', 'services', 'wholesale'] as const;
export const TYPOGRAPHY_TOKENS: readonly TypographyToken[] = ['serif', 'sans', 'grotesk'] as const;
export const TONE_TOKENS: readonly ToneToken[] = ['canvas', 'surface', 'ink'] as const;
export const DENSITY_TOKENS: readonly DensityToken[] = [1, 2, 3] as const;

/** The model set is never empty: an unknown store sells items directly. */
export function modelsOf(blueprint?: { profile?: ModelProfile } | null): CommerceModel[] {
  const models = blueprint?.profile?.models?.filter((model) => COMMERCE_MODELS.includes(model)) || [];
  return models.length ? models : ['products'];
}

/** Temporary bridge while stored documents and reports still carry a business kind. */
export function kindForModels(models: readonly CommerceModel[]): BusinessKind {
  if (models.includes('food')) return 'food';
  if (models.includes('bulk')) return 'wholesale';
  if (models.includes('booking') || models.includes('quote')) return 'services';
  return 'goods';
}

export function catalogLayoutFor(itemCount: number): CatalogLayout {
  if (itemCount <= 15) return 'flat';
  if (itemCount <= 60) return 'pills';
  return 'rails';
}

const reachable = (facts: GateFacts) => Boolean(facts.phone || facts.email || facts.address);
const enquiryable = (facts: GateFacts) => Boolean(facts.phone || facts.email);
const itemCount = (facts: GateFacts) => facts.items?.length ?? 0;
const priced = (facts: GateFacts) => (facts.items || []).some((item) => typeof item.price === 'number');
const bookable = (facts: GateFacts) => (facts.services || []).some((service) => typeof service.price === 'number');

/** Per-model must-haves. A failing gate keeps the site a draft and says what is missing. */
export function checkModelsGate(models: readonly CommerceModel[], facts: GateFacts): GateResult {
  const missing: GateNeed[] = [];
  const need = (model: CommerceModel, key: string, message: string) => { missing.push({ model, need: key, message }); };
  for (const model of models) {
    if (!reachable(facts)) need(model, 'contact', 'Add a phone number, email or address so customers can reach you.');
    switch (model) {
      case 'products':
        if (!itemCount(facts)) need(model, 'item', 'Add at least 1 item to your catalog.');
        break;
      case 'food':
        if (!itemCount(facts)) need(model, 'menu', 'Add at least 1 menu item.');
        if (!(facts.hours || []).length) need(model, 'hours', 'Add your opening hours.');
        break;
      case 'booking':
        if (!bookable(facts)) need(model, 'service', 'Add 1 bookable service with a price.');
        break;
      case 'quote':
        if (!enquiryable(facts)) need(model, 'enquiry', 'Add a phone number or email so enquiries reach you.');
        break;
      case 'digital':
        if (!priced(facts)) need(model, 'price', 'Add at least 1 priced item.');
        break;
      case 'bulk':
        if (!itemCount(facts)) need(model, 'item', 'Add at least 1 item to your catalog.');
        if (!enquiryable(facts)) need(model, 'enquiry', 'Add a phone number or email so trade buyers reach you.');
        if (facts.minimum === undefined || facts.minimum === '') need(model, 'minimum', 'State the minimum order for trade buyers.');
        break;
    }
  }
  const unique = missing.filter((entry, index) => missing.findIndex((other) => other.need === entry.need && other.message === entry.message) === index);
  return { ok: !unique.length, missing: unique };
}

/** Required sections for a model set, plus the optional sections the facts support. */
export function compileSectionOrder(
  models: readonly CommerceModel[],
  lead: LeadSection,
  included: {
    announcement?: boolean;
    spotlight?: boolean;
    catalog?: boolean;
    story?: boolean;
    trust?: boolean;
  },
): SectionKind[] {
  const wanted = new Set<SectionKind>(sectionsForModels(models).required);
  if (included.announcement) wanted.add('announcement');
  if (included.spotlight) wanted.add('spotlight');
  if (included.story) wanted.add('story');
  if (included.trust) wanted.add('trust');
  if (!(included.catalog ?? true)) {
    wanted.delete('catalog');
    wanted.delete('menu');
  }

  const order = SECTION_SEQUENCE.filter((kind) => wanted.has(kind));

  // The lead lifts above the hero; the rest of the sequence keeps its place.
  const leadKind: SectionKind = lead === 'catalog'
    ? (wanted.has('menu') ? 'menu' : wanted.has('booking') ? 'booking' : 'catalog')
    : lead;
  const at = order.indexOf(leadKind);
  const hero = order.indexOf('hero');
  if (at > hero && hero >= 0) {
    order.splice(at, 1);
    order.splice(hero, 0, leadKind);
  }
  return order;
}

export function defaultBlueprint(models: readonly CommerceModel[] = ['products'], itemCount = 0, gate: GateResult = { ok: true, missing: [] }): Blueprint {
  const settled = [...new Set(models)];
  return {
    kind: kindForModels(settled),
    profile: {
      models: settled.length ? settled : ['products'],
      industry: 'general',
      capabilities: { pos: false, commerce: true, site: true, team: false },
      confidence: { models: 1, industry: 0 },
      ask: false,
    },
    style: 'luxury',
    typography: 'sans',
    tone: 'canvas',
    density: 2,
    lead: 'catalog',
    sections: compileSectionOrder(settled, 'catalog', { catalog: itemCount > 0 }),
    catalogLayout: catalogLayoutFor(itemCount),
    gate,
    hash: '',
    revision: 1,
  };
}

const SUMMARIES: Record<SectionKind, { label: string; detail: (facts: GateFacts) => string }> = {
  header: { label: 'Header Navigation', detail: () => 'Brand, menu and one primary action' },
  announcement: { label: 'Announcement', detail: (facts) => facts.notice || 'Shop announcement' },
  hero: { label: 'Hero Section', detail: () => 'First impression and the main route in' },
  spotlight: { label: 'Spotlight', detail: (facts) => facts.season ? `${facts.season} offer` : 'Featured offer' },
  catalog: { label: 'Catalog', detail: (facts) => `${facts.items?.length ?? 0} items` },
  menu: { label: 'Menu', detail: (facts) => `${facts.items?.length ?? 0} items` },
  booking: { label: 'Bookable services', detail: (facts) => `${facts.services?.length ?? 0} services` },
  story: { label: 'Story', detail: () => 'Craft and owner heritage' },
  trust: { label: 'Trust', detail: (facts) => (facts.proofs?.length ? facts.proofs.join(' & ') : 'Proof points') },
  faq: { label: 'Questions', detail: () => 'Answers to what customers ask first' },
  policy: { label: 'Policy', detail: () => 'Shipping, returns and payment terms' },
  location: { label: 'Location', detail: (facts) => facts.address || 'Where and when to find you' },
  contact: { label: 'Contact', detail: () => 'Phone, message and directions' },
  footer: { label: 'Footer', detail: () => 'Contact card and closing links' },
};

export function summarizeSections(blueprint: Blueprint, facts: GateFacts): SectionSummary[] {
  return blueprint.sections.map((kind) => ({
    kind,
    label: SUMMARIES[kind]?.label || kind,
    detail: SUMMARIES[kind]?.detail(facts) || '',
  }));
}
