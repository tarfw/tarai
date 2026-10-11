/**
 * Primitives Registry.
 *
 * Maps (purpose, option) to the isolated, pixel-perfect primitive template.
 * Zero hardcoded HTML in the compiler; every section is an independent module.
 */

import type { Section } from './document.ts';
import type { RenderContext } from './primitives/nodes.ts';

// Header primitives
import * as HeaderMinimal from './primitives/header/minimal.ts';
import * as HeaderFloatingPill from './primitives/header/floating_pill.ts';
import * as HeaderCenteredLogo from './primitives/header/centered_logo.ts';

// Hero primitives
import * as HeroSplit from './primitives/hero/split.ts';
import * as HeroAtmospheric from './primitives/hero/atmospheric.ts';
import * as HeroCommerce from './primitives/hero/commerce.ts';
import * as HeroTypography from './primitives/hero/typography.ts';

// Announcement primitives
import * as AnnouncementScrolling from './primitives/announcement/scrolling.ts';
import * as AnnouncementQuizPill from './primitives/announcement/quiz_pill.ts';

// Catalog primitives
import * as CatalogCleanGrid from './primitives/catalog/clean_grid.ts';

// Footer primitives
import * as FooterContactCard from './primitives/footer/contact_card.ts';

// Generic fallback renderer
import { renderNodes } from './primitives/nodes.ts';
import { styleClass } from './styles.ts';
import { escapeAttribute } from './html.ts';

export interface PrimitiveRenderer {
  render(section: Section, context: RenderContext): string;
}

export function getPrimitive(purpose: string, option?: string): PrimitiveRenderer {
  switch (purpose) {
    case 'announcement':
    case 'notice': {
      if (option === 'quiz_pill' || option === 'quiz') return AnnouncementQuizPill;
      return AnnouncementScrolling;
    }
    case 'navigation':
    case 'header': {
      if (option === 'floating_pill') return HeaderFloatingPill;
      if (option === 'centered_logo') return HeaderCenteredLogo;
      return HeaderMinimal;
    }
    case 'hero': {
      if (option === 'centered_atmospheric' || option === 'atmospheric' || option === 'bg_image') return HeroAtmospheric;
      if (option === 'commerce') return HeroCommerce;
      if (option === 'typography') return HeroTypography;
      return HeroSplit;
    }
    case 'catalog':
    case 'collection':
    case 'menu':
    case 'services': {
      return CatalogCleanGrid;
    }
    case 'footer': {
      return FooterContactCard;
    }
    default: {
      return {
        render(section: Section, context: RenderContext): string {
          const style = styleClass(context.collector, section.style);
          const layout = section.layout || { kind: 'flow' };
          const kind = layout.kind === 'flow' ? '' : ` tar-${layout.kind}`;
          const body = renderNodes(section.nodes, { ...context, binding: section.bindings?.[0], sectionLayout: section.layout });
          if (!body.trim()) return '';
          return `<section id="${escapeAttribute(section.id)}" class="tar-section${style}" data-purpose="${escapeAttribute(section.purpose)}"><div class="tar-wrap${kind}">${body}</div></section>`;
        },
      };
    }
  }
}
