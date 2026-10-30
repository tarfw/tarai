// sections.ts — the section library: six kinds, a few variants each. Every
// section reads the style tokens (var(--ink), var(--bg), ...) and hardcodes no
// colour, font, radius or width, so any stack works on any style (paraiv2 §2).

import { escapeAttribute, escapeHtml, formatMoney, safeHref } from './html.ts';
import type { SiteData, Style } from './types.ts';

export interface Item {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly price?: number;
  readonly currency?: string;
  readonly image?: string;
}

export interface RenderContext {
  readonly site: SiteData;
  readonly style: Style;
  readonly items: readonly Item[];
  readonly media?: (assetId: string) => string | null;
}

const link = (href: string, label: string, cls = ''): string => {
  const safe = safeHref(href);
  return safe ? `<a${cls ? ` class="${cls}"` : ''} href="${safe}">${escapeHtml(label)}</a>` : escapeHtml(label);
};

const picture = (url: string | null | undefined, alt: string): string => {
  const safe = safeHref(url);
  return safe ? `<img src="${safe}" alt="${escapeAttribute(alt)}" loading="lazy">` : '';
};

export function renderNav(context: RenderContext, variant: string): string {
  const { site } = context;
  const links = [link('#catalog', 'Menu'), link('#contact', 'Visit')].join('');
  if (variant === 'centered-pill') {
    return `<header class="nav nav-pill"><span class="brand">${escapeHtml(site.title)}</span><nav>${links}</nav></header>`;
  }
  return `<header class="nav nav-left"><span class="brand">${escapeHtml(site.title)}</span><nav>${links}</nav></header>`;
}

export function renderHero(context: RenderContext, variant: string): string {
  const { site, media } = context;
  const photo = site.assets.length ? media?.(site.assets[0].id) : null;
  const cta = site.contact?.whatsapp ? link(`https://wa.me/${site.contact.whatsapp.replace(/[^0-9]/g, '')}`, 'Order on WhatsApp', 'cta') : link('#catalog', 'See the menu', 'cta');
  if (variant === 'bleed-overlay' && photo) {
    return `<section class="hero hero-bleed"><div class="hero-media">${picture(photo, site.title)}</div><div class="hero-copy"><h1>${escapeHtml(site.title)}</h1>${site.tagline ? `<p class="tagline">${escapeHtml(site.tagline)}</p>` : ''}${cta}</div></section>`;
  }
  return `<section class="hero hero-type"><h1>${escapeHtml(site.title)}</h1>${site.tagline ? `<p class="tagline">${escapeHtml(site.tagline)}</p>` : ''}${cta}</section>`;
}

export function renderCatalog(context: RenderContext, variant: string): string {
  const { items, style } = context;
  if (!items.length) {
    return `<section class="catalog catalog-empty" id="catalog"><h2>Catalog</h2><p class="empty">Items are on their way.</p></section>`;
  }
  const price = (item: Item) => item.price !== undefined && item.currency
    ? `<span class="price">${escapeHtml(formatMoney(item.price, item.currency, 'en-IN'))}</span>` : '';
  if (variant === 'photo-grid') {
    return `<section class="catalog catalog-photo" id="catalog"><h2>Catalog</h2><div class="grid">${items.map((item) => `
      <article class="tile">${item.image ? picture(item.image, item.title) : ''}<h3>${escapeHtml(item.title)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}${price(item)}</article>`).join('')}</div></section>`;
  }
  if (variant === 'bordered-cells') {
    return `<section class="catalog catalog-cells" id="catalog"><h2>Catalog</h2><ul>${items.map((item) => `
      <li><div><h3>${escapeHtml(item.title)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}</div>${price(item)}</li>`).join('')}</ul></section>`;
  }
  return `<section class="catalog catalog-menu" id="catalog"><h2>${escapeHtml(style.id === 'ink-mono' ? 'Services' : 'Menu')}</h2><ul>${items.map((item) => `
    <li><span class="item-title">${escapeHtml(item.title)}</span><span class="dots"></span>${price(item)}</li>`).join('')}</ul></section>`;
}

export function renderStory(context: RenderContext, variant: string): string {
  const { site, media } = context;
  if (!site.about) return '';
  const photo = site.assets.length > 1 ? media?.(site.assets[1].id) : null;
  if (variant === 'big-quote-band') {
    return `<section class="story story-quote"><blockquote>${escapeHtml(site.about)}</blockquote></section>`;
  }
  if (variant === 'split-photo-text' && photo) {
    return `<section class="story story-split"><div class="story-copy"><h2>About</h2><p>${escapeHtml(site.about)}</p></div><div class="story-media">${picture(photo, site.title)}</div></section>`;
  }
  return `<section class="story story-plain"><h2>About</h2><p>${escapeHtml(site.about)}</p></section>`;
}

export function renderGallery(context: RenderContext, variant: string): string {
  const { site, media } = context;
  const shots = site.assets.map((asset) => ({ asset, url: media?.(asset.id) })).filter((shot) => shot.url);
  if (shots.length < 3) return '';
  const cls = variant === 'horizontal-reel' ? 'gallery gallery-reel' : 'gallery gallery-bento';
  return `<section class="${cls}">${shots.slice(0, 6).map((shot) => picture(shot.url, shot.asset.alt || site.title)).join('')}</section>`;
}

export function renderFooter(context: RenderContext, variant: string): string {
  const { site } = context;
  const hours = site.hours?.length ? `<ul class="hours">${site.hours.map((row) => `<li>${escapeHtml(row)}</li>`).join('')}</ul>` : '';
  const contact = site.contact
    ? `<p class="contact">${[
        site.contact.address ? escapeHtml(site.contact.address) : '',
        site.contact.phone ? link(`tel:${site.contact.phone}`, site.contact.phone) : '',
        site.contact.email ? link(`mailto:${site.contact.email}`, site.contact.email) : '',
      ].filter(Boolean).join(' · ')}</p>` : '';
  const notice = site.notice ? `<p class="notice">${escapeHtml(site.notice)}</p>` : '';
  if (variant === 'minimal-whatsapp-bar' && site.contact?.whatsapp) {
    return `<footer class="footer footer-bar" id="contact">${notice}${hours}${contact}${link(`https://wa.me/${site.contact.whatsapp.replace(/[^0-9]/g, '')}`, 'WhatsApp', 'bar')}</footer>`;
  }
  return `<footer class="footer footer-card" id="contact">${notice}${hours}${contact}</footer>`;
}

export const SECTION_RENDERERS: Record<string, (context: RenderContext, variant: string) => string> = {
  nav: renderNav,
  hero: renderHero,
  catalog: renderCatalog,
  story: renderStory,
  gallery: renderGallery,
  footer: renderFooter,
};
