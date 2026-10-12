/**
 * Deterministic site builder.
 *
 * Implements the Autonomous Commerce Store contract (parai.md):
 * Facts (records) + Brief (bullets) -> commerce model -> Blueprint -> code -> static page.
 *
 * It invents nothing: every block carries supplied facts or plain text derived
 * from the owner's own brief. A block whose evidence is missing is
 * omitted, never faked. Prices and money stay strictly code-owned.
 */

import { createDesign, resolveDesign, TONE_STYLE, type Design } from './design.ts';
import {
  DOCUMENT_VERSION,
  type Asset,
  type Brief,
  type Node,
  type Page,
  type Section,
  type SectionLayoutSpec,
  type SiteDocument,
  type StyleSet,
} from './document.ts';
import { recipeOfType, sectionType } from './recipes/library.ts';
import { tokenRef } from './recipes/slots.ts';
import {
  applySectionOverrides,
  catalogLayoutFor,
  checkModelsGate,
  compileSectionOrder,
  defaultBlueprint,
  kindForModels,
  lockedText,
  modelsOf,
  type Blueprint,
  type BusinessKind,
  type DensityToken,
  type GateResult,
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
  terms?: string[];
  minimum?: string;
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

/**
 * The recipe chooses the section's layout and is stamped on the section, so a renderer reads
 * its settings back without guessing. A number the builder worked out from the content —
 * how many columns a catalog needs — still beats the recipe's standing default.
 */
export function stampRecipe(section: Section, blueprint: Blueprint): Section {
  const type = sectionType(section.purpose);
  const recipe = recipeOfType(type, blueprint.recipes?.[type]);
  if (!recipe) return section;
  const layout: SectionLayoutSpec = {
    ...recipe.layout,
    ...(typeof section.layout?.columns === 'number' ? { columns: section.layout.columns } : {}),
    ...(recipe.layout.scrim ? { scrim: tokenRef(recipe.layout.scrim) } : {}),
  };
  // The merchant's settings win over anything already stamped, and only the settings the
  // chosen recipe declares survive, so switching a layout cannot orphan a value.
  const turned: Record<string, boolean | string> = {};
  for (const [key, value] of Object.entries({ ...(section.recipe?.settings || {}), ...(blueprint.overrides?.settings?.[type] || {}) })) {
    if (Object.hasOwn(recipe.settings, key)) turned[key] = value;
  }
  const recipeStamp = Object.keys(turned).length ? { id: recipe.id, settings: turned } : { id: recipe.id };
  return { ...section, layout, recipe: recipeStamp };
}

/**
 * Merchant copy is stamped last and is never offered to the prose model, so a
 * regeneration keeps what the owner wrote instead of overwriting it (parai D10).
 * Returns the slot ids it wrote.
 */
export function stampText(doc: SiteDocument, text: Record<string, string>): string[] {
  const written: string[] = [];
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      const value = text[node.id];
      if (value && (node.kind === 'heading' || node.kind === 'text')) {
        node.props = { ...node.props, text: value };
        written.push(node.id);
      }
      walk(node.children || []);
    }
  };
  for (const page of doc.pages) for (const section of page.sections) walk(section.nodes);
  return written;
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
    case 'header': {
      // The navigation primitive reads the document's own sections; the section only
      // has to exist so the compiler never has to invent one.
      return {
        id: at,
        purpose: 'header',
        layout: { kind: 'stack' },
        style: style(density, tone),
        nodes: [],
      };
    }

    case 'hero': {
      const headline = input.title;
      const subline = brief.goal || plain;
      slots.push({ id: `${at}-line`, limit: 220, purpose: 'hero', current: subline });

      const shop = blueprint.sections.find((kind) => kind === 'catalog' || kind === 'menu' || kind === 'booking');
      const cta = shop
        ? { label: shop === 'menu' ? 'See the menu' : shop === 'booking' ? 'Book a service' : 'View Collection', href: `#${shop}` }
        : { label: 'Chat on WhatsApp', href: whatsappUrl(phone, `Hello ${input.title}, I have a question.`) };

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
              props: { label: cta.label, href: cta.href, variant: 'outline' },
            },
          ],
        },
      ];

      const photos = (input.assets || []).filter((a) => a.kind === 'image' && a.rights.approved);
      const heroRecipe = recipeOfType('hero', blueprint.recipes?.hero)?.id;
      if (photos.length >= 2 && heroRecipe === 'split') {
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
        layout: { kind: 'stack' },
        style: style(density, tone),
        nodes,
      };
    }

    case 'announcement': {
      if (!facts.notice) return null;
      return {
        id: at,
        purpose: 'announcement',
        layout: { kind: 'stack' },
        style: { base: { pad: 'sm', ...TONE_STYLE.surface } },
        nodes: [
          { id: `${at}-text`, kind: 'text', props: { text: facts.notice } },
        ],
      };
    }

    case 'spotlight': {
      // The banner recipe promises one featured thing, so it shows the shop's first item.
      // With nothing to feature the section is not built at all, the same way an empty
      // catalog is not (parai §5.4: a recipe renders or the section does not exist).
      const feature = (facts.items || [])[0];
      if (!feature) return null;
      const bannerTitle = facts.season ? `${facts.season} offer` : `Featured at ${input.title}`;
      const bannerText = brief.goal || '';
      if (bannerText) slots.push({ id: `${at}-text`, limit: 300, purpose: 'spotlight', current: bannerText });
      return {
        id: at,
        purpose: 'spotlight',
        layout: { kind: 'stack' },
        style: style(density, tone === 'ink' ? 'surface' : 'ink'),
        nodes: [
          { id: `${at}-title`, kind: 'heading', props: { text: bannerTitle, level: 2 } },
          {
            id: `${at}-feature`,
            kind: 'collection',
            props: {
              slot: 'item',
              layout: 'flat',
              items: [{ ...feature, whatsapp: whatsappUrl(phone, `Hello ${input.title}, I want to order "${feature.title}".`) }],
            },
          },
          ...(bannerText ? [{ id: `${at}-text`, kind: 'text' as const, props: { text: bannerText } }] : []),
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
    case 'booking': {
      const source = purpose === 'booking' ? (facts.services || []) : (facts.items || []);
      if (!source.length) return null;
      const items = source.map((entry) => ({
        ...entry,
        whatsapp: whatsappUrl(phone, `Hello ${input.title}, I want to order "${entry.title}".`),
      }));

      const itemCount = items.length;
      const layoutKind = catalogLayoutFor(itemCount);
      const sectionTitle = purpose === 'menu' ? 'Menu' : purpose === 'booking' ? 'Services' : 'Catalog';

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
          query: purpose === 'booking' ? 'records.public' : 'catalog.public',
          version: 1,
          access: 'public',
          freshness: 300,
          params: {
            records: source.map((entry) => entry.id),
            channel: facts.channel || 'default',
            ...(purpose === 'booking' ? { type: 'pos.product' } : {}),
          },
          empty: { text: 'Availability is published here.' },
        }],
      };
    }

    case 'faq': {
      const questions = facts.questions || [];
      if (!questions.length) return null;
      return {
        id: at,
        purpose: 'faq',
        layout: { kind: 'stack' },
        style: style(density),
        nodes: [
          { id: `${at}-title`, kind: 'heading', props: { text: 'Questions customers ask', level: 2 } },
          {
            id: `${at}-list`,
            kind: 'accordion',
            props: {},
            children: questions.map((entry, index) => ({
              id: `${at}-q-${index + 1}`,
              kind: 'stack' as const,
              props: { label: entry.q },
              children: [{ id: `${at}-a-${index + 1}`, kind: 'text' as const, props: { text: entry.a } }],
            })),
          },
        ],
      };
    }

    case 'policy': {
      const terms = facts.terms || [];
      if (!terms.length) return null;
      return {
        id: at,
        purpose: 'policy',
        layout: { kind: 'stack' },
        style: style(density, 'surface'),
        nodes: [
          { id: `${at}-title`, kind: 'heading', props: { text: 'Shipping, returns and payment', level: 2 } },
          { id: `${at}-list`, kind: 'list', props: { items: terms } },
        ],
      };
    }

    case 'location': {
      const lines = [
        facts.address,
        facts.city && `City: ${facts.city}`,
        ...(facts.hours || []),
      ].filter((entry): entry is string => Boolean(entry));
      if (!lines.length) return null;
      return {
        id: at,
        purpose: 'location',
        layout: { kind: 'stack' },
        style: style(density),
        nodes: [
          { id: `${at}-title`, kind: 'heading', props: { text: 'Where to find us', level: 2 } },
          { id: `${at}-list`, kind: 'list', props: { items: lines } },
        ],
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
      return {
        id: at,
        purpose: 'trust',
        layout: { kind: 'grid', columns: Math.min(3, proofs.length) },
        style: style(density),
        nodes: [
          { id: `${at}-title`, kind: 'heading', props: { text: 'Authentic & Verified', level: 2 } },
          ...proofs.map((proof, idx) => ({
            id: `${at}-badge-${idx + 1}`,
            kind: 'card' as const,
            props: {},
            // The shop's own words, unchanged: a proof is a claim the merchant made, and
            // shouting it or stamping a tick onto it is a design decision, not content.
            children: [{ id: `${at}-text-${idx + 1}`, kind: 'text' as const, props: { text: proof } }],
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

    case 'footer': {
      const lines = [
        facts.phone && `Phone: ${facts.phone}`,
        facts.email,
        facts.address,
        ...(facts.hours || []),
      ].filter((entry): entry is string => Boolean(entry));
      return {
        id: at,
        purpose: 'footer',
        layout: { kind: 'row' },
        style: style(density, 'ink'),
        nodes: [
          ...(brief.goal ? [{ id: `${at}-bio`, kind: 'text' as const, props: { text: brief.goal } }] : []),
          ...(lines.length ? [{ id: `${at}-contact`, kind: 'list' as const, props: { items: lines } }] : []),
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
        id: 'hero',
        purpose: 'hero',
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

export function buildSite(input: BuildInput): { doc: SiteDocument; slots: Slot[]; gate: GateResult } {
  const models = modelsOf(input.blueprint);
  const gate = checkModelsGate(models, input.facts);
  const itemCount = input.facts.items?.length ?? 0;
  const catalogLayout = catalogLayoutFor(itemCount);
  const slots: Slot[] = [];

  const blueprint: Blueprint = {
    ...input.blueprint,
    kind: kindForModels(models),
    profile: { ...input.blueprint.profile, models },
    gate,
    catalogLayout,
    recipes: {
      catalog: catalogLayout === 'rails' ? 'rail' : 'grid',
      ...input.blueprint.recipes,
      ...input.blueprint.overrides?.recipes,
    },
    sections: applySectionOverrides(compileSectionOrder(
      models,
      input.blueprint.lead || 'catalog',
      {
        announcement: Boolean(input.facts.notice),
        spotlight: input.blueprint.sections.includes('spotlight'),
        catalog: itemCount > 0,
        story: input.blueprint.sections.includes('story'),
        trust: input.blueprint.sections.includes('trust') && (input.facts.proofs?.length ?? 0) > 0,
      },
    ), models, input.blueprint.overrides),
  };

  const design: Design = blueprint.style
    ? resolveDesign(blueprint.style)
    : createDesign(
        blueprint.typography,
        blueprint.tone,
        blueprint.density,
        input.brief,
      );

  const buildInput: BuildInput = { ...input, blueprint };
  const homeSections: Section[] = [];
  for (const sectionKind of blueprint.sections) {
    const section = block(sectionKind, slug(sectionKind, 'section'), buildInput, ['/'], slots);
    if (section) homeSections.push(section);
  }

  // A storefront that sells items shows them or says it is coming; it never shows stand-ins.
  const sellsItems = models.some((model) => model !== 'booking' && model !== 'quote');
  const page = sellsItems && !itemCount
    ? buildComingSoonPage(buildInput)
    : {
        id: 'home',
        path: '/',
        title: input.title,
        meta: { description: (input.brief.goal || `${input.title} online`).slice(0, 300) },
        sections: homeSections,
      };
  const pages: Page[] = [{
    ...page,
    sections: page.sections.map((section) => stampRecipe(section, blueprint)),
  }];

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
    pages,
    redirects: [],
    locks: [],
    policy: carried?.policy ?? { allowedCurrencies: ['INR'] },
    claims: [],
    currentRelease: carried?.currentRelease ?? null,
    releases: structuredClone(carried?.releases || []),
  };

  stampText(doc, blueprint.overrides?.text || {});
  // A slot the merchant wrote is never offered to the prose model, so generated
  // copy cannot overwrite it and no later pass has to undo the damage.
  const locked = lockedText(blueprint.overrides);
  return { doc, slots: slots.filter((slot) => !locked.has(slot.id)), gate };
}

export function defaultSite(title: string, goal: string): SiteDocument {
  const brief = { goal, audience: '', tone: '' };
  return buildSite({
    title,
    brief,
    facts: {},
    blueprint: defaultBlueprint(),
    assets: [],
  }).doc;
}
