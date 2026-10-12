import type { Page } from '../../document.ts';

/**
 * The page links a header can offer: the sections this page actually has, in the order the
 * document lists them. Every header recipe draws its menu from here, so one store cannot
 * grow two different navigations.
 */
export function headerLinks(page: Page | undefined): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [{ label: 'Home', href: '/' }];
  for (const section of page?.sections || []) {
    const push = (label: string, href: string): void => {
      if (!links.some((entry) => entry.href === href)) links.push({ label, href });
    };
    if (section.purpose === 'catalog' || section.purpose === 'collection' || section.id === 'catalog') {
      push('Catalog', `#${section.id || 'catalog'}`);
    } else if (section.purpose === 'menu' || section.id === 'menu') {
      push('Menu', `#${section.id || 'menu'}`);
    } else if (section.purpose === 'services' || section.purpose === 'booking' || section.id === 'services') {
      push('Services', `#${section.id || 'services'}`);
    } else if (section.purpose === 'spotlight' || section.id === 'spotlight') {
      push('Offers', `#${section.id || 'spotlight'}`);
    } else if (section.purpose === 'story' || section.id === 'story') {
      push('Story', `#${section.id || 'story'}`);
    }
  }
  if (!links.some((entry) => entry.href.includes('contact'))) links.push({ label: 'Contact', href: '#contact' });
  return links;
}
