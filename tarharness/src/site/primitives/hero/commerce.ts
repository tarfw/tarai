import type { Section } from '../../document.ts';
import { escapeAttribute, escapeHtml } from '../../html.ts';
import { firstImage, mediaSize, renderNodes, settingsOf, wordsOf, slotStyle, slotText, slotsOf, unusedNodes, type RenderContext } from '../nodes.ts';
import { layoutStyle, styleClass } from '../../styles.ts';

/** The commerce hero: the shop's line beside one framed product card. */
export function render(section: Section, context: RenderContext): string {
  const found = slotsOf(section, context.doc, context.recipe);
  const slots = found.values;
  const settings = settingsOf(section, context.recipe);
  const headline = slotText(slots, 'headline', context.recipe?.fallback.headline || 'Your store name');
  const subline = slotText(slots, 'body');
  const eyebrow = typeof settings.eyebrow === 'string' ? settings.eyebrow : '';
  const href = slotText(slots, 'ctaHref', context.recipe?.fallback.cta || '#catalog');
  const label = wordsOf(section, context.recipe, slots, 'label', 'cta', 'See the shop');
  const image = firstImage(context.doc);
  const src = slotText(slots, 'media') || image?.src || '';
  const alt = slotText(slots, 'mediaAlt') || headline;

  const style = styleClass(context.collector, section.style);
  const id = escapeAttribute(section.id || 'hero');
  const actionsHtml = `<div class="tar-hero-actions"><a href="${escapeAttribute(href)}" class="tar-btn tar-btn-outline${slotStyle(context, found, 'cta')}">${escapeHtml(label)}</a></div>`;
  const rest = unusedNodes(section.nodes, found.used);
  const extra = rest.length ? `<div class="tar-stack">${renderNodes(rest, context)}</div>` : '';

  return `<section id="${id}" class="tar-hero tar-hero-commerce${style}" data-purpose="hero">
  <div class="tar-hero-inner">
    <div class="tar-hero-grid"${layoutStyle(context.doc.design, section.layout)}>
      <div class="tar-hero-text">
        ${eyebrow ? `<span class="tar-hero-eyebrow">${escapeHtml(eyebrow)}</span>` : ''}
        <h1 class="tar-hero-title${slotStyle(context, found, 'headline')}">${escapeHtml(headline)}</h1>
        ${subline ? `<p class="tar-hero-desc${slotStyle(context, found, 'body')}">${escapeHtml(subline)}</p>` : ''}
        ${actionsHtml}
        ${extra}
      </div>
      <div class="tar-hero-spotlight-card">
        ${src ? `<img class="tar-hero-spotlight-img${slotStyle(context, found, 'media')}" src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}"${mediaSize(slots)} loading="eager" fetchpriority="high">` : '<div class="tar-hero-placeholder"><div class="tar-brand-mark">★</div></div>'}
        <div class="tar-hero-spotlight-meta">
          <span class="tar-hero-spotlight-title">${escapeHtml(headline)}</span>
        </div>
      </div>
    </div>
  </div>
</section>`;
}
