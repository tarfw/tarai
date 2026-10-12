import type { Section } from '../../document.ts';
import { escapeAttribute, escapeHtml } from '../../html.ts';
import { slotText, slotsOf, type RenderContext } from '../nodes.ts';
import { styleClass } from '../../styles.ts';

/** The notice bar: one line of news in a thin band. */
export function render(section: Section, context: RenderContext): string {
  const notice = slotText(slotsOf(section, context.doc, context.recipe).values, 'body');
  if (!notice) return '';
  const style = styleClass(context.collector, section.style);

  return `<aside id="${escapeAttribute(section.id || 'notice')}" class="tar-notice${style}" role="region" data-purpose="announcement">
  <div class="tar-wrap tar-notice-inner">
    <span>${escapeHtml(notice)}</span>
  </div>
</aside>`;
}
