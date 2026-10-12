import type { Section } from '../../document.ts';
import { escapeAttribute, escapeHtml } from '../../html.ts';
import { slotText, slotsOf, type RenderContext } from '../nodes.ts';
import { styleClass } from '../../styles.ts';

/** The notice pill: one line of news with one round action at the end. */
export function render(section: Section, context: RenderContext): string {
  const slots = slotsOf(section, context.doc, context.recipe).values;
  const notice = slotText(slots, 'body');
  if (!notice) return '';
  const href = slotText(slots, 'ctaHref', context.recipe?.fallback.cta || '#catalog');
  const style = styleClass(context.collector, section.style);

  return `<aside id="${escapeAttribute(section.id || 'notice')}" class="tar-notice tar-notice-quiz${style}" role="region" data-purpose="announcement">
  <div class="tar-wrap tar-notice-inner">
    <a href="${escapeAttribute(href)}" class="tar-notice-quiz-link">
      <span>${escapeHtml(notice)}</span>
      <span class="tar-notice-arrow-pill" aria-hidden="true">&rarr;</span>
    </a>
  </div>
</aside>`;
}
