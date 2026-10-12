import { EASING_CSS, HEIGHT_CSS, RATIO_CSS } from './document.ts';
import type { SectionLayoutSpec, Style, StyleSet } from './document.ts';
import { resolveToken, type Design } from './design.ts';

export interface CssCollector {
  classes: Map<string, StyleSet>;
  runtime: Set<string>;
}

const short = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

export function padUnit(design: Design, value: string | undefined): string | null {
  if (!value) return null;
  if (value === 'token:space.unit') return 'var(--space-unit)';
  if (value === 'token:space.section') return 'var(--space-section)';
  const steps: Record<string, number> = { none: 0, sm: 2, md: 4, lg: 8, xl: 12 };
  return steps[value] === undefined ? null : `calc(var(--space-unit) * ${steps[value]})`;
}

export function colorValue(design: Design, value: string): string {
  const token = resolveToken(design, value);
  if (typeof token === 'string') return token;
  return value;
}

export function styleDeclarations(design: Design, style: Style | undefined): string[] {
  if (!style) return [];
  const out: string[] = [];
  if (style.background) out.push(`background:${colorValue(design, style.background)}`);
  if (style.gradient) out.push(`background-image:linear-gradient(${style.gradient.angle}deg, ${colorValue(design, style.gradient.from)}, ${colorValue(design, style.gradient.to)})`);
  if (style.color) out.push(`color:${colorValue(design, style.color)}`);
  if (style.pad) { const pad = padUnit(design, style.pad); if (pad) out.push(`padding:${pad}`); }
  if (style.gap) { const gap = padUnit(design, style.gap); if (gap) out.push(`gap:${gap}`); }
  if (style.radius !== undefined) {
    const resolved = typeof style.radius === 'number' ? style.radius : resolveToken(design, style.radius) ?? 0;
    out.push(`border-radius:${typeof resolved === 'number' ? `${resolved}px` : resolved}`);
  }
  if (style.border === 'hairline') out.push('border:1px solid var(--color-border)');
  else if (style.border && style.border !== 'none') out.push(`border:1px solid ${colorValue(design, style.border)}`);
  if (style.shadow && style.shadow !== 'none') out.push(`box-shadow:var(--elevation-${style.shadow})`);
  if (style.align) out.push(`justify-content:${({ start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' } as Record<string, string>)[style.align] || 'flex-start'}`);
  if (style.width === 'content') out.push('max-width:var(--layout-content)');
  else if (style.width === 'wide') out.push('max-width:var(--layout-wide)');
  if (style.aspect) out.push(`aspect-ratio:${({ square: '1 / 1', portrait: '3 / 4', landscape: '4 / 3', wide: '16 / 9' } as Record<string, string>)[style.aspect] || 'auto'}`);
  if (style.mask === 'soft') out.push('mask-image:linear-gradient(to bottom, #000 72%, transparent)');
  if (style.size) out.push(`font-size:var(--type-${style.size})`);
  if (style.weight) out.push(`font-weight:${style.weight}`);
  if (style.columns) out.push(`grid-template-columns:repeat(${style.columns}, minmax(0, 1fr))`);
  return out;
}

export function styleClass(collector: CssCollector, style: StyleSet | undefined): string {
  if (!style || !Object.keys(style).length) return '';
  const key = JSON.stringify(style);
  const name = `s-${short(key)}`;
  collector.classes.set(name, style);
  return ` ${name}`;
}

/**
 * The grammar knobs a section asked for, carried onto its container as custom properties so
 * a recipe stays data. validate.ts admits only words from LAYOUT_RATIOS and LAYOUT_HEIGHTS
 * and requires a scrim to be a token the design carries, so nothing here interpolates a
 * value an author wrote.
 */
export function layoutStyle(design: Design, layout: SectionLayoutSpec | undefined): string {
  if (!layout) return '';
  const vars: string[] = [];
  if (layout.kind === 'split') {
    const ratio = RATIO_CSS[layout.ratio || ''];
    if (ratio) vars.push(`--split-ratio:${ratio}`);
  }
  if (layout.kind === 'overlay') {
    const height = HEIGHT_CSS[layout.height || ''];
    if (height) vars.push(`--overlay-height:${height}`);
    const scrim = layout.scrim ? resolveToken(design, String(layout.scrim)) : undefined;
    if (typeof scrim === 'string') vars.push(`--overlay-scrim:${scrim}`);
  }
  return vars.length ? ` style="${vars.join(';')}"` : '';
}

/** The narrow-screen behaviour a wide layout declares. */
export function layoutClass(layout: SectionLayoutSpec | undefined): string {
  return layout?.collapse === 'keep' ? ' tar-keep' : '';
}

export function compileCss(design: Design, collector: CssCollector): string {
  const space = (steps: number) => `calc(var(--space-unit) * ${steps})`;
  const blocks: string[] = [];
  collector.classes.forEach((style, name) => {
    for (const level of ['base', 'small', 'medium', 'large'] as const) {
      const declarations = styleDeclarations(design, style[level]);
      if (!declarations.length) continue;
      const rule = `.${name}{${declarations.join(';')}}`;
      if (level === 'base') blocks.push(rule);
      else if (level === 'small') blocks.push(`@media (max-width: 640px){${rule}}`);
      else if (level === 'medium') blocks.push(`@media (min-width: 641px) and (max-width: 1024px){${rule}}`);
      else blocks.push(`@media (min-width: 1025px){${rule}}`);
    }
  });

  return `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=Mukta+Malar:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');

:root {
  --color-canvas: ${design.color.canvas};
  --color-ink: ${design.color.ink};
  --color-accent: ${design.color.accent};
  --color-accentink: ${design.color.accentink};
  --color-surface: ${design.color.surface};
  --color-border: ${design.color.border};
  --color-muted: ${design.color.muted};
  --color-success: ${design.color.success};
  --color-danger: ${design.color.danger};
  --font-display: ${design.type.display};
  --font-heading: ${design.type.heading};
  --font-body: ${design.type.body};
  --type-base: ${design.type.base}px;
  --type-display: clamp(2rem, 5vw, ${(design.type.base * design.type.scale ** 3).toFixed(0)}px);
  --type-heading: clamp(1.5rem, 3vw, ${(design.type.base * design.type.scale ** 2).toFixed(0)}px);
  --type-body: ${design.type.base}px;
  --type-label: ${Math.max(12, Math.round(design.type.base * 0.875))}px;
  --type-tracking: ${design.type.tracking || 0}em;
  --leading: ${design.type.leading};
  --space-unit: ${design.space.unit}px;
  --space-section: ${design.space.section}px;
  --layout-content: ${design.space.container}px;
  --layout-wide: ${(design.space.container + 240).toFixed(0)}px;
  --radius-sm: ${design.shape.sm}px;
  --radius-md: ${design.shape.md}px;
  --radius-lg: ${design.shape.lg}px;
  --radius-pill: ${design.shape.pill}px;
  --elevation-low: 0 1px ${design.elevation.low}px rgba(15, 15, 20, 0.08);
  --elevation-high: 0 12px ${design.elevation.high}px rgba(15, 15, 20, 0.16);
  --motion: ${design.motion.duration}ms;
  --ease: ${EASING_CSS[design.motion.easing] || 'ease'};
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: var(--type-base); -webkit-text-size-adjust: 100%; }
body { background: var(--color-canvas); color: var(--color-ink); font-family: var(--font-body); line-height: var(--leading); letter-spacing: var(--type-tracking); min-height: 100vh; display: flex; flex-direction: column; }
main { flex: 1; }
img, video { max-width: 100%; height: auto; display: block; }
a { color: inherit; }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.tar-skip { position: absolute; top: -9999px; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.tar-skip:focus { position: static; display: inline-block; padding: ${space(2)} ${space(4)}; background: var(--color-accent); color: var(--color-accentink); width: auto; height: auto; }
.tar-wrap { width: 100%; max-width: var(--layout-content); margin: 0 auto; padding: 0 clamp(16px, 4vw, 48px); }
.tar-section { padding: var(--space-section) 0; }
.tar-section[data-purpose="chrome"], .tar-chrome { padding: 0 !important; margin: 0; width: 100%; }
.tar-flex { display: flex; flex-direction: row; gap: ${space(4)}; align-items: flex-start; flex-wrap: wrap; }
.tar-stack { display: flex; flex-direction: column; gap: ${space(4)}; }
.tar-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: ${space(4)}; }
.tar-grid > .tar-title { grid-column: 1 / -1; width: 100%; }
.tar-row { display: flex; flex-direction: row; flex-wrap: wrap; gap: ${space(4)}; align-items: flex-start; }
.tar-row > * { flex: 1 1 ${space(40)}; min-width: 0; }
.tar-split { display: grid; grid-template-columns: var(--split-ratio, 1fr 1fr); gap: ${space(8)}; align-items: center; }
.tar-overlay { position: relative; display: flex; flex-direction: column; justify-content: flex-end; gap: ${space(4)}; min-height: var(--overlay-height, auto); overflow: hidden; border-radius: var(--radius-md); }
.tar-overlay > .tar-scrim { position: absolute; inset: 0; background: var(--overlay-scrim, transparent); opacity: 0.72; pointer-events: none; }
.tar-overlay > .tar-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.tar-overlay > :not(.tar-scrim) { position: relative; }
.tar-rail { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(min(280px, 78vw), 1fr); gap: ${space(4)}; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scroll-padding-inline-start: ${space(4)}; padding-bottom: ${space(2)}; }
.tar-rail > * { scroll-snap-align: start; }
.tar-disclosure { display: flex; flex-direction: column; gap: ${space(1)}; }
.tar-disclosure > details { border-top: 1px solid var(--color-border); }
.tar-disclosure > details:last-child { border-bottom: 1px solid var(--color-border); }
.tar-disclosure summary { display: flex; align-items: center; justify-content: space-between; gap: ${space(4)}; padding: ${space(4)} 0; font-weight: 600; cursor: pointer; list-style: none; }
.tar-disclosure summary::-webkit-details-marker { display: none; }
.tar-disclosure summary::after { content: '+'; color: var(--color-muted); font-weight: 400; }
.tar-disclosure details[open] summary::after { content: '−'; }
.tar-disclosure summary + div { padding: 0 0 ${space(4)}; max-width: 72ch; }
.tar-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: ${space(4)}; display: flex; flex-direction: column; gap: ${space(2)}; }
.tar-prose { max-width: 72ch; }
.tar-title { font-family: var(--font-display); font-weight: ${design.type.weight}; line-height: 1.15; }
h1.tar-title { font-size: var(--type-display); }
h2.tar-title { font-size: var(--type-heading); }
h3.tar-title { font-size: var(--type-body); font-weight: ${Math.min(900, design.type.weight + 100)}; }
.tar-muted { color: var(--color-muted); }
.tar-label { font-size: var(--type-label); font-weight: 600; }
.tar-btn { display: inline-flex; align-items: center; justify-content: center; gap: ${space(2)}; padding: ${space(3)} ${space(6)}; border-radius: var(--radius-pill); font-weight: 600; font-size: var(--type-body); text-decoration: none; cursor: pointer; border: 1px solid transparent; transition: opacity var(--motion) var(--ease), transform var(--motion) var(--ease); }
.tar-btn:hover { opacity: 0.88; }
.tar-btn:active { transform: scale(0.985); }
.tar-btn-primary { background: var(--color-accent); color: var(--color-accentink); }
.tar-btn-secondary { background: transparent; color: var(--color-ink); border-color: var(--color-border); }
.tar-btn-outline { background: transparent; color: var(--color-ink); border: 1px solid var(--color-ink); font-size: 13px; font-weight: 600; padding: 8px 20px; border-radius: var(--radius-pill); }
.tar-btn-outline:hover { background: var(--color-ink); color: var(--color-canvas); }
.tar-btn-whatsapp, .tar-btn.tar-btn-whatsapp { background: #25D366; color: #ffffff; font-size: 13px; font-weight: 600; padding: 8px 18px; border-radius: var(--radius-pill); text-decoration: none; border: none; display: inline-flex; align-items: center; gap: 6px; }
.tar-btn-whatsapp:hover, .tar-btn.tar-btn-whatsapp:hover { opacity: 0.9; }
.tar-link { text-decoration: underline; text-underline-offset: 3px; }
.tar-divider { border: 0; border-top: 1px solid var(--color-border); }
.tar-spacer { height: var(--space-section); }
.tar-icon { width: 1.5em; height: 1.5em; stroke: currentColor; fill: none; stroke-width: 1.6; }
.tar-price { font-weight: 700; color: var(--color-accent); }
.tar-item img { width: 100%; border-radius: var(--radius-sm); }
.tar-cardlink { text-decoration: none; display: block; }
.tar-item[hidden] { display: none; }
.tar-empty { color: var(--color-muted); font-style: italic; }

/* Notice Banner */
.tar-notice {
  background: var(--color-surface);
  color: var(--color-ink);
  border-bottom: 1px solid var(--color-border);
  padding: 10px 16px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  width: 100%;
  position: sticky;
  top: 0;
  z-index: 45;
}

/* Header & Navigation */
.tar-nav { position: sticky; top: 0; z-index: 50; background: var(--color-canvas); border-bottom: 1px solid var(--color-border); width: 100%; }
.tar-nav-inner { display: flex; align-items: center; justify-content: space-between; gap: ${space(4)}; min-height: 56px; padding: 0 clamp(16px, 4vw, 48px); max-width: var(--layout-content); margin: 0 auto; }
.tar-brand { font-family: var(--font-display); font-size: 22px; font-weight: 800; letter-spacing: 0.02em; text-decoration: none; color: var(--color-ink); }
.tar-navlinks { display: flex; gap: 20px; list-style: none; flex-wrap: wrap; font-size: 13px; font-weight: 600; margin: 0; padding: 0; align-items: center; }
.tar-navlinks a { text-decoration: none; color: var(--color-ink); transition: opacity 0.15s ease; }
.tar-navlinks a:hover { opacity: 0.7; }
.tar-menu-btn { display: none; background: none; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: ${space(1)} ${space(2)}; font-size: 1.1rem; cursor: pointer; color: var(--color-ink); }
.tar-nav-centered .tar-nav-inner { justify-content: center; position: relative; }
.tar-nav-centered .tar-brand { text-align: center; }
.tar-nav-centered .tar-menu { position: absolute; right: clamp(16px, 4vw, 48px); }

/* ========================================================
   HIGH-CRAFT HERO PATTERNS (METHOD 2)
   ======================================================== */
.tar-hero { position: relative; width: 100%; min-height: 75vh; display: flex; align-items: center; padding: clamp(40px, 6vw, 76px) 0; overflow: hidden; }
.tar-hero-inner { width: 100%; max-width: var(--layout-content); margin: 0 auto; padding: 0 clamp(16px, 4vw, 48px); }
.tar-hero-eyebrow { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-accent); margin-bottom: 6px; }
.tar-hero-title { font-family: var(--font-display); font-size: clamp(2.2rem, 4.2vw, 3.8rem); font-weight: 700; line-height: 1.12; letter-spacing: -0.02em; color: var(--color-ink); margin: 0 0 12px 0; }
.tar-hero-desc { font-size: clamp(1rem, 1.25vw, 1.15rem); line-height: 1.6; color: var(--color-muted); max-width: 52ch; margin: 0 0 20px 0; }
.tar-hero-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.tar-hero-actions .tar-btn { font-size: 14px; padding: 10px 22px; }

/* 1. Split Hero 50/50 (#4) */
.tar-hero-split .tar-hero-grid { display: grid; grid-template-columns: var(--split-ratio, 1.1fr 0.9fr); align-items: center; gap: clamp(32px, 5vw, 64px); }
.tar-hero-split.tar-hero-flip .tar-hero-media { order: -1; }
.tar-hero-split .tar-hero-text { display: flex; flex-direction: column; }
.tar-hero-split .tar-hero-media { position: relative; width: 100%; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--elevation-high); aspect-ratio: 4 / 3; background: var(--color-surface); }
.tar-hero-split .tar-hero-media img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: var(--radius-lg); }
.tar-hero-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-border) 100%); }
.tar-brand-mark { font-family: var(--font-display); font-size: 48px; font-weight: 800; color: var(--color-muted); letter-spacing: 0.05em; }

/* 2. Commerce Hero (#16) */
.tar-hero-commerce .tar-hero-grid { display: grid; grid-template-columns: var(--split-ratio, 1.15fr 0.85fr); align-items: center; gap: clamp(32px, 5vw, 64px); }
.tar-hero-spotlight-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--elevation-high); display: flex; flex-direction: column; gap: 12px; position: relative; }
.tar-hero-spotlight-img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: var(--radius-md); background: #f1f5f9; display: block; }
.tar-hero-spotlight-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.tar-hero-spotlight-title { font-size: 16px; font-weight: 700; color: var(--color-ink); }
.tar-hero-spotlight-price { font-size: 18px; font-weight: 800; color: var(--color-accent); }

/* 3. Typography Hero (#24) */
.tar-hero-typography { text-align: center; padding: clamp(48px, 8vw, 96px) 0; }
.tar-hero-typography .tar-hero-text { max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; }
.tar-hero-typography .tar-hero-title { font-family: var(--font-display); font-size: clamp(2.6rem, 5.5vw, 4.6rem); font-weight: 700; line-height: 1.08; letter-spacing: -0.025em; color: var(--color-ink); }
.tar-hero-typography .tar-hero-desc { font-size: clamp(1.05rem, 1.4vw, 1.25rem); line-height: 1.65; color: var(--color-muted); max-width: 58ch; }
.tar-hero-typography .tar-hero-actions { justify-content: center; }

/* 4. Background Image Hero (#7) */
.tar-hero-bgimage { min-height: 75vh; display: flex; align-items: center; background-size: cover; background-position: center; position: relative; color: #ffffff; }
.tar-hero-scrim { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(15, 23, 42, 0.45) 0%, rgba(15, 23, 42, 0.85) 100%); z-index: 1; }
.tar-hero-bgimage .tar-hero-inner { position: relative; z-index: 2; }
.tar-hero-bgimage .tar-hero-title { color: #ffffff !important; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
.tar-hero-bgimage .tar-hero-desc { color: rgba(255, 255, 255, 0.9) !important; text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
.tar-hero-bgimage .tar-btn-outline { border-color: rgba(255,255,255,0.7); color: #ffffff; }
.tar-hero-bgimage .tar-btn-outline:hover { background: #ffffff; color: #0f172a; }

/* 5. Minimal Hero (#23) */
.tar-hero-minimal { min-height: 75vh; display: flex; align-items: center; padding: clamp(40px, 6vw, 64px) 0; border-bottom: 1px solid var(--color-border); }
.tar-hero-minimal .tar-hero-grid { display: flex; justify-content: space-between; align-items: center; gap: 32px; flex-wrap: wrap; width: 100%; }
.tar-hero-minimal .tar-hero-title { font-family: var(--font-display); font-size: clamp(2rem, 3.8vw, 3.2rem); font-weight: 600; line-height: 1.2; margin-bottom: 8px; }

/* 6. Fullscreen Hero: the overlay grammar carrying the shop's own photo */
.tar-hero-fullscreen { border-radius: 0; padding: var(--space-section) 0; }
.tar-hero-fullscreen .tar-hero-title { font-family: var(--font-display); font-size: clamp(2.2rem, 5vw, 4rem); font-weight: 700; line-height: 1.12; letter-spacing: -0.02em; max-width: 22ch; }
.tar-hero-fullscreen .tar-hero-desc { font-size: clamp(1.05rem, 1.4vw, 1.25rem); line-height: 1.6; max-width: 60ch; }
.tar-hero-fullscreen .tar-btn-outline { border-color: currentColor; color: currentColor; }

/* Floating Pill Navigation (GutGutGoose Style) */
.tar-nav-floating { position: absolute; top: 0; left: 0; right: 0; z-index: 50; background: transparent; border-bottom: none; width: 100%; }
.tar-nav-floating-inner { display: flex; align-items: center; justify-content: space-between; min-height: 72px; padding: 16px clamp(16px, 4vw, 48px); max-width: var(--layout-content); margin: 0 auto; position: relative; }
.tar-brand-pill { display: inline-flex; align-items: center; gap: 10px; background: rgba(255, 255, 255, 0.94); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 999px; padding: 6px 18px 6px 6px; text-decoration: none; color: #0f172a; box-shadow: 0 4px 20px rgba(0,0,0,0.12); transition: transform 0.15s ease, background 0.15s ease; }
.tar-brand-pill:hover { transform: translateY(-1px); background: #ffffff; }
.tar-brand-pill-avatar { width: 34px; height: 34px; border-radius: 50%; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.15); flex-shrink: 0; }
.tar-brand-pill-avatar img, .tar-brand-pill-img { width: 100%; height: 100%; object-fit: cover; }
.tar-brand-pill-letter { font-family: var(--font-display); font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1; }
.tar-brand-pill-icon { font-size: 18px; line-height: 1; }
.tar-brand-pill-name { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; white-space: nowrap; }
.tar-menu-circle-btn { width: 44px; height: 44px; border-radius: 50%; background: rgba(255, 255, 255, 0.94); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.12); transition: transform 0.15s ease, background 0.15s ease; padding: 0; }
.tar-menu-circle-btn:hover { transform: scale(1.05); background: #ffffff; }
.tar-hamburger-bar { width: 18px; height: 2px; background: #0f172a; border-radius: 2px; }
.tar-navlinks-floating { display: none; position: absolute; top: calc(100% + 8px); right: clamp(16px, 4vw, 48px); background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: var(--radius-md); padding: 16px 20px; flex-direction: column; align-items: flex-start; gap: 14px; box-shadow: var(--elevation-high); min-width: 160px; z-index: 60; }
.tar-menu[data-open] .tar-navlinks-floating { display: flex; }
.tar-navlinks-floating a { color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; transition: opacity 0.15s ease; }
.tar-navlinks-floating a:hover { opacity: 0.8; }

/* Announcement pill */
.tar-notice-quiz { background: var(--color-accent); color: var(--color-accentink); text-align: center; border-bottom: none; }
.tar-notice-quiz-link { display: inline-flex; align-items: center; gap: ${space(2)}; color: inherit; text-decoration: none; }
.tar-notice-quiz-link:hover { opacity: 0.9; }
.tar-notice-arrow-pill { display: inline-flex; align-items: center; justify-content: center; width: ${space(4)}; height: ${space(4)}; border-radius: var(--radius-pill); border: 1px solid currentColor; }

/* Collection Grid and Cards */
.tar-collection-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; width: 100%; }
.tar-collection-title { font-size: 22px; font-weight: 700; margin: 0; color: var(--color-ink); }
.tar-product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: 20px; width: 100%; }
.tar-collection-card { width: 100%; display: block; }
.tar-product-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px; gap: 12px; position: relative; display: flex; flex-direction: column; width: 100%; }
.tar-card-media { position: relative; overflow: hidden; width: 100%; aspect-ratio: 4 / 3; background: #f1f5f9; border-radius: var(--radius-sm); }
.tar-card-media img, .tar-card-media .tar-card-img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-sm); display: block; }
.tar-card-media-placeholder { background: #f1f5f9; display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 4 / 3; border-radius: var(--radius-sm); }
.tar-card-placeholder-box { font-family: var(--font-display); font-size: 26px; font-weight: 700; color: #94a3b8; letter-spacing: 0.05em; }
.tar-card-badge { position: absolute; top: 8px; left: 8px; background: var(--color-accent); color: var(--color-accentink); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: var(--radius-sm); z-index: 2; line-height: 1.2; }
.tar-card-badge-wrap { margin-bottom: 4px; }
.tar-card-meta { display: flex; flex-direction: column; gap: 6px; width: 100%; flex: 1; }
.tar-product-title { font-size: 15px; font-weight: 600; color: var(--color-ink); line-height: 1.35; font-family: var(--font-body); }
.tar-card-desc { font-size: 13px; color: var(--color-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tar-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 8px; width: 100%; }
.tar-card-footer .tar-price { font-size: 15px; font-weight: 700; color: var(--color-accent); white-space: nowrap; }

/* Semantic Footer (Shopify-Inspired) */
.tar-footer { border-top: 1px solid var(--color-border); background: var(--color-surface); margin-top: auto; width: 100%; color: var(--color-ink); }
.tar-footer-wrap { width: 100%; max-width: var(--layout-content); margin: 0 auto; padding: clamp(40px, 5vw, 64px) clamp(16px, 4vw, 48px) clamp(24px, 3vw, 36px); }
.tar-footer-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.2fr; gap: clamp(24px, 4vw, 48px); margin-bottom: clamp(32px, 4vw, 48px); }
.tar-footer-col { display: flex; flex-direction: column; gap: 12px; }
.tar-footer-brand { font-family: var(--font-display); font-size: 20px; font-weight: 800; letter-spacing: 0.02em; color: var(--color-ink); text-decoration: none; }
.tar-footer-bio { font-size: 13px; line-height: 1.6; color: var(--color-muted); max-width: 32ch; }
.tar-footer-badge-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #16a34a; background: rgba(22, 163, 74, 0.1); padding: 4px 10px; border-radius: var(--radius-pill); width: fit-content; }
.tar-footer-col-title { font-family: var(--font-heading); font-size: 14px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--color-ink); margin-bottom: 2px; }
.tar-footer-list { list-style: none; display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; }
.tar-footer-list a { font-size: 13px; color: var(--color-muted); text-decoration: none; transition: color 0.15s ease; }
.tar-footer-list a:hover { color: var(--color-ink); text-decoration: underline; }
.tar-footer-contact-item { font-size: 13px; color: var(--color-muted); line-height: 1.5; }
.tar-footer-contact-item strong { color: var(--color-ink); }
.tar-footer-bottom { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding-top: 24px; border-top: 1px solid var(--color-border); font-size: 12px; color: var(--color-muted); }
.tar-footer-payments { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tar-pay-pill { font-size: 11px; font-weight: 600; background: var(--color-canvas); border: 1px solid var(--color-border); padding: 3px 8px; border-radius: 4px; color: var(--color-ink); }

.tar-tabs [role="tablist"] { display: flex; gap: ${space(2)}; border-bottom: 1px solid var(--color-border); flex-wrap: wrap; }
.tar-tabs [role="tab"] { background: none; border: 0; padding: ${space(2)} ${space(3)}; font: inherit; cursor: pointer; border-bottom: 2px solid transparent; }
.tar-tabs [role="tab"][aria-selected="true"] { border-color: var(--color-accent); color: var(--color-accent); font-weight: 600; }
.tar-tabs [role="tabpanel"] { padding-top: ${space(4)}; }
.tar-tabs[data-ready] [role="tabpanel"][hidden] { display: none; }
.tar-acc { border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); margin-bottom: ${space(2)}; }
.tar-acc summary { padding: ${space(3)} ${space(4)}; font-weight: 600; cursor: pointer; }
.tar-acc > div { padding: 0 ${space(4)} ${space(4)}; color: var(--color-muted); }
.tar-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: ${space(2)}; }
.tar-gallery img { border-radius: var(--radius-sm); cursor: zoom-in; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.tar-lightbox { position: fixed; inset: 0; background: rgba(10, 10, 14, 0.86); display: none; align-items: center; justify-content: center; padding: ${space(6)}; z-index: 60; }
.tar-lightbox[data-open] { display: flex; }
.tar-lightbox img { max-width: 92vw; max-height: 88vh; border-radius: var(--radius-md); }
.tar-search { display: flex; gap: ${space(2)}; margin-bottom: ${space(4)}; }
.tar-search input { flex: 1; padding: ${space(2)} ${space(3)}; border: 1px solid var(--color-border); border-radius: var(--radius-md); font: inherit; background: var(--color-canvas); color: inherit; }
.tar-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.tar-cart { display: flex; flex-direction: column; gap: ${space(5)}; max-width: 720px; }
.tar-cart-list { list-style: none; display: flex; flex-direction: column; gap: ${space(3)}; }
.tar-cart-row { display: flex; align-items: center; gap: ${space(4)}; padding: ${space(3)}; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); }
.tar-cart-img { width: 56px; height: 56px; flex: none; border-radius: var(--radius-sm); object-fit: cover; }
.tar-cart-img-empty { display: inline-flex; align-items: center; justify-content: center; background: var(--color-canvas); color: var(--color-muted); font-weight: 700; }
.tar-cart-info { display: flex; flex-direction: column; gap: ${space(1)}; flex: 1; min-width: 0; }
.tar-cart-qty input { width: 80px; padding: ${space(2)}; border: 1px solid var(--color-border); border-radius: var(--radius-md); font: inherit; background: var(--color-canvas); color: inherit; text-align: center; }
.tar-cart-buyer { display: flex; flex-direction: column; gap: ${space(3)}; }
.tar-field { display: flex; flex-direction: column; gap: ${space(1)}; }
.tar-field label { font-size: var(--type-label); font-weight: 600; }
.tar-field input, .tar-field textarea { padding: ${space(2)} ${space(3)}; border: 1px solid var(--color-border); border-radius: var(--radius-md); font: inherit; background: var(--color-canvas); color: inherit; }
.tar-field textarea { min-height: 96px; resize: vertical; }
.tar-honeypot { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.tar-cta { background: var(--color-surface); border-radius: var(--radius-lg); padding: ${space(10)}; text-align: center; }
${blocks.join('\n')}
@media (max-width: 768px) {
  .tar-nav-inner { position: relative; }
  .tar-brand-pill { max-width: calc(100vw - 84px); }
  .tar-brand-pill-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
  .tar-nav-floating .tar-navlinks-floating {
    right: 16px;
    left: auto !important;
    top: calc(100% + 8px);
    border-radius: var(--radius-md);
    min-width: 170px;
    max-width: calc(100vw - 32px);
    background: rgba(15, 23, 42, 0.96) !important;
  }
  .tar-hero { min-height: 75vh; padding: 36px 0; }
  .tar-hero-split .tar-hero-grid,
  .tar-hero-commerce .tar-hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
  .tar-hero-split .tar-hero-media { aspect-ratio: 16 / 10 !important; }
  .tar-hero-actions { flex-direction: column; align-items: stretch; width: 100%; }
  .tar-hero-actions .tar-btn { width: 100%; justify-content: center; }
  .tar-hero-centered-atmospheric { min-height: 75vh; padding: 96px 16px 0; }
  .tar-hero-centered-title { font-size: clamp(1.9rem, 7.5vw, 2.8rem); margin-bottom: 12px; }
  .tar-hero-centered-desc { font-size: 0.95rem; margin-bottom: 20px; }
  .tar-hero-pill-btn { padding: 12px 28px; font-size: 15px; }
  .tar-flex { flex-direction: column; }
  .tar-split:not(.tar-keep) { grid-template-columns: 1fr; gap: ${space(6)}; }
  .tar-row.tar-keep { flex-wrap: nowrap; }
  .tar-menu[data-ready] .tar-navlinks:not(.tar-navlinks-floating) { display: none; }
  .tar-menu[data-ready][data-open] .tar-navlinks:not(.tar-navlinks-floating) {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    box-shadow: var(--elevation-high);
    padding: 16px 24px;
    gap: 14px;
    z-index: 60;
  }
  .tar-menu-btn { display: inline-flex; align-items: center; justify-content: center; }
  .tar-section { padding: 36px 0; }
  .tar-grid, .tar-product-grid { grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)) !important; gap: 12px !important; }
  .tar-footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
  .tar-footer-bottom { flex-direction: column; align-items: flex-start; gap: 14px; }
}
@media (min-width: 769px) and (max-width: 1024px) {
  .tar-hero-centered-atmospheric { min-height: 80vh; padding: 110px 24px 0; }
  .tar-hero-centered-title { font-size: clamp(2.4rem, 4.5vw, 3.4rem); }
  .tar-grid, .tar-product-grid { grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)) !important; gap: 16px !important; }
  .tar-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
}
`.trim();
}
