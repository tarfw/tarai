/**
 * Typed, reviewable patches over a v2 site document.
 *
 * Every patch carries the base revision it was built against; stale patches
 * conflict instead of overwriting newer work. Locked sections, nodes and tokens
 * are excluded before any generator or judgment runs, and rejected here if a
 * patch tries to change them.
 */

import { badRequest, conflict, notFound } from '../errors.ts';
import { pruneLayout } from './document.ts';
import { resolveDesign, resolveToken, TOKENS } from './design.ts';
import type { Lock, Node, Persona, Section, SiteDocument, StyleSet } from './document.ts';
import {
  applySectionOverrides,
  defaultBlueprint,
  modelsOf,
  normalizeOverrides,
  OPTIONAL_SECTIONS,
  SECTION_KINDS,
  SECTION_SEQUENCE,
  sectionsForModels,
  type Blueprint,
  type Overrides,
  type SectionKind,
} from './blueprint.ts';
import { stampRecipe, stampText } from './build.ts';
import { canonicalDesignId, tokensFor } from './designs/library.ts';
import { recipeOfType, sectionType } from './recipes/library.ts';
import { projectLook } from './shortlist.ts';

/** What a merchant can decide for themselves, and keep across every regeneration. */
export type OverrideKind = 'design' | 'recipe' | 'settings' | 'text' | 'hide' | 'show' | 'order';
export const OVERRIDE_KINDS: readonly OverrideKind[] = ['design', 'recipe', 'settings', 'text', 'hide', 'show', 'order'] as const;

export type PatchOperation =
  | { op: 'set_text'; target: string; value: string }
  | { op: 'set_props'; target: string; value: Record<string, unknown> }
  | { op: 'set_style'; target: string; value: StyleSet | null }
  | { op: 'set_layout'; target: string; value: import('./document.ts').SectionLayoutSpec }
  | { op: 'move_node'; target: string; before?: string; after?: string }
  | { op: 'move_section'; target: string; index: number }
  | { op: 'add_section'; page: string; section: Section; index?: number }
  | { op: 'remove_section'; target: string }
  | { op: 'add_node'; parent: string; node: Node; index?: number }
  | { op: 'remove_node'; target: string }
  | { op: 'set_token'; token: string; value: string | number }
  | { op: 'set_redirect'; from: string; to: string | null }
  | { op: 'set_page'; page: string; value: { title?: string; description?: string; path?: string } }
  | { op: 'set_brief'; value: Partial<SiteDocument['brief']> }
  | { op: 'set_persona'; persona: Persona }
  | { op: 'remove_persona'; target: string }
  | { op: 'set_policy'; value: Partial<SiteDocument['policy']> }
  | { op: 'set_asset_rights'; target: string; value: { approved?: boolean; license?: string; source?: string; alt?: string } }
  | { op: 'add_asset'; asset: SiteDocument['assets'][number] }
  | { op: 'remove_asset'; target: string }
  | { op: 'set_override'; kind: OverrideKind; target?: string; value?: unknown }
  | { op: 'clear_override'; kind: OverrideKind | 'all'; target?: string }
  | { op: 'lock'; target: string; kind: Lock['kind'] }
  | { op: 'unlock'; target: string };

export interface PatchInput {
  base: number;
  operations: readonly PatchOperation[];
  /** Locks are advisory for user-requested edits and enforced for regeneration. */
  respectLocks?: boolean;
}

export interface DiffEntry {
  target: string;
  kind: 'text' | 'prop' | 'style' | 'structure' | 'token' | 'persona' | 'policy' | 'lock' | 'brief' | 'asset' | 'override';
  from: string;
  to: string;
}

interface FoundNode {
  node: Node;
  parent: Node[] | null;
  index: number;
  section: Section;
}

interface FoundSection {
  section: Section;
  page: SiteDocument['pages'][number];
  index: number;
}

function findSection(doc: SiteDocument, id: string): FoundSection | null {
  for (const page of doc.pages) {
    const index = page.sections.findIndex((section) => section.id === id);
    if (index >= 0) return { section: page.sections[index], page, index };
  }
  return null;
}

function findNode(doc: SiteDocument, id: string): FoundNode | null {
  const walk = (nodes: Node[], section: Section, parent: Node[] | null): FoundNode | null => {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (node.id === id) return { node, parent: nodes, index, section };
      if (node.children) {
        const nested = walk(node.children, section, node.children);
        if (nested) return nested;
      }
    }
    return null;
  };
  for (const page of doc.pages) {
    for (const section of page.sections) {
      const found = walk(section.nodes, section, section.nodes);
      if (found) return found;
    }
  }
  return null;
}

function findContainer(doc: SiteDocument, id: string): Node[] | null {
  if (doc.pages.some((page) => page.sections.some((section) => section.id === id))) {
    return null;
  }
  const node = findNode(doc, id);
  return node ? node.node.children || null : null;
}

export function lockedTargets(doc: SiteDocument): Set<string> {
  const locked = new Set<string>(doc.locks.map((lock) => lock.target));
  const walk = (nodes: Node[], inside: boolean) => {
    for (const node of nodes) {
      if (inside || locked.has(node.id)) locked.add(node.id);
      walk(node.children || [], inside || locked.has(node.id));
    }
  };
  for (const page of doc.pages) for (const section of page.sections) {
    const sectionLocked = locked.has(section.id);
    if (sectionLocked) locked.add(section.id);
    walk(section.nodes, sectionLocked);
  }
  return locked;
}

function guard(locked: Set<string>, target: string, respect: boolean): void {
  if (respect && locked.has(target)) throw conflict('That part of the site is locked. Unlock it before editing.');
}

export function applyPatch(doc: SiteDocument, input: PatchInput): SiteDocument {
  if (!Number.isSafeInteger(input.base) || input.base !== doc.revision) {
    throw conflict('Site changed since this patch was prepared. Refresh and try again.');
  }
  if (input.operations.length > 200) throw badRequest('Too many site changes.');
  const respect = input.respectLocks !== false;
  const locked = lockedTargets(doc);
  const next = structuredClone(doc) as SiteDocument;
  for (const operation of input.operations) {
    switch (operation.op) {
      case 'set_text': {
        guard(locked, operation.target, respect);
        const found = findNode(next, operation.target) ?? sectionHeading(next, operation.target);
        if (!found || (found.node.kind !== 'heading' && found.node.kind !== 'text')) throw notFound('Site text target was not found.');
        found.node.props = { ...found.node.props, text: String(operation.value).slice(0, 4000) };
        break;
      }
      case 'set_props': {
        guard(locked, operation.target, respect);
        const found = findNode(next, operation.target);
        if (!found) throw notFound('Site node was not found.');
        found.node.props = { ...found.node.props, ...operation.value };
        break;
      }
      case 'set_style': {
        guard(locked, operation.target, respect);
        const section = findSection(next, operation.target);
        if (section) {
          if (operation.value === null) delete section.section.style;
          else section.section.style = operation.value;
          break;
        }
        const found = findNode(next, operation.target);
        if (!found) throw notFound('Site node was not found.');
        if (operation.value === null) delete found.node.style;
        else found.node.style = operation.value;
        break;
      }
      case 'set_layout': {
        guard(locked, operation.target, respect);
        const section = findSection(next, operation.target);
        if (!section) throw notFound('Site section was not found.');
        section.section.layout = operation.value;
        break;
      }
      case 'move_node': {
        guard(locked, operation.target, respect);
        const found = findNode(next, operation.target);
        if (!found || !found.parent) throw notFound('Site node was not found.');
        const [node] = found.parent.splice(found.index, 1);
        const anchorId = operation.before || operation.after;
        const anchor = anchorId ? findNode(next, anchorId) : null;
        if (anchorId && (!anchor || !anchor.parent)) throw notFound('Site node anchor was not found.');
        if (anchor && anchor.parent) {
          const at = operation.before ? anchor.index : anchor.index + 1;
          anchor.parent.splice(at, 0, node);
        } else {
          const section = findSection(next, found.section.id);
          if (!section) throw notFound('Site section was not found.');
          section.section.nodes.push(node);
        }
        break;
      }
      case 'move_section': {
        guard(locked, operation.target, respect);
        const found = findSection(next, operation.target);
        if (!found) throw notFound('Site section was not found.');
        const [section] = found.page.sections.splice(found.index, 1);
        const at = Math.max(0, Math.min(found.page.sections.length, Number(operation.index) || 0));
        found.page.sections.splice(at, 0, section);
        break;
      }
      case 'add_section': {
        const page = next.pages.find((entry) => entry.id === operation.page || entry.path === operation.page);
        if (!page) throw notFound('Site page was not found.');
        if (page.sections.some((section) => section.id === operation.section.id)) throw badRequest('Site section id already exists.');
        const at = Math.max(0, Math.min(page.sections.length, operation.index ?? page.sections.length));
        page.sections.splice(at, 0, structuredClone(operation.section));
        break;
      }
      case 'remove_section': {
        guard(locked, operation.target, respect);
        const found = findSection(next, operation.target);
        if (!found) throw notFound('Site section was not found.');
        if (found.page.sections.length <= 1) throw badRequest('A page keeps at least one section.');
        found.page.sections.splice(found.index, 1);
        break;
      }
      case 'add_node': {
        guard(locked, operation.parent, respect);
        const section = findSection(next, operation.parent);
        const container = section ? section.section.nodes : findContainer(next, operation.parent);
        if (!container) throw notFound('Site container was not found.');
        const at = Math.max(0, Math.min(container.length, operation.index ?? container.length));
        container.splice(at, 0, structuredClone(operation.node));
        break;
      }
      case 'remove_node': {
        guard(locked, operation.target, respect);
        const found = findNode(next, operation.target);
        if (!found || !found.parent) throw notFound('Site node was not found.');
        found.parent.splice(found.index, 1);
        break;
      }
      case 'set_token': {
        guard(locked, operation.token, respect);
        const [group, key] = operation.token.replace(/^token:/, '').split('.');
        const entry = TOKENS.find((token) => token.group === group && token.key === key);
        if (!entry) throw badRequest('Choose a registered design token.');
        const groupValue = (next.design as unknown as Record<string, Record<string, unknown>>)[group];
        if (!groupValue) throw badRequest('Choose a registered design token.');
        const current = groupValue[key];
        if (entry.kind === 'color' && (typeof operation.value !== 'string' || !/^#[0-9a-f]{6}$/i.test(operation.value))) throw badRequest('Colour tokens use a hex value.');
        if ((entry.kind === 'number') && (typeof operation.value !== 'number' || !Number.isFinite(operation.value))) throw badRequest('Numeric tokens use a number.');
        if (entry.kind === 'font' && typeof operation.value !== 'string') throw badRequest('Font tokens use a font stack.');
        if (entry.kind === 'enum' && (typeof operation.value !== 'string' || !['linear', 'ease', 'easeout', 'easeinout'].includes(operation.value))) throw badRequest('Choose a registered easing value.');
        groupValue[key] = current === undefined ? operation.value : operation.value;
        break;
      }
      case 'set_redirect': {
        const index = next.redirects.findIndex((entry) => entry.from === operation.from);
        if (operation.to === null) {
          if (index >= 0) next.redirects.splice(index, 1);
        } else if (index >= 0) next.redirects[index] = { from: operation.from, to: operation.to, status: 308 };
        else next.redirects.push({ from: operation.from, to: operation.to, status: 308 });
        break;
      }
      case 'set_page': {
        const page = next.pages.find((entry) => entry.id === operation.page || entry.path === operation.page);
        if (!page) throw notFound('Site page was not found.');
        if (typeof operation.value.title === 'string' && operation.value.title.trim()) page.title = operation.value.title.trim().slice(0, 200);
        if (typeof operation.value.path === 'string' && operation.value.path !== page.path) {
          if (next.pages.some((entry) => entry.path === operation.value.path)) throw badRequest('Site page path already exists.');
          next.redirects.push({ from: page.path, to: operation.value.path, status: 308 });
          page.path = operation.value.path;
        }
        if (typeof operation.value.description === 'string') page.meta = { ...page.meta, description: operation.value.description.trim().slice(0, 300) };
        break;
      }
      case 'set_brief':
        next.brief = { ...next.brief, ...operation.value };
        break;
      case 'set_persona': {
        if (!/^[a-z][a-z0-9-]{0,39}$/.test(operation.persona?.id || '')) throw badRequest('Persona id must be a lowercase word.');
        const persona = structuredClone(operation.persona);
        const personas = [...(next.personas || [])];
        const index = personas.findIndex((entry) => entry.id === persona.id);
        if (index >= 0) personas[index] = persona;
        else personas.push(persona);
        if (personas.length > 4) throw badRequest('A site compiles at most four persona variants.');
        next.personas = personas;
        break;
      }
      case 'remove_persona': {
        const personas = [...(next.personas || [])];
        const index = personas.findIndex((entry) => entry.id === operation.target);
        if (index < 0) throw notFound('Site persona was not found.');
        personas.splice(index, 1);
        next.personas = personas;
        break;
      }
      case 'set_policy':
        next.policy = { ...next.policy, ...operation.value };
        break;
      case 'set_asset_rights': {
        const asset = next.assets.find((entry) => entry.id === operation.target);
        if (!asset) throw notFound('Site asset was not found.');
        const value = operation.value;
        if (typeof value.approved === 'boolean') asset.rights = { ...asset.rights, approved: value.approved };
        if (typeof value.license === 'string') asset.rights = { ...asset.rights, license: value.license.slice(0, 120) };
        if (typeof value.source === 'string') asset.rights = { ...asset.rights, source: value.source.slice(0, 200) };
        if (typeof value.alt === 'string') asset.alt = value.alt.slice(0, 300);
        break;
      }
      case 'add_asset': {
        const asset = operation.asset;
        if (!asset || next.assets.some((entry) => entry.id === asset.id)) throw badRequest('Site asset is invalid or already exists.');
        next.assets.push(structuredClone(asset));
        break;
      }
      case 'remove_asset': {
        const index = next.assets.findIndex((entry) => entry.id === operation.target);
        if (index < 0) throw notFound('Site asset was not found.');
        next.assets.splice(index, 1);
        break;
      }
      case 'set_override': {
        setOverride(next, operation, locked, respect);
        break;
      }
      case 'clear_override': {
        clearOverride(next, operation, locked, respect);
        break;
      }
      case 'lock': {
        if (!['section', 'node', 'token', 'brand'].includes(operation.kind)) throw badRequest('Choose a registered lock kind.');
        const exists = operation.kind === 'token'
          ? typeof resolveToken(next.design, operation.target) !== 'undefined'
          : operation.kind === 'brand'
            ? true
            : Boolean(findSection(next, operation.target) || findNode(next, operation.target));
        if (!exists) throw notFound('Locked target was not found.');
        if (!next.locks.some((entry) => entry.target === operation.target)) next.locks.push({ target: operation.target, kind: operation.kind, at: Date.now() });
        break;
      }
      case 'unlock': {
        next.locks = next.locks.filter((entry) => entry.target !== operation.target);
        break;
      }
      default:
        throw badRequest('Site change is invalid.');
    }
  }
  next.revision = doc.revision + 1;
  return next;
}

function sectionHeading(doc: SiteDocument, id: string): FoundNode | null {
  const section = findSection(doc, id);
  if (!section) return null;
  const node = section.section.nodes.find((entry) => entry.kind === 'heading');
  return node ? { node, parent: section.section.nodes, index: section.section.nodes.indexOf(node), section: section.section } : null;
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** The section type a stored section renders as; generated documents use it as the id too. */
const kindOf = (section: Section): SectionKind => sectionType(section.purpose);

const sequenced = (list: Iterable<SectionKind>): SectionKind[] => {
  const wanted = new Set(list);
  return SECTION_SEQUENCE.filter((kind) => wanted.has(kind));
};

/** The blueprint with its overrides normalized, so a caller can write to one object. */
function blueprintOf(doc: SiteDocument): Blueprint {
  const blueprint: Blueprint = doc.blueprint ? { ...doc.blueprint } : defaultBlueprint();
  const overrides = normalizeOverrides(blueprint.overrides);
  if (Object.keys(overrides).length) blueprint.overrides = overrides;
  else delete blueprint.overrides;
  doc.blueprint = blueprint;
  return blueprint;
}

/** The blueprint as a renderer sees it: the merchant's recipes over the store's picks. */
function effective(blueprint: Blueprint): Blueprint {
  return { ...blueprint, recipes: { ...(blueprint.recipes || {}), ...(blueprint.overrides?.recipes || {}) } };
}

/** Re-stamp every section of one kind. False when the document has not built it yet. */
function restamp(doc: SiteDocument, kind: SectionKind, blueprint: Blueprint): boolean {
  const view = effective(blueprint);
  let found = false;
  for (const page of doc.pages) {
    page.sections = page.sections.map((section) => {
      if (kindOf(section) !== kind) return section;
      found = true;
      return stampRecipe(section, view);
    });
  }
  return found;
}

function pend(overrides: Overrides, key: string): void {
  overrides.pending = [...new Set([...(overrides.pending || []), key])];
}

function unpend(overrides: Overrides, key: string): void {
  const rest = (overrides.pending || []).filter((entry) => entry !== key);
  if (rest.length) overrides.pending = rest;
  else delete overrides.pending;
}

function sectionKind(value: unknown): SectionKind {
  const kind = typeof value === 'string' ? value.trim() : '';
  if (!(SECTION_KINDS as readonly string[]).includes(kind)) throw badRequest('Choose a section this store has.');
  return kind as SectionKind;
}

/** Recompute the section list and put the page back in that order. */
function reshape(doc: SiteDocument, blueprint: Blueprint): void {
  blueprint.sections = applySectionOverrides(blueprint.sections, modelsOf(blueprint), blueprint.overrides);
  const rank = (section: Section) => {
    const at = blueprint.sections.indexOf(kindOf(section));
    return at < 0 ? blueprint.sections.length : at;
  };
  for (const page of doc.pages) page.sections = [...page.sections].sort((left, right) => rank(left) - rank(right));
}

function textTarget(doc: SiteDocument, target: unknown): string {
  const id = typeof target === 'string' ? target.trim() : '';
  if (!id) throw badRequest('Name the text to keep.');
  const node = findNode(doc, id)?.node;
  if (node && (node.kind === 'heading' || node.kind === 'text')) return node.id;
  const heading = sectionHeading(doc, id)?.node;
  if (heading) return heading.id;
  throw notFound('Site text target was not found.');
}

/**
 * A merchant decision, written where it survives every regeneration (parai §8, D10).
 * What can be applied to the stored document is applied here, so the change is visible
 * without a rebuild; what needs content the document does not have is left pending.
 */
function setOverride(doc: SiteDocument, operation: Extract<PatchOperation, { op: 'set_override' }>, locked: Set<string>, respect: boolean): void {
  if (!(OVERRIDE_KINDS as readonly string[]).includes(operation.kind)) throw badRequest('Choose an override to change.');
  const blueprint = blueprintOf(doc);
  const overrides: Overrides = blueprint.overrides || (blueprint.overrides = {});
  const models = modelsOf(blueprint);

  if (operation.kind === 'design') {
    const id = canonicalDesignId(typeof operation.value === 'string' ? operation.value.trim() : '');
    if (!tokensFor(id)) throw badRequest('Choose a design from the library.');
    overrides.design = id;
    blueprint.style = id;
    const projected = projectLook(id);
    blueprint.typography = projected.typography;
    blueprint.tone = projected.tone;
    blueprint.density = projected.density;
    const design = resolveDesign(id);
    // An imported reference keeps its provenance; only the tokens change hands.
    doc.design = doc.design?.source ? { ...design, source: doc.design.source } : design;
    unpend(overrides, 'design');
    return;
  }

  if (operation.kind === 'text') {
    const id = textTarget(doc, operation.target);
    const words = (typeof operation.value === 'string' ? operation.value : '').trim().slice(0, 4000);
    if (!words) throw badRequest('Give the words to keep.');
    guard(locked, id, respect);
    overrides.text = { ...(overrides.text || {}), [id]: words };
    stampText(doc, { [id]: words });
    unpend(overrides, `text:${id}`);
    return;
  }

  const kind = sectionKind(operation.target);
  guard(locked, kind, respect);

  if (operation.kind === 'recipe') {
    const id = typeof operation.value === 'string' ? operation.value.trim() : '';
    const recipe = recipeOfType(kind, id);
    if (!recipe || recipe.id !== id) throw badRequest('Choose a layout this section has.');
    overrides.recipes = { ...(overrides.recipes || {}), [kind]: id };
    if (restamp(doc, kind, blueprint)) unpend(overrides, `recipe:${kind}`);
    else pend(overrides, `recipe:${kind}`);
    return;
  }

  if (operation.kind === 'settings') {
    const value = record(operation.value);
    if (!Object.keys(value).length) throw badRequest('Give a setting to turn.');
    const recipe = recipeOfType(kind, overrides.recipes?.[kind] || blueprint.recipes?.[kind]);
    if (!recipe) throw badRequest('That section has no settings.');
    const turned = { ...(overrides.settings?.[kind] || {}) };
    for (const [key, entry] of Object.entries(value)) {
      const setting = recipe.settings[key];
      if (!setting) throw badRequest('Choose a setting this layout has.');
      if (setting.type === 'boolean') {
        if (typeof entry !== 'boolean') throw badRequest('That setting is either on or off.');
        turned[key] = entry;
      } else if (setting.type === 'choice') {
        const choice = typeof entry === 'string' ? entry.trim() : '';
        if (!(setting.options || []).includes(choice)) throw badRequest('Choose one of the listed options.');
        turned[key] = choice;
      } else {
        const words = (typeof entry === 'string' ? entry : '').trim().slice(0, setting.max || 200);
        if (!words) throw badRequest('Give the words for that setting.');
        // A colour or a length here would be a design decision in disguise (parai D7).
        if (/^#[0-9a-f]{3,8}$/i.test(words)) throw badRequest('A setting carries words; colours belong to the design.');
        turned[key] = words;
      }
    }
    overrides.settings = { ...(overrides.settings || {}), [kind]: turned };
    // Stamped at once, so a saved choice shows in the preview instead of waiting for a rebuild.
    if (restamp(doc, kind, blueprint)) unpend(overrides, `settings:${kind}`);
    else pend(overrides, `settings:${kind}`);
    return;
  }

  if (operation.kind === 'order') {
    const asked = Array.isArray(operation.value)
      ? sequenced(operation.value.filter((entry) => (SECTION_KINDS as readonly string[]).includes(String(entry))) as SectionKind[])
      : [];
    if (!asked.length) throw badRequest('Give the section order.');
    overrides.order = asked;
    reshape(doc, blueprint);
    unpend(overrides, 'order');
    return;
  }

  const hidden = new Set(overrides.hidden || []);
  const shown = new Set(overrides.shown || []);
  const required = sectionsForModels(models).required;
  if (operation.kind === 'hide') {
    if (required.includes(kind)) throw badRequest('That section is required for the way you sell.');
    hidden.add(kind);
    shown.delete(kind);
    let kept = 0;
    for (const page of doc.pages) {
      page.sections = page.sections.filter((section) => kindOf(section) !== kind);
      kept += page.sections.length;
    }
    if (!kept) throw badRequest('A page keeps at least one section.');
    unpend(overrides, `show:${kind}`);
  } else {
    hidden.delete(kind);
    if (!required.includes(kind) && (OPTIONAL_SECTIONS as readonly string[]).includes(kind)) shown.add(kind);
    // Turning a section back on can need content this document never built.
    if (doc.pages.some((page) => page.sections.some((section) => kindOf(section) === kind))) unpend(overrides, `show:${kind}`);
    else pend(overrides, `show:${kind}`);
  }
  overrides.hidden = sequenced(hidden);
  overrides.shown = sequenced(shown);
  if (!overrides.hidden.length) delete overrides.hidden;
  if (!overrides.shown.length) delete overrides.shown;
  reshape(doc, blueprint);
}

/**
 * Hand a decision back to the system. The document keeps what was already built —
 * undo is the way back — and the next regeneration is free to choose again.
 */
function clearOverride(doc: SiteDocument, operation: Extract<PatchOperation, { op: 'clear_override' }>, locked: Set<string>, respect: boolean): void {
  const kind = operation.kind;
  if (kind !== 'all' && !(OVERRIDE_KINDS as readonly string[]).includes(kind)) throw badRequest('Choose an override to clear.');
  const blueprint = blueprintOf(doc);
  const overrides = blueprint.overrides;
  if (!overrides) return;

  if (kind === 'all') {
    const waiting = [...new Set([...(overrides.hidden || []), ...(overrides.shown || [])].map((entry) => `show:${entry}`))];
    if (waiting.length) blueprint.overrides = { pending: waiting };
    else delete blueprint.overrides;
    reshape(doc, blueprint);
    return;
  }

  if (kind === 'text') {
    const rest = { ...(overrides.text || {}) };
    const id = typeof operation.target === 'string' ? operation.target.trim() : '';
    if (id) {
      if (!Object.hasOwn(rest, id)) throw notFound('Merchant text for that slot was not found.');
      delete rest[id];
    } else if (!Object.keys(rest).length) {
      throw notFound('Merchant text was not found.');
    }
    // The words already written stay written; a regeneration writes fresh copy.
    if (Object.keys(rest).length) overrides.text = rest;
    else delete overrides.text;
    return;
  }

  if (kind === 'design') {
    delete overrides.design;
    return;
  }

  const target = sectionKind(operation.target);
  guard(locked, target, respect);

  if (kind === 'recipe') {
    const rest = { ...(overrides.recipes || {}) };
    if (!Object.hasOwn(rest, target)) throw notFound('That section was not overridden.');
    delete rest[target];
    if (Object.keys(rest).length) overrides.recipes = rest;
    else delete overrides.recipes;
    restamp(doc, target, blueprint);
    unpend(overrides, `recipe:${target}`);
    return;
  }

  if (kind === 'settings') {
    const rest = { ...(overrides.settings || {}) };
    if (!Object.keys(rest).length) throw notFound('That section was not overridden.');
    if (Object.hasOwn(rest, target)) delete rest[target];
    if (Object.keys(rest).length) overrides.settings = rest;
    else delete overrides.settings;
    restamp(doc, target, blueprint);
    unpend(overrides, `settings:${target}`);
    return;
  }

  if (kind === 'order') {
    delete overrides.order;
    reshape(doc, blueprint);
    unpend(overrides, 'order');
    return;
  }

  const hidden = new Set(overrides.hidden || []);
  const shown = new Set(overrides.shown || []);
  if (kind === 'hide') {
    if (!hidden.has(target)) throw notFound('That section was not hidden.');
    hidden.delete(target);
    if ((OPTIONAL_SECTIONS as readonly string[]).includes(target)) shown.add(target);
    if (!doc.pages.some((page) => page.sections.some((section) => kindOf(section) === target))) pend(overrides, `show:${target}`);
  } else {
    if (!shown.has(target)) throw notFound('That section was not turned on.');
    shown.delete(target);
    unpend(overrides, `show:${target}`);
  }
  overrides.hidden = sequenced(hidden);
  overrides.shown = sequenced(shown);
  if (!overrides.hidden.length) delete overrides.hidden;
  if (!overrides.shown.length) delete overrides.shown;
  reshape(doc, blueprint);
}

const text = (value: unknown): string => typeof value === 'string' ? value : '';

/** Human-readable change list for review before a patch is applied. */
export function diffSummary(before: SiteDocument, after: SiteDocument): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const push = (target: string, kind: DiffEntry['kind'], from: unknown, to: unknown) => {
    const left = typeof from === 'object' ? JSON.stringify(from) : text(from);
    const right = typeof to === 'object' ? JSON.stringify(to) : text(to);
    if (left === right) return;
    entries.push({ target, kind, from: left.slice(0, 160), to: right.slice(0, 160) });
  };
  push('brief', 'brief', before.brief, after.brief);
  push('policy', 'policy', before.policy, after.policy);
  for (const token of TOKENS) {
    const left = (before.design as unknown as Record<string, Record<string, unknown>>)[token.group]?.[token.key];
    const right = (after.design as unknown as Record<string, Record<string, unknown>>)[token.group]?.[token.key];
    if (left !== right) entries.push({ target: `token:${token.group}.${token.key}`, kind: 'token', from: text(left), to: text(right) });
  }
  const beforeNodes = new Map<string, Node>();
  const collect = (doc: SiteDocument) => {
    const map = new Map<string, Node>();
    const walk = (nodes: Node[]) => nodes.forEach((node) => { map.set(node.id, node); walk(node.children || []); });
    doc.pages.forEach((page) => page.sections.forEach((section) => walk(section.nodes)));
    return map;
  };
  collect(before).forEach((node, id) => beforeNodes.set(id, node));
  const afterNodes = collect(after);
  for (const [id, node] of afterNodes) {
    const previous = beforeNodes.get(id);
    if (!previous) { entries.push({ target: id, kind: 'structure', from: '', to: `added ${node.kind}` }); continue; }
    push(id, 'style', previous.style, node.style);
    const keys = new Set([...Object.keys(previous.props), ...Object.keys(node.props)]);
    for (const key of keys) {
      if (key === 'items') continue;
      const left = previous.props[key];
      const right = node.props[key];
      if (JSON.stringify(left) !== JSON.stringify(right)) entries.push({ target: id, kind: key === 'text' ? 'text' : 'prop', from: text(left), to: text(right) });
    }
  }
  for (const [id] of beforeNodes) if (!afterNodes.has(id)) entries.push({ target: id, kind: 'structure', from: 'removed', to: '' });
  const sectionsOf = (doc: SiteDocument) => new Map(doc.pages.flatMap((page) => page.sections.map((section) => [`${page.id}:${section.id}`, section] as const)));
  const beforeSections = sectionsOf(before);
  const afterSections = sectionsOf(after);
  for (const [key, section] of afterSections) {
    const previous = beforeSections.get(key);
    if (!previous) { entries.push({ target: section.id, kind: 'structure', from: '', to: 'added section' }); continue; }
    push(section.id, 'style', previous.style, section.style);
    push(section.id, 'prop', previous.layout, section.layout);
  }
  for (const [key, section] of beforeSections) if (!afterSections.has(key)) entries.push({ target: section.id, kind: 'structure', from: 'removed section', to: '' });
  if (JSON.stringify(before.personas || []) !== JSON.stringify(after.personas || [])) entries.push({ target: 'personas', kind: 'persona', from: `${(before.personas || []).length}`, to: `${(after.personas || []).length}` });
  if (JSON.stringify(before.redirects) !== JSON.stringify(after.redirects)) entries.push({ target: 'redirects', kind: 'structure', from: `${before.redirects.length}`, to: `${after.redirects.length}` });
  if (JSON.stringify(before.locks) !== JSON.stringify(after.locks)) entries.push({ target: 'locks', kind: 'lock', from: `${before.locks.length}`, to: `${after.locks.length}` });
  if (JSON.stringify(before.assets) !== JSON.stringify(after.assets)) entries.push({ target: 'assets', kind: 'asset', from: `${before.assets.length}`, to: `${after.assets.length}` });
  const beforeOverrides = before.blueprint?.overrides;
  const afterOverrides = after.blueprint?.overrides;
  if (JSON.stringify(beforeOverrides || {}) !== JSON.stringify(afterOverrides || {})) {
    entries.push({ target: 'overrides', kind: 'override', from: Object.keys(beforeOverrides || {}).join(' ') || 'none', to: Object.keys(afterOverrides || {}).join(' ') || 'none' });
  }
  return entries;
}
