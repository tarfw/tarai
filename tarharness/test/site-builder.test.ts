import { describe, expect, it } from 'vitest';
import { compileSite } from '../src/site/compile.ts';
import { gate } from '../src/site/gate.ts';
import { pickSections, pickStyle } from '../src/site/pick.ts';
import { renderSite } from '../src/site/spine.ts';
import { findStyle } from '../src/site/styles.ts';
import type { SiteData } from '../src/site/types.ts';

const site = (overrides: Partial<SiteData> = {}): SiteData => ({
  styleId: 'cream-lime',
  sections: pickSections({ trade: 'bakery', itemCount: 2, photoCount: 0 }, 'cream-lime'),
  title: 'Slow Loaf',
  tagline: 'Baked daily',
  about: 'Small-batch sourdough.',
  items: [],
  assets: [],
  revision: 1,
  ...overrides,
});

const context = (data: SiteData) => ({
  site: data,
  style: findStyle(data.styleId),
  items: [
    { id: 'loaf', slug: 'loaf', title: 'Sourdough', description: 'Wood fired', price: 25000, currency: 'INR' },
  ],
});

describe('site builder', () => {
  it('picks a style from the trade', () => {
    expect(pickStyle('artisan bakery')).toBe('cream-lime');
    expect(pickStyle('consulting studio')).toBe('ink-mono');
  });

  it('never asks for a photo that is not there', () => {
    const flat = pickSections({ trade: 'bakery', itemCount: 2, photoCount: 0 }, 'cream-lime');
    expect(flat.map((section) => section.kind)).toEqual(['nav', 'hero', 'catalog', 'story', 'footer']);
    expect(flat.find((section) => section.kind === 'catalog')?.variant).toBe('menu-sheet');
    expect(flat.some((section) => section.variant === 'bleed-overlay')).toBe(false);

    const rich = pickSections({ trade: 'bakery', itemCount: 2, photoCount: 3 }, 'cream-lime');
    expect(rich.map((section) => section.kind)).toEqual(['nav', 'hero', 'catalog', 'story', 'gallery', 'footer']);
  });

  it('renders a clean page that passes the gate', async () => {
    const data = site();
    const { html, css } = renderSite(context(data));
    expect(html).toContain('<title>Slow Loaf</title>');
    expect(html).toContain('₹250.00');
    expect(gate(html, css, { items: 1, title: data.title })).toEqual({ blocking: [], advisory: [] });

    const compiled = await compileSite(context(data), 'https://shop.example');
    expect(compiled.files.map((file) => file.path)).toEqual(['/index.html', '/style.css', '/robots.txt', '/sitemap.xml']);
    expect(compiled.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('blocks what must not go live', () => {
    const data = site({ title: '' });
    const { html, css } = renderSite(context(data));
    expect(gate(html, css, { items: 1, title: '' }).blocking).toContain('The site needs a name.');
    expect(gate('<a href="javascript:alert(1)">x</a>', css, { items: 0, title: 'x' }).blocking.join()).toContain('unsafe scheme');
  });
});
