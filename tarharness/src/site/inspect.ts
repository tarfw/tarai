/**
 * Deterministic release checks.
 *
 * Browser/compiler/security failures block publication; subjective aesthetic
 * findings stay advisory recommendations. Measured numbers are recorded so a
 * later review can compare candidates without re-running inference.
 */

import { collectIssues, type Issue } from './validate.ts';
import type { CompileResult } from './compile.ts';
import type { Node, SiteDocument } from './document.ts';

export interface ClaimCheck {
  text: string;
  verdict: 'supported' | 'contradicted' | 'unsupported';
  evidence?: readonly string[];
}

export interface Inspection {
  blocking: Issue[];
  advisory: Issue[];
  measured: {
    pages: number;
    sections: number;
    nodes: number;
    files: number;
    html: number;
    css: number;
    js: number;
    items: number;
    claims: number;
  };
}

function walkNodes(nodes: Node[] | undefined): Node[] {
  return (nodes || []).flatMap((node) => [node, ...walkNodes(node.children)]);
}

export interface InspectOptions {
  compiled?: CompileResult;
  claims?: readonly ClaimCheck[];
  origin?: string;
  /** Identifiers that must never appear in public files (workspace, record ids). */
  secrets?: readonly string[];
}

export function inspectDocument(doc: SiteDocument, options: InspectOptions = {}): Inspection {
  const blocking: Issue[] = [];
  const advisory: Issue[] = [];
  const add = (level: 'blocking' | 'advisory', area: string, path: string, message: string) => {
    (level === 'blocking' ? blocking : advisory).push({ level, area, path, message });
  };

  for (const issue of collectIssues(doc)) (issue.level === 'blocking' ? blocking : advisory).push(issue);

  const paths = new Set(doc.pages.map((page) => page.path));
  const redirects = new Set(doc.redirects.map((redirect) => redirect.from));
  const assets = new Map(doc.assets.map((asset) => [asset.id, asset]));
  const allNodes = doc.pages.flatMap((page) => page.sections.flatMap((section) => walkNodes(section.nodes)));
  const usedAssets = new Set<string>();
  let images = 0;

  for (const node of allNodes) {
    if (node.kind === 'image') {
      images += 1;
      const id = String(node.props.asset || '');
      usedAssets.add(id);
      const asset = assets.get(id);
      if (!asset) continue;
      const decorative = node.props.decorative === true;
      const alt = typeof node.props.alt === 'string' ? node.props.alt : asset.alt || '';
      if (!decorative && !alt.trim()) add('blocking', 'a11y', node.id, 'Images need alt text or a decorative marker.');
      if (!asset.rights.approved) add('blocking', 'asset', node.id, `Asset ${id} has no approved rights for publication.`);
    }
    if (node.kind === 'gallery') {
      for (const id of (Array.isArray(node.props.assets) ? node.props.assets as string[] : [])) {
        usedAssets.add(id);
        const asset = assets.get(id);
        if (asset && !asset.rights.approved) add('blocking', 'asset', node.id, `Asset ${id} has no approved rights for publication.`);
      }
    }
    if (node.kind === 'link' || node.kind === 'button') {
      const href = typeof node.props.href === 'string' ? node.props.href : '';
      if (href.startsWith('/') && !paths.has(href) && !redirects.has(href) && !href.startsWith('/#')) {
        add('blocking', 'link', node.id, `Link target ${href} is not a page or redirect.`);
      }
    }
    const links = node.kind === 'navigation' || node.kind === 'footer' || node.kind === 'menu' ? node.props.links : undefined;
    if (Array.isArray(links)) {
      for (const link of links as { href?: string }[]) {
        const href = typeof link.href === 'string' ? link.href : '';
        if (href.startsWith('/') && !paths.has(href) && !redirects.has(href) && !href.startsWith('/#')) add('blocking', 'link', node.id, `Navigation target ${href} is not a page or redirect.`);
      }
    }
  }

  for (const asset of doc.assets) if (asset.id && !usedAssets.has(asset.id)) add('advisory', 'asset', asset.id, 'Asset is stored but not used on any page.');

  // Content rhythm: no automatic hero / three cards / testimonials sequence.
  for (const page of doc.pages) {
    const purposes = page.sections.filter((section) => section.purpose !== 'chrome').map((section) => section.purpose);
    if (purposes.length >= 4 && new Set(purposes).size === 1) add('advisory', 'distinctiveness', page.id, 'Sections repeat one purpose; vary the page rhythm.');
    const headingLevels = walkNodes(page.sections.flatMap((section) => section.nodes)).filter((node) => node.kind === 'heading').map((node) => Number(node.props.level));
    let previous = 0;
    for (const level of headingLevels) {
      if (previous && level > previous + 1) { add('advisory', 'a11y', page.id, 'Heading levels skip a step.'); break; }
      previous = level;
    }
    if (!page.meta?.description) add('advisory', 'seo', page.id, 'Pages read better with a meta description.');
  }

  for (const claim of options.claims || doc.claims || []) {
    if (claim.verdict === 'unsupported') add('advisory', 'claim', 'claims', `Unresolved claim needs review: ${claim.text.slice(0, 90)}`);
    if (claim.verdict === 'contradicted') add('blocking', 'claim', 'claims', `Claim contradicts its evidence: ${claim.text.slice(0, 90)}`);
  }

  let html = 0;
  let css = 0;
  let js = 0;
  const compiled = options.compiled;
  if (compiled) {
    const files = compiled.files;
    for (const file of files) {
      const bytes = typeof file.body === 'string' ? new TextEncoder().encode(file.body).byteLength : file.body.byteLength;
      if (file.mime.startsWith('text/html')) html += bytes;
      if (file.mime.startsWith('text/css')) css += bytes;
      if (file.mime.startsWith('text/javascript')) js += bytes;
    }
    for (const expected of ['/robots.txt', '/sitemap.xml', '/style.css']) {
      if (!files.some((file) => file.path === expected)) add('blocking', 'seo', expected, `Compiled release is missing ${expected}.`);
    }
    if (options.origin) {
      const home = String(files.find((file) => file.path === '/index.html')?.body || '');
      if (!home.includes('rel="canonical"')) add('blocking', 'seo', '/index.html', 'Compiled home page is missing its canonical link.');
    }
    if (css > 150_000) add('blocking', 'performance', 'style.css', 'Stylesheet exceeds the 150KB budget.');
    if (js > 16_000) add('blocking', 'performance', 'site.js', 'Interaction runtime exceeds the 16KB budget.');
    if (html > 1_200_000) add('advisory', 'performance', 'pages', 'Total HTML is large for one release.');
    // Only opaque identifiers are meaningful here: short or address-bearing ids
    // legitimately appear in public URLs and would be false positives.
    const secrets = (options.secrets || []).filter((secret) => secret.length >= 12 && !(options.origin || '').includes(secret));
    for (const secret of secrets) {
      const found = files.some((file) => typeof file.body === 'string' && file.body.includes(secret));
      if (found) add('blocking', 'isolation', 'release', 'Compiled release contains a private identifier.');
    }
  }

  return {
    blocking,
    advisory,
    measured: {
      pages: doc.pages.length,
      sections: doc.pages.reduce((total, page) => total + page.sections.length, 0),
      nodes: allNodes.length,
      files: compiled?.files.length || 0,
      html, css, js,
      items: compiled?.itemCount || 0,
      claims: (options.claims || doc.claims || []).length,
    },
  };
}
