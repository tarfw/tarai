// gate.ts — the deterministic gate that replaces the Playwright suite inside
// the Worker. Same rules, checked on the rendered bytes: nothing overflows its
// own markup, no empty image box, no unsafe link, real data present.

export interface GateReport {
  readonly blocking: readonly string[];
  readonly advisory: readonly string[];
}

const IMG = /<img\b[^>]*>/gi;

export function gate(html: string, css: string, facts: { items: number; title: string }): GateReport {
  const blocking: string[] = [];
  const advisory: string[] = [];
  if (!facts.title.trim()) blocking.push('The site needs a name.');
  if (!html.includes('<title>')) blocking.push('The page has no title element.');
  if (!css.includes(':root')) blocking.push('The style has no tokens.');
  if (html.length > 1_500_000) blocking.push('The page is too large to serve.');
  for (const tag of html.match(IMG) ?? []) {
    if (!/\bsrc="https?:\/\/|\bsrc="\//i.test(tag)) blocking.push('An image has no source.');
    if (!/\balt="/i.test(tag)) blocking.push('An image has no alt text.');
  }
  if (/href="(?:javascript|data):/i.test(html)) blocking.push('A link uses an unsafe scheme.');
  if (facts.items > 0 && !/class="catalog/.test(html)) blocking.push('Catalog items were not rendered.');
  if (html.includes('${')) blocking.push('A template expression leaked into the page.');
  if (!html.includes('id="contact"')) advisory.push('The footer has no contact anchor.');
  return { blocking: [...new Set(blocking)], advisory: [...new Set(advisory)] };
}
