/**
 * Site design system: 3 design tokens (typography, tone, density),
 * WCAG contrast audit, token resolution, and design reference import/export.
 *
 * Jev picks tokens and sections; content always comes from Facts.
 */

import { DENSITY_VALUES, EASING_VALUES, LIMITS, type Style } from './document.ts';
import type { TypographyToken, ToneToken, DensityToken } from './blueprint.ts';
import { contrast } from './contrast.ts';
import { CODE_FLOORS, designFor } from './designs/library.ts';
import { GROTESK, MONO, SANS, SERIF } from './fonts.ts';

export { contrast, ensureContrast, hexRgb, isGradient, isHex, labelOn, luminance, mix } from './contrast.ts';
export { GROTESK, MONO, SANS, SERIF } from './fonts.ts';

export interface DesignDirection {
  audience: string;
  purpose: string;
  voice: string;
  density: string;
  idea: string;
}

export interface DesignColor {
  canvas: string;
  ink: string;
  accent: string;
  accentink: string;
  surface: string;
  border: string;
  muted: string;
  success: string;
  danger: string;
}

export interface DesignType {
  display: string;
  heading: string;
  body: string;
  base: number;
  scale: number;
  leading: number;
  weight: number;
  tracking?: number;
}

export interface DesignSpace {
  unit: number;
  section: number;
  container: number;
}

export interface DesignShape {
  sm: number;
  md: number;
  lg: number;
  pill: number;
}

export interface DesignElevation {
  low: number;
  high: number;
}

export interface DesignLayout {
  columns: number;
  gap: number;
  align: 'start' | 'center';
}

export interface DesignMotion {
  duration: number;
  easing: string;
  reduce: boolean;
}

export interface DesignDecision {
  area: string;
  question: string;
  choice: string;
  alternatives?: string[];
  note?: string;
}

export interface DesignSource {
  reference: string;
  hash: string;
  revision: number;
  decisions: DesignDecision[];
}

export interface Design {
  theme: string;
  direction: DesignDirection;
  color: DesignColor;
  type: DesignType;
  space: DesignSpace;
  shape: DesignShape;
  elevation: DesignElevation;
  layout: DesignLayout;
  motion: DesignMotion;
  guidance: string[];
  source?: DesignSource;
}

export const FONT_STACKS: Record<TypographyToken, { display: string; heading: string; body: string }> = {
  sans: { display: SANS, heading: SANS, body: SANS },
  serif: { display: SERIF, heading: SERIF, body: SANS },
  grotesk: { display: GROTESK, heading: GROTESK, body: GROTESK },
};

export const TONE_COLORS: Record<ToneToken, DesignColor> = {
  canvas: {
    canvas: '#ffffff',
    ink: '#000000',
    accent: '#18181b',
    accentink: '#ffffff',
    surface: '#f4f4f5',
    border: '#e4e4e7',
    muted: '#71717a',
    success: '#16a34a',
    danger: '#dc2626',
  },
  surface: {
    canvas: '#edebe4',
    ink: '#1c1917',
    accent: '#292524',
    accentink: '#ffffff',
    surface: '#e5e2da',
    border: '#d8d4c9',
    muted: '#78716c',
    success: '#16a34a',
    danger: '#dc2626',
  },
  ink: {
    canvas: '#111111',
    ink: '#f8fafc',
    accent: '#ffffff',
    accentink: '#111111',
    surface: '#1c1c1f',
    border: '#27272a',
    muted: '#94a3b8',
    success: '#22c55e',
    danger: '#ef4444',
  },
};

export function densitySpace(density: DensityToken = 2): DesignSpace {
  if (density === 1) return { unit: 6, section: 64, container: 1200 };
  if (density === 3) return { unit: 12, section: 128, container: 1200 };
  return { unit: 8, section: 96, container: 1200 };
}

export function createDesign(
  typography: TypographyToken = 'sans',
  tone: ToneToken = 'canvas',
  density: DensityToken = 2,
  brief: { audience?: string; goal?: string; tone?: string } = {},
): Design {
  const fonts = FONT_STACKS[typography] || FONT_STACKS.sans;
  const colors = TONE_COLORS[tone] || TONE_COLORS.canvas;
  const space = densitySpace(density);
  const densityWord = density === 1 ? 'compact' : density === 3 ? 'airy' : 'balanced';

  return {
    theme: tone,
    direction: {
      audience: brief.audience || 'Local customers and visitors',
      purpose: brief.goal || 'Storefront',
      voice: brief.tone || 'Warm, authentic and direct',
      density: densityWord,
      idea: 'Zero-touch autonomous storefront',
    },
    color: { ...colors },
    type: {
      display: fonts.display,
      heading: fonts.heading,
      body: fonts.body,
      base: 16,
      scale: 1.25,
      leading: 1.5,
      weight: 600,
      tracking: typography === 'grotesk' ? 0.01 : 0,
    },
    space,
    shape: { sm: 4, md: 8, lg: 16, pill: 9999 },
    elevation: { ...CODE_FLOORS.elevation },
    layout: { ...CODE_FLOORS.layout },
    motion: { ...CODE_FLOORS.motion },
    guidance: ['Under 150 KB static HTML', 'No heavy animation', 'Tamil font stack supported'],
  };
}

/**
 * The built library is the only design catalog; the generated import map is rewritten by
 * `npm run designs` from designmds/*.md, and ids that predate that migration resolve there.
 */
export const DEFAULT_DESIGN = designFor(null);

export function resolveDesign(themeId?: string | null): Design {
  return designFor(themeId);
}

export const COLOR_KEYS: readonly (keyof DesignColor)[] = [
  'canvas', 'ink', 'accent', 'accentink', 'surface', 'border', 'muted', 'success', 'danger',
];

export const TONE_STYLE: Record<string, Style> = {
  canvas: { background: 'token:color.canvas', color: 'token:color.ink' },
  surface: { background: 'token:color.surface', color: 'token:color.ink' },
  ink: { background: 'token:color.ink', color: 'token:color.canvas' },
  accent: { background: 'token:color.accent', color: 'token:color.accentink' },
};
export const TONE_KEYS: readonly string[] = Object.keys(TONE_STYLE);

interface TokenEntry { group: string; key: string; kind: 'color' | 'number' | 'font' | 'enum' }

export const TOKENS: readonly TokenEntry[] = [
  ...COLOR_KEYS.map((key) => ({ group: 'color', key, kind: 'color' as const })),
  { group: 'type', key: 'display', kind: 'font' }, { group: 'type', key: 'heading', kind: 'font' },
  { group: 'type', key: 'body', kind: 'font' }, { group: 'type', key: 'base', kind: 'number' },
  { group: 'type', key: 'scale', kind: 'number' }, { group: 'type', key: 'leading', kind: 'number' },
  { group: 'type', key: 'weight', kind: 'number' }, { group: 'type', key: 'tracking', kind: 'number' },
  { group: 'space', key: 'unit', kind: 'number' }, { group: 'space', key: 'section', kind: 'number' },
  { group: 'space', key: 'container', kind: 'number' },
  { group: 'shape', key: 'sm', kind: 'number' }, { group: 'shape', key: 'md', kind: 'number' },
  { group: 'shape', key: 'lg', kind: 'number' }, { group: 'shape', key: 'pill', kind: 'number' },
  { group: 'elevation', key: 'low', kind: 'number' }, { group: 'elevation', key: 'high', kind: 'number' },
  { group: 'layout', key: 'columns', kind: 'number' }, { group: 'layout', key: 'gap', kind: 'number' },
  { group: 'motion', key: 'duration', kind: 'number' }, { group: 'motion', key: 'easing', kind: 'enum' },
];

export function resolveToken(design: Design, ref: string): string | number | undefined {
  if (!ref.startsWith('token:')) return undefined;
  const [group, key] = ref.slice('token:'.length).split('.');
  if (!group || !key || !TOKENS.some((token) => token.group === group && token.key === key)) return undefined;
  const value = (design as unknown as Record<string, Record<string, unknown>>)[group]?.[key];
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

export function isTokenRef(value: string): boolean {
  return value.startsWith('token:');
}

export interface DesignReport {
  level: 'blocking' | 'advisory';
  area: string;
  message: string;
}

export function auditDesign(design: Design): DesignReport[] {
  const reports: DesignReport[] = [];
  const pairs: [keyof DesignColor, keyof DesignColor, number, string, 'blocking' | 'advisory'][] = [
    ['ink', 'canvas', 4.5, 'Body text', 'blocking'],
    ['ink', 'surface', 4.5, 'Text on raised surfaces', 'blocking'],
    ['accentink', 'accent', 4.5, 'Button text', 'blocking'],
    ['muted', 'canvas', 4.5, 'Secondary text', 'advisory'],
    ['muted', 'surface', 4.5, 'Secondary text on raised surfaces', 'advisory'],
    ['border', 'canvas', 1.2, 'Visible borders', 'advisory'],
  ];
  for (const [fg, bg, minimum, label, level] of pairs) {
    const ratio = contrast(design.color[fg], design.color[bg]);
    if (ratio === null) { reports.push({ level: 'blocking', area: 'color', message: `${label} colour must be a plain hex value.` }); continue; }
    if (ratio < minimum) reports.push({ level, area: 'color', message: `${label} contrast is ${ratio.toFixed(2)}:1, below ${minimum}:1.` });
  }
  if (design.type.base < LIMITS.typography) reports.push({ level: 'blocking', area: 'type', message: 'Base type size must be at least 16px.' });
  if (design.space.unit <= 0 || design.space.unit > 32) reports.push({ level: 'blocking', area: 'space', message: 'Spacing unit must be between 1 and 32px.' });
  if (design.space.section < 32) reports.push({ level: 'advisory', area: 'space', message: 'Section spacing is tight; generous spacing reads better.' });
  if (design.type.scale < 1.1 || design.type.scale > 1.6) reports.push({ level: 'advisory', area: 'type', message: 'Type scale outside the familiar 1.1-1.6 range.' });
  if (design.shape.pill < 100) reports.push({ level: 'advisory', area: 'shape', message: 'Pill radius should stay large enough to read as a pill.' });
  if (design.motion.reduce !== true) reports.push({ level: 'blocking', area: 'motion', message: 'Reduced-motion fallback must stay enabled.' });
  if (!(DENSITY_VALUES as readonly string[]).includes(design.direction.density)) reports.push({ level: 'blocking', area: 'direction', message: 'Density must be airy, balanced or compact.' });
  if (!(EASING_VALUES as readonly string[]).includes(design.motion.easing)) reports.push({ level: 'blocking', area: 'motion', message: 'Easing must be linear, ease, easeout or easeinout.' });
  return reports;
}

const AREA_ALIASES: Record<string, string> = {
  direction: 'direction', voice: 'direction', audience: 'direction', purpose: 'direction',
  foundation: 'color', foundations: 'color', color: 'color', colours: 'color', colors: 'color',
  typography: 'type', type: 'type', fonts: 'type', font: 'type',
  spacing: 'space', space: 'space',
  shape: 'shape', radius: 'shape', corner: 'shape', corners: 'shape',
  surface: 'surface', surfaces: 'surface', elevation: 'elevation', shadow: 'elevation', shadows: 'elevation',
  layout: 'layout', grid: 'layout',
  motion: 'motion', transition: 'motion', transitions: 'motion', animation: 'motion',
  guidance: 'guidance', rules: 'guidance', notes: 'guidance',
};

const COLOR_WORDS: Record<string, keyof DesignColor> = {
  accent: 'accent', primary: 'accent', brand: 'accent',
  canvas: 'canvas', background: 'canvas', bg: 'canvas', page: 'canvas',
  ink: 'ink', text: 'ink', foreground: 'ink',
  surface: 'surface', panel: 'surface', card: 'surface',
  border: 'border', line: 'border', divider: 'border', outline: 'border',
  muted: 'muted', secondary: 'muted', subtle: 'muted',
  success: 'success', positive: 'success',
  danger: 'danger', error: 'danger', destructive: 'danger',
  accentink: 'accentink', onaccent: 'accentink',
};

const FONT_ALIASES: Record<string, string> = {
  serif: SERIF, sans: SANS, sansserif: SANS, system: SANS, grotesk: GROTESK,
};

function clone(design: Design): Design {
  return JSON.parse(JSON.stringify(design)) as Design;
}

export interface DesignParse {
  design: Design;
  decisions: DesignDecision[];
  notes: string[];
}

export function parseDesign(markdown: string, previous: Design = DEFAULT_DESIGN): DesignParse {
  const design = clone(previous);
  const decisions: DesignDecision[] = [];
  const notes: string[] = [];
  let area = '';
  const seen = new Set<string>();

  const decide = (decision: DesignDecision) => {
    if (decisions.some((entry) => entry.area === decision.area && entry.question === decision.question)) return;
    decisions.push(decision);
  };
  const assign = (key: string, value: string) => {
    const marker = `${area}.${key}`;
    const current = (design as unknown as Record<string, Record<string, unknown>>)[area]?.[key];
    if (seen.has(marker)) {
      if (String(current) !== value) decide({ area, question: `Use one ${key} value`, choice: String(current), alternatives: [String(value)] });
      return;
    }
    seen.add(marker);
    const target = (design as unknown as Record<string, Record<string, unknown>>)[area];
    if (!target) return;
    if (typeof current === 'boolean') {
      target[key] = value === 'true';
      return;
    }
    if (typeof current === 'number') {
      const number = Number.parseFloat(value);
      if (Number.isFinite(number)) target[key] = Math.round(number * 100) / 100;
      return;
    }
    target[key] = value;
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const textVal = heading[2].toLowerCase().replace(/[^a-z ]/g, '').trim();
      const word = textVal.split(/\s+/).find((part) => AREA_ALIASES[part]) || '';
      area = AREA_ALIASES[word] || '';
      continue;
    }
    if (!line || !area) continue;
    const body = line.replace(/^[-*+]\s+/, '').replace(/\*\*/g, '').trim();
    const pair = /^([a-z][a-z ]{1,24}?)\s*[:=]\s*(.+)$/i.exec(body);
    const key = pair ? pair[1].trim().toLowerCase().replace(/\s+/g, '') : '';
    const value = pair ? pair[2].trim() : body;

    if (area === 'color') {
      const hex = value.match(/#[0-9a-f]{6}/i)?.[0];
      if (!hex) continue;
      const named = pair ? COLOR_WORDS[key] : undefined;
      if (named) assign(named, hex.toLowerCase());
      else notes.push(`Unnamed colour ${hex} was kept as guidance.`);
      continue;
    }
    if (area === 'type') {
      const size = /^(\d+(?:\.\d+)?)\s*(?:px)?$/i.exec(value)?.[1] ?? /(\d+(?:\.\d+)?)\s*px/i.exec(value)?.[1];
      if (size && /size|base|body/i.test(key || value)) {
        const px = Number.parseFloat(size);
        if (px < LIMITS.typography) decide({ area: 'type', question: 'Keep a readable minimum type size', choice: `Raise ${px}px to ${LIMITS.typography}px for body text`, note: 'Smaller sizes stay available only as labeled exceptions.' });
        assign('base', String(Math.max(px, LIMITS.typography)));
        continue;
      }
      const scale = /^(\d\.\d+)$/.exec(value)?.[1];
      if (scale && /scale|ratio/i.test(key)) { assign('scale', scale); continue; }
      const leading = /^(\d\.\d+)$/.exec(value)?.[1];
      if (leading && /leading|line/i.test(key)) { assign('leading', leading); continue; }
      const font = FONT_ALIASES[value.toLowerCase().replace(/[^a-z]/g, '')];
      if (font && /display|heading|body|font/i.test(key)) { assign(key.includes('body') ? 'body' : 'heading', font); continue; }
      if (/figma|google|licensed|font/i.test(body)) {
        decide({ area: 'type', question: 'Substitute named fonts', choice: 'Use system font stacks', note: `Reference font "${value}" is not licensed for embedding; a suitable system stack is used instead.` });
      }
      continue;
    }
    if (area === 'space') {
      const numbers = [...value.matchAll(/(\d+(?:\.\d+)?)\s*(px)?/gi)].map((match) => Number.parseFloat(match[1]));
      if (!numbers.length) continue;
      if (/unit|increment|step|base/i.test(key || value)) assign('unit', String(numbers[0]));
      else if (/section|block|gutter|vertical/i.test(key)) assign('section', String(numbers[0]));
      else if (/container|max|width/i.test(key)) assign('container', String(numbers[0]));
      continue;
    }
    if (area === 'shape') {
      const numbers = [...value.matchAll(/(\d+(?:\.\d+)?)\s*(px)?/gi)].map((match) => Number.parseFloat(match[1]));
      if (numbers.length > 3) decide({ area: 'shape', question: 'Limit border radii', choice: 'Keep 3 standard radii', note: 'Too many radii make the surface noisy.' });
      if (numbers[0] !== undefined) assign('sm', String(numbers[0]));
      if (numbers[1] !== undefined) assign('md', String(numbers[1]));
      if (numbers[2] !== undefined) assign('lg', String(numbers[2]));
      if (numbers[3] !== undefined) assign('pill', String(numbers[3]));
      continue;
    }
    if (area === 'motion') {
      const ms = /(\d+)\s*ms/i.exec(value)?.[1];
      if (ms) assign('duration', ms);
      if (/ease|linear/i.test(value)) assign('easing', value.toLowerCase().replace(/[^a-z]/g, ''));
      if (/reduce|respect/i.test(key || value)) assign('reduce', String(/true|yes|1/i.test(value)));
      continue;
    }
    if (area === 'guidance') {
      const clean = body.replace(/[#*`]/g, '').trim().slice(0, 200);
      if (clean && !/http/i.test(clean)) design.guidance = [...design.guidance.slice(0, 40), clean];
      continue;
    }
    if (area === 'direction') {
      if (/audience|who/i.test(key)) assign('audience', value.slice(0, 200));
      else if (/purpose|goal/i.test(key)) assign('purpose', value.slice(0, 200));
      else if (/voice|tone/i.test(key)) assign('voice', value.slice(0, 200));
      else if (/density/i.test(key)) assign('density', (['compact', 'balanced', 'airy'] as const).find((option) => value.toLowerCase().includes(option)) || design.direction.density);
      else if (/idea|concept|direction/i.test(key)) assign('idea', value.slice(0, 200));
    }
  }

  design.guidance = design.guidance.filter((entry) => typeof entry === 'string' && entry.length > 0).slice(0, 40);
  return { design, decisions, notes };
}

export function exportDesign(design: Design | undefined | null): string {
  if (!design) return '';
  const direction = design.direction || DEFAULT_DESIGN.direction;
  const color = design.color || DEFAULT_DESIGN.color;
  const type = design.type || DEFAULT_DESIGN.type;
  const space = design.space || DEFAULT_DESIGN.space;
  const shape = design.shape || DEFAULT_DESIGN.shape;

  const lines: string[] = [];
  lines.push('# Design');
  lines.push('');
  lines.push('## Direction');
  lines.push(`- audience: ${direction.audience || ''}`);
  lines.push(`- purpose: ${direction.purpose || ''}`);
  lines.push(`- voice: ${direction.voice || ''}`);
  lines.push(`- density: ${direction.density || 'balanced'}`);
  lines.push('');
  lines.push('## Foundations');
  for (const key of COLOR_KEYS) lines.push(`- ${key}: ${color[key] || DEFAULT_DESIGN.color[key]}`);
  lines.push('');
  lines.push('## Typography');
  lines.push(`- display: ${type.display || DEFAULT_DESIGN.type.display}`);
  lines.push(`- heading: ${type.heading || DEFAULT_DESIGN.type.heading}`);
  lines.push(`- body: ${type.body || DEFAULT_DESIGN.type.body}`);
  lines.push(`- base: ${type.base || 16}px`);
  lines.push('');
  lines.push('## Spacing');
  lines.push(`- unit: ${space.unit || 8}px`);
  lines.push(`- section: ${space.section || 96}px`);
  lines.push(`- container: ${space.container || 1200}px`);
  lines.push('');
  lines.push('## Shape');
  lines.push(`- sm: ${shape.sm ?? 4}px`);
  lines.push(`- md: ${shape.md ?? 8}px`);
  lines.push(`- lg: ${shape.lg ?? 16}px`);
  lines.push(`- pill: ${shape.pill ?? 9999}px`);
  return `${lines.join('\n')}\n`;
}
