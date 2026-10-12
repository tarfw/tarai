import type { Section } from '../../document.ts';
import { escapeAttribute, escapeHtml } from '../../html.ts';
import { settingsOf, slotText, slotsOf, type RenderContext } from '../nodes.ts';
import { headerLinks } from './links.ts';

export function render(section: Section, context: RenderContext): string {
  const brand = slotText(slotsOf(section, context.doc, context.recipe).values, 'brand', context.recipe?.fallback.brand || 'Your store name');
  const listId = 'site-main-nav';
  const links = settingsOf(section, context.recipe).links === false ? [] : headerLinks(context.doc.pages[0]);
  const rendered = links.map((l) => `<li><a href="${escapeAttribute(l.href)}">${escapeHtml(l.label)}</a></li>`).join('');
  const menu = rendered
    ? `<nav class="tar-menu" data-menu="${listId}" aria-label="Main Navigation">
      <button class="tar-menu-btn" type="button" aria-expanded="false" aria-label="Toggle navigation">☰</button>
      <ul id="${listId}" class="tar-navlinks">
        ${rendered}
      </ul>
    </nav>`
    : '';

  return `<header id="site-header" class="tar-nav" data-purpose="navigation">
  <div class="tar-wrap tar-nav-inner">
    <a class="tar-brand" href="/">${escapeHtml(brand)}</a>
    ${menu}
  </div>
</header>`;
}
