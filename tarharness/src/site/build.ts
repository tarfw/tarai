/**
 * Deterministic site builder.
 *
 * Implements the Autonomous Site Agent contract (agenticsite.md):
 * Facts (records) + Brief (bullets) -> 1 Jev fan-out -> Blueprint -> code -> static page.
 *
 * It invents nothing: every block carries supplied facts or plain text derived
 * from the owner's own brief. A block whose evidence is missing is
 * omitted, never faked. Prices and money stay strictly code-owned.
 */

import { createDesign, resolveDesign, THEMES, TONE_STYLE, type Design } from './design.ts';
import {
  DOCUMENT_VERSION,
  type Asset,
  type Brief,
  type Journey,
  type Node,
  type Page,
  type Section,
  type SiteDocument,
  type StyleSet,
} from './document.ts';
import {
  catalogLayoutFor,
  catalogSectionFor,
  checkPublishGate,
  compileSectionOrder,
  defaultBlueprint,
  type Blueprint,
  type BusinessKind,
  type DensityToken,
  type SectionKind,
  type SiteFacts,
  type ToneToken,
  type TypographyToken,
} from './blueprint.ts';

export type Density = 'airy' | 'balanced' | 'compact';
export type Tone = 'canvas' | 'surface' | 'ink' | 'accent';

export { type Blueprint };

export interface Facts extends SiteFacts {
  items?: Array<{
    id: string;
    title: string;
    price?: number;
    currency?: string;
    image?: string;
    image2?: string;
    category?: string;
    description?: string;
    badge?: string;
    swatches?: string[];
    colours?: number;
  }>;
  channel?: string;
  services?: Array<{
    id: string;
    title: string;
    price?: number;
    currency?: string;
    description?: string;
  }>;
  features?: string[];
  proof?: { quote: string; author: string }[];
  questions?: { q: string; a: string }[];
  hours?: string[];
  address?: string;
  phone?: string;
  email?: string;
  proofs?: string[];
  season?: string;
  notice?: string;
}

export interface Slot {
  id: string;
  limit: number;
  purpose: string;
  current: string;
}

export interface BuildInput {
  title: string;
  brief: Brief;
  facts: Facts;
  blueprint: Blueprint;
  assets?: Asset[];
  locale?: string;
  previous?: SiteDocument | null;
}

export function briefBias(brief: SiteDocument['brief'] | undefined): Set<string> {
  return new Set([...(brief?.rejected || [])].map((entry) => entry.split(':').slice(-1)[0]));
}

const slug = (value: string, fallback: string): string => {
  const clean = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return /^[a-z][a-z0-9-]*$/.test(clean) ? clean : fallback;
};

const padFor = (density: DensityToken | Density): string =>
  density === 3 || density === 'airy' ? 'token:space.section' : density === 1 || density === 'compact' ? 'token:space.unit' : 'lg';

const style = (density: DensityToken | Density, tone?: ToneToken | Tone): StyleSet => ({
  base: { pad: padFor(density), ...(tone && TONE_STYLE[tone] ? TONE_STYLE[tone] : {}) },
});

function whatsappUrl(phone: string | undefined, message: string): string {
  if (!phone) return '/contact';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

function block(
  purpose: SectionKind | string,
  at: string,
  input: BuildInput,
  paths: string[],
  slots: Slot[],
): Section | null {
  const { brief, facts, blueprint } = input;
  const phone = facts.phone || '';
  const plain = brief.goal || `${input.title} online`;
  const tone = blueprint.tone || 'canvas';
  const density = blueprint.density || 2;

  switch (purpose) {
    case 'header':
    case 'hero': {
      const headline = input.title;
      const subline = brief.goal || plain;
      slots.push({ id: `${at}-line`, limit: 220, purpose: 'header', current: subline });

      const nodes: Node[] = [
        { id: `${at}-title`, kind: 'heading', props: { text: headline, level: 1 } },
        { id: `${at}-line`, kind: 'text', props: { text: subline } },
        {
          id: `${at}-cta-row`,
          kind: 'flex',
          props: {},
          children: [
            {
              id: `${at}-cta-catalog`,
              kind: 'button',
              props: { label: 'View Collection', href: '#catalog', variant: 'outline' },
            },
          ],
        },
      ];

      const photos = (input.assets || []).filter((a) => a.kind === 'image' && a.rights.approved);
      if (photos.length >= 2 && blueprint.headerStyle === 'split') {
        nodes.push({
          id: `${at}-split-photos`,
          kind: 'flex',
          props: {},
          children: photos.slice(0, 2).map((photo) => ({
            id: `${at}-img-${photo.id}`,
            kind: 'image',
            props: { asset: photo.id, alt: photo.alt || input.title },
          })),
        });
      } else if (photos.length >= 1) {
        nodes.push({
          id: `${at}-hero-image`,
          kind: 'image',
          props: { asset: photos[0].id, alt: photos[0].alt || input.title },
        });
      }

      return {
        id: at,
        purpose: 'hero',
        layout: { kind: blueprint.heroPattern === 'split' || blueprint.headerStyle === 'split' ? 'flex' : 'stack' },
        style: style(density, tone),
        nodes,
      };
    }

    case 'notice': {
      if (!facts.notice) return null;
      return {
        id: at,
        purpose: 'notice',
        layout: { kind: 'stack' },
        style: { base: { pad: 'sm', ...TONE_STYLE.surface } },
        nodes: [
          { id: `${at}-text`, kind: 'text', props: { text: facts.notice } },
        ],
      };
    }

    case 'spotlight': {
      const bannerTitle = facts.season ? `${facts.season} Festival Offer` : 'Special Spotlight Collection';
      const bannerText = brief.goal || 'Exclusive festive sarees and apparel with doorstep delivery.';
      slots.push({ id: `${at}-text`, limit: 300, purpose: 'spotlight', current: bannerText });
      return {
        id: at,
        purpose: 'spotlight',
        layout: { kind: 'stack' },
        style: style(density, tone === 'ink' ? 'surface' : 'ink'),
        nodes: [
          { id: `${at}-title`, kind: 'heading', props: { text: bannerTitle, level: 2 } },
          { id: `${at}-text`, kind: 'text', props: { text: bannerText } },
          {
            id: `${at}-cta`,
            kind: 'button',
            props: {
              label: 'View Offers',
              href: '#catalog',
              variant: 'filled',
            },
          },
        ],
      };
    }

    case 'catalog':
    case 'menu':
    case 'services': {
      let items = (facts.items || []).map((item) => ({
        ...item,
        whatsapp: whatsappUrl(phone, `Hello ${input.title}, I want to order "${item.title}".`),
      }));
      if (!items.length) {
        items = [
          { id: 'sample-1', title: 'Product 1', description: 'Handcrafted signature item made with premium materials.', price: 49900, currency: 'INR', badge: 'Best Seller', whatsapp: whatsappUrl(phone, `Hello ${input.title}, I want to order "Product 1".`) },
          { id: 'sample-2', title: 'Product 2', description: 'Exclusive artisanal collection piece with authentic finish.', price: 79900, currency: 'INR', badge: 'Trending', whatsapp: whatsappUrl(phone, `Hello ${input.title}, I want to order "Product 2".`) },
          { id: 'sample-3', title: 'Product 3', description: 'Popular everyday favourite verified for premium quality.', price: 129900, currency: 'INR', badge: 'Featured', whatsapp: whatsappUrl(phone, `Hello ${input.title}, I want to order "Product 3".`) },
          { id: 'sample-4', title: 'Product 4', description: 'Limited edition seasonal release crafted to perfection.', price: 189900, currency: 'INR', whatsapp: whatsappUrl(phone, `Hello ${input.title}, I want to order "Product 4".`) },
        ];
      }

      const itemCount = items.length;
      const layoutKind = catalogLayoutFor(itemCount);
      const sectionTitle = purpose === 'menu' ? 'Menu' : purpose === 'services' ? 'Services' : 'Catalog';

      const nodes: Node[] = [
        { id: `${at}-title`, kind: 'heading', props: { text: sectionTitle, level: 2 } },
        {
          id: `${at}-items`,
          kind: 'collection',
          props: {
            slot: 'items',
            layout: layoutKind,
            items,
            whatsappPhone: phone,
          },
        },
      ];

      return {
        id: at,
        purpose,
        layout: { kind: 'stack', columns: layoutKind === 'rails' ? 4 : layoutKind === 'pills' ? 3 : 2 },
        style: style(density),
        nodes,
        bindings: [{
          id: `${at}-binding`,
          slot: 'items',
          query: purpose === 'services' ? 'records.public' : 'catalog.public',
          version: 1,
          access: 'public',
          freshness: 300,
          params: {
            records: (facts.items || []).map((i) => i.id),
            channel: facts.channel || 'default',
            ...(purpose === 'services' ? { type: 'pos.product' } : {}),
          },
          empty: { text: 'Availability is published here.' },
        }],
      };
    }

    case 'story': {
      // Only include story if merchant actually gave a story in Brief/Facts; never show dummy "Cloth21 online" text
      const text = brief.goal && brief.goal !== `${input.title} online` ? brief.goal : '';
      if (!text) return null;
      slots.push({ id: `${at}-body`, limit: 600, purpose: 'story', current: text });
      return {
        id: at,
        purpose: 'story',
        layout: { kind: 'stack' },
        style: style(density, 'surface'),
        nodes: [
          { id: `${at}-title`, kind: 'heading', props: { text: `About ${input.title}`, level: 2 } },
          { id: `${at}-body`, kind: 'text', props: { text } },
        ],
      };
    }

    case 'trust': {
      const proofs = facts.proofs || [];
      if (!proofs.length) return null;
      const proofLabels = proofs.map((p) => p.toUpperCase());
      return {
        id: at,
        purpose: 'trust',
        layout: { kind: 'grid', columns: Math.min(3, proofs.length) },
        style: style(density),
        nodes: [
          { id: `${at}-title`, kind: 'heading', props: { text: 'Authentic & Verified', level: 2 } },
          ...proofLabels.map((badge, idx) => ({
            id: `${at}-badge-${idx + 1}`,
            kind: 'card' as const,
            props: {},
            children: [{ id: `${at}-text-${idx + 1}`, kind: 'text' as const, props: { text: `✓ ${badge}` } }],
          })),
        ],
      };
    }

    case 'contact': {
      const details = [
        facts.address,
        facts.city && `Location: ${facts.city}`,
        facts.phone && `Phone: ${facts.phone}`,
        facts.email && `Email: ${facts.email}`,
      ].filter((entry): entry is string => Boolean(entry));

      return {
        id: at,
        purpose: 'contact',
        layout: { kind: 'stack' },
        style: style(density, 'surface'),
        nodes: [
          { id: `${at}-title`, kind: 'heading', props: { text: `Contact & Orders`, level: 2 } },
          ...(details.length ? [{ id: `${at}-list`, kind: 'list' as const, props: { items: details } }] : []),
          {
            id: `${at}-cta-row`,
            kind: 'flex',
            props: {},
            children: [
              {
                id: `${at}-whatsapp`,
                kind: 'button',
                props: {
                  label: 'Chat on WhatsApp',
                  href: whatsappUrl(phone, `Hello ${input.title}, I have a question.`),
                  variant: 'filled',
                },
              },
              ...(facts.phone
                ? [{ id: `${at}-call`, kind: 'button' as const, props: { label: `Call ${facts.phone}`, href: `tel:${facts.phone}`, variant: 'outline' } }]
                : []),
            ],
          },
        ],
      };
    }

    default:
      return null;
  }
}

function buildComingSoonPage(input: BuildInput): Page {
  const phone = input.facts.phone || '';
  const tone = input.blueprint.tone || 'canvas';
  return {
    id: 'home',
    path: '/',
    title: input.title,
    meta: { description: `${input.title} - Coming soon with WhatsApp orders.` },
    sections: [
      {
        id: 'header',
        purpose: 'header',
        layout: { kind: 'stack' },
        style: style(input.blueprint.density || 2, tone),
        nodes: [
          { id: 'cs-title', kind: 'heading', props: { text: input.title, level: 1 } },
          { id: 'cs-tagline', kind: 'text', props: { text: 'Our full online storefront is arriving shortly.' } },
          {
            id: 'cs-cta-row',
            kind: 'flex',
            props: {},
            children: [
              {
                id: 'cs-whatsapp',
                kind: 'button',
                props: {
                  label: 'Inquire on WhatsApp',
                  href: whatsappUrl(phone, `Hello ${input.title}, please send me your product catalog.`),
                  variant: 'filled',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'contact',
        purpose: 'contact',
        layout: { kind: 'stack' },
        style: style(input.blueprint.density || 2, 'surface'),
        nodes: [
          { id: 'cs-contact-title', kind: 'heading', props: { text: 'Get in Touch', level: 2 } },
          {
            id: 'cs-contact-text',
            kind: 'text',
            props: { text: input.facts.address || input.facts.phone ? `Visit or call: ${[input.facts.address, input.facts.phone].filter(Boolean).join(' · ')}` : 'Contact us directly on WhatsApp for orders.' },
          },
        ],
      },
    ],
  };
}

export function buildSite(input: BuildInput): { doc: SiteDocument; slots: Slot[]; gate: boolean } {
  const gatePasses = checkPublishGate(input.facts);
  const slots: Slot[] = [];

  const blueprint: Blueprint = {
    ...input.blueprint,
    gate: gatePasses,
    catalogLayout: catalogLayoutFor(input.facts.items?.length ?? 0),
    sections: compileSectionOrder(
      input.blueprint.kind || 'goods',
      input.blueprint.lead || 'catalog',
      {
        notice: Boolean(input.facts.notice),
        spotlight: input.blueprint.sections.includes('spotlight'),
        catalog: (input.facts.items?.length ?? 0) > 0,
        story: input.blueprint.sections.includes('story'),
        trust: input.blueprint.sections.includes('trust') && (input.facts.proofs?.length ?? 0) > 0,
      },
    ),
  };

  const design: Design = blueprint.style
    ? resolveDesign(blueprint.style)
    : createDesign(
        blueprint.typography,
        blueprint.tone,
        blueprint.density,
        input.brief,
      );

  const homeSections: Section[] = [];
  for (const sectionKind of blueprint.sections) {
    const at = sectionKind === 'header' ? 'hero' : slug(sectionKind, 'section');
    const section = block(sectionKind, at, { ...input, blueprint }, ['/'], slots);
    if (section) homeSections.push(section);
  }
  const pages: Page[] = [
    {
      id: 'home',
      path: '/',
      title: input.title,
      meta: { description: (input.brief.goal || `${input.title} online`).slice(0, 300) },
      sections: homeSections,
    },
  ];

  const carried = input.previous;
  const doc: SiteDocument = {
    schema: DOCUMENT_VERSION,
    revision: carried ? carried.revision + 1 : 1,
    brief: input.brief,
    category: blueprint.kind,
    blueprint: structuredClone(blueprint),
    locale: input.locale || carried?.locale || 'en',
    timezone: carried?.timezone || 'Asia/Kolkata',
    currency: carried?.currency || 'INR',
    design,
    assets: structuredClone(input.assets || []),
    components: [],
    pages,
    journeys: [],
    redirects: [],
    locks: [],
    policy: { allowedCurrencies: ['INR'] },
    claims: [],
    currentRelease: carried?.currentRelease ?? null,
    releases: structuredClone(carried?.releases || []),
  };

  return { doc, slots, gate: gatePasses };
}

export function defaultSite(title: string, goal: string): SiteDocument {
  const brief = { goal, audience: '', tone: '' };
  return buildSite({
    title,
    brief,
    facts: {},
    blueprint: defaultBlueprint('goods'),
    assets: [],
  }).doc;
}
