import type { Section } from '../../document.ts';
import { escapeAttribute, escapeHtml, safeHref } from '../../html.ts';
import { settingsOf, slotList, slotText, slotsOf, type RenderContext } from '../nodes.ts';
import { headerLinks } from '../header/links.ts';

/**
 * The closing card: who the store is, where the page goes, and the contact details the
 * merchant supplied. Nothing here is invented - a store with no phone shows no phone.
 */
export function render(section: Section, context: RenderContext): string {
  const doc = context.doc;
  const page = doc.pages[0];
  const slots = slotsOf(section, doc, context.recipe).values;
  const settings = settingsOf(section, context.recipe);
  const brand = slotText(slots, 'headline') || slotText(slots, 'brand', context.recipe?.fallback.brand || 'Your store name');
  const bio = slotText(slots, 'body');
  const lines = slotList(slots, 'points');
  const links = settings.links === false ? [] : headerLinks(page);

  const nav = links.length
    ? `<div class="tar-footer-col">
        <h4 class="tar-footer-col-title">Pages</h4>
        <ul class="tar-footer-list">${links.map((link) => `<li><a href="${escapeAttribute(safeHref(link.href) || '#')}">${escapeHtml(link.label)}</a></li>`).join('')}</ul>
      </div>`
    : '';
  const contact = lines.length
    ? `<div class="tar-footer-col">
        <h4 class="tar-footer-col-title">Contact</h4>
        <ul class="tar-footer-list">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
      </div>`
    : '';

  return `<footer id="${escapeAttribute(section.id || 'site-footer')}" class="tar-footer" data-purpose="footer">
  <div class="tar-footer-wrap">
    <div class="tar-footer-grid">
      <div class="tar-footer-col">
        <a class="tar-footer-brand" href="/">${escapeHtml(brand)}</a>
        ${bio ? `<p class="tar-footer-bio">${escapeHtml(bio)}</p>` : ''}
      </div>
      ${nav}
      ${contact}
    </div>
    <div class="tar-footer-bottom">
      <span>© ${new Date().getFullYear()} ${escapeHtml(brand)}</span>
    </div>
  </div>
</footer>`;
}
