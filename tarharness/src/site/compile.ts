/**
 * Site v2 compiler: pure lightweight compiler and dispatcher.
 *
 * Dispatches to isolated primitives in registry.ts, bundles CSS from styles.ts,
 * emits canonical metadata, sitemap, robots, and the tiny interaction runtime.
 * Under 150KB bundle served at the edge with revision cache-busting.
 */

import type { Asset, Node, Page, Persona, Section, SiteDocument } from './document.ts';
import { escapeAttribute, escapeHtml, slugify } from './html.ts';
import { TONE_STYLE } from './design.ts';
import { compileCss, type CssCollector } from './styles.ts';
import { getPrimitive } from './registry.ts';
import { EXT, itemSlug, renderNodes, type RenderContext, type ResolvedItem } from './primitives/nodes.ts';
import { renderDefaultHeaderNav } from './primitives/nav.ts';
import { renderDefaultCatalogSection } from './primitives/collection.ts';
import { renderShopifyFooter } from './primitives/action.ts';

export type { ResolvedItem } from './primitives/nodes.ts';

export interface CompiledFile {
  path: string;
  mime: string;
  body: string | Uint8Array;
  hash: string;
}

export interface CompileOptions {
  origin?: string;
  release?: string;
  media?: (asset: Asset) => Promise<Uint8Array | null>;
}

export interface CompileResult {
  files: CompiledFile[];
  hash: string;
  itemCount: number;
  redirects: { from: string; to: string; status: 308 }[];
  personas: { id: string; when: Persona['when']; priority: number }[];
}

const sha = async (value: string): Promise<string> => {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const RUNTIME = `
(function () {
  var menus = document.querySelectorAll('[data-menu]');
  for (var index = 0; index < menus.length; index += 1) {
    (function (menu) {
      var button = menu.querySelector('.tar-menu-btn, .tar-menu-circle-btn');
      var id = menu.getAttribute('data-menu');
      var list = document.getElementById(id);
      if (!button || !list) return;
      menu.setAttribute('data-ready', '');
      button.setAttribute('aria-controls', id);
      button.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = menu.hasAttribute('data-open');
        if (open) menu.removeAttribute('data-open'); else menu.setAttribute('data-open', '');
        button.setAttribute('aria-expanded', String(!open));
      });
      var links = list.querySelectorAll('a');
      for (var k = 0; k < links.length; k += 1) {
        links[k].addEventListener('click', function () {
          menu.removeAttribute('data-open');
          button.setAttribute('aria-expanded', 'false');
        });
      }
      document.addEventListener('click', function (e) {
        if (!menu.contains(e.target)) {
          menu.removeAttribute('data-open');
          button.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          menu.removeAttribute('data-open');
          button.setAttribute('aria-expanded', 'false');
        }
      });
    })(menus[index]);
  }
  var tabs = document.querySelectorAll('[data-tabs]');
  for (var t = 0; t < tabs.length; t += 1) {
    (function (group) {
      var buttons = group.querySelectorAll('[role="tab"]');
      var panels = group.querySelectorAll('[role="tabpanel"]');
      if (!buttons.length) return;
      group.setAttribute('data-ready', '');
      var activate = function (active) {
        for (var i = 0; i < buttons.length; i += 1) {
          var selected = buttons[i] === active;
          buttons[i].setAttribute('aria-selected', String(selected));
          buttons[i].setAttribute('tabindex', selected ? '0' : '-1');
          if (panels[i]) { if (selected) panels[i].removeAttribute('hidden'); else panels[i].setAttribute('hidden', ''); }
        }
      };
      for (var i = 0; i < buttons.length; i += 1) {
        buttons[i].addEventListener('click', function (event) { activate(event.currentTarget); });
      }
      activate(buttons[0]);
    })(tabs[t]);
  }
  var searches = document.querySelectorAll('[data-search]');
  for (var s = 0; s < searches.length; s += 1) {
    (function (input) {
      var form = input.form;
      if (form) form.addEventListener('submit', function (event) { event.preventDefault(); });
      var target = document.getElementById(input.getAttribute('data-search'));
      if (!target) return;
      var items = target.querySelectorAll('[data-item]');
      input.addEventListener('input', function () {
        var value = input.value.toLowerCase();
        for (var i = 0; i < items.length; i += 1) {
          var match = items[i].getAttribute('data-item').indexOf(value) !== -1;
          if (match) items[i].removeAttribute('hidden'); else items[i].setAttribute('hidden', '');
        }
      });
    })(searches[s]);
  }
  var galleries = document.querySelectorAll('[data-gallery]');
  if (galleries.length) {
    var box = document.createElement('div');
    box.className = 'tar-lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Image');
    box.addEventListener('click', function () { box.removeAttribute('data-open'); });
    document.body.appendChild(box);
    for (var g = 0; g < galleries.length; g += 1) {
      galleries[g].addEventListener('click', function (event) {
        var image = event.target && event.target.tagName === 'IMG' ? event.target : null;
        if (!image) return;
        box.innerHTML = '';
        var clone = document.createElement('img');
        clone.src = image.src;
        clone.alt = image.alt || '';
        box.appendChild(clone);
        box.setAttribute('data-open', '');
      });
    }
  }
})();
`.trim();

function renderSection(section: Section, context: RenderContext): string {
  const isHero = section.purpose === 'hero' || (section.purpose === 'header' && section.id === 'hero');
  const isNav = !isHero && (section.purpose === 'navigation' || section.purpose === 'nav' || (section.purpose === 'header' && section.id !== 'hero'));
  const isFooter = section.purpose === 'footer' || section.id === 'site-footer' || section.id === 'footer';

  // 1. Resolve design option from section or blueprint
  let option = (section as unknown as { option?: string }).option;
  if (!option) {
    if (isNav) {
      option = context.doc.blueprint?.headerStyle;
    } else if (isHero) {
      option = context.doc.blueprint?.heroPattern;
    } else if (isFooter) {
      option = (context.doc.blueprint as Record<string, unknown> | undefined)?.footerStyle as string | undefined;
    } else if (section.purpose === 'notice') {
      const textNode = section.nodes?.find((n) => n.kind === 'text');
      const text = String(textNode?.props?.text || '');
      if (text.toLowerCase().includes('quiz') || context.doc.blueprint?.heroPattern === 'centered_atmospheric') {
        option = 'quiz_pill';
      }
    }
  }

  // 2. Dispatch to the modular primitive registry
  const purpose = isHero ? 'hero' : isNav ? 'navigation' : isFooter ? 'footer' : section.purpose;
  const primitive = getPrimitive(purpose, option);
  return primitive.render(section, context);
}

function pageMeta(doc: SiteDocument, page: Page, origin: string | undefined, canonicalPath: string, titleOverride?: string): string {
  const title = escapeHtml(`${titleOverride || page.title} — ${doc.pages[0].title}`);
  const description = escapeHtml(page.meta?.description || doc.brief.goal || `${doc.pages[0].title}`);
  const canonical = origin ? `${origin}${canonicalPath === '/' ? '/' : canonicalPath}` : null;
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: titleOverride || page.title,
    description: page.meta?.description || doc.brief.goal || undefined,
    inLanguage: doc.locale,
  };
  return `<title>${title}</title>
  <meta name="description" content="${description}">
  ${canonical ? `<link rel="canonical" href="${escapeAttribute(canonical)}">` : ''}
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  ${canonical ? `<meta property="og:url" content="${escapeAttribute(canonical)}">` : ''}
  <meta property="og:type" content="website">
  <script type="application/ld+json">
${JSON.stringify(structured, null, 2).replace(/</g, '\\u003c')}
  </script>`;
}

function pageHtml(doc: SiteDocument, page: Page, body: string, origin: string | undefined, canonicalPath: string, cssPath: string, runtime: boolean, titleOverride?: string): string {
  return `<!DOCTYPE html>
<html lang="${escapeAttribute(doc.locale || 'en')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${pageMeta(doc, page, origin, canonicalPath, titleOverride)}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Mukta+Malar:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${cssPath}?v=${doc.revision || 1}">
  ${runtime ? '<script src="/site.js" defer></script>' : ''}
</head>
<body>
  <a class="tar-skip" href="#main">Skip to content</a>
  <main id="main">
${body}
  </main>
</body>
</html>`;
}

function withoutHidden(nodes: Node[], hidden: Set<string>): Node[] {
  const kept: Node[] = [];
  for (const node of nodes) {
    if (hidden.has(node.id) && !(node.kind === 'heading' && Number(node.props.level) === 1)) continue;
    const children = node.children ? withoutHidden(node.children, hidden) : undefined;
    if (node.children && !children?.length) continue;
    kept.push({ ...node, ...(children ? { children } : {}) });
  }
  return kept;
}

function variantOf(doc: SiteDocument, persona: Persona): SiteDocument {
  const hidden = new Set(persona.hide || []);
  const rank = new Map((persona.order || []).map((id, index) => [id, index]));
  const pages = doc.pages.map((page) => {
    const sections = page.sections
      .filter((section) => !hidden.has(section.id))
      .map((section) => {
        const nodes = withoutHidden(section.nodes, hidden);
        if (!nodes.length) return null;
        const tint = TONE_STYLE[String(persona.tone?.[section.id] || '')];
        const base = { ...(section.style?.base || {}), ...(tint || {}) };
        return { ...section, nodes, ...(section.style || tint ? { style: { ...section.style, base } } : {}) } as Section;
      })
      .filter((section): section is Section => section !== null)
      .sort((left, right) => (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER));
    return { ...page, sections: sections.length ? sections : page.sections };
  });
  return { ...doc, pages };
}

function hasCatalogSection(page: Page): boolean {
  return page.sections.some((s) => s.purpose === 'catalog' || s.purpose === 'collection' || s.purpose === 'menu' || s.purpose === 'services' || s.nodes.some((n) => n.kind === 'collection'));
}

function hasNavSection(page: Page): boolean {
  return page.sections.some((s) => s.id !== 'hero' && (s.purpose === 'navigation' || s.purpose === 'nav' || s.id === 'nav' || s.nodes.some((n) => n.kind === 'navigation')));
}

function hasFooterSection(page: Page): boolean {
  return page.sections.some((s) => s.purpose === 'footer' || s.nodes.some((n) => n.kind === 'footer'));
}

export async function compileDocument(doc: SiteDocument, options: CompileOptions = {}): Promise<CompileResult> {
  const collector: CssCollector = { classes: new Map(), runtime: new Set() };
  const files: CompiledFile[] = [];
  let itemCount = 0;
  const base = options.origin ? new URL(options.origin).pathname.replace(/\/$/, '') : '';
  const detailPages: { path: string; page: Page; item: ResolvedItem; detailNodes: Node[] }[] = [];
  const routes: string[] = [];

  const contexts = (item?: ResolvedItem, index = 0): RenderContext => ({ doc, collector, base, item, index });

  for (const page of doc.pages) {
    const hasNav = hasNavSection(page);
    const hasCatalog = hasCatalogSection(page);
    const hasFooter = hasFooterSection(page);
    const renderedSections = page.sections
      .filter((section) => section.purpose !== 'contact' && section.id !== 'contact')
      .map((section) => renderSection(section, contexts()))
      .filter(Boolean);
    if (!hasNav) {
      const navHtml = renderDefaultHeaderNav(doc, page);
      const noticeIndex = page.sections.findIndex((s) => s.purpose === 'notice');
      if (noticeIndex === 0) {
        renderedSections.splice(1, 0, navHtml);
      } else {
        renderedSections.unshift(navHtml);
      }
    }
    if (!hasCatalog) {
      const catalogHtml = renderDefaultCatalogSection(doc);
      const contactIndex = renderedSections.findIndex((s) => s.includes('data-purpose="contact"'));
      if (contactIndex >= 0) {
        renderedSections.splice(contactIndex, 0, catalogHtml);
      } else {
        renderedSections.push(catalogHtml);
      }
    }
    if (!hasFooter) {
      const footerOption = (doc.blueprint as Record<string, unknown> | undefined)?.footerStyle as string | undefined;
      const footerPrimitive = getPrimitive('footer', footerOption);
      renderedSections.push(footerPrimitive.render({ id: 'site-footer', purpose: 'footer', nodes: [], layout: { kind: 'flow' } }, contexts()));
    }
    const body = renderedSections.join('\n');
    const runtime = collector.runtime.size > 0;
    const html = pageHtml(doc, page, body, options.origin, page.path, '/style.css', runtime);
    files.push({ path: page.path === '/' ? '/index.html' : `${page.path}/index.html`, mime: 'text/html; charset=utf-8', body: html, hash: await sha(html) });
    routes.push(page.path);

    for (const section of page.sections) {
      for (const binding of section.bindings || []) {
        const node = section.nodes.find((entry) => entry.kind === 'collection' && (entry.id === binding.slot || (entry.props || {}).slot === binding.slot || entry.id === (entry.props || {}).slot));
        if (!node) continue;
        const items = Array.isArray(node.props.items) ? node.props.items as ResolvedItem[] : [];
        itemCount += items.length;
        const size = binding.paginate?.size;
        if (size && items.length > size) {
          for (let number = 2; number * size - size < items.length; number += 1) {
            const slice = items.slice((number - 1) * size, number * size);
            const paged = { ...node, props: { ...node.props, items: slice } };
            const sectionCopy = { ...section, nodes: section.nodes.map((entry) => entry === node ? paged : entry) };
            const pagedBody = page.sections.map((entry) => entry === section ? renderSection(sectionCopy, contexts()) : renderSection(entry, contexts())).join('\n');
            const path = `${page.path === '/' ? '' : page.path}/page/${number}`;
            const html2 = pageHtml(doc, page, pagedBody, options.origin, path, '/style.css', collector.runtime.size > 0, `${page.title} (page ${number})`);
            files.push({ path: `${path}/index.html`, mime: 'text/html; charset=utf-8', body: html2, hash: await sha(html2) });
            routes.push(path);
          }
        }
        if (binding.detail && node.children?.length) {
          items.forEach((item, index) => {
            const path = `${binding.detail!.path.replace('/:item', '')}/${itemSlug(item, index)}`;
            detailPages.push({ path, page, item, detailNodes: node.children! });
          });
        }
      }
    }
  }

  // Persona variants compile beside the base pages
  const variants = [...(doc.personas || [])].sort((left, right) => right.priority - left.priority).slice(0, 4);
  for (const persona of variants) {
    const variant = variantOf(doc, persona);
    for (const page of variant.pages) {
      const hasNav = hasNavSection(page);
      const hasCatalog = hasCatalogSection(page);
      const hasFooter = hasFooterSection(page);
      const renderedSections = page.sections
        .filter((section) => section.purpose !== 'contact' && section.id !== 'contact')
        .map((section) => renderSection(section, contexts()))
        .filter(Boolean);
      if (!hasNav) {
        const navHtml = renderDefaultHeaderNav(variant, page);
        const noticeIndex = page.sections.findIndex((s) => s.purpose === 'notice');
        if (noticeIndex === 0) {
          renderedSections.splice(1, 0, navHtml);
        } else {
          renderedSections.unshift(navHtml);
        }
      }
      if (!hasCatalog) {
        const catalogHtml = renderDefaultCatalogSection(variant);
        const contactIndex = renderedSections.findIndex((s) => s.includes('data-purpose="contact"'));
        if (contactIndex >= 0) {
          renderedSections.splice(contactIndex, 0, catalogHtml);
        } else {
          renderedSections.push(catalogHtml);
        }
      }
      if (!hasFooter) {
        const footerOption = (variant.blueprint as Record<string, unknown> | undefined)?.footerStyle as string | undefined;
        const footerPrimitive = getPrimitive('footer', footerOption);
        renderedSections.push(footerPrimitive.render({ id: 'site-footer', purpose: 'footer', nodes: [], layout: { kind: 'flow' } }, contexts()));
      }
      const body = renderedSections.join('\n');
      const html = pageHtml(variant, page, body, options.origin, page.path, '/style.css', collector.runtime.size > 0);
      const path = `/.persona/${persona.id}${page.path === '/' ? '' : page.path}/index.html`;
      files.push({ path, mime: 'text/html; charset=utf-8', body: html, hash: await sha(html) });
    }
  }

  for (const entry of detailPages) {
    const inner = renderNodes(entry.detailNodes, { ...contexts(entry.item) });
    const body = `<section class="tar-section" data-purpose="detail"><div class="tar-wrap tar-stack">${inner}</div></section>`;
    const html = pageHtml(doc, entry.page, body, options.origin, entry.path, '/style.css', false, entry.item.title);
    files.push({ path: `${entry.path}/index.html`, mime: 'text/html; charset=utf-8', body: html, hash: await sha(html) });
    routes.push(entry.path);
  }

  const usedAssets = new Set<string>();
  const walk = (nodes: Node[] | undefined) => (nodes || []).forEach((node) => {
    if (typeof node.props?.asset === 'string') usedAssets.add(String(node.props.asset));
    if (Array.isArray(node.props?.assets)) (node.props.assets as unknown[]).forEach((id) => usedAssets.add(String(id)));
    walk(node.children);
  });
  doc.pages.forEach((page) => page.sections.forEach((section) => walk(section.nodes)));
  for (const asset of doc.assets) if (usedAssets.has(asset.id) && asset.rights.approved && options.media) {
    const bytes = await options.media(asset);
    if (bytes) files.push({ path: `/media/${asset.id}.${EXT[asset.mime] || 'bin'}`, mime: asset.mime, body: bytes, hash: asset.hash });
  }

  const css = compileCss(doc.design, collector);
  files.push({ path: '/style.css', mime: 'text/css; charset=utf-8', body: css, hash: await sha(css) });
  if (collector.runtime.size) files.push({ path: '/site.js', mime: 'text/javascript; charset=utf-8', body: RUNTIME, hash: await sha(RUNTIME) });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${options.origin ? routes.map((route) => `<url><loc>${escapeAttribute(`${options.origin}${route}`)}</loc></url>`).join('') : ''}</urlset>`;
  files.push({ path: '/sitemap.xml', mime: 'application/xml; charset=utf-8', body: sitemap, hash: await sha(sitemap) });
  const robots = `User-agent: *\nAllow: /\n${options.origin ? `Sitemap: ${options.origin}/sitemap.xml\n` : ''}`;
  files.push({ path: '/robots.txt', mime: 'text/plain; charset=utf-8', body: robots, hash: await sha(robots) });

  const hash = await sha(files.map((file) => `${file.path}:${file.hash}`).join('|'));
  return { files, hash, itemCount, redirects: doc.redirects.map((redirect) => ({ ...redirect })), personas: variants.map((persona) => ({ id: persona.id, when: persona.when, priority: persona.priority })) };
}
