/**
 * Scoped site editing: one router, three lanes.
 *
 * `site.ask` turns an instruction into a small, reviewable patch. Exact values
 * the owner typed resolve in code with zero model calls; only ambiguity goes to
 * Jev, in one batched call; new prose goes to the language model. Nothing is
 * applied until `site.edit` commits the reviewed operations, and undo writes a
 * new revision instead of rewriting history.
 */

import type { Client } from '@libsql/client/web';
import { badRequest, conflict, notFound, unavailable } from '../errors.ts';
import type { AccessContext } from '../types.ts';
import { ALIGN_VALUES, PAD_VALUES, SIZE_VALUES, WIDTH_VALUES, pruneLayout, type Node, type Persona, type Section, type SectionLayoutSpec, type SiteDocument, type Style } from './document.ts';
import { COLOR_KEYS, TONE_STYLE, exportDesign, parseDesign, TONE_COLORS } from './design.ts';
import { SECTION_KINDS, sectionsForModels, type SectionKind } from './blueprint.ts';
import { designOptions } from './designs/library.ts';
import { recipesFor, sectionType } from './recipes/library.ts';
import { applyPatch, diffSummary, type DiffEntry, type PatchOperation } from './patch.ts';
import { interpret, type EditQuestion, type JudgmentCache } from './judgment.ts';
import { DEFAULT_BUDGET, GROQ_DEFAULT_MODEL, ModelRunner, SITE_MODEL_FALLBACKS, draftCopy } from './model.ts';
import { readDocument } from './adapt.ts';
import { validateDocument } from './validate.ts';
import { getSiteRecord } from './store.ts';
import { compileDocument } from './compile.ts';

const now = () => Date.now();
const text = (value: unknown, max = 400): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Values offered for one style property; anything outside this list is rejected. */
export const PROPERTY_OPTIONS: Record<string, readonly string[]> = {
  background: [...COLOR_KEYS.map((key) => `token:color.${key}`), 'transparent'],
  color: COLOR_KEYS.map((key) => `token:color.${key}`),
  pad: PAD_VALUES,
  gap: PAD_VALUES,
  radius: ['token:shape.sm', 'token:shape.md', 'token:shape.lg', 'token:shape.pill'],
  border: ['none', 'hairline'],
  shadow: ['none', 'low', 'high'],
  align: ALIGN_VALUES,
  width: WIDTH_VALUES,
  size: SIZE_VALUES,
};

/** Words that map directly to an allowed value, so no judgment call is needed. */
export const SYNONYMS: Record<string, string> = {
  black: 'token:color.ink', dark: 'token:color.ink', ink: 'token:color.ink', charcoal: 'token:color.ink',
  white: 'token:color.canvas', light: 'token:color.canvas', plain: 'token:color.canvas',
  accent: 'token:color.accent', brand: 'token:color.accent',
  surface: 'token:color.surface', raised: 'token:color.surface', panel: 'token:color.surface',
  mist: 'token:color.surface', banding: 'token:color.surface',
  muted: 'token:color.muted', subtle: 'token:color.muted',
  hairline: 'hairline', none: 'none',
  pill: 'token:shape.pill', rounded: 'token:shape.lg', sharp: 'token:shape.sm', square: 'token:shape.sm',
  spacious: 'token:space.section', tight: 'token:space.unit',
  soft: 'low', flat: 'none',
  centered: 'center', centre: 'center', left: 'start', right: 'end', between: 'between',
  full: 'full', wide: 'wide', content: 'content',
  large: 'lg', small: 'sm', medium: 'md',
  display: 'display', heading: 'heading', body: 'body', label: 'label',
};

const PROPERTY_WORDS: Record<string, string[]> = {
  background: ['background', 'bg', 'backdrop'],
  color: ['colour', 'color', 'text colour'],
  pad: ['padding', 'pad', 'spacing'],
  gap: ['gap'],
  radius: ['radius', 'corner', 'corners'],
  border: ['border', 'outline'],
  shadow: ['shadow', 'elevation', 'depth'],
  align: ['align', 'alignment', 'centre', 'center'],
  width: ['width', 'full width'],
  size: ['type size', 'text size', 'font size'],
};

const DENSITY_PAD: Record<string, string> = { airy: 'token:space.section', balanced: 'lg', compact: 'token:space.unit' };

/** Merchant words for a section kind, so "turn the products into rails" names `catalog`. */
const KIND_WORDS: Record<SectionKind, string[]> = {
  header: ['header', 'nav', 'navigation', 'top bar', 'menu bar'],
  announcement: ['announcement', 'notice', 'ticker'],
  hero: ['hero', 'intro', 'introduction', 'above the fold'],
  spotlight: ['spotlight', 'promo', 'promotion', 'offer', 'sale'],
  catalog: ['catalog', 'catalogue', 'product', 'products', 'collection', 'shop', 'items'],
  menu: ['menu', 'dishes', 'dish list'],
  booking: ['booking', 'bookings', 'appointment', 'appointments', 'reserve', 'service', 'services'],
  story: ['story', 'about', 'about us'],
  trust: ['trust', 'review', 'reviews', 'testimonial', 'testimonials', 'proof', 'proofs'],
  faq: ['faq', 'faqs', 'question', 'questions'],
  policy: ['policy', 'policies', 'terms', 'shipping', 'returns', 'refund'],
  location: ['location', 'address', 'map', 'directions'],
  contact: ['contact', 'whatsapp', 'enquiry', 'enquire', 'get in touch'],
  footer: ['footer', 'foot', 'bottom bar'],
};

/** Merchant words for a recipe id. The id itself always counts; these are the nicknames. */
const LAYOUT_WORDS: Record<string, string[]> = {
  rail: ['rail', 'rails', 'carousel', 'slider', 'swipe'],
  grid: ['grid', 'tiles', 'tile'],
  list: ['list', 'rows', 'stacked'],
  split: ['split', 'side by side'],
  fullscreen: ['fullscreen', 'full screen', 'full bleed', 'edge to edge'],
  typography: ['typography', 'type led', 'big type'],
  commerce: ['commerce', 'shop first', 'buy first'],
  pill: ['pill', 'floating', 'rounded bar'],
  minimal: ['minimal', 'simple', 'plain'],
  brand: ['brand', 'logo led', 'logo first'],
  bar: ['bar', 'strip', 'marquee'],
  banner: ['banner', 'band'],
  editorial: ['editorial', 'magazine'],
  proofs: ['testimonials', 'reviews', 'proofs'],
  disclosure: ['disclosure', 'accordion', 'collapsible'],
  card: ['card', 'cards'],
  whatsapp: ['whatsapp'],
  form: ['form'],
  tiers: ['tiers', 'packages', 'pricing'],
};

const DESIGN_WORDS = ['design', 'theme', 'look', 'style', 'palette', 'library'];
const HIDE_WORDS = ['hide', 'remove', 'delete', 'drop', 'take away', 'turn off', 'switch off', 'get rid of'];
const SHOW_WORDS = ['show', 'reveal', 'bring back', 'add back', 'put back', 'turn on', 'switch on', 'restore'];

/** Whole-word match against a normalized command, so "bold" never fires on "bolder". */
const has = (words: string, term: string): boolean => ` ${words} `.includes(` ${term} `);

/**
 * The design a merchant named, if they named one. A bare colour or type adjective is not a
 * design choice — it takes "design"/"theme"/"look" nearby, or the exact label — because the
 * same words turn up in value commands like "bold title" that belong to the node lanes.
 */
function designNamed(words: string): string | null {
  const intent = DESIGN_WORDS.some((entry) => has(words, entry));
  for (const option of designOptions()) {
    const label = option.name.toLowerCase();
    if (words === option.id || (label && words === label)) return option.id;
    if (intent && (has(words, option.id) || (label && words.includes(label)))) return option.id;
  }
  return null;
}

function namedKind(words: string): SectionKind | null {
  let best: SectionKind | null = null;
  let length = 0;
  for (const kind of SECTION_KINDS) {
    for (const term of KIND_WORDS[kind]) {
      if (has(words, term) && term.length > length) { best = kind; length = term.length; }
    }
  }
  return best;
}

interface OverrideAsk {
  operations: PatchOperation[];
  choices: Record<string, string>;
  questions: string[];
  target: string | null;
  summary: string;
}

/**
 * A merchant naming a design, a section layout, or a section they want on or off is making a
 * choice the system must keep: it becomes an override, so the next regeneration honours it
 * instead of choosing again (parai §8, D10). Only unambiguous words land here; anything else
 * falls through to the value lanes, which edit the document in front of the merchant.
 */
function overrideLane(doc: SiteDocument, words: string): OverrideAsk | null {
  const empty = { operations: [], choices: {}, questions: [], target: null, summary: '' };

  const design = designNamed(words);
  if (design) {
    const label = designOptions().find((option) => option.id === design)?.name || design;
    return { ...empty, operations: [{ op: 'set_override', kind: 'design', value: design }], choices: { design }, target: null, summary: `Remembered the ${label} design` };
  }

  const kind = namedKind(words);
  if (!kind) return null;
  const off = HIDE_WORDS.some((entry) => has(words, entry));
  const on = SHOW_WORDS.some((entry) => has(words, entry));

  if (off || on) {
    const required = sectionsForModels(doc.blueprint.profile?.models || []).required;
    if (off && required.includes(kind)) {
      return { ...empty, questions: [`The ${kind} section is needed for the way you sell, so it stays. What would you like to change in it?`] };
    }
    return {
      ...empty,
      operations: [{ op: 'set_override', kind: off ? 'hide' : 'show', target: kind }],
      choices: { section: kind, ...(off ? { hidden: kind } : { shown: kind }) },
      target: kind,
      summary: off ? `Remembered to leave out ${kind}` : `Remembered to show ${kind}`,
    };
  }

  const recipe = recipesFor(sectionType(kind)).find((entry) => LAYOUT_WORDS[entry.id]?.some((term) => has(words, term)) || has(words, entry.id));
  if (!recipe) return null;
  return {
    ...empty,
    operations: [{ op: 'set_override', kind: 'recipe', target: kind, value: recipe.id }],
    choices: { section: kind, recipe: recipe.id },
    target: kind,
    summary: `Remembered the ${recipe.id} layout for ${kind}`,
  };
}

export interface AskResult {
  siteId: string;
  base: number;
  target: string | null;
  targetKind: 'section' | 'node' | null;
  operations: PatchOperation[];
  summary: string;
  questions: string[];
  /** Values resolved without a model, so brief memory can credit the owner. */
  choices: Record<string, string>;
}

function findNode(doc: SiteDocument, id: string): Node | null {
  const walk = (nodes: Node[]): Node | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const nested = node.children ? walk(node.children) : null;
      if (nested) return nested;
    }
    return null;
  };
  for (const page of doc.pages) for (const section of page.sections) {
    const found = walk(section.nodes);
    if (found) return found;
  }
  return null;
}

function sectionOf(doc: SiteDocument, id: string): Section | null {
  return doc.pages.flatMap((page) => page.sections).find((section) => section.id === id) || null;
}

function targetKindOf(doc: SiteDocument, target: string): 'section' | 'node' | null {
  if (sectionOf(doc, target)) return 'section';
  if (findNode(doc, target)) return 'node';
  return null;
}

function candidates(doc: SiteDocument): { id: string; label: string; purpose?: string }[] {
  return doc.pages.flatMap((page) => page.sections.map((section) => ({
    id: section.id,
    label: `${page.title}: ${String(section.nodes.find((node) => node.kind === 'heading')?.props.text || section.purpose)}`,
    purpose: section.purpose,
  })));
}

/** Lane 1: exact values the owner typed. Returns the ops and the properties still open. */
function exact(doc: SiteDocument, command: string, target: string): { ops: PatchOperation[]; open: EditQuestion[]; choices: Record<string, string> } {
  const lower = command.toLowerCase();
  const ops: PatchOperation[] = [];
  const choices: Record<string, string> = {};
  const open: EditQuestion[] = [];
  const section = sectionOf(doc, target);
  const node = section ? null : findNode(doc, target);
  const existing = section?.style || node?.style || {};
  const base: Record<string, unknown> = { ...(existing.base || {}) };
  let changedStyle = false;
  const spoken: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6' };
  const digits = /(?:^|\s)([1-6])\s*(?:col|column)/.exec(lower)?.[1];
  const word = /(?:^|\s)(one|two|three|four|five|six)\s*(?:col|column)/.exec(lower)?.[1];
  const isVertical = /(?:vertical|vertically|single\s*column|one\s*column|stacked|stack|as\s*a\s*list|list\s*view|column\s*view)/.test(lower);
  const isHorizontal = /(?:horizontal|horizontally|grid|as\s*a\s*grid|side\s*by\s*side|across|row|rows|multi\s*column)/.test(lower);
  const value = digits
    || (word ? spoken[word] : undefined)
    || (isVertical ? '1' : undefined)
    || (isHorizontal ? (lower.includes('2') || lower.includes('two') ? '2' : lower.includes('3') || lower.includes('three') ? '3' : '4') : undefined);
  let layout: Record<string, unknown> | null = section ? { ...section.layout } : null;
  let changedLayout = false;
  if (section) {
    if (value) {
      const columns = Math.min(6, Math.max(1, Number(value)));
      layout = { ...layout, kind: columns > 1 ? 'grid' : 'stack', columns };
      changedLayout = true;
      choices.columns = String(columns);
    } else if (/(?:photo\s*bigger|bigger\s*photo|larger\s*photo|photo\s*large|bigger\s*image|larger\s*image|big\s*photo)/.test(lower)) {
      const curCols = Number(section.layout.columns) || 3;
      const nextCols = curCols > 2 ? 2 : (curCols === 2 ? 1 : 2);
      layout = { ...layout, kind: nextCols > 1 ? 'grid' : 'stack', columns: nextCols };
      changedLayout = true;
      choices.columns = String(nextCols);
    } else if (/(?:split\s*layout|split\s*hero|split)/.test(lower)) {
      layout = { ...layout, kind: 'flex', columns: 2 };
      changedLayout = true;
      choices.columns = '2';
      choices.layout = 'flex';
    } else if (/(?:full\s*bleed|fullbleed|hero\s*banner|full\s*width)/.test(lower)) {
      layout = { ...layout, kind: 'stack', width: 'full' };
      changedLayout = true;
      choices.layout = 'stack';
    } else if (/(?:col|column|grid|layout)/.test(lower)) {
      open.push({ key: 'columns', label: 'Columns', values: ['2', '3', '4'] });
    }
  }

  const align = lower.includes('centre') || lower.includes('center') ? 'center'
    : lower.includes('align left') || lower.includes('left align') ? 'start'
      : lower.includes('align right') || lower.includes('right align') ? 'end'
        : lower.includes('justify') || lower.includes('between') ? 'between' : undefined;
  if (align && ALIGN_VALUES.includes(align)) {
    if (section) { layout = { ...layout, align }; changedLayout = true; }
    else { base.align = align; changedStyle = true; }
    choices.align = align;
  }

  const density = lower.includes('airy') || lower.includes('spacious') || lower.includes('breathing room') ? 'airy'
    : lower.includes('compact') || lower.includes('tight') || lower.includes('dense') ? 'compact' : undefined;
  if (density) {
    base.pad = DENSITY_PAD[density];
    changedStyle = true;
    choices.density = density;
  } else if (lower.includes('spacing') || lower.includes('padding')) {
    open.push({ key: 'density', label: 'Spacing density', values: ['airy', 'balanced', 'compact'] });
  }

  const tone = lower.includes('accent') ? 'accent'
    : lower.includes('surface') || lower.includes('panel') || lower.includes('dark card') || lower.includes('card') ? 'surface'
    : lower.includes('dark') || lower.includes('black') || lower.includes('night') || lower.includes('ink') ? 'ink'
    : lower.includes('light') || lower.includes('white') || lower.includes('canvas') ? 'canvas'
    : Object.keys(TONE_STYLE).find((entry) => lower.includes(entry));

  if (tone && TONE_STYLE[tone]) {
    Object.assign(base, TONE_STYLE[tone]);
    changedStyle = true;
    choices.tone = tone;
  } else if (/(?:festive\s*sale|run\s*festive\s*sale|festive|special\s*sale)/.test(lower)) {
    Object.assign(base, TONE_STYLE.accent);
    changedStyle = true;
    choices.tone = 'accent';
    const copy = (section?.nodes || [node].filter(Boolean) as Node[]).find((entry) => ['heading', 'text', 'button'].includes(entry.kind));
    if (copy && copy.kind === 'heading') {
      ops.push({ op: 'set_text', target: copy.id, value: 'Festive Sale · Special Offers Live Now' });
      choices.text = 'exact';
    } else if (copy && copy.kind === 'button') {
      ops.push({ op: 'set_props', target: copy.id, value: { label: 'Shop Festive Sale' } });
      choices.text = 'exact';
    }
  } else if (/(?:add\s*location|location|address)/.test(lower)) {
    Object.assign(base, TONE_STYLE.surface);
    changedStyle = true;
    choices.tone = 'surface';
  } else if (/(?:tone|look|feel)/.test(lower)) {
    open.push({ key: 'tone', label: 'Section tone', values: Object.keys(TONE_STYLE) });
  }

  if (/(?:bold\s*title|large\s*title|large\s*heading|big\s*title|bigger\s*title|display\s*title)/.test(lower)) {
    const copy = (section?.nodes || [node].filter(Boolean) as Node[]).find((entry) => entry.kind === 'heading');
    if (copy) {
      ops.push({ op: 'set_props', target: copy.id, value: { level: 1 } });
      choices.heading = 'display';
    }
  }

  if (/(?:pill\s*tabs|pill|rounded\s*tabs)/.test(lower)) {
    base.radius = 'token:shape.pill';
    changedStyle = true;
    choices.radius = 'token:shape.pill';
  } else if (/(?:underline\s*style|underline)/.test(lower)) {
    base.border = 'hairline';
    changedStyle = true;
    choices.border = 'hairline';
  }

  for (const [property, words] of Object.entries(PROPERTY_WORDS)) {
    if (!words.some((entry) => lower.includes(entry))) continue;
    const allowed = PROPERTY_OPTIONS[property];
    const chosen = allowed.find((entry) => lower.includes(entry.replace('token:', '').split('.').pop() || entry))
      ?? Object.entries(SYNONYMS).find(([entry]) => lower.includes(entry) && allowed.includes(SYNONYMS[entry]))?.[1];
    if (chosen && allowed.includes(chosen)) {
      (base as Record<string, unknown>)[property] = chosen;
      changedStyle = true;
      choices[property] = chosen;
    } else {
      open.push({ key: property, label: property, values: allowed });
    }
  }
  if (layout && changedLayout && layout.kind) ops.push({ op: 'set_layout', target, value: pruneLayout(layout as unknown as SectionLayoutSpec) });
  if (changedStyle) ops.push({ op: 'set_style', target, value: { ...existing, base: base as unknown as Style } });

  const quote = /["“']([^"”']+)["”']/.exec(command);
  if (quote) {
    const copy = (section?.nodes || [node].filter(Boolean) as Node[]).find((entry) => ['heading', 'text', 'button'].includes(entry.kind));
    if (copy) {
      ops.push(copy.kind === 'button'
        ? { op: 'set_props', target: copy.id, value: { label: quote[1].slice(0, 120) } }
        : { op: 'set_text', target: copy.id, value: quote[1].slice(0, 4000) });
      choices.text = 'exact';
    }
  }
  return { ops, open, choices };
}

const AUDIENCE: Record<string, Persona['when']> = {
  mobile: { device: 'mobile' }, phone: { device: 'mobile' }, tablet: { device: 'tablet' }, desktop: { device: 'desktop' },
  returning: { returning: true }, repeat: { returning: true }, regular: { returning: true },
  new: { returning: false }, first: { returning: false }, fresh: { returning: false },
};

/**
 * "Hide this for first-time visitors" is a variant, not an edit: the base page
 * keeps every fact and the compiled branch carries the difference. Resolved at
 * the edge from the request alone.
 */
function variant(doc: SiteDocument, command: string, target: string): PatchOperation | null {
  const spoken = /(?:for|to)\s+(?:only\s+)?(mobile|phone|tablet|desktop|returning|repeat|regular|new|first|fresh)(?:\s+(?:visitors|users|customers|buyers|traffic|ones|readers))?/.exec(command.toLowerCase());
  const when = spoken ? AUDIENCE[spoken[1]] : undefined;
  if (!when) return null;
  const value = Object.values(when)[0];
  const id = typeof value === 'string' ? value : value ? 'returning' : 'new';
  const existing = (doc.personas || []).find((entry) => entry.id === id);
  const priority = existing?.priority || 10;
  if (/(hide|remove|drop|skip|cut|without)/.test(command.toLowerCase())) {
    return { op: 'set_persona', persona: { id, when, priority, hide: [...new Set([...(existing?.hide || []), target])] } };
  }
  if (/(show|lead|front|first|promote|highlight|put)/.test(command.toLowerCase())) {
    return { op: 'set_persona', persona: { id, when, priority, order: [target, ...(existing?.order || []).filter((entry) => entry !== target)] } };
  }
  return null;
}

/** Lane 3: new prose. One bounded call for one element. */
async function prose(runner: ModelRunner | null, doc: SiteDocument, command: string, target: string): Promise<PatchOperation[]> {
  if (!runner) return [];
  const section = sectionOf(doc, target);
  const node = (section?.nodes || [findNode(doc, target)].filter(Boolean) as Node[]).find((entry) => entry.kind === 'text' || entry.kind === 'heading');
  if (!node) return [];
  const limit = node.kind === 'heading' ? 120 : 600;
  try {
    const copy = await draftCopy(runner, { instruction: command, current: text(node.props.text, limit), facts: { brief: doc.brief, voice: doc.design.direction.voice }, locale: doc.locale, limit });
    return [{ op: 'set_text', target: node.id, value: copy }];
  } catch {
    return [];
  }
}

export async function executeSiteAsk(
  client: Client,
  context: AccessContext,
  input: Record<string, unknown>,
  typesafe?: string,
  control?: D1Database,
  ai?: Ai,
  model?: string,
  groqApiKey?: string,
): Promise<Record<string, unknown>> {
  const siteId = text(input.siteId, 160);
  const current = await getSiteRecord(client, siteId);
  if (!current) throw notFound('Site was not found.');
  const { doc } = readDocument(current.data);
  const command = text(input.command, 600);
  if (!command) throw badRequest('Describe the change you want.');
  const lower = command.toLowerCase();
  const cache: JudgmentCache = { control, workspace: context.workspace.id, version: 'ask-2' };

  const normalize = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const normalizedCommand = normalize(command);

  // Global tone handling
  const isPureTheme = !/(?:column|grid|image|text|font|header|hero|section|breathing|align|padding|margin|pad|spacing)/i.test(lower);
  const isDarkTone = isPureTheme && /(?:darker|dark|night|black|ink|streetwear)\s*(?:theme|mode|look|canvas|palette|tone)|(?:theme|mode|look|canvas|palette|tone)\s*(?:darker|dark|night|black|ink|streetwear)|^(?:darker|dark|night|black|ink|streetwear)(?:\s*theme|\s*mode|\s*tone)?$/i.test(command.trim());
  const isSurfaceTone = isPureTheme && /(?:surface|muted|mist|soft|subtle|chalk)\s*(?:theme|mode|look|canvas|palette|tone)|(?:theme|mode|look|canvas|palette|tone)\s*(?:surface|muted|mist|soft|subtle|chalk)|^(?:surface|muted|mist|soft|subtle|chalk)(?:\s*theme|\s*mode|\s*tone)?$/i.test(command.trim());
  const isCanvasTone = isPureTheme && /(?:light(?:er)?|clean|minimal|white|canvas|editorial|lookbook)\s*(?:theme|mode|look|canvas|palette|tone)|(?:theme|mode|look|canvas|palette|tone)\s*(?:light(?:er)?|clean|minimal|white|canvas|editorial|lookbook)|^(?:light(?:er)?|clean|minimal|white|canvas|editorial|lookbook)(?:\s*theme|\s*mode|\s*tone)?$/i.test(command.trim());

  const requested = text(input.target, 120);
  let target: string | null = null;
  if (requested && requested !== 'all') {
    if (targetKindOf(doc, requested)) target = requested;
  }

  // Naming a design, a layout or a section to switch off is a choice to remember, so it is
  // answered as an override before any tone or value lane reads the same words. An explicit
  // target means the merchant is pointing at the document in front of them instead.
  if (!requested || requested === 'all') {
    const remembered = overrideLane(doc, normalizedCommand);
    if (remembered && (remembered.operations.length || remembered.questions.length)) {
      const asked: AskResult = {
        siteId: current.id,
        base: doc.revision,
        target: remembered.target,
        targetKind: remembered.target ? targetKindOf(doc, remembered.target) : null,
        operations: remembered.operations,
        summary: remembered.summary,
        questions: remembered.questions,
        choices: remembered.choices,
      };
      return { ...asked };
    }
  }

  if ((!target || requested === 'all') && (isDarkTone || isSurfaceTone || isCanvasTone)) {
    const tone: 'canvas' | 'surface' | 'ink' = isDarkTone ? 'ink' : isSurfaceTone ? 'surface' : 'canvas';
    const themeColor = TONE_COLORS[tone];
    const operations: PatchOperation[] = [
      { op: 'set_token', token: 'token:color.canvas', value: themeColor.canvas },
      { op: 'set_token', token: 'token:color.surface', value: themeColor.surface },
      { op: 'set_token', token: 'token:color.ink', value: themeColor.ink },
      { op: 'set_token', token: 'token:color.border', value: themeColor.border },
      { op: 'set_token', token: 'token:color.accent', value: lower.includes('editorial') ? '#4d49fc' : themeColor.accent },
      { op: 'set_token', token: 'token:color.accentink', value: themeColor.accentink },
      { op: 'set_token', token: 'token:color.muted', value: themeColor.muted },
      { op: 'set_token', token: 'token:color.success', value: themeColor.success },
      { op: 'set_token', token: 'token:color.danger', value: themeColor.danger },
    ];
    const summary = `Applied ${tone} tone`;
    const result: AskResult = {
      siteId: current.id,
      base: doc.revision,
      target: null,
      targetKind: null,
      operations,
      summary,
      questions: [],
      choices: { tone },
    };
    return { ...result };
  }

  const PURPOSE_SYNONYMS: Record<string, string[]> = {
    collection: ['collection', 'product', 'products', 'grid', 'product grid', 'catalog', 'items', 'offer', 'shop', 'trending', 'new and trending', 'new & trending', 'what we offer', 'photo bigger', 'bigger photo', 'larger photo', 'photo size', 'image size', 'bigger image', 'larger image'],
    recommendations: ['recommendations', 'recommended', 'you will love', "you'll love", 'suggested', 'more pieces'],
    introduction: ['hero', 'banner', 'intro', 'introduction', 'top'],
    hero: ['hero', 'banner', 'intro', 'introduction', 'above the fold'],
    header: ['navigation', 'nav bar', 'menu bar', 'top bar', 'brand bar'],
    split: ['split', 'editorial', 'two images', 'media break', 'two-up'],
    categories: ['categories', 'category', 'tabs', 'filter', 'shop by category'],
    promo: ['promo', 'promotion', 'cta band', 'call to action', 'strip', 'run festive sale', 'festive sale', 'sale', 'festive'],
    story: ['story', 'about', 'about us'],
    chrome: ['navigation', 'header', 'nav', 'menu', 'bar', 'footer', 'foot', 'bottom', 'end'],
    contact: ['contact', 'enquire', 'enquiry', 'form', 'get in touch', 'add location', 'location', 'address', 'hours', 'opening hours'],
    hours: ['hours', 'opening hours', 'schedule', 'timing', 'timings'],
  };

  if (!target) {
    outer: for (const page of doc.pages) {
      for (const section of page.sections) {
        const secId = section.id.toLowerCase();
        const secPurpose = section.purpose.toLowerCase();
        const synonyms = PURPOSE_SYNONYMS[secPurpose] || [secPurpose];
        if (synonyms.some((syn) => normalizedCommand.includes(syn) || lower.includes(syn))) { target = section.id; break outer; }
        if (normalizedCommand.includes(secId) || lower.includes(secId)) { target = section.id; break outer; }
        const heading = section.nodes.find((node) => node.kind === 'heading' && typeof node.props.text === 'string');
        if (heading && typeof heading.props.text === 'string') {
          const normHeading = normalize(heading.props.text);
          if (normHeading && (normalizedCommand.includes(normHeading) || normHeading.includes(normalizedCommand))) {
            target = section.id;
            break outer;
          }
        }
      }
    }
  }

  if (!target && typesafe) {
    const judged = await interpret(typesafe, cache, { command, targets: candidates(doc), questions: [] });
    if (judged.target) { target = judged.target; }
  }

  // Deterministic purpose fallbacks when target is not directly mentioned
  if (!target) {
    if (/(?:photo|image|picture|col|column|grid|list\s*view)/.test(lower)) {
      target = doc.pages[0]?.sections.find((s) => s.purpose === 'collection' || s.purpose === 'catalog' || s.purpose === 'split' || s.purpose === 'hero')?.id || doc.pages[0]?.sections[0]?.id || null;
    } else if (/(?:festive|sale|discount|promo|special\s*offer)/.test(lower)) {
      target = doc.pages[0]?.sections.find((s) => s.purpose === 'promo' || s.purpose === 'spotlight' || s.purpose === 'hero')?.id || doc.pages[0]?.sections[0]?.id || null;
    } else if (/(?:location|address|hours|opening\s*hours|contact)/.test(lower)) {
      target = doc.pages[0]?.sections.find((s) => s.purpose === 'contact' || s.purpose === 'hours')?.id || doc.pages[0]?.sections[0]?.id || null;
    }
  }

  const questions: string[] = [];
  const operations: PatchOperation[] = [];
  const choices: Record<string, string> = {};
  let targetKind: 'section' | 'node' | null = target ? targetKindOf(doc, target) : null;

  if (target && targetKind) {
    const lane = exact(doc, command, target);
    operations.push(...lane.ops);
    Object.assign(choices, lane.choices);
    if (lane.open.length && typesafe) {
      // Lane 2: everything still ambiguous, in one batched call.
      const judged = await interpret(typesafe, cache, { command, targets: [], questions: lane.open });
      const section = sectionOf(doc, target);
      const node = section ? null : findNode(doc, target);
      const existing = section?.style || node?.style || {};
      const styled = operations.find((op) => op.op === 'set_style') as Extract<PatchOperation, { op: 'set_style' }> | undefined;
      const laid = operations.find((op) => op.op === 'set_layout') as Extract<PatchOperation, { op: 'set_layout' }> | undefined;
      const base = { ...(styled?.value?.base || existing.base || {}) } as Record<string, unknown>;
      let nextLayout = { ...(laid?.value || section?.layout || { kind: 'stack' as const }) } as Record<string, unknown>;
      let styleChanged = false;
      let layoutChanged = false;
      for (const [key, value] of Object.entries(judged.values)) {
        if (key === 'columns' && section) {
          const columns = Math.min(6, Math.max(1, Number(value) || 2));
          nextLayout = { ...nextLayout, kind: columns > 1 ? 'grid' : 'stack', columns };
          layoutChanged = true;
        } else if (key === 'align' && section) {
          nextLayout = { ...nextLayout, align: value };
          layoutChanged = true;
        } else if (key === 'density') {
          base.pad = DENSITY_PAD[value] || 'lg';
          styleChanged = true;
        } else if (key === 'tone') {
          Object.assign(base, TONE_STYLE[value] || TONE_STYLE.canvas);
          styleChanged = true;
        } else if (PROPERTY_OPTIONS[key]?.includes(value)) {
          base[key] = value;
          styleChanged = true;
        } else if (key === 'align') {
          base.align = value;
          styleChanged = true;
        }
        choices[key] = value;
      }
      const settled = pruneLayout(nextLayout as unknown as SectionLayoutSpec);
      if (layoutChanged && laid) laid.value = settled;
      else if (layoutChanged) operations.push({ op: 'set_layout', target, value: settled });
      if (styleChanged && styled) styled.value = { ...existing, base: base as unknown as Style };
      else if (styleChanged) operations.push({ op: 'set_style', target, value: { ...existing, base: base as unknown as Style } });
      for (const key of judged.open) if (!questions.some((entry) => entry.startsWith(`Which ${key}`))) questions.push(`Which ${key} should it use?`);
    } else {
      for (const question of lane.open) questions.push(`Which ${question.label} should it use?`);
    }

    // A named audience compiles a variant instead of changing the base page.
    const branch = variant(doc, command, target);
    if (branch) operations.push(branch);

    // Lane 3 only when nothing concrete was named and the owner asked for wording.
    if (!operations.length && !lane.open.length && /(rewrite|wording|copy|say|headl|caption|tone of voice)/.test(lower)) {
      const runner = (ai || groqApiKey) ? new ModelRunner(ai, model || (groqApiKey ? GROQ_DEFAULT_MODEL : SITE_MODEL_FALLBACKS[0]), DEFAULT_BUDGET, groqApiKey) : null;
      operations.push(...await prose(runner, doc, command, target));
    }
  }

  const summary = operations.length
    ? `${operations.map((op) => op.op).filter((op, index, all) => all.indexOf(op) === index).join(', ')} in ${target}`
    : '';
  if (!operations.length && !questions.length) {
    if (target) {
      const sec = sectionOf(doc, target);
      const title = sec?.nodes.find((n) => n.kind === 'heading')?.props.text || sec?.purpose || target;
      questions.push(`What change would you like for ${title} (e.g. "horizontal grid", "vertical layout", "dark background", "airy spacing")?`);
    } else {
      questions.push('Describe the change with a section and a value, for example "make the hero background ink".');
    }
  }
  const result: AskResult = { siteId: current.id, base: doc.revision, target, targetKind, operations, summary, questions, choices };
  return { ...result };
}

export interface EditResult {
  siteId: string;
  version: number;
  revision: number;
  site: SiteDocument;
  diff: DiffEntry[];
}

/** Accepted brief is remembered so the next run offers it first; it never decides. */
function remember(doc: SiteDocument, values: Record<string, string>, kind: 'accepted' | 'rejected'): SiteDocument {
  const entries = Object.entries(values).map(([key, value]) => `${key}:${value}`);
  if (!entries.length) return doc;
  const brief = { ...doc.brief };
  const list = [...new Set([...(brief[kind] || []), ...entries])].slice(-20);
  return { ...doc, brief: { ...brief, [kind]: list } };
}

/**
 * A hand edit is the owner's work: provenance says who wrote it, so the scheduled sweep
 * leaves the draft alone instead of rebuilding over it. Publishing stays their call.
 */
function byMerchant(doc: SiteDocument): SiteDocument {
  return { ...doc, provenance: { state: doc.blueprint?.hash || '', revision: doc.revision, at: now(), generator: 'merchant' } };
}

export async function executeSiteEdit(
  client: Client,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  inputHash: string,
  bucket?: R2Bucket,
): Promise<Record<string, unknown>> {
  const siteId = text(input.siteId, 160);
  const base = Number(input.base);
  const current = await getSiteRecord(client, siteId);
  if (!siteId || !current) throw notFound('Site was not found.');
  if (!Number.isSafeInteger(base)) throw badRequest('Base revision is required.');
  const { doc } = readDocument(current.data);
  if (doc.revision !== base) throw conflict('Site changed since this patch was prepared. Refresh and try again.');
  const operations = Array.isArray(input.operations) ? input.operations as PatchOperation[] : [];
  let next = applyPatch(doc, { base, operations, respectLocks: input.respectLocks !== false });
  validateDocument(next);
  const choices = object(input.choices);
  const remembered = Object.fromEntries(Object.entries(choices).filter(([, value]) => typeof value === 'string') as [string, string][]);
  if (Object.keys(remembered).length) next = remember(next, remembered, 'accepted');
  next = byMerchant(next);
  const diff = diffSummary(doc, next);
  const version = current.version + 1;
  const at = now();
  const summary = text(input.summary, 200) || diff.slice(0, 3).map((entry) => `${entry.target} ${entry.kind}`).join(', ');
  const result: Record<string, unknown> = { siteId, version, revision: next.revision, site: next, diff };
  const stored = await recordHistory(bucket, context, siteId, next, doc, summary);
  const saved = await client.batch([
    { sql: 'UPDATE records SET data=?,version=?,updated=? WHERE id=? AND version=?', args: [JSON.stringify(stored), version, at, siteId, current.version] },
    { sql: `INSERT INTO move(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, 'site.edit', 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, siteId, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] },
  ], 'write');
  if (saved[0].rowsAffected !== 1 || saved[1].rowsAffected !== 1) throw conflict('Site changed while saving. Refresh and try again.');
  return { ...result, html: await previewHtml(next) };
}

/**
 * Snapshot the previous revision in R2 and keep a bounded index in the record.
 * Revision history never grows the frequently updated record without a limit.
 */
async function recordHistory(
  bucket: R2Bucket | undefined,
  context: AccessContext,
  siteId: string,
  next: SiteDocument,
  previous: SiteDocument,
  summary: string,
): Promise<SiteDocument & { history?: unknown[] }> {
  type Entry = { revision: number; at: number; summary: string; key?: string };
  const carried = ((next as unknown as { history?: Entry[] }).history || []).slice(-19);
  const history = [...carried];
  if (bucket) {
    const key = `workspaces/${context.workspace.id}/sites/${siteId}/revisions/${previous.revision}.json`;
    await bucket.put(key, JSON.stringify(previous), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
    history.push({ revision: previous.revision, at: now(), summary: summary.slice(0, 200), key });
    const dropped = carried.length > 19 ? carried[0] : undefined;
    if (dropped?.key) await bucket.delete(dropped.key).catch(() => undefined);
  }
  return { ...next, history } as SiteDocument & { history?: unknown[] };
}

async function previewHtml(doc: SiteDocument): Promise<string> {
  try {
    const compiled = await compileDocument(doc);
    const html = String(compiled.files.find((file) => file.path === '/index.html')?.body || '');
    const css = String(compiled.files.find((file) => file.path === '/style.css')?.body || '');
    return html.replace('</head>', `<style>${css}</style></head>`);
  } catch {
    return '';
  }
}

/** Undo restores an earlier revision as a new revision and records the brief it rejected. */
export async function executeSiteUndo(
  client: Client,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  inputHash: string,
  bucket?: R2Bucket,
): Promise<Record<string, unknown>> {
  if (!bucket) throw unavailable('Site revision storage is not configured.');
  const siteId = text(input.siteId, 160);
  const current = await getSiteRecord(client, siteId);
  if (!siteId || !current) throw notFound('Site was not found.');
  const { doc } = readDocument(current.data);
  const history = ((doc as unknown as { history?: { revision: number; at: number; summary: string; version: number; key?: string }[] }).history) || [];
  const targetRevision = input.revision === undefined ? undefined : Number(input.revision);
  const entry = targetRevision === undefined ? history[history.length - 1] : history.find((item) => item.revision === targetRevision);
  if (!entry?.key) throw notFound('An earlier revision to restore was not found.');
  const stored = await bucket.get(entry.key);
  if (!stored) throw notFound('The stored revision is unavailable.');
  const restored = JSON.parse(await stored.text()) as SiteDocument;
  const undone = text(entry.summary, 200);
  const merged: SiteDocument = byMerchant(remember({
    ...restored,
    revision: doc.revision + 1,
    currentRelease: doc.currentRelease ?? null,
    releases: doc.releases || [],
    brief: doc.brief || restored.brief,
  }, { undo: undone }, 'rejected'));
  validateDocument(merged);
  const diff = diffSummary(doc, merged);
  const version = current.version + 1;
  const at = now();
  const result: Record<string, unknown> = { siteId, version, revision: merged.revision, site: merged, diff, undone: entry.revision };
  const persisted = await recordHistory(bucket, context, siteId, merged, doc, `Restored revision ${entry.revision}`);
  const saved = await client.batch([
    { sql: 'UPDATE records SET data=?,version=?,updated=? WHERE id=? AND version=?', args: [JSON.stringify(persisted), version, at, siteId, current.version] },
    { sql: `INSERT INTO move(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, 'site.undo', 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, siteId, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] },
  ], 'write');
  if (saved[0].rowsAffected !== 1 || saved[1].rowsAffected !== 1) throw conflict('Site changed while undoing. Refresh and try again.');
  return { ...result, html: await previewHtml(merged) };
}

/**
 * Import the readable design.md view.
 *
 * The original reference and its hash are retained; conflicts become recorded
 * decisions. Markdown is a view of the typed design, never a second source of
 * truth, and imported text cannot grant permission or change policy.
 */
export async function executeSiteDesignImport(
  client: Client,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  inputHash: string,
  bucket?: R2Bucket,
): Promise<Record<string, unknown>> {
  const siteId = text(input.siteId, 160);
  const current = await getSiteRecord(client, siteId);
  if (!siteId || !current) throw notFound('Site was not found.');
  const { doc } = readDocument(current.data);
  const markdown = text(input.markdown, 60_000);
  if (!markdown) throw badRequest('Paste the design reference to import.');
  const parsed = parseDesign(markdown, doc.design);
  const revision = (doc.design.source?.revision || 0) + 1;
  const reference = `workspaces/${context.workspace.id}/sites/${siteId}/design/${revision}.md`;
  const hash = await digest(markdown);
  if (bucket) await bucket.put(reference, markdown, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
  const decisions = [...(doc.design.source?.decisions || []), ...parsed.decisions].slice(-50);
  const next: SiteDocument = {
    ...doc,
    revision: doc.revision + 1,
    design: { ...parsed.design, source: { reference, hash, revision, decisions } },
  };
  validateDocument(next);
  const version = current.version + 1;
  const at = now();
  const result: Record<string, unknown> = {
    siteId, version, revision: next.revision, design: next.design,
    decisions: parsed.decisions, notes: parsed.notes, designMarkdown: exportDesign(next.design),
  };
  const stored = await recordHistory(bucket, context, siteId, next, doc, 'Imported design.md');
  const saved = await client.batch([
    { sql: 'UPDATE records SET data=?,version=?,updated=? WHERE id=? AND version=?', args: [JSON.stringify(stored), version, at, siteId, current.version] },
    { sql: `INSERT INTO move(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, 'site.design.import', 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, siteId, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] },
  ], 'write');
  if (saved[0].rowsAffected !== 1 || saved[1].rowsAffected !== 1) throw conflict('Site changed while importing the design. Refresh and try again.');
  return result;
}
