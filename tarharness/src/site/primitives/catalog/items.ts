import type { Section } from '../../document.ts';
import { escapeAttribute } from '../../html.ts';
import { renderNodes, type RenderContext } from '../nodes.ts';
import { renderEmptyCatalogSection } from '../collection.ts';
import { styleClass } from '../../styles.ts';

/**
 * The catalog: a heading over whatever its items node lays out. The layout kind comes from
 * the recipe, so a grid and a rail are the same section with a different grammar primitive.
 */
export function render(section: Section, context: RenderContext): string {
  const nodes = section.nodes || [];
  const heading = nodes.filter((node) => node.kind === 'heading');
  const body = renderNodes(nodes.filter((node) => node.kind !== 'heading'), {
    ...context,
    binding: section.bindings?.[0],
    sectionLayout: section.layout,
  });
  if (!body.trim()) return renderEmptyCatalogSection();

  const style = styleClass(context.collector, section.style);
  const title = heading.length
    ? `<div class="tar-collection-header">${renderNodes(heading, context)}</div>`
    : '';

  return `<section id="${escapeAttribute(section.id || 'catalog')}" class="tar-section${style}" data-purpose="${escapeAttribute(section.purpose)}">
  <div class="tar-wrap">
    ${title}
    ${body}
  </div>
</section>`;
}
