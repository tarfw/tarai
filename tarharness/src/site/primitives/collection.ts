/**
 * The honest empty shelf: what a catalog renders when the merchant has listed nothing.
 * Nothing here invents a product, a price or a badge; the owner's own notice is the only
 * copy allowed in.
 */

import { escapeAttribute, escapeHtml } from '../html.ts';

export function renderEmptyCollection(title: string, notice?: string, phone?: string): string {
  const heading = title ? `<h2 class="tar-title tar-collection-title">${escapeHtml(title)}</h2>` : '';
  const note = escapeHtml(notice || 'Nothing is listed yet. Ask us and we will tell you what is in store.');
  const clean = phone ? phone.replace(/[^0-9]/g, '') : '';
  const cta = clean
    ? `<a class="tar-btn tar-btn-outline" href="https://wa.me/${escapeAttribute(clean)}?text=${encodeURIComponent('Hello, what is available right now?')}">Ask on WhatsApp</a>`
    : '';
  return `<div class="tar-stack tar-empty">
  ${heading}
  <p>${note}</p>
  ${cta}
</div>`;
}

export function renderEmptyCatalogSection(): string {
  return `<section id="catalog" class="tar-section" data-purpose="catalog">
  <div class="tar-wrap tar-stack">
    ${renderEmptyCollection('Catalog', 'Add your first product and it appears here.')}
  </div>
</section>`;
}
