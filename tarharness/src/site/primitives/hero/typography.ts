import type { Section } from '../../document.ts';
import { escapeAttribute, escapeHtml } from '../../html.ts';
import { renderNodes, wordsOf, slotStyle, slotText, slotsOf, unusedNodes, type RenderContext } from '../nodes.ts';
import { styleClass } from '../../styles.ts';

/** The typography hero: one large line, one supporting line, one action. */
export function render(section: Section, context: RenderContext): string {
  const found = slotsOf(section, context.doc, context.recipe);
  const slots = found.values;
  const headline = slotText(slots, 'headline', context.recipe?.fallback.headline || 'Your store name');
  const subline = slotText(slots, 'body');
  const href = slotText(slots, 'ctaHref', context.recipe?.fallback.cta || '#catalog');
  const label = wordsOf(section, context.recipe, slots, 'label', 'cta', 'See the shop');

  const style = styleClass(context.collector, section.style);
  const id = escapeAttribute(section.id || 'hero');
  const actionsHtml = `<div class="tar-hero-actions"><a href="${escapeAttribute(href)}" class="tar-btn tar-btn-outline${slotStyle(context, found, 'cta')}">${escapeHtml(label)}</a></div>`;
  const rest = unusedNodes(section.nodes, found.used);
  const extra = rest.length ? `<div class="tar-stack">${renderNodes(rest, context)}</div>` : '';

  return `<section id="${id}" class="tar-hero tar-hero-typography${style}" data-purpose="hero">
  <div class="tar-hero-inner">
    <div class="tar-hero-text">
      <h1 class="tar-hero-title${slotStyle(context, found, 'headline')}">${escapeHtml(headline)}</h1>
      ${subline ? `<p class="tar-hero-desc${slotStyle(context, found, 'body')}">${escapeHtml(subline)}</p>` : ''}
      ${actionsHtml}
      ${extra}
    </div>
  </div>
</section>`;
}
