/** Site v2 document types shared with the harness. The harness validates every field. */

export const DOCUMENT_VERSION = '2.0.0';

export interface DesignDecision { area: string; question: string; choice: string; alternatives?: string[]; note?: string }
export interface DesignSource { reference: string; hash: string; revision: number; decisions: DesignDecision[] }
export interface Design {
  theme: string;
  direction: { audience: string; purpose: string; voice: string; density: string; idea: string };
  color: Record<string, string>;
  type: { display: string; heading: string; body: string; base: number; scale: number; leading: number; weight: number };
  space: { unit: number; section: number; container: number };
  shape: { sm: number; md: number; lg: number; pill: number };
  elevation: { low: number; high: number };
  layout: { columns: number; gap: number; align: string };
  motion: { duration: number; easing: string; reduce: boolean };
  guidance: string[];
  source?: DesignSource;
}

export interface AssetRights { source: string; license: string; approved: boolean; note?: string }
export interface Asset {
  id: string; kind: 'image' | 'video' | 'font' | 'icon'; mime: string; bytes: number; hash: string;
  width?: number; height?: number; alt?: string; rights: AssetRights; generated?: boolean; prompt?: string;
}
export interface AssetSummary extends Asset { used: boolean; url: string }

export interface Style {
  background?: string;
  color?: string;
  pad?: string;
  gap?: string;
  radius?: string | number;
  border?: string;
  shadow?: string;
  align?: string;
  width?: string;
  aspect?: string;
  gradient?: { from: string; to: string; angle: number };
  mask?: string;
  size?: string;
  weight?: number;
  columns?: number;
}
export interface StyleSet { base?: Style; small?: Style; medium?: Style; large?: Style; [key: string]: Style | undefined; }
export interface Node { id: string; kind: string; props: Record<string, unknown>; style?: StyleSet; children?: Node[]; component?: string; variant?: string }
export interface Section { id: string; purpose: string; layout: { kind: string; columns?: number; gap?: string; align?: string; width?: string }; style?: StyleSet; nodes: Node[]; bindings?: Record<string, unknown>[]; recipe?: { id: string; settings?: Record<string, boolean | string> } }
export interface Page { id: string; path: string; title: string; meta?: { description?: string }; sections: Section[] }
export interface Journey { id: string; title: string; kind: string; target: string; enabled: boolean; fields: { key: string; label: string; kind: string; required?: boolean }[] }
export type BusinessKind = 'goods' | 'food' | 'services' | 'wholesale';
export type SectionKind =
  | 'header' | 'announcement' | 'hero' | 'spotlight' | 'catalog' | 'menu' | 'booking'
  | 'story' | 'trust' | 'faq' | 'policy' | 'location' | 'contact' | 'footer';
export type LeadSection = 'spotlight' | 'catalog' | 'story';
export type CommerceModel = 'products' | 'food' | 'booking' | 'quote' | 'digital' | 'bulk';
export type TypographyToken = 'serif' | 'sans' | 'grotesk';
export type ToneToken = 'canvas' | 'surface' | 'ink';
export type DensityToken = 1 | 2 | 3;
export type CatalogLayout = 'flat' | 'pills' | 'rails';

export interface SectionSummary {
  kind: SectionKind;
  label: string;
  detail: string;
}

export interface GateNeed { model: CommerceModel; need: string; message: string }
export interface GateResult { ok: boolean; missing: GateNeed[] }
export interface ModelProfile {
  models: CommerceModel[];
  industry: string;
  capabilities: { pos: boolean; commerce: boolean; site: boolean; team: boolean };
  confidence: { models: number; industry: number };
  ask: boolean;
}

export type OverrideKind = 'design' | 'recipe' | 'settings' | 'text' | 'hide' | 'show' | 'order';

/** What the merchant has chosen for themselves; code applies these before anything the system proposes. */
export interface Overrides {
  design?: string;
  recipes?: Partial<Record<SectionKind, string>>;
  settings?: Partial<Record<SectionKind, Record<string, boolean | string>>>;
  text?: Record<string, string>;
  hidden?: SectionKind[];
  shown?: SectionKind[];
  order?: SectionKind[];
  pending?: string[];
}

export interface Blueprint {
  kind: BusinessKind;
  profile?: ModelProfile;
  style?: string;
  typography: TypographyToken;
  tone: ToneToken;
  density: DensityToken;
  lead: LeadSection;
  sections: SectionKind[];
  recipes?: Partial<Record<SectionKind, string>>;
  overrides?: Overrides;
  catalogLayout: CatalogLayout;
  gate: GateResult;
  hash: string;
  revision: number;
}

/** One control the server says a layout has: a switch, a short line, or a choice. */
export interface RecipeSetting { type: 'boolean' | 'text' | 'choice'; default: boolean | string; options?: string[]; max?: number }
export interface RecipeOption { id: string; pattern: string }

/** What the design API returns: the library a merchant may choose from (parai D13). */
export interface DesignOption { id: string; name: string; desc: string; swatches: string[]; tone: string; density: string }
export interface DesignLibrary {
  designs: DesignOption[];
  default: string;
  models: CommerceModel[];
  sections: { required: SectionKind[]; optional: SectionKind[] };
  /** Layouts per section type, the settings each one exposes, and the default choice. */
  recipes: Partial<Record<SectionKind, RecipeOption[]>>;
  settings: Partial<Record<SectionKind, Record<string, Record<string, RecipeSetting>>>>;
  defaults: Partial<Record<SectionKind, string>>;
  overrides: Overrides;
}

/**
 * What site.generate takes: what the business is, plus the facts on record. Every list
 * accepts a comma-separated string or an array. Colours and fonts are not inputs.
 */
export interface SiteGenerateInput {
  prompt?: string;
  title?: string;
  audience?: string;
  tone?: string;
  city?: string;
  models?: CommerceModel[] | string;
  industry?: string;
  style?: string;
  lead?: string;
  notice?: string;
  season?: string;
  records?: string[] | string;
  services?: string[] | string;
  hours?: string[] | string;
  proofs?: string[] | string;
  features?: string[] | string;
  terms?: string[] | string;
  minimum?: string;
  phone?: string;
  email?: string;
  address?: string;
  locale?: string;
  reset?: boolean;
}

export interface SiteGenerateResult {
  siteId: string;
  version: number;
  state: string;
  site: SiteDocument;
  preview: { html: string; css: string; hash: string };
  composed: boolean;
  blueprint: Blueprint;
  gate: GateResult;
  missing: GateNeed[];
  note?: string;
}

/** One publish tap, three honest outcomes: live, still a draft with a list, or an error. */
export interface PublishOutcome {
  siteId: string;
  published: boolean;
  state: string;
  releaseId?: string;
  liveUrl?: string;
  publicUrl?: string;
  generation?: number;
  regenerated?: boolean;
  gate?: GateResult;
  missing?: GateNeed[];
  blocking?: string[];
}

export interface PersonaWhen { channel?: string; device?: string; returning?: boolean }export interface Persona { id: string; when: PersonaWhen; priority: number; hide?: string[]; order?: string[]; tone?: Record<string, string> }
export interface ReleaseFile { path: string; mime: string; bytes: number; hash: string; key: string }
export interface ReleaseManifest {
  id: string; siteId: string; version: number; generation: number; created: number; hash: string;
  files: ReleaseFile[]; host?: string; epoch?: number; compiler?: string; checks?: { blocking: number; advisory: number };
  personas?: Pick<Persona, 'id' | 'when' | 'priority'>[];
}
export interface Lock { target: string; kind: 'section' | 'node' | 'token' | 'component' | 'brand'; at: number }
export interface Claim { text: string; verdict: 'supported' | 'contradicted' | 'unsupported'; evidence?: string[] }

export interface SiteDocument {
  schema: typeof DOCUMENT_VERSION;
  revision: number;
  brief: { goal: string; audience: string; tone: string; bullets?: string[]; accepted?: string[]; rejected?: string[]; voice?: string };
  locale: string; timezone: string; currency: string;
  design: Design;
  assets: Asset[];
  components: { id: string; name: string; slots: string[]; variants: Record<string, unknown>; nodes: Node[] }[];
  pages: Page[];
  journeys: Journey[];
  redirects: { from: string; to: string; status: number }[];
  locks: Lock[];
  policy: { publicEnquiry?: boolean; publicOrdering?: boolean; allowedCurrencies?: string[]; turnstile?: string };
  category?: BusinessKind | string;
  personas?: Persona[];
  blueprint?: Blueprint;
  claims?: Claim[];
  currentRelease?: string | null;
  releases?: ReleaseManifest[];
}

export type PatchOperation =
  | { op: 'set_text'; target: string; value: string }
  | { op: 'set_props'; target: string; value: Record<string, unknown> }
  | { op: 'set_style'; target: string; value: StyleSet | null }
  | { op: 'set_layout'; target: string; value: Section['layout'] }
  | { op: 'move_node'; target: string; before?: string; after?: string }
  | { op: 'move_section'; target: string; index: number }
  | { op: 'add_section'; page: string; section: Section; index?: number }
  | { op: 'remove_section'; target: string }
  | { op: 'add_node'; parent: string; node: Node; index?: number }
  | { op: 'remove_node'; target: string }
  | { op: 'swap_component'; target: string; component: string; variant?: string }
  | { op: 'set_token'; token: string; value: string | number }
  | { op: 'set_journey'; journey: Journey }
  | { op: 'remove_journey'; target: string }
  | { op: 'set_redirect'; from: string; to: string | null }
  | { op: 'set_page'; page: string; value: { title?: string; description?: string; path?: string } }
  | { op: 'set_brief'; value: Partial<SiteDocument['brief']> }
  | { op: 'set_persona'; persona: Persona }
  | { op: 'remove_persona'; target: string }
  | { op: 'set_policy'; value: Partial<SiteDocument['policy']> }
  | { op: 'set_asset_rights'; target: string; value: { approved?: boolean; license?: string; source?: string; alt?: string } }
  | { op: 'add_asset'; asset: Asset }
  | { op: 'remove_asset'; target: string }
  | { op: 'lock'; target: string; kind: Lock['kind'] }
  | { op: 'unlock'; target: string }
  | { op: 'set_override'; kind: OverrideKind; target?: string; value?: unknown }
  | { op: 'clear_override'; kind: OverrideKind | 'all'; target?: string };

export interface DiffEntry { target: string; kind: string; from: string; to: string }
export interface CheckIssue { level: 'blocking' | 'advisory'; area: string; path: string; message: string }
export interface Checks { blocking: CheckIssue[]; advisory: CheckIssue[]; measured: Record<string, number>; claims?: number }
export interface HistoryEntry { revision: number; at: number; summary: string }

export interface AskOutcome {
  siteId: string; base: number; target: string | null; targetKind: 'section' | 'node' | null;
  operations: PatchOperation[]; summary: string; questions: string[]; choices: Record<string, string>;
}
export interface EditOutcome { siteId: string; version: number; revision: number; site: SiteDocument; diff: DiffEntry[]; html?: string }
export interface SiteSnapshot {
  site: { id: string; version: number; state: string; data: SiteDocument } | null;
  schema: string | null;
  history: HistoryEntry[];
  designMarkdown: string | null;
  html?: string | null;
  publicUrl: string | null;
  liveRelease: string | null;
  publicationState: string | null;
}

export const PREVIEW_FRAMES = [
  { key: 'phone', label: 'Phone', width: 360 },
  { key: 'tablet', label: 'Tablet', width: 768 },
  { key: 'desktop', label: 'Desktop', width: 1440 },
] as const;
