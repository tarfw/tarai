import { describe, expect, it } from 'vitest';
import { SECTION_CATALOG, getPatternById, getPatternsByPrimitive } from '../src/site/patterns/catalog.ts';
import { selectSectionsDeterministically } from '../src/site/patterns/selector.ts';
import {
  renderNavPrimitive,
  renderHeroPrimitive,
  renderBannerPrimitive,
  renderCollectionPrimitive,
  renderCardsPrimitive,
  renderAccordionPrimitive,
  renderMediaPrimitive,
  renderActionPrimitive,
  renderSectionByPatternId,
} from '../src/site/primitives/index.ts';

describe('70 Section Catalog & 8 Engine Primitives', () => {
  it('contains exactly 70 distinct pre-designed section patterns', () => {
    expect(SECTION_CATALOG.length).toBe(70);
    const ids = new Set(SECTION_CATALOG.map((p) => p.id));
    expect(ids.size).toBe(70);
  });

  it('maps all 70 patterns into the 8 engine primitives', () => {
    const primitives = new Set(SECTION_CATALOG.map((p) => p.primitive));
    const expected = ['nav', 'hero', 'banner', 'collection', 'cards', 'accordion', 'media', 'action'];
    expected.forEach((prim) => {
      expect(primitives.has(prim as any)).toBe(true);
      const items = getPatternsByPrimitive(prim as any);
      expect(items.length).toBeGreaterThan(0);
    });
  });

  it('selects sections deterministically for Kalyan Heritage Silks scenario', () => {
    const selected = selectSectionsDeterministically({
      trade: 'Luxury Handcrafted Kanchipuram Sarees',
      bullets: ['Warm heritage', 'dark ink luxury', 'verified handloom weaver', 'festive Diwali offer'],
      facts: {
        items: 12,
        proofs: ['Silk Mark', 'Handloom Mark'],
        season: 'Diwali',
        hasPhone: true,
      },
    });

    expect(selected.length).toBeGreaterThanOrEqual(6);
    const slugs = selected.map((s) => s.slug);
    expect(slugs).toContain('announcement');
    expect(slugs).toContain('header');
    expect(slugs).toContain('catalog');
    expect(slugs).toContain('footer');
    expect(slugs).toContain('faq');
    expect(slugs).toContain('whatsapp_float');
  });

  it('renders all 8 primitives with zero drift semantic HTML', () => {
    const nav = renderNavPrimitive({ kind: 'announcement', notice: 'Special festive launch' });
    expect(nav).toContain('class="tar-notice"');
    expect(nav).toContain('Special festive launch');

    const hero = renderHeroPrimitive({
      pattern: 'split',
      title: 'Pure Kanchipuram Weaves',
      eyebrow: 'Direct from Loom',
      primaryCta: { label: 'Explore', href: '#catalog' },
    });
    expect(hero).toContain('class="tar-hero tar-hero-split"');
    expect(hero).toContain('Pure Kanchipuram Weaves');

    const banner = renderBannerPrimitive({
      kind: 'trust_badges',
      items: ['Silk Mark', 'Direct Loom'],
    });
    expect(banner).toContain('tar-trust-pill');
    expect(banner).toContain('Silk Mark');

    const collection = renderCollectionPrimitive({
      title: 'Bridal Sarees',
      items: [
        { id: '1', title: 'Maroon Zari Saree', price: 14500, currency: '₹' },
      ],
      phone: '+919840012345',
    });
    expect(collection).toContain('tar-collection-section');
    expect(collection).toContain('Maroon Zari Saree');
    expect(collection).toContain('₹14,500');

    const cards = renderCardsPrimitive({
      title: 'Our Heritage',
      cards: [
        { title: '40 Years', description: 'Generations of weaving tradition' },
      ],
    });
    expect(cards).toContain('tar-cards-section');
    expect(cards).toContain('40 Years');

    const accordion = renderAccordionPrimitive({
      title: 'Frequently Asked Questions',
      items: [
        { question: 'Is Cash on Delivery available?', answer: 'Yes across all pincodes.' },
      ],
    });
    expect(accordion).toContain('tar-accordion-section');
    expect(accordion).toContain('Is Cash on Delivery available?');

    const media = renderMediaPrimitive({
      title: 'Live Loom Snaps',
      items: [
        { src: 'https://images.example.com/loom.jpg', alt: 'Weaver at jacquard loom' },
      ],
    });
    expect(media).toContain('tar-media-section');
    expect(media).toContain('https://images.example.com/loom.jpg');

    const action = renderActionPrimitive({
      kind: 'whatsapp_float',
      phone: '+919840012345',
    });
    expect(action).toContain('tar-whatsapp-float');
    expect(action).toContain('https://wa.me/919840012345');
  });

  it('renders section by pattern ID using dispatcher', () => {
    const rendered = renderSectionByPatternId(1, { kind: 'announcement', notice: 'Diwali sale live' });
    expect(rendered).toContain('Diwali sale live');
  });

  it('renders storefront footer with dynamic workspace facts', async () => {
    const { getPrimitive } = await import('../src/site/registry.ts');
    const footer = getPrimitive('footer', 'contact_card');
    const html = footer.render(
      { id: 'site-footer', purpose: 'footer', nodes: [], layout: { kind: 'flow' } },
      {
        doc: {
          schema: '2.0.0',
          revision: 1,
          locale: 'en',
          timezone: 'UTC',
          currency: 'INR',
          brief: { goal: 'Handcrafted luxury', audience: 'general', tone: 'luxury', phone: '+919876543210' } as any,
          design: {} as any,
          assets: [],
          components: [],
          journeys: [],
          redirects: [],
          locks: [],
          policy: {},
          pages: [
            {
              id: 'home',
              path: '/',
              title: 'Loom Studio',
              sections: [],
            },
          ],
        },
        collector: { classes: new Map(), runtime: new Set() },
        base: '',
        index: 0,
      }
    );

    expect(html).toContain('class="tar-footer"');
    expect(html).toContain('Loom Studio');
    expect(html).toContain('https://wa.me/919876543210');
  });
});
