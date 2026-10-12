const MAX_MANIFEST = 1024 * 1024;
const MAX_HTML = 2 * 1024 * 1024;
const PERSONA = '/.persona/';

function filePath(pathname) {
  if (/%(?:2f|5c|00|25)/i.test(pathname)) return null;
  let path;
  try { path = decodeURIComponent(pathname); } catch { return null; }
  if (!path.startsWith('/') || /[\\\u0000-\u001f]/.test(path) || path.split('/').some((part) => part === '.' || part === '..')) return null;
  if (path.startsWith(PERSONA)) return null;
  if (path === '/') return '/index.html';
  if (path.endsWith('/')) return `${path}index.html`;
  return /\.[^/]+$/.test(path) ? path : `${path}/index.html`;
}

/** Persona signals, read from the request only: no model, no database, no rewrite. */
function device(userAgent) {
  if (/ipad|tablet|playbook|silk|android(?!.*mobile)/i.test(userAgent)) return 'tablet';
  return /mobile|iphone|ipod|android|windows phone/i.test(userAgent) ? 'mobile' : 'desktop';
}
function channel(url, referer) {
  const word = /^[a-z][a-z0-9-]{0,39}$/;
  const given = (url.searchParams.get('channel') || '').toLowerCase();
  if (word.test(given)) return given;
  const host = ((referer || '').split('/')[2] || '').replace(/^www\./, '').split('.')[0];
  return word.test(host) ? host : '';
}
function returning(request) {
  return /(?:^|;\s*)tar_return=1\b/.test(request.headers.get('cookie') || '');
}
function personaFor(manifest, signals) {
  for (const rule of [...(manifest.personas || [])].sort((left, right) => (right.priority || 0) - (left.priority || 0))) {
    const when = rule.when || {};
    if (when.device && when.device !== signals.device) continue;
    if (when.channel && when.channel !== signals.channel) continue;
    if (when.returning !== undefined && when.returning !== signals.returning) continue;
    return rule.id;
  }
  return null;
}

function mime(path) {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.avif')) return 'image/avif';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.woff')) return 'font/woff';
  if (path.endsWith('.xml')) return 'application/xml; charset=utf-8';
  if (path.endsWith('.txt')) return 'text/plain; charset=utf-8';
  return null;
}

function response(status, body) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

async function securityHeaders(contentType, html) {
  const hashes = [];
  if (html) {
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1])));
      hashes.push(`'sha256-${btoa(String.fromCharCode(...digest))}'`);
    }
  }
  return {
    'content-security-policy': [
      "default-src 'none'", "base-uri 'none'", "object-src 'none'", "form-action 'self'", "frame-ancestors 'none'",
      `script-src 'self'${hashes.length ? ` ${hashes.join(' ')}` : ''}`,
      "style-src 'self' 'unsafe-inline'", "img-src 'self' https: data:", "font-src 'self' data:", "connect-src 'none'",
    ].join('; '),
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  };
}

async function placeOrder(env, harness, slug, body) {
  const lines = [];
  const ids = body.getAll('item');
  const quantities = body.getAll('quantity');
  for (let index = 0; index < ids.length; index += 1) {
    const quantity = Number(quantities[index] || 0);
    if (ids[index] && Number.isInteger(quantity) && quantity > 0) lines.push({ variant: ids[index], quantity });
  }
  if (!lines.length) return orderPage('Add at least one item to order.', 400);
  const upstream = await fetch(`${harness}/v1/sites/${encodeURIComponent(slug)}/order`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ lines, name: body.get('name') || '', phone: body.get('phone') || '', note: body.get('note') || '', extra: body.get('extra') || '' }),
  });
  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return orderPage(result.error || 'The order could not be placed.', upstream.status);
  const total = Number(result.order?.total || 0) / 100;
  return orderPage(`Thank you. Your order is placed${result.order?.id ? ` (${result.order.id})` : ''}. The shop will confirm on WhatsApp.`, 200, total, result.order?.currency);
}

function orderPage(message, status, total, currency) {
  const money = typeof total === 'number' && total > 0 ? `<p class="tar-price">${currency || 'INR'} ${total.toFixed(2)}</p>` : '';
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex"><title>Order</title></head><body style="font-family:system-ui;padding:2rem;max-width:560px;margin:0 auto"><h1>${status === 200 ? 'Order placed' : 'Order'}</h1>${money}<p>${message}</p><p><a href="./">Back to the store</a></p></body></html>`, {
    status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const shared = /^tar-sites\.[a-z0-9-]+\.workers\.dev$/.test(host);
    const orderMatch = /^\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\/order\/?$/.exec(url.pathname);
    const hostOrder = !shared && /^\/order\/?$/.test(url.pathname);
    if (request.method === 'POST' && (orderMatch || hostOrder)) {
      // The public cart posts here; the worker forwards ids and counts to the harness, which
      // prices from catalog truth. The harness URL is a var, never a client-supplied value.
      if (!env.HARNESS_ORIGIN) return response(404, 'Not found');
      try {
        // Path mode carries the slug; a custom host resolves its workspace from D1.
        const slug = orderMatch ? orderMatch[1] : (await env.CONTROL.withSession('first-primary').prepare("SELECT w.slug FROM hosts h JOIN workspaces w ON w.id=h.workspace WHERE h.name=? AND h.status='active' AND w.state='active' LIMIT 1").bind(host).first())?.slug;
        if (!slug) return response(404, 'Site not found');
        return await placeOrder(env, env.HARNESS_ORIGIN, slug, await request.formData());
      } catch (error) {
        console.error(JSON.stringify({ event: 'sites.order.error', message: String(error) }));
        return orderPage('The order could not be placed. Please try again.', 503);
      }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return response(405, 'Method not allowed');
    if (shared && url.pathname === '/robots.txt') return new Response(request.method === 'HEAD' ? null : 'User-agent: *\nAllow: /\n', {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
    const match = shared ? /^\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?=\/|$)/.exec(url.pathname) : null;
    if (shared && !match) return response(404, 'Site not found');
    const slug = match?.[1];
    const path = filePath(shared ? (url.pathname.slice(match[0].length) || '/') : url.pathname);
    if (!path) return response(400, 'Invalid path');
    try {
      // D1 is consulted before any object or cache lookup, including on HEAD.
      const query = shared
        ? "SELECT s.workspace,s.site,s.release,s.hash,s.epoch,s.domain FROM workspaces w JOIN sites s ON s.workspace=w.id WHERE w.slug=? AND w.state='active' AND s.domain=? AND s.mode='path' AND s.status='active' AND s.release<>'' LIMIT 1"
        : "SELECT s.workspace,s.site,s.release,s.hash,s.epoch,s.domain FROM hosts h JOIN sites s ON s.workspace=h.workspace AND s.site=h.site JOIN workspaces w ON w.id=s.workspace WHERE h.name=? AND h.status='active' AND w.state='active' AND s.mode='host' AND s.status='active' AND s.release<>'' LIMIT 1";
      const site = await env.CONTROL.withSession('first-primary').prepare(query).bind(...(shared ? [slug, host] : [host])).first();
      if (!site) return response(404, 'Site not found');
      if (shared && url.pathname === `/${slug}`) {
        url.pathname += '/';
        return new Response(null, { status: 308, headers: { location: url.toString(), 'cache-control': 'no-store' } });
      }
      if (!shared && host !== site.domain) {
        const target = new URL(request.url);
        target.hostname = site.domain;
        return new Response(null, { status: 308, headers: { location: target.toString(), 'cache-control': 'no-store' } });
      }
      const prefix = `workspaces/${site.workspace}/sites/${site.site}/releases/${site.release}`;
      const object = await env.SITE_RELEASES.get(`${prefix}/manifest.json`);
      if (!object || !object.body || object.size > MAX_MANIFEST) return response(503, 'Release unavailable');
      const manifest = await object.json();
      if (manifest.id !== site.release || manifest.siteId !== site.site || manifest.hash !== site.hash
        || (manifest.host && manifest.host !== site.domain) || !Array.isArray(manifest.files)) return response(503, 'Release unavailable');
      const signals = {
        device: device(request.headers.get('user-agent') || ''),
        channel: channel(url, request.headers.get('referer')),
        returning: returning(request),
      };
      const variant = personaFor(manifest, signals);
      const wanted = variant && path.endsWith('/index.html') ? `${PERSONA}${variant}${path}` : '';
      const file = (wanted ? manifest.files.find((entry) => entry.path === wanted) : null)
        || manifest.files.find((entry) => entry.path === path);
      if (!file) return response(404, 'Page not found');
      const contentType = mime(file.path);
      if (!contentType || file.key !== `${prefix}${file.path}` || file.mime !== contentType || !Number.isSafeInteger(file.bytes) || file.bytes < 0) return response(503, 'Release unavailable');
      const isHtml = contentType.startsWith('text/html');
      const asset = request.method === 'HEAD' && !isHtml ? await env.SITE_RELEASES.head(file.key) : await env.SITE_RELEASES.get(file.key);
      if (!asset || asset.size !== file.bytes) return response(503, 'Release unavailable');
      if (isHtml && (asset.size > MAX_HTML || !asset.body)) return response(503, 'Release unavailable');
      let html = isHtml ? await asset.text() : null;
      if (html && shared) html = html.replaceAll('href="/', `href="/${slug}/`).replaceAll('src="/', `src="/${slug}/`);
      const headers = new Headers({
        'content-type': contentType,
        'content-length': String(isHtml ? new TextEncoder().encode(html).byteLength : asset.size),
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'x-frame-options': 'DENY',
        ...await securityHeaders(contentType, html),
      });
      // The second visit is a different reader: one first-party flag, no personal data.
      if (isHtml && !signals.returning && manifest.personas?.length) headers.append('set-cookie', 'tar_return=1; Path=/; Max-Age=15552000; SameSite=Lax');
      return new Response(request.method === 'HEAD' ? null : isHtml ? html : asset.body, { status: 200, headers });
    } catch (error) {
      console.error(JSON.stringify({ event: 'sites.serve.error', message: String(error) }));
      return response(503, 'Site unavailable');
    }
  },
};
