/**
 * Autonomous Site Blueprint: what Jev decides and code enforces.
 *
 * Models never touch money or layout rules; Jev decides business kind,
 * lead section, and 3 design tokens. Code enforces section floors,
 * item layout thresholds, and the publish gate.
 */

export type BusinessKind = 'goods' | 'food' | 'services' | 'wholesale';
export type SectionKind = 'header' | 'hero' | 'notice' | 'spotlight' | 'catalog' | 'menu' | 'services' | 'story' | 'trust' | 'contact';
export type LeadSection = 'spotlight' | 'catalog' | 'story';
export type TypographyToken = 'serif' | 'sans' | 'grotesk';
export type ToneToken = 'canvas' | 'surface' | 'ink';
export type DensityToken = 1 | 2 | 3;
export type CatalogLayout = 'flat' | 'pills' | 'rails';
export type HeaderStyle = 'split' | 'fullbleed' | 'minimal' | 'floating_pill';
export type HeroPattern = 'split' | 'commerce' | 'typography' | 'bg_image' | 'minimal' | 'fullbleed' | 'centered_atmospheric';

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

export const SECTION_KINDS: readonly SectionKind[] = [
  'header', 'hero', 'notice', 'spotlight', 'catalog', 'menu', 'services', 'story', 'trust', 'contact',
] as const;

export const BUSINESS_KINDS: readonly BusinessKind[] = ['goods', 'food', 'services', 'wholesale'] as const;
export const HEADER_STYLES: readonly HeaderStyle[] = ['split', 'fullbleed', 'minimal', 'floating_pill'] as const;
export const HERO_PATTERNS: readonly HeroPattern[] = ['split', 'commerce', 'typography', 'bg_image', 'minimal', 'fullbleed', 'centered_atmospheric'] as const;
export const TYPOGRAPHY_TOKENS: readonly TypographyToken[] = ['serif', 'sans', 'grotesk'] as const;
export const TONE_TOKENS: readonly ToneToken[] = ['canvas', 'surface', 'ink'] as const;
export const DENSITY_TOKENS: readonly DensityToken[] = [1, 2, 3] as const;

export function catalogSectionFor(kind: BusinessKind): 'catalog' | 'menu' | 'services' {
  if (kind === 'food') return 'menu';
  if (kind === 'services') return 'services';
  return 'catalog';
}

export function catalogLayoutFor(itemCount: number): CatalogLayout {
  if (itemCount <= 15) return 'flat';
  if (itemCount <= 60) return 'pills';
  return 'rails';
}

export function checkPublishGate(facts: SiteFacts): boolean {
  const hasContact = Boolean(facts.phone || facts.email || facts.address);
  const hasItems = (facts.items?.length ?? 0) > 0;
  return hasContact && hasItems;
}

export async function hashState(brief: readonly string[], facts: SiteFacts): Promise<string> {
  const payload = JSON.stringify({
    brief: [...brief].sort(),
    items: facts.items?.length ?? 0,
    itemIds: facts.items?.map((item) => item.id).sort(),
    phone: facts.phone || '',
    proofs: [...(facts.proofs || [])].sort(),
    season: facts.season || '',
    notice: facts.notice || '',
    address: facts.address || '',
  });
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function defaultBlueprint(kind: BusinessKind = 'goods', itemCount = 0, gate = true): Blueprint {
  const mainCatalog = catalogSectionFor(kind);
  return {
    kind,
    style: 'dark-luxury',
    typography: 'sans',
    tone: 'canvas',
    density: 2,
    lead: 'catalog',
    sections: ['header', mainCatalog, 'contact'],
    headerStyle: 'split',
    heroPattern: 'split',
    catalogLayout: catalogLayoutFor(itemCount),
    gate,
    hash: '',
    revision: 1,
  };
}

export function compileSectionOrder(
  kind: BusinessKind,
  lead: LeadSection,
  included: {
    notice?: boolean;
    spotlight?: boolean;
    catalog?: boolean;
    story?: boolean;
    trust?: boolean;
  },
): SectionKind[] {
  const catalogKind = catalogSectionFor(kind);
  const result: SectionKind[] = ['header'];

  if (included.notice) result.push('notice');

  const hasCatalog = included.catalog ?? true;

  // Lead section chosen by Jev
  const resolvedLead = lead === 'catalog' ? (hasCatalog ? catalogKind : lead) : lead;
  if (resolvedLead === 'spotlight' && included.spotlight) {
    result.push('spotlight');
  } else if (resolvedLead === 'story' && included.story) {
    result.push('story');
  } else if (hasCatalog) {
    result.push(catalogKind);
  }

  // Add remaining included sections deterministically
  if (included.spotlight && !result.includes('spotlight')) {
    result.push('spotlight');
  }
  if (hasCatalog && !result.includes(catalogKind)) {
    result.push(catalogKind);
  }
  if (included.story && !result.includes('story')) {
    result.push('story');
  }
  if (included.trust) {
    result.push('trust');
  }

  // Contact is always last
  result.push('contact');
  return result;
}

export function summarizeSections(blueprint: Blueprint, facts: SiteFacts): SectionSummary[] {
  const catalogKind = catalogSectionFor(blueprint.kind);
  const itemCount = facts.items?.length ?? 0;
  return blueprint.sections.map((kind) => {
    switch (kind) {
      case 'header':
        return { kind, label: 'Header Navigation', detail: 'Clean logo & navigation' };
      case 'hero':
        return { kind, label: 'Hero Section', detail: `${blueprint.heroPattern || 'split'} layout` };
      case 'notice':
        return { kind, label: 'Notice', detail: facts.notice || 'Shop announcement' };
      case 'spotlight':
        return { kind, label: 'Spotlight', detail: facts.season ? `${facts.season} banner` : 'Festive offer banner' };
      case 'catalog':
      case 'menu':
      case 'services': {
        const title = kind === 'menu' ? 'Menu' : kind === 'services' ? 'Services' : 'Catalog';
        return { kind, label: title, detail: `${itemCount} items` };
      }
      case 'story':
        return { kind, label: 'Story', detail: 'Craft & owner heritage' };
      case 'trust': {
        const proofs = facts.proofs?.length ? facts.proofs.join(' & ') : 'Handloom mark & COD';
        return { kind, label: 'Trust', detail: proofs };
      }
      case 'contact':
        return { kind, label: 'Contact', detail: 'Address & inquiries' };
      default:
        return { kind, label: kind, detail: '' };
    }
  });
}
