// pick.ts — Mode 1 brain minus the model. Given the merchant facts, choose one
// style and an ordered section stack. Deterministic: same facts, same site, and
// a merchant can override any single choice (stored, not re-derived).

import type { SectionChoice, SectionKind } from './types.ts';
import { STYLES, findStyle } from './styles.ts';

export interface PickFacts {
  readonly trade: string;
  readonly itemCount: number;
  readonly photoCount: number;
}

const NATURE_WORDS: Record<string, readonly string[]> = {
  food: ['food', 'bakery', 'cafe', 'restaurant', 'kitchen', 'tea', 'coffee', 'snack', 'catering', 'juice'],
  service: ['service', 'consult', 'clinic', 'salon', 'tailor', 'repair', 'studio', 'agency', 'tuition', 'gym'],
  shop: ['shop', 'store', 'retail', 'boutique', 'grocery', 'market', 'hardware'],
};

export function natureOf(trade: string): string {
  const words = trade.toLowerCase();
  for (const [nature, keys] of Object.entries(NATURE_WORDS)) {
    if (keys.some((key) => words.includes(key))) return nature;
  }
  return 'shop';
}

export function pickStyle(trade: string): string {
  const nature = natureOf(trade);
  const match = STYLES.find((style) => style.nature.includes(nature));
  return (match ?? findStyle('warm-paper')).id;
}

/**
 * The stack Jev would pick: nav, hero, catalog always; story when there is
 * something to say; gallery only with real photos; footer always. Variants
 * never demand a photo that does not exist (paraiv2 §3, auto-safety rule).
 */
export function pickSections(facts: PickFacts, styleId: string): SectionChoice[] {
  const style = findStyle(styleId);
  const hasPhotos = facts.photoCount >= 3;
  const variant = (kind: SectionKind) => style.defaultVariants[kind] ?? kind;
  const sections: SectionChoice[] = [
    { kind: 'nav', variant: hasPhotos ? variant('nav') : 'minimal-left' },
    { kind: 'hero', variant: hasPhotos ? variant('hero') : 'typing' },
    { kind: 'catalog', variant: hasPhotos && facts.itemCount > 0 ? variant('catalog') : 'menu-sheet' },
  ];
  if (facts.itemCount === 0) sections[sections.length - 1] = { kind: 'catalog', variant: 'menu-sheet' };
  sections.push({ kind: 'story', variant: variant('story') });
  if (hasPhotos) sections.push({ kind: 'gallery', variant: variant('gallery') });
  sections.push({ kind: 'footer', variant: hasPhotos ? variant('footer') : 'minimal-whatsapp-bar' });
  return sections;
}

/** The minimal stack a brand-new draft starts from (no crawl, no model). */
export function defaultSections(styleId: string): SectionChoice[] {
  return pickSections({ trade: '', itemCount: 0, photoCount: 0 }, styleId);
}
