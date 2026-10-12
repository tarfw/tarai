/**
 * Primitive registry.
 *
 * Maps a recipe id, chosen per section type, to the TypeScript renderer that draws it. The
 * recipes themselves are data (src/site/recipes) and only name a layout, slots, tokens and
 * settings; pixel-level markup stays here, where the CSS budget and the token resolver live.
 */

import type { Section } from './document.ts';
import { renderNodes, type RenderContext } from './primitives/nodes.ts';
import { DEFAULT_RECIPE, canonicalRecipeId, sectionType } from './recipes/library.ts';
import type { SectionType } from './recipes/recipe.ts';
import { escapeAttribute } from './html.ts';
import { layoutClass, layoutStyle, styleClass } from './styles.ts';

// Header primitives
import * as HeaderMinimal from './primitives/header/minimal.ts';
import * as HeaderPill from './primitives/header/pill.ts';
import * as HeaderBrand from './primitives/header/brand.ts';

// Hero primitives
import * as HeroSplit from './primitives/hero/split.ts';
import * as HeroFullscreen from './primitives/hero/fullscreen.ts';
import * as HeroCommerce from './primitives/hero/commerce.ts';
import * as HeroTypography from './primitives/hero/typography.ts';

// Announcement primitives
import * as AnnouncementBar from './primitives/announcement/bar.ts';
import * as AnnouncementPill from './primitives/announcement/pill.ts';

// Catalog primitives
import * as Catalog from './primitives/catalog/items.ts';

// Footer primitives
import * as FooterCard from './primitives/footer/card.ts';

export interface PrimitiveRenderer {
  render(section: Section, context: RenderContext): string;
}

/**
 * The grammar renderer: a section's own nodes inside the layout its recipe named. Types that
 * need no bespoke markup render through this, so they get the token-driven grammar for free.
 */
export const Generic: PrimitiveRenderer = {
  render(section: Section, context: RenderContext): string {
    const style = styleClass(context.collector, section.style);
    const layout = section.layout || { kind: 'flow' };
    const kind = layout.kind === 'flow' ? '' : ` tar-${layout.kind}`;
    const body = renderNodes(section.nodes, { ...context, binding: section.bindings?.[0], sectionLayout: section.layout });
    if (!body.trim()) return '';
    return `<section id="${escapeAttribute(section.id)}" class="tar-section${style}" data-purpose="${escapeAttribute(section.purpose)}"><div class="tar-wrap${kind}${layoutClass(layout)}"${layoutStyle(context.doc.design, layout)}>${body}</div></section>`;
  },
};

/** Every renderer the recipe library may name, keyed by section type then recipe id. */
export const RENDERERS: Partial<Record<SectionType, Record<string, PrimitiveRenderer>>> = {
  header: { minimal: HeaderMinimal, pill: HeaderPill, brand: HeaderBrand },
  announcement: { bar: AnnouncementBar, pill: AnnouncementPill },
  hero: { split: HeroSplit, commerce: HeroCommerce, typography: HeroTypography, fullscreen: HeroFullscreen },
  catalog: { grid: Catalog, rail: Catalog },
  footer: { card: FooterCard },
};

/** The renderer for one section: its recipe id, else the store's pick, else the default. */
export function getPrimitive(purpose: string, option?: string): PrimitiveRenderer {
  const type = sectionType(purpose);
  const id = option ? canonicalRecipeId(type, option) : undefined;
  const byType = RENDERERS[type];
  if (!byType) return Generic;
  return byType[id || ''] || byType[DEFAULT_RECIPE[type]] || Generic;
}
