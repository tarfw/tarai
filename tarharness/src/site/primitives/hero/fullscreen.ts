import type { Section } from '../../document.ts';
import { escapeAttribute, escapeHtml } from '../../html.ts';
import { firstImage, mediaSize, renderNodes, wordsOf, slotStyle, slotText, slotsOf, unusedNodes, type RenderContext } from '../nodes.ts';
import { layoutStyle, styleClass } from '../../styles.ts';
import { tokenRef } from '../../recipes/slots.ts';

/** The fullscreen hero: one photo behind the name, one line and one action. */
export function render(section: Section, context: RenderContext): string {
  const found = slotsOf(section, context.doc, context.recipe);
  const slots = found.values;
  const headline = slotText(slots, 'headline', context.recipe?.fallback.headline || 'Your store name');
  const subline = slotText(slots, 'body');
  const href = slotText(slots, 'ctaHref', context.recipe?.fallback.cta || '#catalog');
  const label = wordsOf(section, context.recipe, slots, 'label', 'cta', 'See the shop');
  const image = firstImage(context.doc);
  const src = slotText(slots, 'media') || image?.src || '';
  const alt = slotText(slots, 'mediaAlt') || headline;

  // The recipe's own colour roles, resolved through the design like every other token.
  const roles = context.recipe?.tokens;
  const overlay = roles?.background && roles.text
    ? { ...section.style, base: { ...section.style?.base, background: tokenRef(roles.background), color: tokenRef(roles.text) } }
    : section.style;
  const style = styleClass(context.collector, overlay);
  const id = escapeAttribute(section.id || 'hero');
  const mediaClass = `tar-media${slotStyle(context, found, 'media')}`;
  const rest = unusedNodes(section.nodes, found.used);
  const extra = rest.length ? `<div class="tar-stack">${renderNodes(rest, context)}</div>` : '';

  return `<section id="${id}" class="tar-hero tar-overlay tar-hero-fullscreen${style}" data-purpose="hero"${layoutStyle(context.doc.design, section.layout)}>
  ${src ? `<img class="${mediaClass}" src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}"${mediaSize(slots)} loading="eager" fetchpriority="high">` : ''}
  <div class="tar-scrim"></div>
  <div class="tar-wrap">
    <h1 class="tar-hero-title${slotStyle(context, found, 'headline')}">${escapeHtml(headline)}</h1>
    ${subline ? `<p class="tar-hero-desc${slotStyle(context, found, 'body')}">${escapeHtml(subline)}</p>` : ''}
    <div class="tar-hero-actions"><a href="${escapeAttribute(href)}" class="tar-btn tar-btn-outline${slotStyle(context, found, 'cta')}">${escapeHtml(label)}</a></div>
    ${extra}
  </div>
</section>`;
}
