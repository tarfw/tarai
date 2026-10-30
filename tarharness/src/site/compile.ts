// compile.ts — one page, three files. Render the spine, run the gate, hash and
// hand back the files the release store writes. No model, no crawl, <1ms.

import { gate, type GateReport } from './gate.ts';
import { renderSite } from './spine.ts';
import type { RenderContext } from './sections.ts';

export interface CompiledFile {
  readonly path: string;
  readonly mime: string;
  readonly body: string;
  readonly hash: string;
}

export interface CompileResult {
  readonly files: readonly CompiledFile[];
  readonly hash: string;
  readonly report: GateReport;
  readonly itemCount: number;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function compileSite(context: RenderContext, origin?: string): Promise<CompileResult> {
  const { html, css } = renderSite(context, origin);
  const report = gate(html, css, { items: context.items.length, title: context.site.title });
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin ? `${origin}/` : '/'}</loc></url>
</urlset>`;
  const files: CompiledFile[] = [
    { path: '/index.html', mime: 'text/html; charset=utf-8', body: html, hash: await sha256(html) },
    { path: '/style.css', mime: 'text/css; charset=utf-8', body: css, hash: await sha256(css) },
    { path: '/robots.txt', mime: 'text/plain; charset=utf-8', body: 'User-agent: *\nAllow: /\n', hash: await sha256('User-agent: *\nAllow: /\n') },
    { path: '/sitemap.xml', mime: 'application/xml; charset=utf-8', body: sitemap, hash: await sha256(sitemap) },
  ];
  const hash = await sha256(files.map((file) => `${file.path}:${file.hash}`).join('\n'));
  return { files, hash, report, itemCount: context.items.length };
}
