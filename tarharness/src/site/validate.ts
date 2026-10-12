/**
 * Site v2 validation: node kinds, props, styles, references, cycles, depth,
 * URLs, bindings, locks and accessibility essentials.
 *
 * `collectIssues` returns every finding; `validateDocument` throws on the first
 * blocking finding so drafts always stay structurally sound. Quality gates that
 * depend on compiled output or published rights live in inspect.ts.
 */

import { badRequest } from '../errors.ts';
import { auditDesign, isTokenRef, resolveToken, TONE_KEYS, type Design } from './design.ts';
import { COMMERCE_MODELS } from './blueprint.ts';
import {
  ALIGN_VALUES, ASPECT_VALUES, BORDER_VALUES, DOCUMENT_VERSION, DENSITY_VALUES, EASING_VALUES,
  LAYOUT_COLLAPSES, LAYOUT_HEIGHTS, LAYOUT_RATIOS, LIMITS, MASK_VALUES, NODE_KINDS, PAD_VALUES, PUBLIC_TYPES, RESERVED_PATHS,
  SECTION_LAYOUTS, SHADOW_VALUES, SIZE_VALUES, STYLE_KEYS, WIDTH_VALUES,
  type Binding, type Node, type Section, type SiteDocument, type Style, type StyleSet,
} from './document.ts';
import { isSafeHref } from './html.ts';

export interface Issue {
  level: 'blocking' | 'advisory';
  area: string;
  path: string;
  message: string;
}

const ID = /^[a-z][a-z0-9-]{0,79}$/;
const PATH = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/;
const HASH = /^[a-f0-9]{64}$/;
const MIME_BY_KIND: Record<string, string[]> = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm'],
  font: ['font/woff2'],
  icon: ['image/svg+xml'],
};
const FONT_STACK = /^[a-zA-Z0-9 ,"'\-._]+$/;
const HEADING_LEVELS = [1, 2, 3];
const PAD_TOKENS = ['token:space.unit', 'token:space.section'];
const RADIUS_TOKENS = ['token:shape.sm', 'token:shape.md', 'token:shape.lg', 'token:shape.pill'];

const text = (value: unknown): string => typeof value === 'string' ? value : '';
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function checkText(issues: Issue[], value: unknown, max: number, area: string, path: string, required = false): void {
  if (value === undefined || value === null) {
    if (required) issues.push({ level: 'blocking', area, path, message: `${area} is required.` });
    return;
  }
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    issues.push({ level: 'blocking', area, path, message: `${area} must be a string of at most ${max} characters.` });
  }
}

function checkColorValue(issues: Issue[], design: Design, value: unknown, area: string, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'string') { issues.push({ level: 'blocking', area, path, message: `${area} must be a colour.` }); return; }
  if (isTokenRef(value)) {
    if (typeof resolveToken(design, value) !== 'string') issues.push({ level: 'blocking', area, path, message: `Unknown colour token ${value}.` });
    return;
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) issues.push({ level: 'blocking', area, path, message: `${area} must be a hex colour or a colour token.` });
}

/**
 * The grammar knobs a section may ask for (parai §5.1). Each is one word from a code-owned
 * list, and a knob only exists for the layouts that implement it.
 */
function checkLayout(issues: Issue[], design: Design, layout: unknown, path: string): void {
  const spec = object(layout);
  const kind = text(spec.kind);
  const word = (area: string, values: readonly string[], message: string) => {
    if (spec[area] === undefined) return;
    if (!values.includes(text(spec[area]))) issues.push({ level: 'blocking', area: 'section', path: `${path}.${area}`, message });
  };
  word('ratio', LAYOUT_RATIOS, 'A ratio is one of 50/50, 60/40, 40/60, 2/1 or 1/2.');
  word('collapse', LAYOUT_COLLAPSES, 'Collapse is stack or keep.');
  word('height', LAYOUT_HEIGHTS, 'Height is short, tall or full.');
  if (spec.ratio !== undefined && kind !== 'split') issues.push({ level: 'blocking', area: 'section', path: `${path}.ratio`, message: 'Only a split has a ratio.' });
  if (spec.collapse !== undefined && kind !== 'split' && kind !== 'row') issues.push({ level: 'blocking', area: 'section', path: `${path}.collapse`, message: 'Only a split or a row says how it collapses.' });
  if (spec.height !== undefined && kind !== 'overlay') issues.push({ level: 'blocking', area: 'section', path: `${path}.height`, message: 'Only an overlay has a height.' });
  if (spec.scrim !== undefined) {
    const scrim = text(spec.scrim);
    if (kind !== 'overlay') issues.push({ level: 'blocking', area: 'section', path: `${path}.scrim`, message: 'Only an overlay has a scrim.' });
    else if (!isTokenRef(scrim) || typeof resolveToken(design, scrim) !== 'string') issues.push({ level: 'blocking', area: 'section', path: `${path}.scrim`, message: 'A scrim is a colour token the design carries.' });
  }
}

function checkStyle(issues: Issue[], design: Design, set: unknown, path: string): void {
  if (set === undefined) return;
  const record = object(set);
  for (const key of Object.keys(record)) {
    if (!['base', 'small', 'medium', 'large'].includes(key)) { issues.push({ level: 'blocking', area: 'style', path, message: `Unknown style override ${key}.` }); continue; }
    const style = object(record[key]);
    for (const property of Object.keys(style)) {
      if (!(STYLE_KEYS as readonly string[]).includes(property)) {
        issues.push({ level: 'blocking', area: 'style', path: `${path}.${key}.${property}`, message: `Style property ${property} is not allowed.` });
      }
    }
    const at = `${path}.${key}`;
    const value = style as Style;
    checkColorValue(issues, design, value.background, 'background', `${at}.background`);
    checkColorValue(issues, design, value.color, 'colour', `${at}.color`);
    if (value.pad !== undefined && !(PAD_VALUES as readonly string[]).includes(String(value.pad)) && !PAD_TOKENS.includes(String(value.pad))) issues.push({ level: 'blocking', area: 'style', path: `${at}.pad`, message: 'Padding must be none, sm, md, lg, xl or a spacing token.' });
    if (value.gap !== undefined && !(PAD_VALUES as readonly string[]).includes(String(value.gap)) && !PAD_TOKENS.includes(String(value.gap))) issues.push({ level: 'blocking', area: 'style', path: `${at}.gap`, message: 'Gap must be none, sm, md, lg, xl or a spacing token.' });
    if (value.radius !== undefined && typeof value.radius === 'number' && (value.radius < 0 || value.radius > 64)) issues.push({ level: 'blocking', area: 'style', path: `${at}.radius`, message: 'Radius must be between 0 and 64.' });
    if (typeof value.radius === 'string' && !RADIUS_TOKENS.includes(value.radius)) issues.push({ level: 'blocking', area: 'style', path: `${at}.radius`, message: `Unknown radius token ${value.radius}.` });
    if (value.border !== undefined && !(BORDER_VALUES as readonly string[]).includes(String(value.border)) && !isTokenRef(String(value.border))) issues.push({ level: 'blocking', area: 'style', path: `${at}.border`, message: 'Border must be none, hairline or a colour token.' });
    if (value.shadow !== undefined && !(SHADOW_VALUES as readonly string[]).includes(String(value.shadow))) issues.push({ level: 'blocking', area: 'style', path: `${at}.shadow`, message: 'Shadow must be none, low or high.' });
    if (value.align !== undefined && !(ALIGN_VALUES as readonly string[]).includes(String(value.align))) issues.push({ level: 'blocking', area: 'style', path: `${at}.align`, message: 'Align must be start, center, end or between.' });
    if (value.width !== undefined && !(WIDTH_VALUES as readonly string[]).includes(String(value.width))) issues.push({ level: 'blocking', area: 'style', path: `${at}.width`, message: 'Width must be content, wide or full.' });
    if (value.aspect !== undefined && !(ASPECT_VALUES as readonly string[]).includes(String(value.aspect))) issues.push({ level: 'blocking', area: 'style', path: `${at}.aspect`, message: 'Aspect must be square, portrait, landscape or wide.' });
    if (value.mask !== undefined && !(MASK_VALUES as readonly string[]).includes(String(value.mask))) issues.push({ level: 'blocking', area: 'style', path: `${at}.mask`, message: 'Mask must be none or soft.' });
    if (value.size !== undefined && !(SIZE_VALUES as readonly string[]).includes(String(value.size))) issues.push({ level: 'blocking', area: 'style', path: `${at}.size`, message: 'Size must be display, heading, body or label.' });
    if (value.weight !== undefined && (typeof value.weight !== 'number' || value.weight < 100 || value.weight > 900)) issues.push({ level: 'blocking', area: 'style', path: `${at}.weight`, message: 'Weight must be between 100 and 900.' });
    if (value.columns !== undefined && (typeof value.columns !== 'number' || value.columns < 1 || value.columns > 6)) issues.push({ level: 'blocking', area: 'style', path: `${at}.columns`, message: 'Columns must be between 1 and 6.' });
    if (value.gradient !== undefined) {
      const gradient = object(value.gradient);
      checkColorValue(issues, design, gradient.from, 'gradient start', `${at}.gradient.from`);
      checkColorValue(issues, design, gradient.to, 'gradient end', `${at}.gradient.to`);
      if (typeof gradient.angle !== 'number' || gradient.angle < 0 || gradient.angle > 360) issues.push({ level: 'blocking', area: 'style', path: `${at}.gradient.angle`, message: 'Gradient angle must be between 0 and 360.' });
    }
  }
}

function checkLinks(issues: Issue[], value: unknown, path: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 12) { issues.push({ level: 'blocking', area: 'link', path, message: 'Links must be an array of at most 12 entries.' }); return; }
  value.forEach((entry, index) => {
    const link = object(entry);
    checkText(issues, link.label, 60, 'Link label', `${path}[${index}]`, true);
    if (!isSafeHref(link.href)) issues.push({ level: 'blocking', area: 'link', path: `${path}[${index}].href`, message: 'Link must use a page path, HTTPS URL, email or phone link.' });
  });
}

function checkNodes(issues: Issue[], doc: SiteDocument, nodes: unknown, path: string, ids: Set<string>, depth: number, pageIds: { node: Set<string>; collection: string[] }): void {
  if (!Array.isArray(nodes)) { issues.push({ level: 'blocking', area: 'node', path, message: 'Nodes must be an array.' }); return; }
  if (!nodes.length) issues.push({ level: 'blocking', area: 'node', path, message: 'A container needs at least one child node.' });
  if (depth > LIMITS.depth) { issues.push({ level: 'blocking', area: 'node', path, message: `Node nesting exceeds the ${LIMITS.depth} level limit.` }); return; }
  nodes.forEach((raw, index) => {
    const node = object(raw) as unknown as Node;
    const at = `${path}[${index}]`;
    if (!ID.test(text(node.id)) || ids.has(text(node.id))) { issues.push({ level: 'blocking', area: 'node', path: at, message: 'Node id must be unique and lowercase.' }); return; }
    ids.add(text(node.id));
    pageIds.node.add(text(node.id));
    if (!(NODE_KINDS as readonly string[]).includes(String(node.kind))) { issues.push({ level: 'blocking', area: 'node', path: at, message: `Unknown node kind ${String(node.kind)}.` }); return; }
    if (node.kind === 'collection') pageIds.collection.push(text(node.id));
    checkStyle(issues, doc.design, node.style, `${at}.style`);
    const props = object(node.props);
    switch (node.kind) {
      case 'heading':
        checkText(issues, props.text, 300, 'Heading text', at, true);
        if (!HEADING_LEVELS.includes(Number(props.level))) issues.push({ level: 'blocking', area: 'node', path: at, message: 'Heading level must be 1, 2 or 3.' });
        break;
      case 'text':
        checkText(issues, props.text, 4000, 'Text', at, true);
        break;
      case 'image': {
        const asset = doc.assets.find((entry) => entry.id === props.asset);
        if (!asset || asset.kind !== 'image') issues.push({ level: 'blocking', area: 'asset', path: at, message: 'Image nodes reference a registered image asset.' });
        if (props.decorative !== undefined && typeof props.decorative !== 'boolean') issues.push({ level: 'blocking', area: 'asset', path: at, message: 'Decorative must be a boolean.' });
        if (props.alt !== undefined) checkText(issues, props.alt, 300, 'Alt text', at, false);
        break;
      }
      case 'video': {
        const asset = doc.assets.find((entry) => entry.id === props.asset);
        const remote = typeof props.url === 'string' ? props.url : '';
        if ((!asset || asset.kind !== 'video') && !(remote.startsWith('https://') && isSafeHref(remote))) {
          issues.push({ level: 'blocking', area: 'asset', path: at, message: 'Video nodes need a registered video asset or an HTTPS URL.' });
        }
        break;
      }
      case 'icon':
        checkText(issues, props.name, 40, 'Icon name', at, true);
        break;
      case 'list':
        if (!Array.isArray(props.items) || !props.items.length || props.items.length > 20) issues.push({ level: 'blocking', area: 'node', path: at, message: 'Lists hold 1 to 20 items.' });
        else (props.items as unknown[]).forEach((item, itemIndex) => checkText(issues, item, 300, 'List item', `${at}.items[${itemIndex}]`, true));
        break;
      case 'link':
        checkText(issues, props.label, 120, 'Link label', at, true);
        if (!isSafeHref(props.href)) issues.push({ level: 'blocking', area: 'node', path: at, message: 'Link nodes need a safe href.' });
        break;
      case 'button': {
        checkText(issues, props.label, 120, 'Button label', at, true);
        if (!isSafeHref(props.href)) issues.push({ level: 'blocking', area: 'node', path: at, message: 'Button nodes need a safe href.' });
        break;
      }
      case 'collection': {
        const bound = Array.isArray(props.items) ? props.items : [];
        if (props.title !== undefined) checkText(issues, props.title, 200, 'Collection title', at, false);
        if (props.empty !== undefined) checkText(issues, props.empty, 200, 'Empty text', at, false);
        bound.forEach((item, itemIndex) => checkText(issues, object(item).title, 200, 'Item title', `${at}.items[${itemIndex}]`, true));
        break;
      }
      case 'navigation':
      case 'footer':
        checkText(issues, props.brand, 120, 'Brand', at, true);
        if (props.text !== undefined) checkText(issues, props.text, 300, 'Footer text', at, false);
        checkLinks(issues, props.links, `${at}.links`);
        break;
      case 'menu':
        checkLinks(issues, props.links, `${at}.links`);
        checkText(issues, props.label, 40, 'Menu label', at, false);
        break;
      case 'tabs':
      case 'accordion':
        checkNodes(issues, doc, node.children ?? [], `${at}.children`, ids, depth + 1, pageIds);
        (node.children || []).forEach((child, childIndex) => {
          const label = object(object(child).props).label;
          if (!text(label).trim()) issues.push({ level: 'blocking', area: 'node', path: `${at}.children[${childIndex}]`, message: 'Tab and accordion children need a label.' });
        });
        break;
      case 'gallery':
        if (!Array.isArray(props.assets) || !props.assets.length || props.assets.length > 12 || props.assets.some((id) => !doc.assets.some((asset) => asset.id === id && asset.kind === 'image'))) {
          issues.push({ level: 'blocking', area: 'asset', path: at, message: 'Galleries reference 1 to 12 registered image assets.' });
        }
        break;
      case 'search':
        if (typeof props.target !== 'string') issues.push({ level: 'blocking', area: 'node', path: at, message: 'Search needs a collection target.' });
        break;
      case 'flex':
      case 'grid':
      case 'stack':
      case 'card':
      default:
        break;
    }
    const containers = ['flex', 'grid', 'stack', 'card'];
    const selfHandled = ['tabs', 'accordion'];
    if (containers.includes(node.kind) && (!Array.isArray(node.children) || !node.children.length)) {
      issues.push({ level: 'blocking', area: 'node', path: at, message: 'Layout containers need child nodes.' });
    } else if (!selfHandled.includes(node.kind) && Array.isArray(node.children) && node.children.length) {
      checkNodes(issues, doc, node.children, `${at}.children`, ids, depth + 1, pageIds);
    } else if (!selfHandled.includes(node.kind) && Array.isArray(node.children)) {
      issues.push({ level: 'blocking', area: 'node', path: at, message: 'Children must be a non-empty array.' });
    }
  });
}

function checkBindings(issues: Issue[], section: Section, path: string): void {
  const bindings = section.bindings || [];
  if (bindings.length > 1) issues.push({ level: 'blocking', area: 'binding', path, message: 'A section supports one data binding.' });
  bindings.forEach((raw, index) => {
    const binding = object(raw) as unknown as Binding;
    const at = `${path}.bindings[${index}]`;
    if (!ID.test(text(binding.id))) issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Binding id must be lowercase.' });
    if (binding.query !== 'catalog.public' && binding.query !== 'records.public') { issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Binding query is not registered.' }); return; }
    if (binding.version !== 1 || binding.access !== 'public') issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Binding version or access is invalid.' });
    if (!Number.isSafeInteger(binding.freshness) || binding.freshness < 0 || binding.freshness > 86_400) issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Binding freshness must be 0 to 86400 seconds.' });
    if (binding.limit !== undefined && (!Number.isSafeInteger(binding.limit) || binding.limit < 1 || binding.limit > 100)) issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Binding limit must be 1 to 100.' });
    if (binding.paginate !== undefined && (!Number.isSafeInteger(binding.paginate.size) || binding.paginate.size < 1 || binding.paginate.size > 24)) issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Page size must be 1 to 24.' });
    if (binding.detail !== undefined && !/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/:item$/.test(text(binding.detail.path))) issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Detail path must end with /:item.' });
    if (binding.empty !== undefined) checkText(issues, binding.empty.text, 200, 'Empty text', at, false);
    const params = object(binding.params);
    const records = Array.isArray(params.records) ? params.records : [];
    if (Object.keys(params).some((key) => !['records', 'channel', 'type'].includes(key))) issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Binding params accept records, channel and type only.' });
    if (!Array.isArray(records) || records.length > 100 || records.some((id) => typeof id !== 'string' || !/^[a-zA-Z0-9._:-]{1,160}$/.test(id)) || new Set(records).size !== records.length) {
      issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Binding records must be 0 to 100 unique record ids.' });
    }
    if (params.channel !== undefined && (typeof params.channel !== 'string' || !/^[a-zA-Z0-9-]{1,40}$/.test(params.channel))) issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Binding channel is invalid.' });
    if (binding.query === 'records.public') {
      if (!(PUBLIC_TYPES as readonly string[]).includes(String(params.type))) issues.push({ level: 'blocking', area: 'binding', path: at, message: `Public collections accept ${PUBLIC_TYPES.join(', ')}.` });
    }
    const collection = section.nodes.some((node) => node.kind === 'collection' && node.id === binding.slot);
    const anyCollection = section.nodes.some((node) => node.kind === 'collection');
    if (!anyCollection) issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Bindings need a collection node in the same section.' });
    else if (!collection && !section.nodes.some((node) => node.kind === 'collection' && (object(node.props).slot ?? node.id) === binding.slot)) {
      issues.push({ level: 'blocking', area: 'binding', path: at, message: 'Binding slot must name its collection node.' });
    }
  });
}

export function collectIssues(doc: SiteDocument): Issue[] {
  const issues: Issue[] = [];
  if (!doc || doc.schema !== DOCUMENT_VERSION) { issues.push({ level: 'blocking', area: 'document', path: 'schema', message: `Site document must use schema ${DOCUMENT_VERSION}.` }); return issues; }
  if (JSON.stringify(doc).length > LIMITS.document) issues.push({ level: 'blocking', area: 'document', path: 'document', message: 'Site document exceeds the size limit.' });
  if (!Number.isSafeInteger(doc.revision) || doc.revision < 0) issues.push({ level: 'blocking', area: 'document', path: 'revision', message: 'Revision must be a non-negative integer.' });
  if (!/^[A-Z]{3}$/.test(text(doc.currency))) issues.push({ level: 'blocking', area: 'document', path: 'currency', message: 'Currency must be a three-letter code.' });
  checkText(issues, doc.locale, 20, 'Locale', 'locale', true);
  checkText(issues, doc.timezone, 60, 'Timezone', 'timezone', true);
  checkText(issues, doc.brief?.goal, 300, 'Brief goal', 'brief.goal', false);
  checkText(issues, doc.brief?.audience, 300, 'Brief audience', 'brief.audience', false);
  checkText(issues, doc.brief?.tone, 300, 'Brief tone', 'brief.tone', false);
  // `category` is the retired archetype name; models below own it. Accepted, unvalidated, for one release.
  if (doc.blueprint) {
    const models = doc.blueprint.profile?.models;
    if (!Array.isArray(models) || !models.length) issues.push({ level: 'blocking', area: 'document', path: 'blueprint.profile.models', message: 'The blueprint must declare at least one commerce model.' });
    else if (models.some((model) => !(COMMERCE_MODELS as readonly string[]).includes(model))) issues.push({ level: 'blocking', area: 'document', path: 'blueprint.profile.models', message: 'Commerce models must be registered.' });
    const gate = doc.blueprint.gate;
    if (!gate || typeof gate.ok !== 'boolean' || !Array.isArray(gate.missing)) issues.push({ level: 'blocking', area: 'document', path: 'blueprint.gate', message: 'The blueprint must carry a gate result with its missing list.' });
    if (gate && gate.ok !== true && (!Array.isArray(gate.missing) || !gate.missing.length)) issues.push({ level: 'blocking', area: 'document', path: 'blueprint.gate.missing', message: 'A closed gate must name what the merchant still has to supply.' });
  }

  for (const report of auditDesign(doc.design)) issues.push({ level: report.level, area: `design.${report.area}`, path: 'design', message: report.message });
  for (const key of ['display', 'heading', 'body'] as const) {
    const stack = text(doc.design?.type?.[key]);
    if (!stack || !FONT_STACK.test(stack)) issues.push({ level: 'blocking', area: 'design.type', path: `design.type.${key}`, message: 'Font stacks use plain family names only.' });
  }
  if (doc.design?.direction && !(DENSITY_VALUES as readonly string[]).includes(text(doc.design.direction.density))) issues.push({ level: 'blocking', area: 'design.direction', path: 'design.direction.density', message: 'Density must be airy, balanced or compact.' });
  if (doc.design?.motion && !(EASING_VALUES as readonly string[]).includes(text(doc.design.motion.easing))) issues.push({ level: 'blocking', area: 'design.motion', path: 'design.motion.easing', message: 'Easing must be linear, ease, easeout or easeinout.' });

  if (doc.assets.length > LIMITS.assets) issues.push({ level: 'blocking', area: 'asset', path: 'assets', message: `A site holds at most ${LIMITS.assets} assets.` });
  const assetIds = new Set<string>();
  doc.assets.forEach((asset, index) => {
    const at = `assets[${index}]`;
    if (!ID.test(text(asset.id)) || assetIds.has(asset.id)) issues.push({ level: 'blocking', area: 'asset', path: at, message: 'Asset id must be unique and lowercase.' });
    assetIds.add(text(asset.id));
    if (!MIME_BY_KIND[asset.kind]?.includes(asset.mime)) issues.push({ level: 'blocking', area: 'asset', path: at, message: `Asset type ${asset.mime} is not allowed for ${asset.kind}.` });
    if (!HASH.test(text(asset.hash))) issues.push({ level: 'blocking', area: 'asset', path: at, message: 'Asset hash must be a SHA-256 hex digest.' });
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > 8_000_000) issues.push({ level: 'blocking', area: 'asset', path: at, message: 'Asset size must be between 1 byte and 8MB.' });
    if (!text(asset.rights?.source).trim() || !text(asset.rights?.license).trim()) issues.push({ level: 'blocking', area: 'asset', path: at, message: 'Assets carry source and license provenance.' });
    if (asset.alt !== undefined) checkText(issues, asset.alt, 300, 'Alt text', at, false);
  });

  if (!Array.isArray(doc.pages) || !doc.pages.length || doc.pages.length > LIMITS.pages) { issues.push({ level: 'blocking', area: 'page', path: 'pages', message: `A site holds 1 to ${LIMITS.pages} pages.` }); return issues; }
  const pageIds = new Set<string>();
  const paths = new Set<string>();
  let totalNodes = 0;
  doc.pages.forEach((page, index) => {
    const at = `pages[${index}]`;
    if (!ID.test(text(page.id)) || pageIds.has(page.id)) issues.push({ level: 'blocking', area: 'page', path: at, message: 'Page id must be unique and lowercase.' });
    pageIds.add(text(page.id));
    if (!PATH.test(text(page.path)) || paths.has(page.path) || RESERVED_PATHS.some((reserved) => page.path === reserved || page.path.startsWith(`${reserved}/`))) issues.push({ level: 'blocking', area: 'page', path: at, message: 'Page path must be unique, lowercase and outside reserved routes.' });
    paths.add(text(page.path));
    checkText(issues, page.title, 200, 'Page title', at, true);
    if (page.meta !== undefined) {
      checkText(issues, page.meta.description, 300, 'Page description', at, false);
      checkText(issues, page.meta.ogImage, 8, 'OG image flag', at, false);
      if (page.meta.ogImage !== undefined && page.meta.ogImage !== 'auto') issues.push({ level: 'blocking', area: 'page', path: at, message: 'OG image is compiled from the first image asset, not set directly.' });
    }
    if (!Array.isArray(page.sections) || !page.sections.length || page.sections.length > LIMITS.sections) { issues.push({ level: 'blocking', area: 'section', path: at, message: `A page holds 1 to ${LIMITS.sections} sections.` }); return; }
    const sectionIds = new Set<string>();
    const nodeIds = { node: new Set<string>(), collection: [] as string[] };
    page.sections.forEach((section, sectionIndex) => {
      const sat = `${at}.sections[${sectionIndex}]`;
      if (!ID.test(text(section.id)) || sectionIds.has(section.id)) issues.push({ level: 'blocking', area: 'section', path: sat, message: 'Section id must be unique and lowercase.' });
      sectionIds.add(text(section.id));
      if (!ID.test(text(section.purpose))) issues.push({ level: 'blocking', area: 'section', path: sat, message: 'Section purpose must be a lowercase word.' });
      if (!(SECTION_LAYOUTS as readonly string[]).includes(text(object(section.layout).kind))) issues.push({ level: 'blocking', area: 'section', path: sat, message: 'Section layout kind is invalid.' });
      const columns = object(section.layout).columns;
      if (columns !== undefined && (typeof columns !== 'number' || columns < 1 || columns > 6)) issues.push({ level: 'blocking', area: 'section', path: sat, message: 'Section columns must be 1 to 6.' });
      checkLayout(issues, doc.design, section.layout, `${sat}.layout`);
      checkStyle(issues, doc.design, section.style, `${sat}.style`);
      if (!Array.isArray(section.nodes) || section.nodes.length > LIMITS.nodes) { issues.push({ level: 'blocking', area: 'section', path: sat, message: `A section holds at most ${LIMITS.nodes} nodes.` }); return; }
      totalNodes += section.nodes.length;
      // Chrome sections render from the document itself, so an empty one is honest.
      if (!section.nodes.length && section.purpose !== 'header' && section.purpose !== 'footer') {
        issues.push({ level: 'blocking', area: 'node', path: `${sat}.nodes`, message: 'A container needs at least one child node.' });
      } else if (section.nodes.length) {
        checkNodes(issues, doc, section.nodes, `${sat}.nodes`, nodeIds.node, 1, nodeIds);
      }
      checkBindings(issues, section, sat);
    });
    const headings = page.sections.flatMap((section) => section.nodes.filter((node) => node.kind === 'heading'));
    const levelOne = headings.filter((node) => Number(object(node.props).level) === 1);
    if (levelOne.length !== 1) issues.push({ level: 'blocking', area: 'a11y', path: at, message: 'Each page needs exactly one level-one heading.' });
    if (!page.sections.some((section) => section.nodes.some((node) => node.kind === 'navigation'))) issues.push({ level: 'advisory', area: 'a11y', path: at, message: 'Every page benefits from a navigation section.' });
    if (!page.sections.some((section) => section.nodes.some((node) => node.kind === 'footer'))) issues.push({ level: 'advisory', area: 'a11y', path: at, message: 'Every page benefits from a footer.' });
  });
  if (totalNodes > 1000) issues.push({ level: 'blocking', area: 'node', path: 'pages', message: 'The site holds too many nodes for one build.' });

  const variantIds = new Set<string>();
  for (const page of doc.pages) for (const section of page.sections) {
    variantIds.add(text(section.id));
    const gather = (nodes: Node[]) => nodes.forEach((node) => { variantIds.add(node.id); gather(node.children || []); });
    gather(section.nodes);
  }
  const personaIds = new Set<string>();
  if (doc.personas !== undefined) {
    if (!Array.isArray(doc.personas) || doc.personas.length > 4) issues.push({ level: 'blocking', area: 'persona', path: 'personas', message: 'A site compiles at most four persona variants.' });
    doc.personas.forEach((persona, index) => {
      const at = `personas[${index}]`;
      if (!ID.test(text(persona.id)) || personaIds.has(persona.id)) issues.push({ level: 'blocking', area: 'persona', path: at, message: 'Persona id must be unique and lowercase.' });
      personaIds.add(text(persona.id));
      if (!Number.isSafeInteger(persona.priority) || persona.priority < 1 || persona.priority > 100) issues.push({ level: 'blocking', area: 'persona', path: at, message: 'Persona priority must be 1 to 100.' });
      const when = object(persona.when);
      if (Object.keys(when).some((key) => !['channel', 'device', 'returning'].includes(key))) issues.push({ level: 'blocking', area: 'persona', path: at, message: 'Persona conditions accept channel, device and returning.' });
      if (when.channel !== undefined && !/^[a-z][a-z0-9-]{0,39}$/.test(text(when.channel))) issues.push({ level: 'blocking', area: 'persona', path: at, message: 'Persona channel must be a lowercase word.' });
      if (when.device !== undefined && !['mobile', 'tablet', 'desktop'].includes(text(when.device))) issues.push({ level: 'blocking', area: 'persona', path: at, message: 'Persona device must be mobile, tablet or desktop.' });
      if (when.returning !== undefined && typeof when.returning !== 'boolean') issues.push({ level: 'blocking', area: 'persona', path: at, message: 'Persona returning must be true or false.' });
      if (!Object.keys(when).length) issues.push({ level: 'blocking', area: 'persona', path: at, message: 'A persona variant needs at least one condition.' });
      for (const list of [persona.hide, persona.order]) {
        if (list === undefined) continue;
        if (!Array.isArray(list) || list.length > 40 || list.some((entry) => !variantIds.has(text(entry)))) issues.push({ level: 'blocking', area: 'persona', path: at, message: 'Persona targets must name up to 40 existing sections or nodes.' });
      }
      const tones = object(persona.tone);
      for (const [target, value] of Object.entries(tones)) {
        if (!variantIds.has(target) || !TONE_KEYS.includes(String(value))) issues.push({ level: 'blocking', area: 'persona', path: at, message: 'Persona tones retint an existing target with a registered tone.' });
      }
    });
  }

  if (doc.claims !== undefined) {
    if (!Array.isArray(doc.claims) || doc.claims.length > 40) issues.push({ level: 'blocking', area: 'claim', path: 'claims', message: 'Claims must be a list of at most 40 entries.' });
    else doc.claims.forEach((claim, index) => {
      const at = `claims[${index}]`;
      checkText(issues, claim?.text, 300, 'Claim text', at, true);
      if (!['supported', 'contradicted', 'unsupported'].includes(String(claim?.verdict))) issues.push({ level: 'blocking', area: 'claim', path: at, message: 'Claim verdict must be supported, contradicted or unsupported.' });
    });
  }

  const redirects = new Set<string>();
  doc.redirects.forEach((redirect, index) => {
    const at = `redirects[${index}]`;
    if (!PATH.test(text(redirect.from)) || redirect.from === '/' || redirects.has(redirect.from)) issues.push({ level: 'blocking', area: 'redirect', path: at, message: 'Redirect source must be a unique path.' });
    redirects.add(text(redirect.from));
    if (!PATH.test(text(redirect.to)) || redirect.to === redirect.from) issues.push({ level: 'blocking', area: 'redirect', path: at, message: 'Redirect target must be a different path.' });
    if (redirect.status !== 308) issues.push({ level: 'blocking', area: 'redirect', path: at, message: 'Redirects use the permanent 308 status.' });
    if (paths.has(redirect.from)) issues.push({ level: 'blocking', area: 'redirect', path: at, message: 'A redirect source cannot also be a page.' });
  });

  const lockIds = new Set<string>(['brand']);
  for (const page of doc.pages) for (const section of page.sections) {
    lockIds.add(section.id);
    const collect = (nodes: Node[]) => nodes.forEach((node) => { lockIds.add(node.id); if (node.children) collect(node.children); });
    collect(section.nodes);
  }
  for (const lock of doc.locks) {
    if (!['section', 'node', 'token', 'brand'].includes(lock.kind)) issues.push({ level: 'blocking', area: 'lock', path: `lock.${lock.target}`, message: 'Lock kind is invalid.' });
    const known = lock.kind === 'token' ? isTokenRef(lock.target) && resolveToken(doc.design, lock.target) !== undefined : lockIds.has(lock.target);
    if (!known) issues.push({ level: 'blocking', area: 'lock', path: `lock.${lock.target}`, message: `Locked target ${lock.target} does not exist.` });
    if (!Number.isSafeInteger(lock.at)) issues.push({ level: 'blocking', area: 'lock', path: `lock.${lock.target}`, message: 'Lock timestamp is invalid.' });
  }
  return issues;
}

export function validateDocument(doc: unknown): asserts doc is SiteDocument {
  const issues = collectIssues(doc as SiteDocument);
  const blocking = issues.filter((issue) => issue.level === 'blocking');
  if (blocking.length) {
    const summary = blocking.slice(0, 3).map((issue) => `${issue.path}: ${issue.message}`).join(' ');
    throw badRequest(`Site document is invalid. ${summary}`);
  }
}
