// The site lifecycle, small on purpose (paraiv2): generate a draft from the
// merchant's own facts, compile it to immutable files, publish by repointing,
// roll back by repointing again. The document/blueprint/design engine that used
// to live here is gone.

import type { Client } from '@libsql/client/web';
import { badRequest, conflict, notFound, unavailable } from '../errors.ts';
import { eventStatement } from '../gateway/commit.ts';
import type { AccessContext } from '../types.ts';
import { compileSite, type CompiledFile } from './compile.ts';
import { about as clampAbout, tagline as clampTagline, title as clampTitle, line as clampLine } from './clamp.ts';
import { slugify } from './html.ts';
import { pickSections, pickStyle } from './pick.ts';
import { findStyle } from './styles.ts';
import type { RenderContext, Item } from './sections.ts';
import { isSiteData, type ReleaseFile, type ReleaseManifest, type SiteData } from './types.ts';
import { readAsset } from './asset.ts';

const now = () => Date.now();
const reserved = new Set(['www', 'api', 'app', 'admin', 'mail', 'static', 'assets', 'preview', 'support', 'help', 'status']);
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 240) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const strings = (value: unknown, max = 12): string[] => Array.isArray(value)
  ? value.map((entry) => text(entry, 300)).filter(Boolean).slice(0, max)
  : typeof value === 'string' ? value.split(/[,\n]+/).map((entry) => text(entry, 300)).filter(Boolean).slice(0, max)
  : [];

export interface SiteEnv {
  readonly control?: D1Database;
  readonly domain?: string;
  readonly releases?: R2Bucket;
  readonly content?: R2Bucket;
}

export async function getSiteRecord(client: Client, siteId?: string): Promise<{ id: string; version: number; state: string; data: unknown } | null> {
  const result = await client.execute(siteId
    ? { sql: "SELECT * FROM records WHERE id=? AND type='site' AND archived IS NULL LIMIT 1", args: [siteId] }
    : "SELECT * FROM records WHERE type='site' AND archived IS NULL ORDER BY CASE WHEN state='live' THEN 0 ELSE 1 END,updated DESC,created DESC LIMIT 1");
  const row = result.rows[0];
  return row ? { id: String(row.id), version: Number(row.version), state: String(row.state), data: JSON.parse(String(row.data)) as unknown } : null;
}

/** A site as stored. Anything older than the section model is rebuilt, never migrated. */
export function readSite(data: unknown): SiteData | null {
  if (isSiteData(data)) return data as SiteData;
  return null;
}

/** The draft every new workspace gets: one style, the minimal stack, no model call. */
export function defaultSite(name: string, blurb = ''): SiteData {
  const styleId = pickStyle(blurb);
  return {
    styleId,
    sections: pickSections({ trade: blurb, itemCount: 0, photoCount: 0 }, styleId),
    title: clampTitle(name),
    tagline: clampTagline(blurb),
    about: clampAbout(blurb),
    items: [],
    assets: [],
    revision: 1,
  };
}

/** Public catalog: active variants with a current price in the public channel. */
async function publicVariants(client: Client, channel: string): Promise<string[]> {
  const at = now();
  const result = await client.execute({ sql: `SELECT v.id AS id FROM records v WHERE v.type='variant' AND v.state='active' AND v.archived IS NULL
    AND EXISTS(SELECT 1 FROM records p WHERE p.type='price' AND p.state='active' AND p.archived IS NULL
      AND json_extract(p.data,'$.variant')=v.id AND json_extract(p.data,'$.channel')=?
      AND json_extract(p.data,'$.starts')<=? AND (json_extract(p.data,'$.ends') IS NULL OR json_extract(p.data,'$.ends')>?))
    ORDER BY v.title,v.id LIMIT 40`, args: [channel, at, at] });
  return result.rows.map((row) => String(row.id));
}

async function publicCatalog(client: Client, records: readonly string[], channel: string): Promise<Item[]> {
  if (!records.length) return [];
  const placeholders = records.map(() => '?').join(',');
  const at = now();
  const variants = await client.execute({ sql: `SELECT v.id AS id,v.title AS title,v.data AS variant,p.data AS price FROM records v
    JOIN records p ON p.type='price' AND p.state='active' AND p.archived IS NULL AND json_extract(p.data,'$.variant')=v.id
    WHERE v.type='variant' AND v.state='active' AND v.archived IS NULL AND v.id IN (${placeholders})
    AND p.id=(SELECT current.id FROM records current WHERE current.type='price' AND current.state='active' AND current.archived IS NULL
      AND json_extract(current.data,'$.variant')=v.id AND json_extract(current.data,'$.channel')=?
      AND json_extract(current.data,'$.starts')<=? AND (json_extract(current.data,'$.ends') IS NULL OR json_extract(current.data,'$.ends')>?)
      ORDER BY json_extract(current.data,'$.starts') DESC,current.updated DESC,current.id LIMIT 1)
    ORDER BY v.title,v.id LIMIT 100`, args: [...records, channel, at, at] });
  return variants.rows.map((row) => {
    const variant = object(JSON.parse(String(row.variant)));
    const price = object(JSON.parse(String(row.price)));
    const amount = Number(price.amount);
    const title = String(row.title);
    return {
      id: String(row.id), slug: slugify(title), title,
      description: text(variant.description, 500),
      ...(Number.isSafeInteger(amount) && amount >= 0 && /^[A-Z]{3}$/.test(String(price.currency))
        ? { price: amount, currency: String(price.currency) } : {}),
    };
  });
}

async function resolveItems(client: Client, site: SiteData): Promise<Item[]> {
  const ids = site.items.length ? site.items : await publicVariants(client, 'default');
  return publicCatalog(client, ids, 'default');
}

/** Everything render needs, from stored data only. */
async function renderContext(client: Client, site: SiteData): Promise<RenderContext> {
  const items = await resolveItems(client, site);
  const media = (assetId: string) => {
    const asset = site.assets.find((entry) => entry.id === assetId);
    return asset ? `/assets/${asset.id}` : null;
  };
  return { site, style: findStyle(site.styleId), items, media };
}

/** A preview document for the editor/API: one HTML string with the CSS inline. */
export async function previewSite(client: Client, data: unknown): Promise<string> {
  const site = readSite(data);
  if (!site) return '';
  const compiled = await compileSite(await renderContext(client, site));
  const html = String(compiled.files.find((file) => file.path === '/index.html')?.body || '');
  const css = String(compiled.files.find((file) => file.path === '/style.css')?.body || '');
  return html.replace('</head>', `<style>${css}</style></head>`);
}

function siteOrigin(domain: string | undefined, slug: string): string | undefined {
  if (domain?.startsWith('https://')) {
    try {
      const url = new URL(domain);
      if (/^tar-sites\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname)
        && url.pathname === '/' && !url.search && !url.hash && !url.port && !url.username && !url.password)
        return `${url.origin}/${slug}`;
    } catch { /* Invalid configuration is rejected when publishing. */ }
    return undefined;
  }
  const base = domain?.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  return base && /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/.test(base) && !base.endsWith('.example.com')
    ? `https://${slug}.${base}` : undefined;
}

function siteHost(domain: string | undefined, slug: string): string | undefined {
  const origin = siteOrigin(domain, slug);
  return origin ? new URL(origin).hostname : undefined;
}

interface StepEvent {
  readonly action: string;
  readonly key: string;
  readonly hash: string;
}

async function saveEvent(client: Client, context: AccessContext, record: string, event: StepEvent, result: Record<string, unknown>): Promise<void> {
  await client.execute(eventStatement({ action: event.action, actor: context.identity.id, recordId: record, key: event.key, hash: event.hash, result }));
}

async function saveSite(client: Client, current: { id: string; version: number } | null, doc: SiteData, context: AccessContext, event: StepEvent, result: Record<string, unknown>): Promise<void> {
  const at = now();
  if (!current) {
    await client.batch([
      { sql: "INSERT INTO records (id,type,title,state,data,owner,version,created,updated) VALUES (?,'site',?,'draft',?,?,1,?,?)", args: [`site_${crypto.randomUUID()}`, doc.title, JSON.stringify(doc), context.identity.id, at, at] },
    ], 'write');
    return;
  }
  const saved = await client.batch([
    { sql: 'UPDATE records SET title=?,data=?,version=?,updated=? WHERE id=? AND version=?', args: [doc.title, JSON.stringify(doc), current.version + 1, at, current.id, current.version] },
    { sql: `INSERT INTO move(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, current.id, event.action, context.identity.id, event.hash, event.key, JSON.stringify({ result }), at, at] },
  ], 'write');
  if (saved[0]?.rowsAffected !== 1 || saved[1]?.rowsAffected !== 1) throw conflict('Site changed while saving. Refresh and try again.');
}

/** The draft builder: facts in, one style + one stack out. No model, no crawl. */
function composeSite(input: Record<string, unknown>, previous: SiteData | null, items: readonly string[], assetCount: number): SiteData {
  const trade = (input.industry ?? input.trade ?? input.prompt ?? '') as string;
  const styleId = text(input.style, 40) || previous?.styleId || pickStyle(trade);
  const facts = { trade, itemCount: items.length, photoCount: assetCount };
  const sections = previous && !input.style && !input.sections ? previous.sections : pickSections(facts, styleId);
  const contact = {
    ...(previous?.contact ?? {}),
    ...(text(input.phone) ? { phone: text(input.phone, 40) } : {}),
    ...(text(input.email) ? { email: text(input.email, 120) } : {}),
    ...(text(input.whatsapp) ? { whatsapp: text(input.whatsapp, 40) } : {}),
    ...(text(input.address) ? { address: text(input.address, 160) } : {}),
  };
  return {
    styleId,
    sections,
    title: clampTitle(input.title || previous?.title || ''),
    tagline: clampTagline(input.tagline ?? input.season ?? previous?.tagline ?? ''),
    about: clampAbout(input.about ?? input.prompt ?? previous?.about ?? ''),
    ...(text(input.notice) ? { notice: clampLine(input.notice) } : previous?.notice ? { notice: previous.notice } : {}),
    hours: strings(input.hours, 8).length ? strings(input.hours, 8) : previous?.hours,
    ...(Object.keys(contact).length ? { contact } : {}),
    items,
    assets: previous?.assets ?? [],
    revision: (previous?.revision ?? 0) + 1,
    ...(previous?.policy ? { policy: previous.policy } : {}),
    ...(previous?.releases?.length ? { releases: previous.releases } : {}),
  };
}

export async function executeSiteGenerate(
  client: Client,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  hash: string,
): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined);
  const previous = current ? readSite(current.data) : null;
  const declared = strings(input.records, 40);
  const items = declared.length ? declared : await publicVariants(client, 'default');
  const doc = composeSite(input, previous, items, previous?.assets.length ?? 0);
  if (!current) {
    const at = now();
    const siteId = `site_${crypto.randomUUID()}`;
    const result = { siteId, version: 1, state: 'draft', site: doc };
    await client.batch([
      { sql: "INSERT INTO records (id,type,title,state,data,owner,version,created,updated) VALUES (?,'site',?,'draft',?,?,1,?,?)", args: [siteId, doc.title, JSON.stringify(doc), context.identity.id, at, at] },
      eventStatement({ action: 'site.generate', actor: context.identity.id, recordId: siteId, key, hash, result }),
    ], 'write');
    return result;
  }
  const result = { siteId: current.id, version: current.version + 1, state: current.state, site: doc };
  await saveSite(client, current, doc, context, { action: 'site.generate', key, hash }, result);
  return result;
}

async function saveRelease(client: Client, env: SiteEnv, context: AccessContext, site: { id: string; version: number; data: unknown }, release: string, generation: number, epoch = 0) {
  if (!env.releases) throw unavailable('Site release storage is not configured.');
  const doc = readSite(site.data);
  if (!doc) throw badRequest('Rebuild the site draft first.');
  const origin = siteOrigin(env.domain, context.workspace.slug);
  const contextForRender = await renderContext(client, doc);
  const compiled = await compileSite(contextForRender, origin);
  const prefix = `workspaces/${context.workspace.id}/sites/${site.id}/releases`;
  const files: ReleaseFile[] = compiled.files.map((file: CompiledFile) => ({
    path: file.path, mime: file.mime, bytes: new TextEncoder().encode(file.body).byteLength, hash: file.hash, key: `${prefix}/${release}${file.path}`,
  }));
  for (let index = 0; index < files.length; index += 1) {
    await env.releases.put(files[index].key, compiled.files[index].body, { httpMetadata: { contentType: files[index].mime } });
  }
  for (const asset of doc.assets) {
    const bytes = env.content ? await readAsset(env.content, context, site.id, asset) : null;
    if (!bytes) continue;
    const path = `/assets/${asset.id}`;
    const key = `${prefix}/${release}${path}`;
    await env.releases.put(key, bytes, { httpMetadata: { contentType: asset.mime } });
    files.push({ path, mime: asset.mime, bytes: bytes.byteLength, hash: '', key });
  }
  const manifest = {
    id: release, siteId: site.id, epoch, ...(origin ? { host: siteHost(env.domain, context.workspace.slug) } : {}),
    version: site.version, generation, created: now(), hash: compiled.hash, files,
    checks: { blocking: compiled.report.blocking.length, advisory: compiled.report.advisory.length },
  } satisfies ReleaseManifest;
  await env.releases.put(`${prefix}/${release}/source.json`, JSON.stringify(doc), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  await env.releases.put(`${prefix}/${release}/report.json`, JSON.stringify({ ...compiled.report, created: now() }), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  await env.releases.put(`${prefix}/${release}/manifest.json`, JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  return { manifest, itemCount: compiled.itemCount, report: compiled.report };
}

async function readCandidate(env: SiteEnv, context: AccessContext, site: string, release: string): Promise<{ manifest: ReleaseManifest; source: SiteData }> {
  if (!env.releases) throw unavailable('Site release storage is not configured.');
  if (!/^rel_[a-f0-9-]{36}$/.test(release)) throw badRequest('Choose a compiled site candidate.');
  const prefix = `workspaces/${context.workspace.id}/sites/${site}/releases/${release}`;
  const [manifestObject, sourceObject] = await Promise.all([env.releases.get(`${prefix}/manifest.json`), env.releases.get(`${prefix}/source.json`)]);
  if (!manifestObject || !sourceObject || manifestObject.size > 1_000_000 || sourceObject.size > 1_000_000) throw notFound('Site candidate was not found.');
  const manifest = JSON.parse(await manifestObject.text()) as ReleaseManifest;
  const source = readSite(JSON.parse(await sourceObject.text()));
  if (!source) throw badRequest('Site candidate is invalid.');
  if (manifest.id !== release || manifest.siteId !== site || !Array.isArray(manifest.files) || !manifest.files.length
    || manifest.files.some((file) => !file.path.startsWith('/') || file.key !== `${prefix}${file.path}`)) throw badRequest('Site candidate is invalid.');
  return { manifest, source };
}

/** The D1 pointer is the public serving authority. R2 files are written first. */
async function activatePublication(env: SiteEnv, context: AccessContext, site: string, manifest: ReleaseManifest, expected?: number): Promise<string | null> {
  const control = env.control;
  if (!control) return null;
  const origin = siteOrigin(env.domain, context.workspace.slug);
  if (!origin) throw unavailable('A valid site Worker origin or platform domain is required.');
  if (reserved.has(context.workspace.slug) || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(context.workspace.slug)) throw badRequest('This workspace slug cannot be used as a site address.');
  const host = new URL(origin).hostname;
  const mode = env.domain?.startsWith('https://') ? 'path' : 'host';
  const primary = control.withSession('first-primary');
  const owned = mode === 'host' ? await primary.prepare('SELECT workspace,site FROM hosts WHERE name=?').bind(host).first<{ workspace: string; site: string }>() : null;
  if (owned && (owned.workspace !== context.workspace.id || owned.site !== site)) throw conflict('This site hostname is already assigned.');
  const previous = await primary.prepare('SELECT site,epoch,release,hash,domain,mode,status FROM sites WHERE workspace=?').bind(context.workspace.id)
    .first<{ site: string; epoch: number; release: string; hash: string; domain: string; mode: string; status: string }>();
  if (previous?.release === manifest.id && previous.hash === manifest.hash && previous.domain === host && previous.mode === mode && previous.status === 'active' && previous.site === site) return origin;
  if (expected !== undefined && (previous?.epoch || 0) !== expected) throw conflict('Live publication changed since this candidate was prepared. Compile and review it again.');
  const at = now();
  const statements = [
    previous
      ? control.prepare("UPDATE sites SET site=?,release=?,hash=?,epoch=epoch+1,domain=?,mode=?,status='active',updated=? WHERE workspace=? AND epoch=?")
        .bind(site, manifest.id, manifest.hash, host, mode, at, context.workspace.id, previous.epoch)
      : control.prepare("INSERT INTO sites(workspace,site,release,hash,epoch,domain,mode,status,updated) VALUES(?,?,?,?,1,?,?,'active',?)")
        .bind(context.workspace.id, site, manifest.id, manifest.hash, host, mode, at),
  ];
  if (mode === 'host') statements.push(owned
    ? control.prepare("UPDATE hosts SET status='active',updated=? WHERE name=? AND workspace=? AND site=?").bind(at, host, context.workspace.id, site)
    : control.prepare("INSERT INTO hosts(name,workspace,site,status,updated) VALUES(?,?,?,'active',?)").bind(host, context.workspace.id, site, at));
  if (previous?.mode === 'host' && (mode === 'path' || previous.domain !== host)) statements.push(
    control.prepare("UPDATE hosts SET status='pending',updated=? WHERE name=? AND workspace=? AND site=? AND status='active'")
      .bind(at, previous.domain, context.workspace.id, site));
  const results = await control.batch(statements);
  if (results.some((result) => result.meta.changes !== 1)) throw conflict('Site publication changed concurrently. Refresh and try again.');
  return origin;
}

async function previewToken(env: SiteEnv, context: AccessContext, site: string, release: string): Promise<string | null> {
  if (!env.control) return null;
  const token = crypto.randomUUID();
  await env.control.prepare('INSERT INTO previews(token,workspace,site,release,expires) VALUES(?,?,?,?,?)')
    .bind(token, context.workspace.id, site, release, now() + 30 * 60_000).run();
  return `/v1/site-previews/${token}/`;
}

async function runCompile(client: Client, context: AccessContext, input: Record<string, unknown>, event: StepEvent, env: SiteEnv): Promise<Record<string, unknown>> {
  if (!env.releases) throw unavailable('Site release storage is not configured.');
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined); if (!current) throw notFound('Site was not found.');
  const authority = env.control ? await env.control.withSession('first-primary').prepare('SELECT site,epoch FROM sites WHERE workspace=?')
    .bind(context.workspace.id).first<{ site: string; epoch: number }>() : null;
  const releaseId = `rel_${crypto.randomUUID()}`;
  const doc = readSite(current.data);
  const { manifest, report } = await saveRelease(client, env, context, current, releaseId, (doc?.releases?.length || 0) + 1, authority?.epoch || 0);
  if (report.blocking.length) {
    return { releaseId, hash: manifest.hash, blocking: report.blocking, published: false };
  }
  const previewUrl = await previewToken(env, context, current.id, releaseId);
  const result = { releaseId, hash: manifest.hash, version: current.version, ...(previewUrl ? { previewUrl } : {}) };
  await saveEvent(client, context, current.id, event, result);
  return result;
}

export async function executeSiteCompile(client: Client, bucket: R2Bucket | undefined, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, control?: D1Database, domain?: string, content?: R2Bucket): Promise<Record<string, unknown>> {
  return runCompile(client, context, input, { action: 'site.compile', key, hash: inputHash }, { releases: bucket, control, domain, content });
}

async function publishRelease(client: Client, env: SiteEnv, context: AccessContext, input: Record<string, unknown>, event: StepEvent): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined); if (!current) throw notFound('Site was not found.');
  const releaseId = text(input.releaseId, 80);
  const { manifest, source } = await readCandidate(env, context, current.id, releaseId);
  // Facts are re-derived before a release goes live: restoring an old page whose
  // products have since been archived would publish stale content.
  const recheck = await compileSite(await renderContext(client, source), siteOrigin(env.domain, context.workspace.slug));
  if (recheck.hash !== manifest.hash) throw conflict('Public facts changed since this release. Compile and review a new candidate instead of restoring stale content.');
  const expected = input.epoch === undefined ? undefined : Number(input.epoch);
  const origin = await activatePublication(env, context, current.id, manifest, Number.isSafeInteger(expected) ? expected : undefined);
  const next: SiteData = { ...source, releases: [...(source.releases ?? []).filter((item) => item.id !== manifest.id), { id: manifest.id, hash: manifest.hash, created: now() }].slice(-10) };
  const at = now();
  const saved = await client.batch([
    { sql: "UPDATE records SET state='live',data=?,version=?,updated=? WHERE id=? AND version=?", args: [JSON.stringify(next), current.version + 1, at, current.id, current.version] },
    { sql: `INSERT INTO move(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, current.id, event.action, context.identity.id, event.hash, event.key, JSON.stringify({ releaseId }), at, at] },
  ], 'write');
  if (saved[0]?.rowsAffected !== 1 || saved[1]?.rowsAffected !== 1) throw conflict('Site changed while publishing. Refresh and try again.');
  const liveUrl = origin && input.subdomain ? origin : origin;
  return { siteId: current.id, published: true, releaseId: manifest.id, liveUrl: liveUrl ?? '', hash: manifest.hash };
}

export async function executeSitePublish(client: Client, bucket: R2Bucket | undefined, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, control?: D1Database, domain?: string, content?: R2Bucket): Promise<Record<string, unknown>> {
  return publishRelease(client, { releases: bucket, control, domain, content }, context, input, { action: 'site.publish', key, hash: inputHash });
}

export async function executeSiteRollback(client: Client, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, control?: D1Database, domain?: string, bucket?: R2Bucket, content?: R2Bucket): Promise<Record<string, unknown>> {
  const { siteId, releaseId } = { siteId: text(input.siteId, 160), releaseId: text(input.releaseId, 80) };
  if (!siteId || !releaseId) throw badRequest('Choose the site and the release to restore.');
  const result = await publishRelease(client, { releases: bucket, control, domain, content }, context, { siteId, releaseId }, { action: 'site.rollback', key, hash: inputHash });
  return { ...result, rolledBack: true };
}

export async function executeSitePublishLatest(client: Client, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, env: SiteEnv): Promise<Record<string, unknown>> {
  const generated = await executeSiteGenerate(client, context, input, `${key}:draft`, inputHash) as Record<string, unknown>;
  const compiled = await runCompile(client, context, { siteId: generated.siteId }, { action: 'site.compile', key: `${key}:compile`, hash: inputHash }, env);
  if (compiled.blocking) return { siteId: generated.siteId, published: false, state: 'draft', blocking: compiled.blocking };
  const published = await publishRelease(client, env, context, { siteId: generated.siteId, releaseId: compiled.releaseId }, { action: 'site.publishLatest', key, hash: inputHash });
  return { ...published, state: 'live', publicUrl: published.liveUrl };
}

export async function executeSiteRefresh(client: Client, bucket: R2Bucket | undefined, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, control?: D1Database, domain?: string, content?: R2Bucket): Promise<Record<string, unknown>> {
  const env: SiteEnv = { releases: bucket, control, domain, content };
  const generated = await executeSiteGenerate(client, context, { ...input }, `${key}:draft`, inputHash) as Record<string, unknown>;
  const compiled = await runCompile(client, context, { siteId: generated.siteId }, { action: 'site.refresh', key: `${key}:compile`, hash: inputHash }, env);
  if (compiled.blocking) return { siteId: generated.siteId, refreshed: false, blocking: compiled.blocking };
  const live = control ? await control.withSession('first-primary').prepare("SELECT status FROM sites WHERE workspace=? AND site=?").bind(context.workspace.id, generated.siteId).first<{ status: string }>() : null;
  if (live?.status !== 'active') return { siteId: generated.siteId, refreshed: true, itemCount: (await resolveItems(client, generated.site as SiteData)).length };
  await publishRelease(client, env, context, { siteId: generated.siteId, releaseId: compiled.releaseId }, { action: 'site.refresh.publish', key, hash: inputHash });
  return { siteId: generated.siteId, refreshed: true, itemCount: (await resolveItems(client, generated.site as SiteData)).length };
}

/** Cron: keep a live site's public facts current, at most once per interval. */
export async function siteRegenerate(client: Client, context: AccessContext, env: SiteEnv, siteId?: string): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, siteId);
  if (!current) return { rebuilt: false, missing: ['site'] };
  const doc = readSite(current.data);
  if (!doc) return { rebuilt: false, missing: ['site'] };
  const generated = await executeSiteGenerate(client, context, { siteId: current.id }, `regen:${current.id}:${now()}`, `regen:${current.id}`) as Record<string, unknown>;
  const compiled = await runCompile(client, context, { siteId: current.id }, { action: 'site.refresh', key: `regen:${current.id}:c`, hash: `regen:${current.id}` }, env);
  if (compiled.blocking) return { rebuilt: false, held: 'gate', missing: compiled.blocking };
  await publishRelease(client, env, context, { siteId: current.id, releaseId: compiled.releaseId }, { action: 'site.refresh.publish', key: `regen:${current.id}:p`, hash: `regen:${current.id}` });
  return { rebuilt: generated.siteId === current.id, itemCount: 0 };
}

export async function executeSiteUnpublish(client: Client, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, control?: D1Database): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined); if (!current) throw notFound('Site was not found.');
  if (control) {
    const primary = control.withSession('first-primary');
    const row = await primary.prepare('SELECT domain,mode FROM sites WHERE workspace=?').bind(context.workspace.id).first<{ domain: string; mode: string }>();
    if (row) {
      await control.batch([
        control.prepare('DELETE FROM sites WHERE workspace=?').bind(context.workspace.id),
        control.prepare("UPDATE hosts SET status='pending',updated=? WHERE workspace=? AND site=?").bind(now(), context.workspace.id, current.id),
      ]);
    }
  }
  await saveEvent(client, context, current.id, { action: 'site.unpublish', key, hash: inputHash }, { siteId: current.id, unpublished: true });
  return { siteId: current.id, unpublished: true };
}

export async function executeSiteAssets(client: Client, context: AccessContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined); if (!current) throw notFound('Site was not found.');
  const doc = readSite(current.data);
  return { siteId: current.id, revision: doc?.revision ?? 0, assets: doc?.assets ?? [] };
}

