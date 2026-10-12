import type { Binding, Node, Section, SectionLayoutSpec, SiteDocument, StyleSet } from '../document.ts';
import { escapeAttribute, escapeHtml, formatMoney, safeHref, slugify } from '../html.ts';
import { styleClass, type CssCollector } from '../styles.ts';
import type { Recipe } from '../recipes/recipe.ts';
import { renderEmptyCollection } from './collection.ts';
import * as FooterCard from './footer/card.ts';

/** Media extension by mime type, for the `/media/<id>.<ext>` URLs the release ships. */
export const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif',
  'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'font/woff2': 'woff2',
};

/**
 * What a section holds, read once. Every hero used to walk these nodes itself; the walk
 * lives here so a recipe's slot names mean the same thing in every renderer. A later node
 * wins over an earlier one, which is how the documents already on disk were built.
 *
 * Only the slots the recipe declares are claimed: a widget node the recipe does not ask for
 * stays in the section and renders, instead of silently becoming the hero's caption.
 */
export type SlotValues = Record<string, string | string[]>;

/** Containers a slot may be nested in. Widgets keep their own contents. */
const WRAPPERS = ['flex', 'stack', 'grid', 'card'];

export interface SectionSlots {
  values: SlotValues;
  /** Nodes a slot already drew; the rest still has to reach the page. */
  used: Set<string>;
  /** The style the merchant put on the node a slot drew, by slot name. */
  styles: Record<string, StyleSet>;
}

export function slotsOf(section: Section, doc: SiteDocument, recipe?: Recipe): SectionSlots {
  const slots: SlotValues = { brand: doc.pages[0]?.title || '' };
  const used = new Set<string>();
  const styles: Record<string, StyleSet> = {};
  const points: string[] = [];
  const wanted = recipe ? new Set(Object.keys(recipe.slots)) : null;
  const claim = (name: string, node: Node): boolean => {
    if (wanted && !wanted.has(name)) return false;
    used.add(node.id);
    if (node.style) styles[name] = node.style;
    return true;
  };
  const visit = (nodes: Node[] | undefined): void => {
    for (const node of nodes || []) {
      const props = (node.props || {}) as Record<string, unknown>;
      const text = typeof props.text === 'string' ? props.text : typeof props.label === 'string' ? props.label : '';
      if (node.kind === 'heading' && text && claim('headline', node)) slots.headline = text;
      else if (node.kind === 'text' && text && claim('body', node)) slots.body = text;
      else if (node.kind === 'button' && typeof props.href === 'string' && claim('cta', node)) {
        slots.cta = text;
        slots.ctaHref = safeHref(props.href) || '';
      } else if (node.kind === 'image' && typeof props.asset === 'string') {
        const asset = doc.assets.find((entry) => entry.id === props.asset);
        if (asset && claim('media', node)) {
          slots.media = `/media/${asset.id}.${EXT[asset.mime] || 'jpg'}`;
          slots.mediaAlt = typeof props.alt === 'string' ? props.alt : (asset.alt || '');
          if (asset.width && asset.height) {
            slots.mediaWidth = String(asset.width);
            slots.mediaHeight = String(asset.height);
          }
        }
      } else if (node.kind === 'list' && Array.isArray(props.items) && props.items.length && claim('points', node)) {
        for (const item of props.items) if (typeof item === 'string' && item.trim()) points.push(item);
      }
      if (WRAPPERS.includes(node.kind)) visit(node.children);
    }
  };
  visit(section.nodes);
  if (points.length) slots.points = points;
  return { values: slots, used, styles };
}

/** The classes a slot's own node carried, so a merchant's radius survives the recipe. */
export function slotStyle(context: RenderContext, slots: SectionSlots, name: string): string {
  const set = slots.styles[name];
  return set ? styleClass(context.collector, set) : '';
}

/** The nodes a recipe's slots did not draw, with containers whose children were all drawn. */
export function unusedNodes(nodes: Node[] | undefined, used: Set<string>): Node[] {
  const out: Node[] = [];
  for (const node of nodes || []) {
    if (used.has(node.id)) continue;
    if (!node.children?.length) { out.push(node); continue; }
    const rest = unusedNodes(node.children, used);
    if (rest.length) out.push({ ...node, children: rest });
  }
  return out;
}

/** The first image the store owns, for layouts whose media slot may be filled from anywhere. */
export function firstImage(doc: SiteDocument): { src: string; alt: string } | null {
  const asset = doc.assets.find((entry) => entry.kind === 'image');
  if (!asset) return null;
  return { src: `/media/${asset.id}.${EXT[asset.mime] || 'jpg'}`, alt: asset.alt || '' };
}

export function slotText(slots: SlotValues, name: string, fallback = ''): string {
  const value = slots[name];
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && value.length) return value[0];
  return fallback;
}

export function slotList(slots: SlotValues, name: string): string[] {
  const value = slots[name];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

/**
 * One line of shop words: what the merchant typed beats what the build wrote into the slot,
 * which beats the recipe's own default (parai D10). A renderer reads copy only through here,
 * so a saved setting shows in the next preview instead of waiting for a regeneration.
 */
export function wordsOf(section: Section, recipe: Recipe | undefined, slots: SlotValues, setting: string, slot: string, floor = ''): string {
  const turned = section.recipe?.settings?.[setting];
  if (typeof turned === 'string' && turned.trim()) return turned.trim();
  const built = slotText(slots, slot);
  if (built.trim()) return built;
  return String(recipe?.settings[setting]?.default ?? floor) || floor;
}

/** `width` / `height` for a slot's image, so a hero cannot shift the page while it paints. */
export function mediaSize(slots: SlotValues): string {
  const width = slotText(slots, 'mediaWidth');
  const height = slotText(slots, 'mediaHeight');
  return width && height ? ` width="${escapeAttribute(width)}" height="${escapeAttribute(height)}"` : '';
}

/**
 * The merchant's turn of the recipe, over the defaults the recipe declares. A renderer reads
 * a setting and nothing else, so an override cannot smuggle in a colour or a length.
 */
export function settingsOf(section: Section, recipe?: Recipe): Record<string, boolean | string> {
  const out: Record<string, boolean | string> = {};
  for (const [name, setting] of Object.entries(recipe?.settings || {})) out[name] = setting.default;
  const stored = section.recipe?.settings;
  if (stored && typeof stored === 'object') {
    for (const [name, value] of Object.entries(stored as Record<string, unknown>)) {
      if (typeof value === 'boolean' || typeof value === 'string') out[name] = value;
    }
  }
  return out;
}

export interface ResolvedItem {
  id?: string;
  slug?: string;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  image?: string;
  image2?: string;
  badge?: string;
  colours?: number;
  swatches?: string[];
}

export interface RenderContext {
  doc: SiteDocument;
  collector: CssCollector;
  base: string;
  binding?: Binding;
  item?: ResolvedItem;
  index: number;
  sectionLayout?: SectionLayoutSpec;
  /** The recipe chosen for this section, when one exists. */
  recipe?: Recipe;
}

export const ICONS: Record<string, string> = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M4 12l5 5L20 6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  phone: 'M6 3h4l2 5-3 2a12 12 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 014 5a2 2 0 012-2z',
  pin: 'M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11zM12 10a2 2 0 100-4 2 2 0 000 4z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  bag: 'M6 7h12l1 13H5zM9 7a3 3 0 016 0',
  heart: 'M12 20s-7-4.5-7-9.5A3.5 3.5 0 0112 8a3.5 3.5 0 017 2.5c0 5-7 9.5-7 9.5z',
  search: 'M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  person: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
};

export function itemSlug(item: ResolvedItem, index: number): string {
  return item.slug || `${slugify(item.title)}-${index + 1}`;
}

export function renderNodes(nodes: Node[] | undefined, context: RenderContext): string {
  if (!Array.isArray(nodes)) return '';
  return nodes.map((node) => renderNode(node, context)).join('\n');
}

export function renderChildren(node: Node, context: RenderContext): string {
  return renderNodes(node.children, context);
}

export function renderNode(node: Node, context: RenderContext): string {
  const style = styleClass(context.collector, node.style);
  const id = escapeAttribute(node.id);
  const merged = node.props || {};
  const item = context.item;

  switch (node.kind) {
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(merged.level) || 2));
      const field = String(merged.field || '');
      const content = item && field ? (field === 'title' ? item.title : field === 'description' ? item.description || '' : '') : String(merged.text || '');
      return `<h${level} id="${id}" class="tar-title${style}">${escapeHtml(content)}</h${level}>`;
    }
    case 'text': {
      const field = String(merged.field || '');
      const content = item && field === 'description' ? item.description || '' : String(merged.text || '');
      return `<p id="${id}" class="tar-prose${style}">${escapeHtml(content).replace(/\n/g, '<br>')}</p>`;
    }
    case 'image': {
      const asset = context.doc.assets.find((entry) => entry.id === merged.asset);
      if (!asset) return '';
      const source = `/media/${asset.id}.${EXT[asset.mime] || 'bin'}`;
      const alt = merged.decorative ? '' : escapeAttribute(merged.alt ?? asset.alt ?? '');
      const dimensions = asset.width && asset.height ? ` width="${asset.width}" height="${asset.height}"` : '';
      return `<img id="${id}" class="tar-media${style}" src="${source}" alt="${alt}"${dimensions} loading="lazy" decoding="async">`;
    }
    case 'video': {
      const asset = context.doc.assets.find((entry) => entry.id === merged.asset);
      const remote = safeHref(merged.url);
      const source = asset ? `/media/${asset.id}.${EXT[asset.mime] || 'bin'}` : remote;
      if (!source) return '';
      return `<video id="${id}" class="tar-media${style}" src="${escapeAttribute(source)}" controls preload="metadata" playsinline></video>`;
    }
    case 'icon': {
      const path = ICONS[String(merged.name)] || ICONS.sparkle;
      return `<svg id="${id}" class="tar-icon${style}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
    }
    case 'list': {
      const items = Array.isArray(merged.items) ? merged.items as unknown[] : [];
      return `<ul id="${id}" class="tar-list${style}">${items.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>`;
    }
    case 'link': {
      const href = safeHref(merged.href) || '#';
      return `<a id="${id}" class="tar-link${style}" href="${href}">${escapeHtml(merged.label)}</a>`;
    }
    case 'button': {
      const label = escapeHtml(merged.label);
      const href = safeHref(merged.href) || '#';
      const variantClass = merged.variant === 'secondary' ? ' tar-btn-secondary' : merged.variant === 'outline' ? ' tar-btn-outline' : ' tar-btn-primary';
      return `<a id="${id}" class="tar-btn${variantClass}${style}" href="${href}">${label}</a>`;
    }
    case 'divider': return `<hr id="${id}" class="tar-divider">`;
    case 'spacer': return `<div id="${id}" class="tar-spacer" aria-hidden="true"></div>`;
    case 'flex': return `<div id="${id}" class="tar-flex${style}">${renderChildren(node, context)}</div>`;
    case 'stack': return `<div id="${id}" class="tar-stack${style}">${renderChildren(node, context)}</div>`;
    case 'grid': return `<div id="${id}" class="tar-grid${style}">${renderChildren(node, context)}</div>`;
    case 'card': return `<div id="${id}" class="tar-card${style}">${renderChildren(node, context)}</div>`;
    case 'collection': {
      const items = Array.isArray(merged.items) ? merged.items as (ResolvedItem & { whatsapp?: string; badge?: string })[] : [];
      const binding = context.binding;
      const detail = binding?.detail?.path;
      const emptyNotice = (merged.whatsappPhone as string) || (context.doc.brief as unknown as Record<string, unknown>)?.phone as string;
      if (!items.length) return `<div id="${id}" class="tar-stack${style}">${renderEmptyCollection(String(merged.title || ''), binding?.empty?.text, emptyNotice)}</div>`;
      const hasPriorHeading = context.doc.pages?.some((p) => p.sections?.some((s) => s.nodes?.some((n) => n.kind === 'heading' && String(n.props?.text).trim().toLowerCase() === String(merged.title || '').trim().toLowerCase())));
      const title = (merged.title && !hasPriorHeading) ? `<div class="tar-collection-header"><h2 class="tar-title tar-collection-title">${escapeHtml(merged.title)}</h2></div>` : '';
      const cards = items.map((entry, index) => {
        const slug = itemSlug(entry, index);
        const cardImg = entry.image && /^https?:\/\//.test(entry.image) ? entry.image : (entry.image ? `/media/${entry.image}` : '');
        const badge = entry.badge ? `<span class="tar-card-badge">${escapeHtml(entry.badge)}</span>` : '';
        const media = cardImg ? `<div class="tar-card-media">
          ${badge}
          <img class="tar-card-img" src="${escapeAttribute(cardImg)}" alt="${escapeAttribute(entry.title)}" loading="lazy" decoding="async">
        </div>` : `<div class="tar-card-media tar-card-media-placeholder">
          ${badge}
          <div class="tar-card-placeholder-box">${escapeHtml(entry.title.slice(0, 2).toUpperCase())}</div>
        </div>`;
        const priceHtml = entry.price !== undefined
          ? `<span class="tar-price">${formatMoney(entry.price, entry.currency || context.doc.currency || 'INR', context.doc.locale)}</span>`
          : '';
        const descHtml = entry.description ? `<p class="tar-card-desc">${escapeHtml(entry.description)}</p>` : '';
        const ctaHtml = '';
        const body = `<div class="tar-card tar-product-card">
              ${media}
              <div class="tar-card-meta">
                <strong class="tar-product-title">${escapeHtml(entry.title)}</strong>
                ${descHtml}
                <div class="tar-card-footer">
                  ${priceHtml}
                  ${ctaHtml}
                </div>
              </div>
            </div>`;
        const href = detail ? `${detail.replace('/:item', '')}/${encodeURIComponent(slug)}` : null;
        const card = `<div class="tar-collection-card" data-item="${escapeAttribute(`${entry.title} ${entry.description || ''}`.toLowerCase())}">${body}</div>`;
        return href ? `<a class="tar-cardlink" href="${escapeAttribute(href)}">${card}</a>` : card;
      }).join('\n');
      const secCols = (merged.columns as number | undefined) || context.sectionLayout?.columns || context.doc.design.layout.columns;
      const secKind = context.sectionLayout?.kind;
      const isStack = secKind === 'stack' && secCols === 1;
      const isRail = secKind === 'rail';
      const inner = isStack ? 'tar-stack' : isRail ? 'tar-rail' : 'tar-grid tar-product-grid';
      const innerStyle = isStack ? ' style="display:flex;flex-direction:column;gap:24px;max-width:720px;margin:0 auto;width:100%"' : '';
      return `<div id="${id}" class="tar-stack${style}" style="width:100%">${title}<div class="${inner}"${innerStyle}>${cards}</div></div>`;
    }
    case 'navigation': {
      const links = Array.isArray(merged.links) ? merged.links as { label?: string; href?: string }[] : [];
      const listId = `nav-${escapeAttribute(node.id)}`;
      const rendered = links.map((link) => {
        const href = safeHref(link.href);
        return href ? `<li><a href="${href}">${escapeHtml(link.label)}</a></li>` : '';
      }).join('');
      return `<header id="${escapeAttribute(node.id)}" class="tar-nav">
        <div class="tar-wrap tar-nav-inner">
          <a class="tar-brand" href="/">${escapeHtml(merged.brand || '')}</a>
          <nav class="tar-menu" data-menu="${listId}" aria-label="Main">
            ${rendered ? `<button class="tar-menu-btn" type="button" aria-expanded="false">☰</button><ul id="${listId}" class="tar-navlinks">${rendered}</ul>` : ''}
          </nav>
        </div>
      </header>`;
    }
    case 'footer': {
      // Documents that predate sections carried their footer as a node; render it through
      // the same primitive the section uses so a store never gets two footers.
      const brand = typeof merged.brand === 'string' && merged.brand
        ? [{ id: `${node.id}-brand`, kind: 'heading' as const, props: { text: merged.brand, level: 3 } }]
        : [];
      const legacy: Section = {
        id: node.id,
        purpose: 'footer',
        layout: { kind: 'row' },
        nodes: [...brand, ...(node.children || [])],
      };
      return FooterCard.render(legacy, context);
    }
    case 'menu': {
      const links = Array.isArray(merged.links) ? merged.links as { label?: string; href?: string }[] : [];
      const listId = `menu-${escapeAttribute(node.id)}`;
      const rendered = links.map((link) => {
        const href = safeHref(link.href);
        return href ? `<li><a href="${href}">${escapeHtml(link.label)}</a></li>` : '';
      }).join('');
      context.collector.runtime.add('menu');
      return `<nav id="${id}" class="tar-stack${style}"><button class="tar-menu-btn" type="button" aria-expanded="false">${escapeHtml(merged.label || 'Menu')}</button><ul class="tar-navlinks">${rendered}</ul></nav>`;
    }
    case 'tabs': {
      context.collector.runtime.add('tabs');
      const children = node.children || [];
      const buttons = children.map((child, index) => `<button role="tab" type="button" id="${escapeAttribute(child.id)}-tab" aria-controls="${escapeAttribute(child.id)}" aria-selected="${index === 0}" tabindex="${index === 0 ? '0' : '-1'}">${escapeHtml((child.props || {}).label)}</button>`).join('');
      const panels = children.map((child, index) => `<div role="tabpanel" id="${escapeAttribute(child.id)}" aria-labelledby="${escapeAttribute(child.id)}-tab"${index === 0 ? '' : ' hidden'}>${renderNodes(child.children, context)}</div>`).join('');
      return `<div id="${id}" class="tar-tabs${style}" data-tabs><div role="tablist">${buttons}</div>${panels}</div>`;
    }
    case 'accordion': {
      const children = node.children || [];
      return `<div id="${id}" class="tar-stack${style}">${children.map((child) => `<details class="tar-acc"><summary>${escapeHtml((child.props || {}).label)}</summary><div>${renderNodes(child.children, context)}</div></details>`).join('')}</div>`;
    }
    case 'gallery': {
      const assets = Array.isArray(merged.assets) ? merged.assets as string[] : [];
      context.collector.runtime.add('gallery');
      const images = assets.map((assetId) => {
        const asset = context.doc.assets.find((entry) => entry.id === assetId);
        if (!asset) return '';
        return `<img src="/media/${asset.id}.${EXT[asset.mime] || 'bin'}" alt="${escapeAttribute(asset.alt || '')}" loading="lazy" decoding="async">`;
      }).join('');
      return `<div id="${id}" class="tar-gallery${style}" data-gallery>${images}</div>`;
    }
    case 'search': {
      context.collector.runtime.add('search');
      const target = escapeAttribute(merged.target);
      return `<form id="${id}" class="tar-search${style}" role="search"><label class="tar-visually-hidden" for="${id}-input">Search</label><input id="${id}-input" type="search" data-search="${target}" placeholder="${escapeAttribute(merged.placeholder || 'Search')}"><button class="tar-btn tar-btn-secondary" type="submit">Search</button></form>`;
    }
    default:
      return '';
  }
}
