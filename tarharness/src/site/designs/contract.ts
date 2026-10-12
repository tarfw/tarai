/**
 * Contract for the design library build: what a reference file parses to, what a
 * reviewed design emits, and how the index and review list are shaped.
 *
 * Types only — no fs, no runtime data. `parse.ts` fills these shapes, `check.ts`
 * judges them, and `scripts/designdigest.ts` writes them to git.
 */

import type { DesignColor, DesignSpace, DesignShape, DesignType } from '../design.ts';

export const TOKENS_VERSION = 1;

/** One lowercase semantic word, unique across the library (parai §3.3). */
export const DESIGN_ID = /^[a-z]+$/;

export const DENSITY_WORDS = ['airy', 'balanced', 'compact'] as const;
export type DensityWord = (typeof DENSITY_WORDS)[number];

export const TONE_WORDS = ['light', 'dark'] as const;
export type ToneWord = (typeof TONE_WORDS)[number];

export const IMAGERY_WORDS = ['editorial', 'product', 'proof', 'illustrative'] as const;
export type ImageryWord = (typeof IMAGERY_WORDS)[number];

/** Roles the renderer consumes. Every one of these must resolve from the source file. */
export const REQUIRED_ROLES = ['canvas', 'ink', 'surface', 'accent', 'border', 'muted'] as const;
export type ColorRole = (typeof REQUIRED_ROLES)[number] | 'accentink' | 'success' | 'danger';

/**
 * Role resolution: a source colour is scored by the earliest keyword it matches in its
 * role list, ties broken by table order. Ordered so a filled control beats a mere border.
 */
export const ROLE_KEYWORDS: Record<ColorRole, readonly string[]> = {
  canvas: ['page canvas', 'dominant page canvas', 'page backgrounds', 'canvas', 'primary page', 'page background'],
  ink: ['primary text', 'body copy', 'display headings', 'ink color', 'default ink', 'ink', 'foreground', 'text'],
  surface: ['card surfaces', 'feature-card', 'card surface', 'panel surfaces', 'panel', 'surface', 'raised'],
  accent: ['filled pill', 'conversion', 'filled', 'accent borders', 'accent', 'brand', 'link', 'button', 'highlight'],
  accentink: ['text-on-dark', 'reversed text', 'on accent', 'button label', 'label on'],
  border: ['border', 'outline', 'divider', 'separator', 'hairline'],
  muted: ['muted', 'metadata', 'low-emphasis', 'inactive', 'secondary', 'supporting', 'subtle'],
  success: ['active green', 'green', 'success', 'positive', 'verified'],
  danger: ['red', 'danger', 'error', 'destructive', 'expiry', 'alert'],
};

/** Palette colours that carry no role; they stay available to recipes as gradients. */
export interface GradientToken {
  name: string;
  value: string;
}

export interface SourceColor {
  name: string;
  value: string;
  token: string;
  role: string;
  /** Lowercased `name + role`, what ROLE_KEYWORDS is matched against. */
  text: string;
}

export interface FontBlock {
  family: string;
  role: string;
  token: string;
  substitute?: string;
  weights: number[];
  sizes: number[];
  leading: number[];
}

export interface ScaleRow {
  role: string;
  family?: string;
  weight?: number;
  size?: number;
  leading?: number;
  tracking?: number;
  token: string;
}

export interface RadiusRow {
  element: string;
  value: number;
}

/** Everything a reference file states, before any of it is interpreted. */
export interface ParsedReference {
  file: string;
  brand: string;
  vibe: string;
  theme: string;
  colors: SourceColor[];
  gradients: SourceColor[];
  fonts: FontBlock[];
  scale: ScaleRow[];
  spacing: number[];
  baseUnit?: number;
  densityWord?: string;
  radii: RadiusRow[];
  sectionGap?: number;
  sectionGapRaw?: string;
  cardPadding?: number;
  elementGap?: number;
  maxWidth?: number;
  notes: string[];
}

/** The reviewed, build-time record for one reference file. */
export interface DesignTags {
  id: string;
  label: string;
  desc: string;
  tone: ToneWord;
  density: DensityWord;
  industries: string[];
  models: string[];
  imagery: ImageryWord;
  direction: { audience: string; purpose: string; voice: string; idea: string };
  guidance: string[];
  license: { kind: string; note: string; approved: boolean };
  reviewer: string;
}

export interface SidecarEntry extends Partial<DesignTags> {
  /** Reference files are keyed by filename in `scripts/designtags.json`. */
  file?: string;
}

/** What ships in the Worker bundle: source-derived tokens plus the reviewer's tags. */
export interface DesignTokens {
  version: number;
  id: string;
  tone: ToneWord;
  density: DensityWord;
  direction: { audience: string; purpose: string; voice: string; idea: string };
  color: DesignColor;
  gradients: GradientToken[];
  type: DesignType;
  space: DesignSpace;
  shape: DesignShape;
  guidance: string[];
  notes: string[];
  source: { file: string; hash: string; brand: string; license: { kind: string; note: string } };
}

/** Index row (parai §3.4) plus the two authored strings the owner-facing picker shows. */
export interface DesignIndexRow {
  id: string;
  label: string;
  desc: string;
  tone: ToneWord;
  density: DensityWord;
  industries: string[];
  models: string[];
  imagery: ImageryWord;
  contrast: number;
  swatches: string[];
}

export interface DesignIndex {
  version: number;
  /** Id used when nothing matches (parai §3.5). */
  default: string;
  designs: DesignIndexRow[];
}

export interface ReviewFinding {
  check: string;
  level: 'blocking' | 'advisory';
  message: string;
}

export interface ReviewEntry {
  file: string;
  id?: string;
  brand?: string;
  findings: ReviewFinding[];
}

export interface DesignReview {
  version: number;
  /** Reference files whose blocking findings kept them out of `index.json`. */
  excluded: ReviewEntry[];
  /** Advisory findings on designs that did ship; the reviewer reads these. */
  notes: ReviewEntry[];
}
