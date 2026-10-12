import type { Section } from '../../document.ts';
import { escapeAttribute, escapeHtml } from '../../html.ts';
import { settingsOf, slotText, slotsOf, type RenderContext } from '../nodes.ts';
import { headerLinks } from './links.ts';

export function render(section: Section, context: RenderContext): string {
  const brand = slotText(slotsOf(section, context.doc, context.recipe).values, 'brand', context.recipe?.fallback.brand || 'Your store name');
  const listId = 'site-main-nav';
  const links = settingsOf(section, context.recipe).links === false ? [] : headerLinks(context.doc.pages[0]);
  const rendered = links.map((l) => `<li><a href="${escapeAttribute(l.href)}">${escapeHtml(l.label)}</a></li>`).join('');
  const initial = escapeHtml(brand.trim().charAt(0).toUpperCase());
  const menu = rendered
    ? `<nav class="tar-menu" data-menu="${listId}" aria-label="Main Navigation">
      <button class="tar-menu-circle-btn" type="button" aria-expanded="false" aria-label="Toggle navigation">
        <span class="tar-hamburger-bar"></span>
        <span class="tar-hamburger-bar"></span>
        <span class="tar-hamburger-bar"></span>
      </button>
      <ul id="${listId}" class="tar-navlinks tar-navlinks-floating">
        ${rendered}
      </ul>
    </nav>`
    : '';

  return `<header id="site-header" class="tar-nav tar-nav-floating" data-purpose="navigation">
  <div class="tar-wrap tar-nav-floating-inner">
    <a class="tar-brand-pill" href="/" aria-label="${escapeAttribute(brand)}">
      <span class="tar-brand-pill-avatar"><span class="tar-brand-pill-letter">${initial}</span></span>
      <span class="tar-brand-pill-name">${escapeHtml(brand)}</span>
    </a>
    ${menu}
  </div>
</header>`;
}
