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
export interface Section { id: string; purpose: string; layout: { kind: string; columns?: number; gap?: string; align?: string; width?: string }; style?: StyleSet; nodes: Node[]; bindings?: Record<string, unknown>[] }
export interface Page { id: string; path: string; title: string; meta?: { description?: string }; sections: Section[] }
export interface Journey { id: string; title: string; kind: string; target: string; enabled: boolean; fields: { key: string; label: string; kind: string; required?: boolean }[] }
export type BusinessKind = 'goods' | 'food' | 'services' | 'wholesale';
export type SectionKind = 'header' | 'hero' | 'notice' | 'spotlight' | 'catalog' | 'menu' | 'services' | 'story' | 'trust' | 'contact';
export type LeadSection = 'spotlight' | 'catalog' | 'story';
export type TypographyToken = 'serif' | 'sans' | 'grotesk';
export type ToneToken = 'canvas' | 'surface' | 'ink';
export type DensityToken = 1 | 2 | 3;
export type CatalogLayout = 'flat' | 'pills' | 'rails';
export type HeaderStyle = 'split' | 'fullbleed' | 'minimal' | 'floating_pill';
export const HEADER_STYLES = ['split', 'fullbleed', 'minimal', 'floating_pill'] as const;

export type HeroPattern = 'split' | 'commerce' | 'typography' | 'bg_image' | 'minimal' | 'fullbleed' | 'centered_atmospheric';
export const HERO_PATTERNS = ['split', 'commerce', 'typography', 'bg_image', 'minimal', 'fullbleed', 'centered_atmospheric'] as const;

export interface SectionSummary {
  kind: SectionKind;
  label: string;
  detail: string;
}

export interface Blueprint {
  kind: BusinessKind;
  style?: string;
  typography: TypographyToken;
  tone: ToneToken;
  density: DensityToken;
  lead: LeadSection;
  sections: SectionKind[];
  headerStyle: HeaderStyle;
  heroPattern?: HeroPattern;
  catalogLayout: CatalogLayout;
  gate: boolean;
  hash: string;
  revision: number;
}

export interface PersonaWhen { channel?: string; device?: string; returning?: boolean }
export interface Persona { id: string; when: PersonaWhen; priority: number; hide?: string[]; order?: string[]; tone?: Record<string, string> }
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
  | { op: 'unlock'; target: string };

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
