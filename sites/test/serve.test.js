import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

const site = { workspace: 'work_1', site: 'site_1', release: 'rel_1', hash: 'releasehash', epoch: 0, domain: 'shop.example.test' };
const prefix = 'workspaces/work_1/sites/site_1/releases/rel_1';
const html = '<html><head><style>body{color:red}</style><script type="application/ld+json">{"name":"Shop"}</script></head><body>Shop</body></html>';
const file = { path: '/index.html', mime: 'text/html; charset=utf-8', bytes: Buffer.byteLength(html), hash: 'filehash', key: `${prefix}/index.html` };

function fixture(override = {}) {
  const reads = [];
  const row = Object.hasOwn(override, 'row') ? override.row : site;
  const body = override.html || html;
  const asset = { ...file, bytes: Buffer.byteLength(body) };
  const manifest = { id: site.release, siteId: site.site, hash: site.hash, files: [asset], ...override.manifest };
  const env = {
    CONTROL: {
      withSession(mode) {
        assert.equal(mode, 'first-primary');
        return { prepare(sql) {
          assert.match(sql, override.shared ? /workspaces w JOIN sites s/ : /hosts h JOIN sites s/);
          assert.match(sql, /w.state='active'/);
          return { bind(...values) {
            reads.push([override.shared ? 'path' : 'host', ...values]);
            return { async first() { return row; } };
          } };
        } };
      },
    },
    SITE_RELEASES: {
      async get(key) {
        reads.push(['get', key]);
        if (key === `${prefix}/manifest.json`) return { size: 300, body: true, json: async () => manifest };
        if (key === file.key) return { size: asset.bytes, body: new Response(body).body, text: async () => body };
        return null;
      },
      async head(key) { reads.push(['head', key]); return null; },
    },
  };
  return { env, reads };
}

test('serves only the active host and release manifest', async () => {
  const { env, reads } = fixture();
  const result = await worker.fetch(new Request('https://shop.example.test/'), env);
  assert.equal(result.status, 200);
  assert.equal(await result.text(), html);
  assert.equal(result.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.match(result.headers.get('content-security-policy'), /style-src 'self' 'unsafe-inline'/);
  assert.match(result.headers.get('content-security-policy'), /'sha256-/);
  assert.deepEqual(reads, [['host', 'shop.example.test'], ['get', `${prefix}/manifest.json`], ['get', file.key]]);
});

test('unknown host does not read R2', async () => {
  const { env, reads } = fixture({ row: null });
  const result = await worker.fetch(new Request('https://unknown.example.test/'), env);
  assert.equal(result.status, 404);
  assert.deepEqual(reads, [['host', 'unknown.example.test']]);
});

test('secondary host redirects only after D1 authorization', async () => {
  const { env, reads } = fixture();
  const result = await worker.fetch(new Request('https://alias.example.test/collection?x=1'), env);
  assert.equal(result.status, 308);
  assert.equal(result.headers.get('location'), 'https://shop.example.test/collection?x=1');
  assert.deepEqual(reads, [['host', 'alias.example.test']]);
});

test('mismatched live release manifest fails closed', async () => {
  const { env, reads } = fixture({ manifest: { hash: 'previoushash' } });
  const result = await worker.fetch(new Request('https://shop.example.test/'), env);
  assert.equal(result.status, 503);
  assert.equal(reads.length, 2);
  const changed = fixture({ manifest: { host: 'another.example.test' } });
  assert.equal((await worker.fetch(new Request('https://shop.example.test/'), changed.env)).status, 503);
  assert.equal(changed.reads.length, 2);
});

test('unlisted and encoded slash paths do not access an R2 file', async () => {
  const { env, reads } = fixture();
  assert.equal((await worker.fetch(new Request('https://shop.example.test/private'), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://shop.example.test/%2fprivate'), env)).status, 400);
  assert.equal(reads.filter(([kind]) => kind === 'get').length, 1);
});

test('serves workspace paths on the shared Workers.dev host with scoped links', async () => {
  const shared = 'tar-sites.tar-54d.workers.dev';
  const { env, reads } = fixture({ shared: true, html: '<a href="/catalog">Catalog</a><img src="/logo.png">' });
  const result = await worker.fetch(new Request(`https://${shared}/slice-house/`), env);
  assert.equal(result.status, 200);
  assert.equal(await result.text(), '<a href="/slice-house/catalog">Catalog</a><img src="/slice-house/logo.png">');
  assert.deepEqual(reads, [['path', 'slice-house', shared], ['get', `${prefix}/manifest.json`], ['get', file.key]]);
  assert.equal(result.headers.get('content-length'), String(Buffer.byteLength('<a href="/slice-house/catalog">Catalog</a><img src="/slice-house/logo.png">')));
});

test('unknown workspace path never reads release storage', async () => {
  const { env, reads } = fixture({ shared: true, row: null });
  const result = await worker.fetch(new Request('https://tar-sites.tar-54d.workers.dev/other/'), env);
  assert.equal(result.status, 404);
  assert.deepEqual(reads, [['path', 'other', 'tar-sites.tar-54d.workers.dev']]);
});

test('rejects malformed shared paths and exposes a shared robots policy', async () => {
  const { env, reads } = fixture({ shared: true });
  assert.equal((await worker.fetch(new Request('https://tar-sites.tar-54d.workers.dev/'), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://tar-sites.tar-54d.workers.dev/slice-house/%2fprivate'), env)).status, 400);
  const robots = await worker.fetch(new Request('https://tar-sites.tar-54d.workers.dev/robots.txt'), env);
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Allow: \/$/m);
  assert.deepEqual(reads, []);
});

test('keeps two workspace releases isolated on the same Worker host', async () => {
  const host = 'tar-sites.tar-54d.workers.dev';
  const rows = new Map(['alpha', 'beta'].map((slug) => [slug, {
    workspace: `work_${slug}`, site: `site_${slug}`, release: `rel_${slug}`, hash: `hash_${slug}`, domain: host,
  }]));
  const objects = new Map();
  for (const [slug, row] of rows) {
    const key = `workspaces/${row.workspace}/sites/${row.site}/releases/${row.release}`;
    objects.set(`${key}/index.html`, slug);
    objects.set(`${key}/manifest.json`, { id: row.release, siteId: row.site, hash: row.hash, files: [
      { path: '/index.html', key: `${key}/index.html`, mime: 'text/html; charset=utf-8', bytes: slug.length },
    ] });
  }
  const env = {
    CONTROL: { withSession: () => ({ prepare: (sql) => ({ bind: (slug, domain) => ({ first: async () => {
      assert.match(sql, /w.slug=\? AND w.state='active' AND s.domain=\?/);
      return domain === host ? rows.get(slug) : null;
    } }) }) }) },
    SITE_RELEASES: { get: async (key) => {
      const value = objects.get(key);
      return typeof value === 'string'
        ? { size: value.length, body: true, text: async () => value }
        : value ? { size: 100, body: true, json: async () => value } : null;
    } },
  };
  assert.equal(await (await worker.fetch(new Request(`https://${host}/alpha/`), env)).text(), 'alpha');
  assert.equal(await (await worker.fetch(new Request(`https://${host}/beta/`), env)).text(), 'beta');
  assert.equal((await worker.fetch(new Request(`https://${host}/alpha/beta/`), env)).status, 404);
  rows.delete('alpha');
  assert.equal((await worker.fetch(new Request(`https://${host}/alpha/`), env)).status, 404);
  assert.equal(await (await worker.fetch(new Request(`https://${host}/beta/`), env)).text(), 'beta');
});

test('forwards a public cart to the harness and never prices it itself', async () => {
  const host = 'tar-sites.tar-54d.workers.dev';
  let sent = null;
  const env = {
    HARNESS_ORIGIN: 'https://harness.test',
    CONTROL: { withSession: () => ({ prepare: (sql) => ({ bind: () => ({ first: async () => {
      assert.match(sql, /w.slug=\? AND w.state='active' AND s.release<>''/);
      return { owner_id: 'owner_1', name: 'Slice House', slug: 'slice-house', database_name: 'slice', database_host: 'slice' };
    } }) }) }) },
    SITE_RELEASES: { get: async () => null },
  };
  globalThis.fetch = async (url, init) => {
    sent = { url: String(url), body: JSON.parse(init.body), key: init.headers['idempotency-key'] };
    return new Response(JSON.stringify({ order: { id: 'order_1', state: 'open', total: 31500, currency: 'INR' } }), { status: 201 });
  };
  const form = new FormData();
  form.append('item', 'v_garlic');
  form.append('quantity', '2');
  form.append('name', 'Divya');
  form.append('phone', '9876543210');
  const result = await worker.fetch(new Request(`https://${host}/slice-house/order`, { method: 'POST', body: form }), env);
  assert.equal(result.status, 200);
  assert.equal(sent.url, 'https://harness.test/v1/sites/slice-house/order');
  // The worker sends ids and counts; the harness owns the price.
  assert.deepEqual(sent.body.lines, [{ variant: 'v_garlic', quantity: 2 }]);
  assert.equal('price' in sent.body.lines[0], false);
});

test('a cart with no orderable lines is refused before any upstream call', async () => {
  const host = 'tar-sites.tar-54d.workers.dev';
  let called = false;
  const env = {
    HARNESS_ORIGIN: 'https://harness.test',
    CONTROL: { withSession: () => ({ prepare: () => ({ bind: () => ({ first: async () => ({ slug: 'slice-house' }) }) }) }) },
    SITE_RELEASES: { get: async () => null },
  };
  globalThis.fetch = async () => { called = true; return new Response('{}'); };
  const form = new FormData();
  form.append('item', 'v_garlic');
  form.append('quantity', '0');
  const result = await worker.fetch(new Request(`https://${host}/slice-house/order`, { method: 'POST', body: form }), env);
  assert.equal(result.status, 400);
  assert.equal(called, false);
});
