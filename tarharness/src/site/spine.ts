// spine.ts — one page wrapper. Injects the style's CSS variables, alternates
// the canvas/band rhythm, and slots the picked sections in order. Sections
// never know about each other; the spine is the only layout authority.

import { escapeAttribute, escapeHtml } from './html.ts';
import { SECTION_RENDERERS, type RenderContext } from './sections.ts';

const BANDS = ['a', 'b'] as const;

export function renderSite(context: RenderContext, origin?: string): { html: string; css: string } {
  const { site, style } = context;
  const body: string[] = [];
  let index = 0;
  for (const section of site.sections) {
    if (section.hidden) continue;
    const render = SECTION_RENDERERS[section.kind];
    if (!render) continue;
    const markup = render(context, section.variant);
    if (!markup) continue;
    body.push(`<div class="band band-${BANDS[index % 2]}">${markup}</div>`);
    index += 1;
  }
  const description = escapeAttribute(site.about || site.tagline || `${site.title} — official site.`);
  const canonical = origin ? `<link rel="canonical" href="${escapeAttribute(`${origin}/`)}">` : '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${description}">
${canonical}
<title>${escapeHtml(site.title)}</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="page">
${body.join('\n')}
</div>
</body>
</html>`;
  return { html, css: stylesheet(style.vars) };
}

function stylesheet(vars: Record<string, string>): string {
  const root = Object.entries(vars).map(([key, value]) => `  ${key}: ${value};`).join('\n');
  return `:root {
${root}
  --max: 1080px;
  --space: clamp(16px, 4vw, 40px);
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font-body); line-height: 1.55; }
h1, h2, h3 { font-family: var(--font-display); line-height: 1.15; margin: 0 0 .5em; font-weight: 700; }
h1 { font-size: clamp(2rem, 6vw, 3.6rem); letter-spacing: -0.02em; }
h2 { font-size: clamp(1.4rem, 3vw, 2rem); }
h3 { font-size: 1.05rem; }
p { margin: 0 0 1em; color: var(--muted); }
a { color: inherit; }
img { max-width: 100%; display: block; border-radius: var(--radius); }
.band { padding: var(--space) 0; }
.band > * { width: 100%; max-width: var(--max); margin: 0 auto; padding: 0 var(--space); }
.band-a { background: var(--bg); }
.band-b { background: var(--bg-band); }
.nav { display: flex; align-items: center; gap: 16px; padding-top: 18px; padding-bottom: 18px; }
.nav nav { display: flex; gap: 16px; margin-left: auto; font-size: .95rem; }
.nav a { text-decoration: none; opacity: .8; }
.nav a:hover { opacity: 1; }
.nav-pill .brand { flex: 0 0 auto; }
.brand { font-family: var(--font-display); font-weight: 700; letter-spacing: -0.01em; }
.hero { display: grid; gap: 20px; padding-top: calc(var(--space) * 1.4); padding-bottom: calc(var(--space) * 1.4); }
.hero-bleed { grid-template-columns: 1.1fr 1fr; align-items: center; }
.hero-bleed .hero-media img { aspect-ratio: 4 / 3; object-fit: cover; }
.tagline { font-size: 1.15rem; max-width: 34ch; }
.cta { display: inline-block; margin-top: 8px; padding: 12px 20px; border-radius: var(--radius); background: var(--accent); color: var(--accent-ink); text-decoration: none; font-weight: 700; }
.catalog ul { list-style: none; margin: 0; padding: 0; }
.catalog-menu li { display: flex; align-items: baseline; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.catalog-menu .dots { flex: 1; border-bottom: 1px dotted var(--line); }
.catalog-photo .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
.catalog-photo .tile h3 { margin-top: 10px; }
.catalog-cells li { display: flex; justify-content: space-between; gap: 16px; padding: 14px 16px; border: 1px solid var(--line); border-radius: var(--radius); margin-bottom: 10px; }
.price { font-variant-numeric: tabular-nums; white-space: nowrap; }
.catalog-empty .empty { color: var(--muted); }
.story-split { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: center; }
.story-quote blockquote { margin: 0; font-family: var(--font-display); font-size: clamp(1.3rem, 3vw, 2rem); line-height: 1.35; }
.gallery { display: grid; gap: 12px; }
.gallery-bento { grid-template-columns: repeat(3, 1fr); }
.gallery-bento img { aspect-ratio: 1; object-fit: cover; }
.gallery-reel { grid-auto-flow: column; grid-auto-columns: 70%; overflow-x: auto; }
.footer { display: grid; gap: 12px; padding-top: calc(var(--space) * 1.2); padding-bottom: calc(var(--space) * 1.2); }
.footer .hours { list-style: none; margin: 0; padding: 0; color: var(--muted); }
.footer .contact { margin: 0; }
.footer .notice { margin: 0; font-weight: 600; color: var(--ink); }
.footer .bar { display: inline-block; padding: 10px 16px; border-radius: var(--radius); background: var(--accent); color: var(--accent-ink); text-decoration: none; font-weight: 700; width: fit-content; }
@media (max-width: 720px) {
  .hero-bleed, .story-split { grid-template-columns: 1fr; }
  .gallery-bento { grid-template-columns: repeat(2, 1fr); }
}
`;
}
