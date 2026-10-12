/**
 * Deterministic parser for `designmds/*.md` style references, and the resolver that
 * turns a parsed reference plus signed tags into shippable design tokens.
 *
 * No AI, no fs: the digest script reads the files and hands the text to these functions.
 * Roles are read from the source tables; readability floors are applied here, so the
 * reference keeps its identity and the code keeps the guarantee (parai D7).
 */

import { contrast, ensureContrast, isGradient, isHex, labelOn, mix } from '../contrast.ts';
import { GROTESK, MONO, SANS, SERIF } from '../fonts.ts';
import {
  ROLE_KEYWORDS,
  TOKENS_VERSION,
  type ColorRole,
  type DesignTags,
  type DesignTokens,
  type FontBlock,
  type ParsedReference,
  type RadiusRow,
  type ScaleRow,
  type SourceColor,
} from './contract.ts';

const PLACEHOLDER = /^[\u2014\u2013\u2015-]$/;
const DASH = ' — ';

/** Default modular scale; the renderer types only body, heading and display. */
const TYPE_SCALE = 1.25;
const DEFAULT_SUCCESS = '#16a34a';
const DEFAULT_DANGER = '#dc2626';
const DEFAULT_CONTAINER = 1200;
const DEFAULT_SECTION = 96;
const MIN_TYPE_BASE = 16;

function cleanCell(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length > 1) return trimmed.slice(1, -1).trim();
  return trimmed;
}

function cells(line: string): string[] {
  const parts = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  return parts.map((part) => cleanCell(part));
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:-]*-[\s:|-]*$/.test(line) && line.includes('|');
}

/** Parse a length in px or rem, a range (`80-120px`), or a bare number. */
export function lengthValue(raw?: string): number | undefined {
  if (!raw || PLACEHOLDER.test(raw)) return undefined;
  const range = /(-?\d*\.?\d+)\s*(?:px|rem)?\s*[-\u2013\u2014]\s*(-?\d*\.?\d+)\s*(px|rem)/i.exec(raw);
  if (range) {
    const from = Number(range[1]) * (range[3].toLowerCase() === 'rem' ? 16 : 1);
    const to = Number(range[2]) * (range[3].toLowerCase() === 'rem' ? 16 : 1);
    return Math.round((from + to) / 2);
  }
  const single = /(-?\d*\.?\d+)\s*(px|rem|%)/i.exec(raw);
  if (single) {
    const number = Number(single[1]);
    if (single[2].toLowerCase() === 'rem') return Math.round(number * 16);
    if (single[2] === '%') return undefined;
    return number;
  }
  const bare = /^-?\d*\.?\d+$/.test(raw) ? Number(raw) : Number.NaN;
  return Number.isFinite(bare) ? bare : undefined;
}

function numberList(raw?: string): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => lengthValue(part.trim()))
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
}

/** Letter spacing in em, from either `-2.378px` at a known size or `0.037em`. */
function emValue(raw?: string, size?: number): number | undefined {
  if (!raw || PLACEHOLDER.test(raw) || /normal/i.test(raw)) return undefined;
  const em = /(-?\d*\.?\d+)\s*em/i.exec(raw);
  if (em) return Number(em[1]);
  const px = /(-?\d*\.?\d+)\s*px/i.exec(raw);
  if (px && size) return Number(px[1]) / size;
  return undefined;
}

function headingText(line: string): string {
  return line.replace(/^#+\s*/, '').trim();
}

function fontBlockHeader(text: string): FontBlock | null {
  if (!text.includes(DASH)) return null;
  const family = text.slice(0, text.indexOf(DASH)).trim();
  if (!family) return null;
  let rest = text.slice(text.indexOf(DASH) + DASH.length).trim();
  let token = '';
  const marker = rest.lastIndexOf('·');
  if (marker >= 0) {
    token = cleanCell(rest.slice(marker + 1).trim());
    rest = rest.slice(0, marker).trim();
  }
  return { family, role: rest, token, weights: [], sizes: [], leading: [] };
}

export function parseDesignMd(markdown: string, file = ''): ParsedReference {
  const ref: ParsedReference = {
    file,
    brand: '',
    vibe: '',
    theme: '',
    colors: [],
    gradients: [],
    fonts: [],
    scale: [],
    spacing: [],
    radii: [],
    notes: [],
  };

  let area = 'head';
  let sub = '';
  let font: FontBlock | null = null;

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('## ')) {
      const title = headingText(line).toLowerCase();
      area = title.includes('colors') ? 'colors'
        : title.includes('typography') ? 'typography'
        : title.includes('spacing') ? 'spacing'
        : 'prose';
      sub = '';
      font = null;
      continue;
    }

    if (line.startsWith('# ') && !ref.brand) {
      const title = headingText(line);
      ref.brand = title.includes(DASH) ? title.slice(0, title.indexOf(DASH)).trim() : title;
      area = 'head';
      continue;
    }

    if (line.startsWith('> ') && !ref.vibe && area === 'head') {
      ref.vibe = line.slice(2).trim();
      continue;
    }

    if (line.startsWith('### ')) {
      sub = headingText(line);
      if (area === 'typography' && sub.toLowerCase() !== 'type scale') {
        font = fontBlockHeader(sub);
        if (font) ref.fonts.push(font);
      } else {
        font = null;
      }
      continue;
    }

    const labelled = /^\*\*(.+?):\*\*\s*(.*)$/i.exec(line.startsWith('- ') ? line.slice(2) : line);
    if (labelled) {
      const key = labelled[1].trim().toLowerCase();
      const value = labelled[2].trim();
      if (key === 'theme') ref.theme = value.toLowerCase();
      else if (key === 'base unit' && ref.baseUnit === undefined) ref.baseUnit = lengthValue(value);
      else if (key === 'density' && !ref.densityWord) ref.densityWord = value.toLowerCase();
      else if (area === 'spacing' && key === 'section gap' && ref.sectionGapRaw === undefined) {
        ref.sectionGapRaw = value;
        ref.sectionGap = lengthValue(value);
        if (ref.sectionGap !== undefined && /[-\u2013\u2014]/.test(value)) {
          ref.notes.push(`Section gap "${value}" read as its midpoint ${ref.sectionGap}px.`);
        }
      } else if (area === 'spacing' && key === 'card padding' && ref.cardPadding === undefined) ref.cardPadding = lengthValue(value);
      else if (area === 'spacing' && key === 'element gap' && ref.elementGap === undefined) ref.elementGap = lengthValue(value);
      else if (area === 'spacing' && key === 'page max-width' && ref.maxWidth === undefined) ref.maxWidth = lengthValue(value);
      else if (font && area === 'typography') {
        if (key === 'substitute') font.substitute = value;
        else if (key === 'weights') font.weights = numberList(value);
        else if (key === 'sizes') font.sizes = numberList(value);
        else if (key === 'line height') font.leading = numberList(value);
      }
      continue;
    }

    if (!isTableRow(line)) continue;
    if (isSeparatorRow(line)) continue;
    const row = cells(line);
    const head = row[0]?.toLowerCase();
    if (head === 'name' || head === 'role' || head === 'element' || head === 'level' || head === 'token') continue;

    if (area === 'colors') {
      const [name, value, token, role] = row;
      if (!value) continue;
      const entry: SourceColor = {
        name: name ?? '',
        value,
        token: token ?? '',
        role: role ?? '',
        text: `${(name ?? '').toLowerCase()} ${(role ?? '').toLowerCase()}`,
      };
      if (isGradient(value)) ref.gradients.push(entry);
      else if (isHex(value)) ref.colors.push(entry);
      else ref.notes.push(`Colour "${name}" value "${value}" is not a plain hex or gradient.`);
      continue;
    }

    if (area === 'typography' && sub.toLowerCase() === 'type scale') {
      const [role, family, weight, size, leading, tracking, token] = row;
      if (!role) continue;
      const parsedSize = lengthValue(size);
      const row_: ScaleRow = {
        role: role.toLowerCase(),
        family: family && !PLACEHOLDER.test(family) ? family : undefined,
        weight: weight && !PLACEHOLDER.test(weight) ? Number(weight) : undefined,
        size: parsedSize,
        leading: leading && !PLACEHOLDER.test(leading) ? Number(leading) : undefined,
        tracking: emValue(tracking, parsedSize),
        token: token ?? '',
      };
      if (size && !PLACEHOLDER.test(size) && row_.size === undefined) ref.notes.push(`Type scale "${role}" size "${size}" is not a px or rem length.`);
      ref.scale.push(row_);
      continue;
    }

    if (area === 'spacing' && sub.toLowerCase() === 'spacing scale') {
      const value = lengthValue(row[1] ?? row[0]);
      if (value !== undefined) ref.spacing.push(value);
      else if (row[1]) ref.notes.push(`Spacing step "${row[0]}" value "${row[1]}" is not a px or rem length.`);
      continue;
    }

    if (area === 'spacing' && sub.toLowerCase() === 'border radius') {
      const value = lengthValue(row[1]);
      const element = (row[0] ?? '').toLowerCase();
      if (value !== undefined && element) ref.radii.push({ element, value } satisfies RadiusRow);
      else if (row[1]) ref.notes.push(`Radius "${row[0]}" value "${row[1]}" is not a px or rem length.`);
      continue;
    }
  }

  if (ref.baseUnit === undefined && ref.spacing.length) {
    ref.baseUnit = Math.min(...ref.spacing);
    ref.notes.push(`No Base unit stated; used the smallest spacing step ${ref.baseUnit}px.`);
  }
  return ref;
}

/** Status colours are named, not described; prose like "forest greens" must not claim them. */
const NAMED_ROLES = new Set<ColorRole>(['success', 'danger']);

/** Highest-scoring source colour for a role: earliest keyword match, then table order. */
export function pickRole(ref: ParsedReference, role: ColorRole): SourceColor | undefined {
  const keywords = ROLE_KEYWORDS[role];
  const byName = NAMED_ROLES.has(role);
  let best: SourceColor | undefined;
  let bestScore = 0;
  for (const color of ref.colors) {
    const haystack = (byName ? color.name : color.text).toLowerCase();
    const index = keywords.findIndex((keyword) => haystack.includes(keyword));
    if (index < 0) continue;
    const score = keywords.length - index;
    if (score > bestScore) {
      bestScore = score;
      best = color;
    }
  }
  return best;
}

function radiusFor(ref: ParsedReference, ...elements: string[]): number | undefined {
  for (const element of elements) {
    const row = ref.radii.find((entry) => entry.element === element || entry.element.includes(element));
    if (row) return row.value;
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fontBlockFor(ref: ParsedReference, name?: string, roleHint?: string): FontBlock | undefined {
  if (name) {
    const wanted = name.toLowerCase();
    const exact = ref.fonts.find((block) => block.family.toLowerCase() === wanted);
    if (exact) return exact;
    const partial = ref.fonts.find((block) => wanted.includes(block.family.toLowerCase()) || block.family.toLowerCase().includes(wanted));
    if (partial) return partial;
  }
  if (roleHint) {
    const described = ref.fonts.filter((block) => !/detected in extracted data/.test(block.role));
    const leading = described.find((block) => block.role.toLowerCase().startsWith(roleHint));
    if (leading) return leading;
    const mentioned = described.find((block) => block.role.toLowerCase().includes(roleHint));
    if (mentioned) return mentioned;
  }
  return undefined;
}

function stackFor(block: FontBlock | undefined): string {
  if (!block) return SANS;
  const identity = `${block.family} ${block.token}`.toLowerCase();
  const generic = /mono|plex|consolas|menlo/.test(identity) ? MONO
    : /serif|georgia|times|minion|playfair|adamina|garamond/.test(identity) ? SERIF
    : /grotesk|helvetica|system/.test(identity) ? GROTESK
    : SANS;
  const names = [block.family, (block.substitute ?? '').split(',')[0].trim()]
    .map((name) => name.replace(/\s+at\b.*$/, '').trim())
    .filter((name) => /^[A-Za-z][A-Za-z .-]{1,30}$/.test(name))
    .filter((name) => !/^(sans-serif|serif|monospace|system-ui|ui-sans-serif)$/.test(name.toLowerCase()));
  const unique = [...new Set(names.map((name) => name.toLowerCase()))].map((lower) => names.find((name) => name.toLowerCase() === lower) as string);
  const quoted = unique.map((name) => `"${name}"`).join(', ');
  return quoted ? `${quoted}, ${generic}` : generic;
}

function scaleRowFor(ref: ParsedReference, roles: string[]): ScaleRow | undefined {
  for (const role of roles) {
    const exact = ref.scale.find((row) => row.role === role);
    if (exact) return exact;
  }
  for (const role of roles) {
    const partial = ref.scale.find((row) => row.role.includes(role));
    if (partial) return partial;
  }
  return undefined;
}

function maxWeight(block: FontBlock | undefined, ceiling = 700): number | undefined {
  const allowed = (block?.weights ?? []).filter((weight) => weight <= ceiling);
  return allowed.length ? Math.max(...allowed) : undefined;
}

function sectionSpace(ref: ParsedReference): number {
  const steps = [...ref.spacing].sort((a, b) => a - b);
  const gap = ref.sectionGap;
  if (gap === undefined || !steps.length) return DEFAULT_SECTION;
  const target = gap * 2;
  const roomy = steps.find((step) => step >= target);
  if (roomy !== undefined) return roomy;
  return steps[steps.length - 1];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Effective legibility margin: the tighter of the two required pairs. */
export function paletteContrast(color: DesignTokens['color']): number {
  const body = contrast(color.ink, color.canvas) ?? 0;
  const button = contrast(color.accentink, color.accent) ?? 0;
  return round2(Math.min(body, button));
}

export function resolveTokens(ref: ParsedReference, tags: DesignTags, source: { file: string; hash: string }): DesignTokens {
  const paper = pickRole(ref, 'canvas')?.value ?? '#ffffff';
  const surface = pickRole(ref, 'surface')?.value ?? paper;
  const notes = [...ref.notes];

  let ink = pickRole(ref, 'ink')?.value ?? '#111111';
  const inkBefore = ink;
  ink = ensureContrast(ensureContrast(ink, paper, 4.5), surface, 4.5);
  if (ink !== inkBefore) notes.push(`Body ink ${inkBefore} darkened to ${ink} to hold 4.5:1 on paper.`);

  const accent = pickRole(ref, 'accent')?.value ?? ink;
  const labelled = pickRole(ref, 'accentink')?.value;
  const accentInk = labelled && (contrast(labelled, accent) ?? 0) >= 4.5 ? labelled : labelOn(accent);
  if (accentInk !== paper) notes.push(`Button labels use ${accentInk} rather than paper to hold 4.5:1 on the accent.`);

  const borderBefore = pickRole(ref, 'border')?.value;
  const border = ensureContrast(borderBefore ?? mix(ink, paper, 0.12), paper, 1.2);
  if (borderBefore && border !== borderBefore) notes.push(`Hairline border ${borderBefore} deepened to ${border} so it reads on paper.`);

  const mutedBefore = pickRole(ref, 'muted')?.value;
  const muted = ensureContrast(ensureContrast(mutedBefore ?? mix(ink, paper, 0.45), paper, 4.5), surface, 4.5);
  if (mutedBefore && muted !== mutedBefore) notes.push(`Secondary text ${mutedBefore} darkened to ${muted} to hold 4.5:1.`);

  const displayRow = scaleRowFor(ref, ['display', 'hero-heading', 'section-heading']);
  const headingRow = scaleRowFor(ref, ['section-heading', 'heading', 'product-card-heading', 'display']);
  const bodyRow = scaleRowFor(ref, ['body', 'nav', 'testimonial']);

  const displayBlock = fontBlockFor(ref, displayRow?.family, 'display');
  const headingBlock = fontBlockFor(ref, headingRow?.family, 'heading') ?? displayBlock;
  const bodyBlock = fontBlockFor(ref, bodyRow?.family, 'body') ?? headingBlock;

  const unit = ref.baseUnit ?? 8;
  const cards = radiusFor(ref, 'cards', 'card', 'buttons');
  const media = radiusFor(ref, 'media', 'images', 'other');
  const pill = radiusFor(ref, 'pills', 'pill', 'tags');
  const md = cards ?? unit * 2;
  const lg = Math.max(md, media ?? md);

  if (ref.baseUnit === undefined) notes.push(`No Base unit stated; spacing floor ${unit}px.`);

  return {
    version: TOKENS_VERSION,
    id: tags.id,
    tone: tags.tone,
    density: tags.density,
    direction: tags.direction,
    color: {
      canvas: paper,
      ink,
      accent,
      accentink: accentInk,
      surface,
      border,
      muted,
      success: pickRole(ref, 'success')?.value ?? DEFAULT_SUCCESS,
      danger: pickRole(ref, 'danger')?.value ?? DEFAULT_DANGER,
    },
    gradients: ref.gradients.map((entry) => ({ name: entry.name, value: entry.value })),
    type: {
      display: stackFor(displayBlock),
      heading: stackFor(headingBlock),
      body: stackFor(bodyBlock),
      base: Math.max(MIN_TYPE_BASE, bodyRow?.size ?? MIN_TYPE_BASE),
      scale: TYPE_SCALE,
      leading: clamp(bodyRow?.leading ?? 1.5, 1.4, 1.7),
      weight: headingRow?.weight ?? maxWeight(headingBlock) ?? 600,
      tracking: round2(clamp(displayRow?.tracking ?? 0, -0.03, 0.05)),
    },
    space: {
      unit,
      section: sectionSpace(ref),
      container: ref.maxWidth ?? DEFAULT_CONTAINER,
    },
    shape: { sm: unit, md, lg, pill: pill ?? 9999 },
    guidance: tags.guidance,
    notes,
    source: { file: source.file, hash: source.hash, brand: ref.brand, license: { kind: tags.license.kind, note: tags.license.note } },
  };
}
