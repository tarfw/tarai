/**
 * TAR Site document - the typed, versioned source of truth for a site.
 *
 * The document contract is this module. Fields and identifiers use one
 * lowercase semantic word; structure supplies qualification.
 */

export const DOCUMENT_VERSION = '2.0.0';

export const NODE_KINDS = [
  'heading', 'text', 'image', 'video', 'icon', 'list', 'link', 'button', 'divider', 'spacer',
  'flex', 'grid', 'stack', 'card', 'collection', 'navigation', 'footer',
  'menu', 'tabs', 'accordion', 'gallery', 'search', 'form',
] as const;

export type NodeKind = typeof NODE_KINDS[number];

/** Nodes that render one or more child nodes. */
export const CONTAINER_KINDS = ['flex', 'grid', 'stack', 'card', 'navigation', 'footer', 'tabs', 'accordion', 'gallery', 'form'] as const;

/** Interaction components backed by the tiny progressive runtime. */
export const INTERACTION_KINDS = ['menu', 'tabs', 'accordion', 'gallery', 'search', 'form'] as const;

/**
 * The layout grammar the engine implements once (parai §5.1). `flow` and `flex` are the
 * names documents stored before it; a recipe always names a grammar primitive.
 */
export const SECTION_LAYOUTS = ['flow', 'flex', 'stack', 'row', 'grid', 'split', 'overlay', 'rail', 'disclosure'] as const;
export type SectionLayout = typeof SECTION_LAYOUTS[number];

/** The two regions of a split, as fractions code owns. A recipe picks one; it never writes a width. */
export const LAYOUT_RATIOS = ['50/50', '60/40', '40/60', '2/1', '1/2'] as const;
/** How a wide layout behaves on a narrow screen: fall into a column, or keep the regions side by side. */
export const LAYOUT_COLLAPSES = ['stack', 'keep'] as const;
/** How tall an overlay's media region is, in viewport terms rather than pixels. */
export const LAYOUT_HEIGHTS = ['short', 'tall', 'full'] as const;
export const RATIO_CSS: Record<string, string> = {
  '50/50': '1fr 1fr', '60/40': '3fr 2fr', '40/60': '2fr 3fr', '2/1': '2fr 1fr', '1/2': '1fr 2fr',
};
export const HEIGHT_CSS: Record<string, string> = { short: '40vh', tall: '65vh', full: '100svh' };

export const STYLE_KEYS = [
  'background', 'color', 'pad', 'gap', 'radius', 'border', 'shadow', 'align', 'width',
  'aspect', 'gradient', 'mask', 'size', 'weight', 'columns',
] as const;

export type StyleKey = typeof STYLE_KEYS[number];

export const PAD_VALUES = ['none', 'sm', 'md', 'lg', 'xl'] as const;
export const ALIGN_VALUES = ['start', 'center', 'end', 'between'] as const;
export const WIDTH_VALUES = ['content', 'wide', 'full'] as const;
export const ASPECT_VALUES = ['square', 'portrait', 'landscape', 'wide'] as const;
export const SHADOW_VALUES = ['none', 'low', 'high'] as const;
export const BORDER_VALUES = ['none', 'hairline'] as const;
export const MASK_VALUES = ['none', 'soft'] as const;
export const SIZE_VALUES = ['display', 'heading', 'body', 'label'] as const;
export const DENSITY_VALUES = ['airy', 'balanced', 'compact'] as const;
export const EASING_VALUES = ['linear', 'ease', 'easeout', 'easeinout'] as const;
export const EASING_CSS: Record<string, string> = {
  linear: 'linear', ease: 'ease', easeout: 'cubic-bezier(0.2, 0.7, 0.2, 1)', easeinout: 'ease-in-out',
};

export interface Gradient {
  readonly from: string;
  readonly to: string;
  readonly angle: number;
}

export interface Style {
  readonly background?: string;
  readonly color?: string;
  readonly pad?: string;
  readonly gap?: string;
  readonly radius?: string | number;
  readonly border?: string;
  readonly shadow?: string;
  readonly align?: string;
  readonly width?: string;
  readonly aspect?: string;
  readonly gradient?: Gradient;
  readonly mask?: string;
  readonly size?: string;
  readonly weight?: number;
  readonly columns?: number;
}

/** Fluid base values with explicit small/medium/large overrides. */
export interface StyleSet {
  base?: Style;
  small?: Style;
  medium?: Style;
  large?: Style;
}

export interface Node {
  id: string;
  kind: NodeKind;
  props: Record<string, unknown>;
  style?: StyleSet;
  children?: Node[];
  component?: string;
  variant?: string;
}

export interface SectionLayoutSpec {
  readonly kind: SectionLayout;
  readonly columns?: number;
  readonly gap?: string;
  readonly align?: string;
  readonly width?: string;
  /** A split's regions, from LAYOUT_RATIOS. */
  readonly ratio?: string;
  /** Narrow-screen behaviour, from LAYOUT_COLLAPSES. */
  readonly collapse?: string;
  /** An overlay's media height, from LAYOUT_HEIGHTS. */
  readonly height?: string;
  /** An overlay's content layer: a `token:` colour reference, never a literal. */
  readonly scrim?: string;
}

/**
 * Layout knobs each grammar primitive owns. Anything else a section carries belongs to a
 * different kind, so an edit that changes the kind drops the knobs it no longer has.
 */
export const LAYOUT_KNOBS: Record<SectionLayout, readonly string[]> = {
  flow: [],
  flex: ['columns', 'gap', 'align', 'width'],
  stack: ['columns', 'gap', 'align', 'width'],
  row: ['columns', 'gap', 'align', 'width', 'collapse'],
  grid: ['columns', 'gap', 'align', 'width'],
  split: ['ratio', 'collapse', 'gap', 'align', 'width'],
  overlay: ['height', 'scrim', 'gap', 'align', 'width'],
  rail: ['columns', 'gap', 'align', 'width'],
  disclosure: ['gap', 'align', 'width'],
} as const;

export function pruneLayout(layout: SectionLayoutSpec): SectionLayoutSpec {
  const allowed = LAYOUT_KNOBS[layout.kind] || [];
  const next: Record<string, unknown> = { kind: layout.kind };
  for (const [key, value] of Object.entries(layout)) {
    if (key !== 'kind' && allowed.includes(key) && value !== undefined) next[key] = value;
  }
  return next as unknown as SectionLayoutSpec;
}

export interface NodeAction {
  readonly id: string;
  readonly label: string;
  readonly target: string;
  readonly journey?: string;
  readonly variant?: string;
  readonly payload?: Record<string, unknown>;
}

export interface Binding {
  readonly id: string;
  readonly slot: string;
  readonly query: 'catalog.public' | 'records.public';
  readonly version: number;
  readonly params?: { records?: string[]; channel?: string; type?: string };
  readonly access: 'public';
  readonly freshness: number;
  readonly limit?: number;
  readonly paginate?: { size: number };
  readonly empty?: { text?: string };
  readonly detail?: { path: string };
}

export interface Section {
  id: string;
  purpose: string;
  layout: SectionLayoutSpec;
  style?: StyleSet;
  nodes: Node[];
  bindings?: Binding[];
  actions?: NodeAction[];
  /**
   * Which recipe this section renders with, and the merchant's turn of its settings.
   * Absent means the renderer chooses from the blueprint, as documents stored before it do.
   */
  recipe?: { id: string; settings?: Record<string, boolean | string> };
}

export interface PageMeta {
  readonly description?: string;
  readonly ogImage?: string;
  readonly keywords?: readonly string[];
}

export interface Page {
  id: string;
  path: string;
  title: string;
  meta?: PageMeta;
  sections: Section[];
}

export interface JourneyField {
  readonly key: string;
  readonly label: string;
  readonly kind: 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'date' | 'select';
  readonly required?: boolean;
  readonly options?: readonly string[];
  readonly max?: number;
}

export interface Journey {
  id: string;
  title: string;
  target: string;
  version: number;
  input: Record<string, unknown>;
  outcome: string;
  enabled: boolean;
  kind: 'enquiry' | 'order' | 'booking' | 'payment';
  fields: JourneyField[];
  message?: string;
  limit?: number;
}

export interface Redirect {
  readonly from: string;
  readonly to: string;
  readonly status: 308;
}

export interface Lock {
  readonly target: string;
  readonly kind: 'section' | 'node' | 'token' | 'component' | 'brand';
  readonly at: number;
}

export interface AssetRights {
  readonly source: string;
  readonly license: string;
  readonly approved: boolean;
  readonly note?: string;
}

export interface Asset {
  id: string;
  kind: 'image' | 'video' | 'font' | 'icon';
  key: string;
  mime: string;
  bytes: number;
  hash: string;
  width?: number;
  height?: number;
  alt?: string;
  rights: AssetRights;
  generated?: boolean;
  prompt?: string;
  /** Stand-in media (for example Pexels) the owner should replace with real photography. */
  placeholder?: boolean;
}

export interface ComponentVariant {
  readonly style?: StyleSet;
  readonly props?: Record<string, unknown>;
}

export interface Component {
  id: string;
  name: string;
  slots: string[];
  variants: Record<string, ComponentVariant>;
  nodes: Node[];
}

export interface Brief {
  goal: string;
  audience: string;
  tone: string;
  /** Merchant's own words that steer generation; memory of what was accepted or rejected. */
  bullets?: readonly string[];
  accepted?: readonly string[];
  rejected?: readonly string[];
  voice?: string;
}

export interface SitePolicy {
  readonly publicEnquiry?: boolean;
  readonly publicOrdering?: boolean;
  readonly allowedCurrencies?: readonly string[];
  readonly turnstile?: string;
}

/** A compiled persona branch: a code-resolved patch over this document. */
export interface Persona {
  readonly id: string;
  readonly when: PersonaWhen;
  readonly priority: number;
  readonly hide?: readonly string[];
  readonly order?: readonly string[];
  readonly tone?: Record<string, string>;
}

export interface PersonaWhen {
  readonly channel?: string;
  readonly device?: string;
  readonly returning?: boolean;
}

/** What the edge needs to pick a variant: match rules only, never content. */
export type PersonaRule = Pick<Persona, 'id' | 'when' | 'priority'>;

export interface ReleaseFile {
  readonly path: string;
  readonly mime: string;
  readonly bytes: number;
  readonly hash: string;
  readonly key: string;
}

/**
 * The last write to this document and the merchant state it read (parai §7). A build writes
 * `agent`, so the scheduled sweep knows a fresh draft is its own to rewrite; a hand edit
 * writes `merchant`, and the sweep leaves that store alone until the owner publishes.
 */
export interface Provenance {
  readonly state: string;
  readonly revision: number;
  readonly at: number;
  readonly generator: 'agent' | 'merchant';
}

export interface ReleaseManifest {
  readonly id: string;
  readonly siteId: string;
  readonly host?: string;
  readonly epoch?: number;
  readonly version: number;
  readonly generation: number;
  readonly created: number;
  readonly hash: string;
  readonly files: ReleaseFile[];
  /** Document schema the compiler consumed. */
  readonly compiler?: string;
  /** Compiled persona variants, best match first; content stays in the release files. */
  readonly personas?: readonly PersonaRule[];
  readonly redirects?: readonly { readonly from: string; readonly to: string; readonly status: 308 }[];
  readonly checks?: { readonly blocking: number; readonly advisory: number };
}

export interface SiteDocument {
  schema: typeof DOCUMENT_VERSION;
  revision: number;
  brief: Brief;
  /** Site archetype; sets the default flow, theme and commerce-gate priors. */
  category?: string;
  locale: string;
  timezone: string;
  currency: string;
  design: import('./design.ts').Design;
  assets: Asset[];
  components: Component[];
  pages: Page[];
  journeys: Journey[];
  redirects: Redirect[];
  locks: Lock[];
  policy: SitePolicy;
  /** Every document carries one: `readDocument` materializes a default for stored sites that predate it. */
  blueprint: import('./blueprint.ts').Blueprint;
  personas?: Persona[];
  /** Prose claims checked against supplied evidence; unresolved claims block publish. */
  claims?: { text: string; verdict: 'supported' | 'contradicted' | 'unsupported'; evidence?: string[] }[];
  /** Compatibility projection of the live release. CONTROL D1 remains the authority. */
  currentRelease?: string | null;
  releases?: ReleaseManifest[];
  /** Which merchant state the build read, and whose hand wrote the document last. */
  provenance?: Provenance;
}

export const LIMITS = {
  pages: 50,
  sections: 40,
  nodes: 200,
  depth: 5,
  document: 1_000_000,
  components: 40,
  assets: 200,
  typography: 16,
} as const;

/** Reserved public routes that a page path may never claim. */
export const RESERVED_PATHS = ['/_tar', '/v1'] as const;

export const PUBLIC_TYPES = ['pos.product', 'item', 'service', 'article', 'project'] as const;

export const JOURNEY_TARGETS: Record<string, readonly string[]> = {
  enquiry: ['record.create'],
  booking: ['record.create'],
  order: ['order.create'],
  payment: [],
};

export function isNodeKind(value: unknown): value is NodeKind {
  return typeof value === 'string' && (NODE_KINDS as readonly string[]).includes(value);
}

export function isContainerKind(kind: NodeKind): boolean {
  return (CONTAINER_KINDS as readonly string[]).includes(kind);
}

export function isInteractionKind(kind: NodeKind): boolean {
  return (INTERACTION_KINDS as readonly string[]).includes(kind);
}
