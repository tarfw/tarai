import { createClient } from '@libsql/client';
import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { executeGateway } from '../src/gateway/actions.ts';
import type { AccessContext } from '../src/types.ts';
import { DEFAULT_DESIGN, auditDesign, exportDesign, parseDesign } from '../src/site/design.ts';
import { DOCUMENT_VERSION, SECTION_LAYOUTS, type Asset, type Section, type SectionLayoutSpec, type SiteDocument } from '../src/site/document.ts';
import { defaultBlueprint } from '../src/site/blueprint.ts';
import { compileDocument } from '../src/site/compile.ts';
import { collectIssues, validateDocument } from '../src/site/validate.ts';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => {
  while (clients.length) clients.pop()?.close();
  vi.unstubAllGlobals();
});

function releaseBucket(): R2Bucket & { objects: Map<string, string> } {
  const objects = new Map<string, string>();
  return {
    objects,
    put: async (key: string, value: string) => { objects.set(key, String(value)); return {} as R2Object; },
    get: async (key: string) => { const value = objects.get(key); return value === undefined ? null : ({ text: async () => value } as unknown as R2ObjectBody); },
  } as unknown as R2Bucket & { objects: Map<string, string> };
}

async function createTestWorkspace() {
  const client = createClient({ url: 'file::memory:' });
  clients.push(client);
  for (const statement of WORKSPACE_SCHEMA) {
    await client.execute(statement);
  }
  const at = Date.now();
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('capability','capability','Capabilities','active',?, 'owner_1',1,?,?)",
    args: [JSON.stringify({ site: true, pos: false, commerce: false }), at, at] });
  // The storefront publishes what the owner actually sells, so the fixture sells something.
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('settings','pos.settings','Store','active','{\"currency\":\"INR\"}','owner_1',1,?,?)", args: [at, at] });
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('prod_garlic','pos.product','Garlic Bread','active','{\"price\":15000,\"shortDescription\":\"Fresh with herbs\"}','owner_1',1,?,?)", args: [at, at] });
  return client;
}

const ownerAccess: AccessContext = {
  identity: { id: 'owner_1', email: 'owner@slicehouse.in', name: 'Muthu' },
  workspace: { id: 'ws_slice', name: 'Slice House', slug: 'slice-house', mode: 'work', databaseName: 'slice', databaseHost: 'slice', state: 'active' },
  member: { workspaceId: 'ws_slice', userId: 'owner_1', role: 'owner', state: 'active' },
};

const asset: Asset = {
  id: 'logo', kind: 'image', key: 'workspaces/ws_slice/sites/site_1/assets/logo.png', mime: 'image/png',
  bytes: 128, hash: 'a'.repeat(64), width: 512, height: 512, alt: 'Slice House logo',
  rights: { source: 'workspace upload', license: 'owned', approved: true },
};

function document(overrides: Partial<SiteDocument> = {}): SiteDocument {
  return {
    schema: DOCUMENT_VERSION,
    revision: 3,
    brief: { goal: 'sell pizza', audience: 'local diners', tone: 'warm' },
    locale: 'en', timezone: 'Asia/Kolkata', currency: 'INR',
    design: structuredClone(DEFAULT_DESIGN),
    assets: [structuredClone(asset)],
    pages: [{
      id: 'home', path: '/', title: 'Home', meta: { description: 'Wood fired pizza' },
      sections: [
        { id: 'navigation', purpose: 'chrome', layout: { kind: 'flow' }, nodes: [{ id: 'nav', kind: 'navigation', props: { brand: 'Slice House', links: [{ label: 'Menu', href: '/catalog' }] } }] },
        {
          id: 'hero', purpose: 'introduction', layout: { kind: 'stack' },
          nodes: [
            { id: 'hero-title', kind: 'heading', props: { text: 'Slice House', level: 1 } },
            { id: 'hero-text', kind: 'text', props: { text: 'Wood fired pizza in Chennai' } },
            { id: 'hero-image', kind: 'image', props: { asset: 'logo' }, style: { base: { radius: 'token:shape.lg', aspect: 'wide' }, small: { pad: 'sm' }, medium: { radius: 'token:shape.md' }, large: { pad: 'lg' } } },
            { id: 'hero-actions', kind: 'flex', props: {}, children: [
              { id: 'hero-primary', kind: 'button', props: { label: 'See the menu', href: '/catalog' } },
            ] },
          ],
        },
        { id: 'footer', purpose: 'chrome', layout: { kind: 'flow' }, nodes: [{ id: 'foot', kind: 'footer', props: { brand: 'Slice House', links: [] } }] },
      ],
    }],
    redirects: [], locks: [], policy: {},
    blueprint: defaultBlueprint(['food'], 1),
    ...overrides,
  };
}

describe('site document v2 validation', () => {
  it('accepts a complete document and rejects structural mistakes', () => {
    expect(() => validateDocument(document())).not.toThrow();

    const unknownKind = document();
    unknownKind.pages[0].sections[1].nodes[0] = { id: 'bad', kind: 'marquee' as never, props: {} };
    expect(collectIssues(unknownKind).some((issue) => issue.message.includes('Unknown node kind'))).toBe(true);

    const badStyle = document();
    badStyle.pages[0].sections[1].nodes[0].style = { base: { position: 'fixed' } as never };
    expect(collectIssues(badStyle).some((issue) => issue.message.includes('not allowed'))).toBe(true);

    const badToken = document();
    badToken.pages[0].sections[1].nodes[0].style = { base: { color: 'token:color.neon' } };
    expect(collectIssues(badToken).some((issue) => issue.message.includes('Unknown colour token'))).toBe(true);

    const twoHeadings = document();
    twoHeadings.pages[0].sections[1].nodes.push({ id: 'hero-title-2', kind: 'heading', props: { text: 'Another', level: 1 } });
    expect(collectIssues(twoHeadings).some((issue) => issue.message.includes('exactly one level-one heading'))).toBe(true);

    const duplicateIds = document();
    duplicateIds.pages[0].sections[1].nodes.push({ id: 'hero-text', kind: 'text', props: { text: 'duplicate' } });
    expect(collectIssues(duplicateIds).some((issue) => issue.message.includes('unique'))).toBe(true);
  });

  it('validates bindings, redirects and locks', () => {
    const bound = document();
    bound.pages[0].sections.push({
      id: 'catalog', purpose: 'collection', layout: { kind: 'grid' },
      nodes: [{ id: 'items', kind: 'collection', props: { title: 'Menu', slot: 'items', items: [] } }],
      bindings: [{ id: 'catalog-items', slot: 'items', query: 'catalog.public', version: 1, access: 'public', freshness: 300, params: { records: ['prod_1'], channel: 'web' } }],
    });
    expect(() => validateDocument(bound)).not.toThrow();

    const unregistered = structuredClone(bound);
    unregistered.pages[0].sections[3].bindings = [{ id: 'bad', slot: 'items', query: 'secret.query' as never, version: 1, access: 'public', freshness: 300 }];
    expect(collectIssues(unregistered).some((issue) => issue.message.includes('not registered'))).toBe(true);

    const orphanBinding = structuredClone(bound);
    orphanBinding.pages[0].sections[3].nodes = [{ id: 'text', kind: 'text', props: { text: 'no collection' } }];
    expect(collectIssues(orphanBinding).some((issue) => issue.message.includes('collection node'))).toBe(true);

    const redirect = document();
    redirect.redirects = [{ from: '/old', to: '/catalog', status: 308 }];
    expect(() => validateDocument(redirect)).not.toThrow();
    const looped = structuredClone(redirect);
    looped.redirects = [{ from: '/old', to: '/old', status: 308 }];
    expect(collectIssues(looped).some((issue) => issue.message.includes('different path'))).toBe(true);

    const locked = document();
    locked.locks = [{ target: 'hero', kind: 'section', at: 1 }];
    expect(() => validateDocument(locked)).not.toThrow();
    const badLock = structuredClone(locked);
    badLock.locks = [{ target: 'ghost', kind: 'section', at: 1 }];
    expect(collectIssues(badLock).some((issue) => issue.message.includes('does not exist'))).toBe(true);
  });

  it('rejects assets without provenance and unsafe asset types', () => {
    const badMime = document();
    badMime.assets = [{ ...asset, mime: 'application/javascript' }];
    expect(collectIssues(badMime).some((issue) => issue.message.includes('not allowed'))).toBe(true);

    const noRights = document();
    noRights.assets = [{ ...asset, rights: { source: '', license: '', approved: false } }];
    expect(collectIssues(noRights).some((issue) => issue.message.includes('provenance'))).toBe(true);
  });
});

describe('site design system', () => {
  it('parses design.md into typed tokens with recorded conflicts', () => {
    const markdown = `# Design
## Direction
- audience: local families
- voice: warm and plain
- density: airy
## Foundations
- canvas: #ffffff
- ink: #0b0b0c
- accent: #4d49fc
- surface: #f7f7f8
- border: #e6e6ea
- muted: #5b6169
- accentink: #ffffff
## Typography
- display: Georgia serif
- body: System sans
- base: 16px
- scale: 1.25
## Spacing
- unit: 4px
- section: 96px
- container: 1140px
## Shape
- radius: 8px, 50px, 9999px
## Motion
- duration: 200ms
- easing: easeout
- reduce: true
## Guidance
- Keep a single accent colour.
`;
    const parsed = parseDesign(markdown);
    expect(parsed.design.color.accent).toBe('#4d49fc');
    expect(parsed.design.space.unit).toBe(4);
    expect(parsed.design.space.section).toBe(96);
    expect(parsed.design.shape.pill).toBe(9999);
    expect(parsed.design.direction.density).toBe('airy');
    expect(parsed.design.guidance).toContain('Keep a single accent colour.');

    const fourRadii = parseDesign('## Shape\n- radius: 2px, 4px, 8px, 16px\n');
    expect(fourRadii.decisions.some((decision) => decision.area === 'shape')).toBe(true);

    const lowType = parseDesign('## Typography\n- base: 13px\n');
    expect(lowType.design.type.base).toBe(16);
    expect(lowType.decisions.some((decision) => decision.question.includes('readable minimum'))).toBe(true);

    const figma = parseDesign('## Typography\n- heading font: Figma Brand Sans\n');
    expect(figma.decisions.some((decision) => decision.question.includes('Substitute named fonts'))).toBe(true);

    const exported = exportDesign(parsed.design);
    expect(exported).toContain('## Foundations');
    expect(exported).toContain('accent: #4d49fc');
    const roundTrip = parseDesign(exported, parsed.design);
    expect(roundTrip.design.color.accent).toBe(parsed.design.color.accent);
  });

  it('flags unreadable contrast as blocking', () => {
    const low = structuredClone(DEFAULT_DESIGN);
    low.color.ink = '#cccccc';
    expect(auditDesign(low).some((report) => report.level === 'blocking' && report.message.includes('Body text contrast'))).toBe(true);
  });
});

describe('site v2 compiler', () => {
  it('renders every node kind with semantic HTML and progressive runtime', async () => {
    const doc = document();
    doc.pages[0].sections[1].nodes.push(
      { id: 'list', kind: 'list', props: { items: ['Hot honey', 'Margherita'] } },
      { id: 'icon', kind: 'icon', props: { name: 'star' } },
      { id: 'divider', kind: 'divider', props: {} },
      { id: 'spacer', kind: 'spacer', props: {} },
      { id: 'tabs', kind: 'tabs', props: {}, children: [
        { id: 'tab-one', kind: 'stack', props: { label: 'Menu' }, children: [{ id: 'tab-one-text', kind: 'text', props: { text: 'Hot honey' } }] },
      ] },
      { id: 'accordion', kind: 'accordion', props: {}, children: [
        { id: 'faq-one', kind: 'stack', props: { label: 'Delivery?' }, children: [{ id: 'faq-one-text', kind: 'text', props: { text: 'Within 5km' } }] },
      ] },
      { id: 'gallery', kind: 'gallery', props: { assets: ['logo'] } },
      { id: 'menu', kind: 'menu', props: { links: [{ label: 'Menu', href: '/catalog' }] } },
    );
    const compiled = await compileDocument(doc, { origin: 'https://slice.example.test' });
    const home = String(compiled.files.find((file) => file.path === '/index.html')?.body || '');
    expect(home).toContain('<html lang="en">');
    expect(home).toContain('alt="Slice House logo"');
    expect(home).toContain('width="512"');
    expect(home).toContain('<details class="tar-acc">');
    expect(home).toContain('role="tabpanel"');
    expect(home).toContain('aria-selected="true"');
    expect(home).toContain('<ul id="list"');
    expect(home).toContain('/media/logo.png');
    expect(home).toContain('href="https://slice.example.test/"');
    const runtime = compiled.files.find((file) => file.path === '/site.js');
    expect(runtime).toBeDefined();
    expect(String(runtime?.body)).toContain('tar-menu-btn');
    const css = String(compiled.files.find((file) => file.path === '/style.css')?.body || '');
    expect(css).toContain(`--color-accent: ${DEFAULT_DESIGN.color.accent}`);
    expect(css).toContain('border-radius:16px');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (min-width: 641px) and (max-width: 1024px)');
    expect(css).toContain('@media (min-width: 1025px)');
    expect(css).toContain('prefers-reduced-motion');
    const sitemap = String(compiled.files.find((file) => file.path === '/sitemap.xml')?.body || '');
    expect(sitemap).toContain('<loc>https://slice.example.test/</loc>');
    expect(sitemap).not.toContain('//</loc>');
  });

  it('escapes content and never emits inline handlers or scripts from data', async () => {
    const doc = document();
    doc.pages[0].sections[1].nodes = [
      { id: 'hero-title', kind: 'heading', props: { text: '</script><script>alert(1)</script>', level: 1 } },
      { id: 'hero-text', kind: 'text', props: { text: 'Safe & sound' } },
      { id: 'link', kind: 'link', props: { label: 'Unsafe', href: 'javascript:alert(1)' } },
      { id: 'button', kind: 'button', props: { label: 'Unsafe', href: 'javascript:alert(1)' } },
    ];
    const compiled = await compileDocument(doc);
    const home = String(compiled.files.find((file) => file.path === '/index.html')?.body || '');
    expect(home).not.toContain('<script>alert(1)</script>');
    expect(home).toContain('&lt;/script&gt;');
    expect(home).not.toContain('javascript:');
    expect(home).not.toContain('onclick');
    // Nothing above may reach the page as a handler; the one script the page carries is the
    // bundled runtime, and this fixture earned it by drawing a menu.
    expect(String(compiled.files.find((file) => file.path === '/site.js')?.body)).toContain("querySelectorAll('[data-menu]')");
  });

  it('expands collection detail templates and pagination at compile time', async () => {
    const doc = document();
    doc.pages.push({
      id: 'catalog', path: '/catalog', title: 'Menu',
      sections: [{
        id: 'items-section', purpose: 'collection', layout: { kind: 'grid' },
        nodes: [{
          id: 'items', kind: 'collection', props: {
            title: 'Menu', slot: 'items',
            items: [
              { id: 'p1', slug: 'garlic-bread', title: 'Garlic Bread', price: 15000, currency: 'INR' },
              { id: 'p2', slug: 'hot-honey', title: 'Hot Honey', price: 20000, currency: 'INR' },
              { id: 'p3', slug: 'margherita', title: 'Margherita', price: 25000, currency: 'INR' },
            ],
          },
          children: [{ id: 'item-title', kind: 'heading', props: { text: '', level: 2, field: 'title' } }],
        }],
        bindings: [{ id: 'items-binding', slot: 'items', query: 'catalog.public', version: 1, access: 'public', freshness: 300, params: { records: ['p1', 'p2', 'p3'] }, paginate: { size: 2 }, detail: { path: '/catalog/:item' } }],
      }],
    });
    const compiled = await compileDocument(doc, { origin: 'https://slice.example.test' });
    const paths = compiled.files.map((file) => file.path);
    expect(paths).toContain('/catalog/garlic-bread/index.html');
    expect(paths).toContain('/catalog/page/2/index.html');
    const detail = String(compiled.files.find((file) => file.path === '/catalog/garlic-bread/index.html')?.body || '');
    expect(detail).toContain('Garlic Bread');
    const sitemap = String(compiled.files.find((file) => file.path === '/sitemap.xml')?.body || '');
    expect(sitemap).toContain('<loc>https://slice.example.test/catalog/garlic-bread</loc>');
  });

  it('serves a public cart page for priced items, with a progressive form and no client prices', async () => {
    const doc = document();
    doc.pages[0].sections.push({
      id: 'catalog', purpose: 'catalog', layout: { kind: 'grid' },
      nodes: [{ id: 'items', kind: 'collection', props: { title: 'Menu', slot: 'items', items: [
        { id: 'v_garlic', slug: 'garlic-bread', title: 'Garlic Bread', price: 15000, currency: 'INR' },
      ] } }],
      bindings: [{ id: 'b', slot: 'items', query: 'catalog.public', version: 1, access: 'public', freshness: 300, params: { records: ['v_garlic'], channel: 'default' } }],
    });
    const compiled = await compileDocument(doc, { origin: 'https://slice.example.test' });
    const cart = compiled.files.find((file) => file.path === '/order/index.html');
    expect(cart).toBeTruthy();
    const body = String(cart?.body || '');
    // The buyer sends variant ids and counts; the page carries no price input to tamper with.
    expect(body).toContain('name="item" value="v_garlic"');
    expect(body).toContain('name="quantity"');
    expect(body).toContain('method="post" action="./"');
    expect(body).not.toMatch(/name="price"/);
    // The cart is reachable from the storefront nav.
    const home = String(compiled.files.find((file) => file.path === '/index.html')?.body || '');
    expect(home).toContain('href="/order/"');
    expect(String(compiled.files.find((file) => file.path === '/sitemap.xml')?.body || '')).toContain('<loc>https://slice.example.test/order</loc>');

    // A store with nothing priced has no cart page at all.
    const bare = document();
    const none = await compileDocument(bare, { origin: 'https://slice.example.test' });
    expect(none.files.some((file) => file.path === '/order/index.html')).toBe(false);
  });
});

describe('site generation and editing', () => {
  it('applies v2 patch operations to a generated draft', async () => {
    const client = await createTestWorkspace();
    const generated = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.generate', idempotencyKey: 'edit-generate', input: { title: 'Slice House', prompt: 'Pizza', records: ['prod_garlic'] },
    }));
    const siteId = String(generated.siteId);
    const site = generated.site as SiteDocument;
    const edited = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'edit-patch', input: {
        siteId, base: site.revision, summary: 'Copy',
        operations: [{ op: 'set_text', target: 'hero-title', value: 'Chennai’s Best Slice' }],
      },
    }, { siteReleases: releaseBucket() }));
    const updated = edited.site as SiteDocument;
    const hero = updated.pages[0].sections.find((section) => section.id === 'hero')!;
    expect(hero.nodes.find((node) => node.kind === 'heading')?.props.text).toBe('Chennai’s Best Slice');
    expect(updated.schema).toBe(DOCUMENT_VERSION);
    expect(updated.revision).toBe(site.revision + 1);
  });

  it('generates a deterministic Blueprint storefront and honours explicit design tokens', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const generated = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.generate',
      idempotencyKey: 'blueprint-tokens-generate',
      input: {
        title: 'Murugan Silks',
        prompt: 'Build a storefront for silk sarees in Salem.',
        records: ['prod_garlic'],
        tone: 'ink',
        typography: 'serif',
        density: 3,
      },
    }));
    const siteId = String(generated.siteId);
    const site = generated.site as SiteDocument;
    // Blueprint kind defaults to goods when none specified
    expect(site.category).toBe('goods');
    // Explicit design tokens drive the compiled tokens.
    expect(site.design.color.canvas).toBe('#111111');
    expect(site.design.color.ink).toBe('#f8fafc');
    expect(site.pages.map((page) => page.path)).toEqual(['/']);

    const compiled = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.compile', idempotencyKey: 'blueprint-compile', input: { siteId },
    }, { siteReleases: bucket }));
    const prefix = `workspaces/${ownerAccess.workspace.id}/sites/${siteId}/releases/${compiled.releaseId}`;
    const html = bucket.objects.get(`${prefix}/index.html`)!;
    expect(html).toContain('Murugan Silks');
    expect(html).not.toContain('data-placeholders');
    expect(html).not.toContain('unsplash');
    const css = bucket.objects.get(`${prefix}/style.css`)!;
    expect(css).toContain('--color-canvas: #111111');
    expect(css).toContain('--color-ink: #f8fafc');
    expect(css).toContain('Mukta Malar');
    expect(css).not.toContain('images.unsplash.com');

    const report = JSON.parse(bucket.objects.get(`${prefix}/report.json`)!) as { inspection: { blocking: unknown[] } };
    expect(report.inspection.blocking.length).toBe(0);

    const published = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'blueprint-publish', input: { siteId, releaseId: compiled.releaseId, hash: compiled.hash },
    }, { siteReleases: bucket }));
    expect(published.state).toBe('live');
  });
});

describe('layout grammar', () => {
  function laidOut(layout: SectionLayoutSpec): SiteDocument {
    const doc = document();
    doc.pages[0].sections[1].layout = layout;
    return doc;
  }

  it('accepts every primitive the engine implements', () => {
    expect([...SECTION_LAYOUTS]).toEqual(['flow', 'flex', 'stack', 'row', 'grid', 'split', 'overlay', 'rail', 'disclosure']);
    for (const kind of SECTION_LAYOUTS) {
      expect(collectIssues(laidOut({ kind })).filter((issue) => issue.area === 'section')).toEqual([]);
    }
  });

  it('keeps each knob with the layout that renders it', () => {
    expect(collectIssues(laidOut({ kind: 'split', ratio: '60/40', collapse: 'keep' }))).toEqual([]);
    expect(collectIssues(laidOut({ kind: 'overlay', height: 'tall', scrim: 'token:color.ink' }))).toEqual([]);
    expect(collectIssues(laidOut({ kind: 'row', collapse: 'stack' }))).toEqual([]);
    expect(collectIssues(laidOut({ kind: 'rail' }))).toEqual([]);
    expect(collectIssues(laidOut({ kind: 'disclosure' }))).toEqual([]);

    const unknown = laidOut({ kind: 'split', ratio: '75/25', height: 'huge', scrim: 'token:color.neon', collapse: 'nonsense' });
    const words = collectIssues(unknown).map((issue) => issue.message);
    expect(words).toContain('A ratio is one of 50/50, 60/40, 40/60, 2/1 or 1/2.');
    expect(words).toContain('Height is short, tall or full.');
    expect(words).toContain('Collapse is stack or keep.');
    expect(words).toContain('Only an overlay has a height.');
    expect(words).toContain('Only an overlay has a scrim.');

    const misplaced = collectIssues(laidOut({ kind: 'grid', ratio: '50/50', columns: 2 }));
    expect(misplaced.some((issue) => issue.message === 'Only a split has a ratio.')).toBe(true);
    expect(collectIssues(laidOut({ kind: 'split', height: 'tall' })).some((issue) => issue.message === 'Only an overlay has a height.')).toBe(true);
    expect(collectIssues(laidOut({ kind: 'stack', collapse: 'keep' })).some((issue) => issue.message === 'Only a split or a row says how it collapses.')).toBe(true);
    expect(collectIssues(laidOut({ kind: 'rail', scrim: 'token:color.ink' })).some((issue) => issue.message === 'Only an overlay has a scrim.')).toBe(true);
    expect(collectIssues(laidOut({ kind: 'overlay', scrim: '#000000' })).some((issue) => issue.message === 'A scrim is a colour token the design carries.')).toBe(true);
    expect(collectIssues(laidOut({ kind: 'overlay', scrim: 'token:color.neon' })).some((issue) => issue.message === 'A scrim is a colour token the design carries.')).toBe(true);
  });

  it('carries the knobs onto the container as token-driven properties', async () => {
    const doc = document();
    doc.pages[0].sections.push(
      { id: 'story', purpose: 'story', layout: { kind: 'split', ratio: '60/40', collapse: 'keep' }, nodes: [{ id: 'story-text', kind: 'text', props: { text: 'Baked since 1998.' } }] },
      { id: 'proof', purpose: 'trust', layout: { kind: 'overlay', height: 'tall', scrim: 'token:color.ink' }, nodes: [{ id: 'proof-text', kind: 'text', props: { text: 'Wood fired' } }] },
      { id: 'picks', purpose: 'spotlight', layout: { kind: 'rail' }, nodes: [{ id: 'picks-text', kind: 'text', props: { text: 'This week' } }] },
    );
    const compiled = await compileDocument(doc, { origin: 'https://slice.example.test' });
    const html = String(compiled.files.find((file) => file.path === '/index.html')?.body || '');
    expect(html).toContain('class="tar-wrap tar-split tar-keep" style="--split-ratio:3fr 2fr"');
    expect(html).toContain('class="tar-wrap tar-overlay" style="--overlay-height:65vh;--overlay-scrim:#000000"');
    expect(html).toContain('class="tar-wrap tar-rail"');
    const css = String(compiled.files.find((file) => file.path === '/style.css')?.body || '');
    expect(css).toContain('.tar-split { display: grid; grid-template-columns: var(--split-ratio, 1fr 1fr)');
    expect(css).toContain('.tar-overlay > .tar-scrim { position: absolute; inset: 0;');
    expect(css).toContain('scroll-snap-type: x mandatory');
    expect(css).toContain('.tar-disclosure details[open] summary::after');
    expect(css).toContain('.tar-split:not(.tar-keep) { grid-template-columns: 1fr');
    expect(css).not.toMatch(/\.tar-(row|split|overlay|rail|disclosure)[^{]*#[0-9a-f]/i);
  });
});

