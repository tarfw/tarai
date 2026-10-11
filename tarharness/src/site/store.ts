import type { Client, InStatement } from '@libsql/client/web';
import { badRequest, conflict, notFound, unavailable } from '../errors.ts';
import { eventStatement } from '../gateway/commit.ts';
import type { AccessContext } from '../types.ts';
import { compileDocument, type CompiledFile } from './compile.ts';
import { validateDocument } from './validate.ts';
import { readDocument } from './adapt.ts';
import { inspectDocument } from './inspect.ts';
import { assetReader } from './asset.ts';
import { applyPexels } from './pexels.ts';
import { CATEGORY_IDS } from './design.ts';
import { type Blueprint, type BusinessKind, type DensityToken, type HeaderStyle, type HeroPattern, type LeadSection, type ToneToken, type TypographyToken, compileSectionOrder, catalogLayoutFor, checkPublishGate, hashState } from './blueprint.ts';
import { BudgetExceeded, DEFAULT_BUDGET, GROQ_DEFAULT_MODEL, ModelRunner, SITE_MODEL_FALLBACKS, readClaims, writeCopy } from './model.ts';
import { buildSite, briefBias, type Facts, type Slot } from './build.ts';
import { defaultBlueprint } from './blueprint.ts';
import { slugify } from './html.ts';
import { checkClaims, fanOut, flagDrift } from './judgment.ts';
import { DOCUMENT_VERSION, type Asset, type Node, type Page, type PersonaRule, type ReleaseFile, type ReleaseManifest, type Section, type SiteDocument } from './document.ts';

const now = () => Date.now();
const reserved = new Set(['www', 'api', 'app', 'admin', 'mail', 'static', 'assets', 'preview', 'support', 'help', 'status']);
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 240) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const strings = (value: unknown, max = 12): string[] => Array.isArray(value) ? value.map((entry) => text(entry, 300)).filter(Boolean).slice(0, max) : [];

export async function getSiteRecord(client: Client, siteId?: string): Promise<{ id: string; version: number; state: string; data: unknown } | null> {
  const result = await client.execute(siteId
    ? { sql: "SELECT * FROM records WHERE id=? AND type='site' AND archived IS NULL LIMIT 1", args: [siteId] }
    : "SELECT * FROM records WHERE type='site' AND archived IS NULL ORDER BY CASE WHEN state='live' THEN 0 ELSE 1 END,updated DESC,created DESC LIMIT 1");
  const row = result.rows[0];
  return row ? { id: String(row.id), version: Number(row.version), state: String(row.state), data: JSON.parse(String(row.data)) as unknown } : null;
}

async function publicCatalog(client: Client, records: readonly string[], channel: string): Promise<Record<string, unknown>[]> {
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
  const items = variants.rows.map((row) => {
    const variant = object(JSON.parse(String(row.variant)));
    const price = object(JSON.parse(String(row.price)));
    const amount = Number(price.amount);
    const title = String(row.title);
    return {
      id: String(row.id), slug: slugify(title),
      title, description: text(variant.description, 500),
      ...(Number.isSafeInteger(amount) && amount >= 0 && /^[A-Z]{3}$/.test(String(price.currency))
        ? { price: amount, currency: String(price.currency) } : {}),
    };
  });
  const settings = await client.execute("SELECT data FROM records WHERE type='pos.settings' AND archived IS NULL LIMIT 1");
  const currency = settings.rows[0] ? text(object(JSON.parse(String(settings.rows[0].data))).currency, 3) : '';
  const products = await client.execute({ sql: `SELECT id,title,data FROM records WHERE type='pos.product' AND state='active' AND archived IS NULL AND id IN (${placeholders}) ORDER BY title,id LIMIT 100`, args: [...records] });
  return [...items, ...products.rows.map((row) => {
    const product = object(JSON.parse(String(row.data)));
    const amount = Number(product.price);
    const title = String(row.title);
    const image = text(product.imageUrl, 500);
    return {
      id: String(row.id), slug: slugify(title),
      title, description: text(product.shortDescription || product.contentSummary, 500),
      ...(image.startsWith('https://') ? { image } : {}),
      ...(Number.isSafeInteger(amount) && amount >= 0 && /^[A-Z]{3}$/.test(currency)
        ? { price: amount, currency } : {}),
    };
  })];
}

/**
 * Owner-published catalog: commerce variants that carry a current active price in
 * the public channel. A channel price is the owner's explicit publish signal, so
 * auto-binding these still honours the invariant that a merely-existing record
 * (a bare pos.product with no channel price) never reaches a public draft.
 */
async function publicVariants(client: Client, channel: string): Promise<string[]> {
  const at = now();
  const result = await client.execute({ sql: `SELECT v.id AS id FROM records v WHERE v.type='variant' AND v.state='active' AND v.archived IS NULL
    AND EXISTS(SELECT 1 FROM records p WHERE p.type='price' AND p.state='active' AND p.archived IS NULL
      AND json_extract(p.data,'$.variant')=v.id AND json_extract(p.data,'$.channel')=?
      AND json_extract(p.data,'$.starts')<=? AND (json_extract(p.data,'$.ends') IS NULL OR json_extract(p.data,'$.ends')>?))
    ORDER BY v.title,v.id LIMIT 40`, args: [channel, at, at] });
  return result.rows.map((row) => String(row.id));
}

/** Public projection for declared non-catalog collections (services, articles, projects). */
async function publicRecords(client: Client, records: readonly string[], type: string): Promise<Record<string, unknown>[]> {
  if (!records.length) return [];
  const placeholders = records.map(() => '?').join(',');
  const result = await client.execute({
    sql: `SELECT id,title,data FROM records WHERE type=? AND state='active' AND archived IS NULL AND id IN (${placeholders}) ORDER BY title,id LIMIT 100`,
    args: [type, ...records],
  });
  return result.rows.map((row) => {
    const data = object(JSON.parse(String(row.data)));
    const title = String(row.title);
    const amount = Number(data.price);
    const currency = text(data.currency, 3);
    const image = text(data.imageUrl, 500);
    return {
      id: String(row.id), slug: slugify(title), title,
      description: text(data.shortDescription || data.summary || data.description, 500),
      ...(image.startsWith('https://') ? { image } : {}),
      ...(Number.isSafeInteger(amount) && amount >= 0 && /^[A-Z]{3}$/.test(currency) ? { price: amount, currency } : {}),
    };
  });
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

async function resolveDocumentBindings(client: Client, doc: SiteDocument): Promise<{ doc: SiteDocument; itemCount: number }> {
  if (!doc.pages.some((page) => page.sections.some((section) => section.bindings?.length))) return { doc, itemCount: 0 };
  const pages: Page[] = [];
  let itemCount = 0;
  for (const page of doc.pages) {
    const sections: Section[] = [];
    for (const section of page.sections) {
      const binding = section.bindings?.[0];
      if (!binding) { sections.push(section); continue; }
      const records = (binding.params?.records || []) as string[];
      const items = binding.query === 'records.public'
        ? await publicRecords(client, records, String(binding.params?.type || 'pos.product'))
        : await publicCatalog(client, records, String(binding.params?.channel || 'default'));
      const limited = binding.limit ? items.slice(0, binding.limit) : items;
      const used = new Set<string>();
      const resolved = limited.map((item, index) => {
        const base = String(item.slug || slugify(String(item.title || 'item')));
        const unique = used.has(base) ? `${base}-${index + 1}` : base;
        used.add(unique);
        return { ...item, slug: unique };
      });
      itemCount += resolved.length;
      sections.push({ ...section, nodes: section.nodes.map((node) => node.kind === 'collection' && (node.id === binding.slot || (node.props || {}).slot === binding.slot)
        ? { ...node, props: { ...node.props, items: resolved } } : node) });
    }
    pages.push({ ...page, sections });
  }
  return { doc: { ...doc, pages }, itemCount };
}

/** Compile any stored source through the one document compiler. */
async function compileAll(client: Client, source: unknown, origin?: string, media?: (asset: Asset) => Promise<Uint8Array | null>): Promise<{ files: CompiledFile[]; hash: string; itemCount: number; redirects: { from: string; to: string; status: 308 }[]; personas: PersonaRule[] }> {
  const doc = readDocument(source).doc;
  validateDocument(doc);
  const resolved = await resolveDocumentBindings(client, doc);
  const compiled = await compileDocument(resolved.doc, { origin, media });
  return { files: compiled.files, hash: compiled.hash, itemCount: resolved.itemCount, redirects: compiled.redirects, personas: compiled.personas };
}

function manifestFile(prefix: string, release: string, file: CompiledFile): ReleaseFile {
  const bytes = typeof file.body === 'string' ? new TextEncoder().encode(file.body).byteLength : file.body.byteLength;
  return { path: file.path, mime: file.mime, bytes, hash: file.hash, key: `${prefix}/${release}${file.path}` };
}

/** Store the compiled document with its release so refresh never sees later edits. */
async function saveRelease(client: Client, bucket: R2Bucket, content: R2Bucket | undefined, context: AccessContext, site: { id: string; version: number; data: unknown }, release: string, generation: number, domain?: string, epoch = 0) {
  const origin = siteOrigin(domain, context.workspace.slug);
  const document = readDocument(site.data).doc;
  const compiled = await compileAll(client, site.data, origin, assetReader(content, context, site.id)); const prefix = `workspaces/${context.workspace.id}/sites/${site.id}/releases`;
  const files = compiled.files.map((file) => manifestFile(prefix, release, file));
  for (let index = 0; index < files.length; index += 1) await bucket.put(files[index].key, compiled.files[index].body as string | Uint8Array, { httpMetadata: { contentType: files[index].mime } });
  const inspection = inspectDocument(document, { compiled, origin, secrets: [context.workspace.id, site.id] });
  const manifest = {
    id: release, siteId: site.id, epoch, ...(origin ? { host: siteHost(domain, context.workspace.slug) } : {}),
    version: site.version, generation, created: now(), hash: compiled.hash, files,
    compiler: DOCUMENT_VERSION, redirects: compiled.redirects, ...(compiled.personas.length ? { personas: compiled.personas } : {}),
    checks: { blocking: inspection.blocking.length, advisory: inspection.advisory.length },
  } satisfies ReleaseManifest;
  await bucket.put(`${prefix}/${release}/source.json`, JSON.stringify({ ...document, currentRelease: null, releases: [] }), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  // The check report lives beside the release but outside manifest.files, so it is never served.
  await bucket.put(`${prefix}/${release}/report.json`, JSON.stringify({ inspection, created: now() }), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  await bucket.put(`${prefix}/${release}/manifest.json`, JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  return { manifest, itemCount: compiled.itemCount, inspection };
}

async function readCandidate(bucket: R2Bucket, context: AccessContext, site: string, release: string): Promise<{ manifest: ReleaseManifest; source: unknown }> {
  if (!/^rel_[a-f0-9-]{36}$/.test(release)) throw badRequest('Choose a compiled site candidate.');
  const prefix = `workspaces/${context.workspace.id}/sites/${site}/releases/${release}`;
  const [manifestObject, sourceObject] = await Promise.all([bucket.get(`${prefix}/manifest.json`), bucket.get(`${prefix}/source.json`)]);
  if (!manifestObject || !sourceObject || manifestObject.size > 1_000_000 || sourceObject.size > 1_000_000) throw notFound('Site candidate was not found.');
  const manifest = JSON.parse(await manifestObject.text()) as ReleaseManifest;
  const source = JSON.parse(await sourceObject.text()) as unknown;
  validateDocument(readDocument(source).doc);
  if (manifest.id !== release || manifest.siteId !== site || !Array.isArray(manifest.files) || !manifest.files.length
    || manifest.files.some((file) => !file.path.startsWith('/') || file.key !== `${prefix}${file.path}`)) throw badRequest('Site candidate is invalid.');
  return { manifest, source };
}

/** The D1 pointer is the public serving authority. R2 files and manifest are written first. */
async function activatePublication(control: D1Database | undefined, domain: string | undefined, context: AccessContext, site: string, manifest: ReleaseManifest, expected?: number): Promise<string | null> {
  if (!control) return null;
  const origin = siteOrigin(domain, context.workspace.slug);
  if (!origin) throw unavailable('A valid site Worker origin or platform domain is required.');
  if (reserved.has(context.workspace.slug) || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(context.workspace.slug)) throw badRequest('This workspace slug cannot be used as a site address.');
  const host = new URL(origin).hostname;
  const mode = domain?.startsWith('https://') ? 'path' : 'host';
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

async function saveEvent(client: Client, context: AccessContext, action: string, record: string, key: string, inputHash: string, result: Record<string, unknown>) {
  await client.execute(eventStatement({ action, actor: context.identity.id, recordId: record, key, hash: inputHash, result }));
}

/**
 * Create: one fan-out. Jev answers every independent question about the brief in
 * a single batched call, the builder composes a valid document from approved
 * facts, one prose pass rewrites the copy slots, and claims are checked in one
 * batched call. With no model key the deterministic defaults still produce a
 * valid site.
 */
export async function executeSiteGenerate(
  client: Client,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  inputHash: string,
  typesafe?: string,
  ai?: Ai,
  control?: D1Database,
  model?: string,
  groqApiKey?: string,
  content?: R2Bucket,
  pexelsApiKey?: string,
): Promise<Record<string, unknown>> {
  const title = text(input.title) || context.workspace.name || 'Workspace';
  const prompt = text(input.prompt ?? input.description, 2000);
  if (input.reset === true) {
    await client.execute("DELETE FROM records WHERE type='site'");
  }
  const existing = input.reset === true ? null : await getSiteRecord(client);
  const previous = existing ? readDocument(existing.data).doc : null;
  const brief = { goal: prompt || `${title} online`, audience: text(input.audience, 200), tone: text(input.tone, 120) };
  const gathered = await publicFacts(client, input, previous, context);
  const cache = { control, workspace: context.workspace.id, version: 'create-2' };
  const inputBriefProvided = Array.isArray(input.brief);
  const inputBrief = inputBriefProvided ? strings(input.brief, 20) : [];
  let bullets = inputBriefProvided ? inputBrief : ((previous?.brief?.bullets || previous?.brief?.accepted || []) as string[]);
  let trade = text(input.trade);

  // Day 0 Inheritance: Only inherit on initial site creation if neither site nor caller provided a brief
  if (!previous && !inputBriefProvided) {
    const briefRow = await client.execute("SELECT data FROM records WHERE id='brief' AND type='brief' AND archived IS NULL LIMIT 1");
    if (briefRow.rows[0]) {
      try {
        const workspaceBriefData = object(JSON.parse(String(briefRow.rows[0].data)));
        if (!bullets.length && Array.isArray(workspaceBriefData.brief) && workspaceBriefData.brief.length) {
          bullets = workspaceBriefData.brief.map(String).filter(Boolean).slice(0, 20);
        }
        if (!trade && typeof workspaceBriefData.trade === 'string' && workspaceBriefData.trade.trim()) {
          trade = workspaceBriefData.trade.trim();
        }
      } catch { /* ignore damaged record */ }
    }
  }
  const avoided = [...briefBias(previous?.brief)];

  const judged = await fanOut(typesafe, cache, {
    trade: trade || brief.audience,
    facts: {
      ...gathered.judged,
      items: gathered.facts.items?.length ?? 0,
      proofs: gathered.facts.proofs || [],
      season: gathered.facts.season || '',
    },
    brief: { ...brief, bullets },
    assets: gathered.assets,
    avoid: avoided,
  });

  const kind = (input.kind as BusinessKind) || judged.kind || 'goods';
  const defaults = defaultBlueprint(kind);
  const style = (input.style as string) || (input.tone ? undefined : (judged.style || previous?.blueprint?.style || defaults.style || 'dark-luxury'));
  const typography = (input.typography as TypographyToken) || judged.typography || defaults.typography;
  const tone = (input.tone as ToneToken) || judged.tone || defaults.tone;
  const density = (typeof input.density === 'number' ? input.density as DensityToken : undefined) || judged.density || defaults.density;
  const lead = (input.lead as LeadSection) || judged.lead || defaults.lead;

  const gate = checkPublishGate(gathered.facts);
  const catalogLayout = catalogLayoutFor(gathered.facts.items?.length ?? 0);
  const sections = compileSectionOrder(kind, lead, {
    notice: Boolean(input.notice || gathered.facts.notice),
    spotlight: judged.spotlight,
    catalog: (gathered.facts.items?.length ?? 0) > 0,
    story: judged.story,
    trust: judged.trust && (gathered.facts.proofs?.length ?? 0) > 0,
  });

  const heroPattern = (input.heroPattern as HeroPattern) || (previous?.blueprint?.heroPattern as HeroPattern) || judged.heroPattern || defaults.heroPattern || 'split';
  const blueprintPre: Omit<Blueprint, 'hash'> = {
    kind,
    style,
    typography,
    tone,
    density,
    lead,
    headerStyle: (input.headerStyle as HeaderStyle) || (previous?.blueprint?.headerStyle as HeaderStyle) || (heroPattern === 'centered_atmospheric' ? 'floating_pill' : heroPattern === 'split' ? 'split' : 'fullbleed'),
    heroPattern,
    catalogLayout,
    sections,
    gate,
    revision: previous ? (previous.revision || 1) + 1 : 1,
  };
  const hash = await hashState(bullets, gathered.facts);
  const blueprint: Blueprint = {
    ...blueprintPre,
    hash,
  };

  const locale = text(input.locale, 8) || previous?.locale || 'en';
  const built = buildSite({
    title,
    brief,
    facts: {
      ...gathered.facts,
      notice: typeof input.notice === 'string' ? input.notice : gathered.facts.notice,
    },
    blueprint,
    assets: gathered.assetsRegistered,
    locale,
    previous,
  });
  const site = built.doc;
  site.brief = {
    ...site.brief,
    bullets,
    accepted: bullets,
    rejected: previous?.brief?.rejected || [],
  };

  const prose = await writeDraft(ai, model, groqApiKey, site, built.slots, gathered.judged);
  let note = prose.note;
  if (prose.claims.length) {
    const checked = await checkClaims(typesafe, cache, prose.claims);
    site.claims = checked.map((claim) => ({ text: claim.text, verdict: claim.verdict }));
  }
  if (note && !site.claims?.length) site.claims = [];
  validateDocument(site);
  const siteId = existing?.id || `site_${crypto.randomUUID()}`;
  const at = now();
  const compiled = await compileDocument(site);
  const rawHtml = String(compiled.files.find((file) => file.path === '/index.html')?.body || '');
  const css = String(compiled.files.find((file) => file.path === '/style.css')?.body || '');
  const preview = { html: rawHtml.replace('</head>', `<style>${css}</style></head>`), css, hash: compiled.hash };
  const version = existing ? existing.version + 1 : 1;
  const state = existing?.state === 'live' ? 'live' : 'draft';
  const result = { siteId, version, state, site, preview, composed: Boolean(prose.wrote), blueprint, gate: built.gate, ...(note ? { note } : {}) };

  // Placeholder photography lands as a follow-up revision so creation stays fast.
  const withPlaceholders = async (): Promise<Record<string, unknown>> => {
    if (!content || !pexelsApiKey || input.photos === false) return result;
    if (site.assets.some((asset) => asset.rights.source.startsWith('pexels'))) return result;
    try {
      const applied = await applyPexels(content, client, context, siteId, pexelsApiKey, site);
      if (!applied) return result;
      return { ...result, version: applied.version, site: applied.site, assets: applied.assets, placeholders: true };
    } catch {
      return result;
    }
  };

  if (existing) {
    const saved = await client.batch([
      { sql: 'UPDATE records SET title=?,data=?,version=?,updated=? WHERE id=? AND version=?', args: [title, JSON.stringify(site), version, at, siteId, existing.version] },
      { sql: `INSERT INTO events(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
        SELECT ?, 'action', ?, 'site.generate', 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, siteId, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] },
    ], 'write');
    if (saved[0].rowsAffected !== 1 || saved[1].rowsAffected !== 1) throw conflict('Site was modified concurrently. Refresh and try again.');
    return withPlaceholders();
  }
  const created = await client.batch([
    { sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) SELECT ?,'site',?,'draft',?,?,1,?,? WHERE NOT EXISTS(SELECT 1 FROM records WHERE type='site' AND archived IS NULL)", args: [siteId, title, JSON.stringify(site), context.identity.id, at, at] },
    { sql: `INSERT INTO events(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, 'site.generate', 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, siteId, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] },
  ], 'write');
  if (created[0].rowsAffected !== 1 || created[1].rowsAffected !== 1) throw conflict('A site was created concurrently. Refresh and edit that site.');
  return withPlaceholders();
}

export async function executeSiteBriefAdd(
  client: Client,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  inputHash: string,
  typesafe?: string,
  control?: D1Database,
): Promise<Record<string, unknown>> {
  const bullet = text(input.bullet, 200);
  if (!bullet) throw badRequest('Provide a brief bullet.');
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined);
  if (!current) throw notFound('Site was not found.');
  const doc = readDocument(current.data).doc;
  const currentBrief = ((doc.brief?.bullets || doc.brief?.accepted || []) as string[]);
  const nextBrief = [...currentBrief.filter((b: string) => b !== bullet), bullet];
  return executeSiteGenerate(client, context, { siteId: current.id, title: doc.pages[0]?.title, brief: nextBrief }, key, inputHash, typesafe, undefined, control);
}

export async function executeSiteBriefRemove(
  client: Client,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  inputHash: string,
  typesafe?: string,
  control?: D1Database,
): Promise<Record<string, unknown>> {
  const bullet = text(input.bullet, 200);
  const clearAll = input.clearAll === true || bullet === '__ALL__';
  if (!bullet && !clearAll) throw badRequest('Provide a brief bullet to remove.');
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined);
  if (!current) throw notFound('Site was not found.');
  const doc = readDocument(current.data).doc;
  const currentBrief = ((doc.brief?.bullets || doc.brief?.accepted || []) as string[]);
  const nextBrief = clearAll ? [] : currentBrief.filter((b: string) => b !== bullet);

  // Keep workspace brief record in sync so old seed bullets never resurrect
  if (clearAll) {
    try {
      await client.execute("UPDATE records SET data=json_set(data, '$.brief', json('[]')) WHERE id='brief' AND type='brief'");
    } catch { /* ignore */ }
  } else if (bullet) {
    try {
      const briefRow = await client.execute("SELECT data FROM records WHERE id='brief' AND type='brief' AND archived IS NULL LIMIT 1");
      if (briefRow.rows[0]) {
        const workspaceBriefData = object(JSON.parse(String(briefRow.rows[0].data)));
        if (Array.isArray(workspaceBriefData.brief)) {
          const filtered = workspaceBriefData.brief.filter((b: unknown) => String(b) !== bullet);
          await client.execute({
            sql: "UPDATE records SET data=json_set(data, '$.brief', json(?)) WHERE id='brief' AND type='brief'",
            args: [JSON.stringify(filtered)],
          });
        }
      }
    } catch { /* ignore */ }
  }

  return executeSiteGenerate(client, context, { siteId: current.id, title: doc.pages[0]?.title, brief: nextBrief }, key, inputHash, typesafe, undefined, control);
}

export async function executeSiteNoticeSet(
  client: Client,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  inputHash: string,
): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined);
  if (!current) throw notFound('Site was not found.');
  const notice = typeof input.notice === 'string' ? text(input.notice, 300) : '';
  const doc = readDocument(current.data).doc;
  const home = doc.pages.find((p) => p.id === 'home' || p.path === '/');
  if (home) {
    home.sections = home.sections.filter((s) => s.purpose !== 'notice');
    if (notice) {
      home.sections.unshift({
        id: 'notice',
        purpose: 'notice',
        layout: { kind: 'stack' },
        style: { base: { pad: 'sm', background: 'token:color.surface' } },
        nodes: [{ id: 'notice-text', kind: 'text', props: { text: notice } }],
      });
    }
  }
  doc.revision += 1;
  validateDocument(doc);
  const version = current.version + 1;
  const at = now();
  const compiled = await compileDocument(doc);
  const rawHtml = String(compiled.files.find((file) => file.path === '/index.html')?.body || '');
  const css = String(compiled.files.find((file) => file.path === '/style.css')?.body || '');
  const preview = { html: rawHtml.replace('</head>', `<style>${css}</style></head>`), css, hash: compiled.hash };
  const result = { siteId: current.id, version, state: current.state, site: doc, preview, notice };
  const saved = await client.batch([
    { sql: 'UPDATE records SET data=?,version=?,updated=? WHERE id=? AND version=?', args: [JSON.stringify(doc), version, at, current.id, current.version] },
    { sql: `INSERT INTO events(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, 'site.notice.set', 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, current.id, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] },
  ], 'write');
  if (saved[0].rowsAffected !== 1 || saved[1].rowsAffected !== 1) throw conflict('Site was modified concurrently. Refresh and try again.');
  return result;
}

export async function executeSiteSectionsSet(
  client: Client,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  inputHash: string,
): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined);
  if (!current) throw notFound('Site was not found.');
  const order = strings(input.order, 10);
  const hidden = new Set(strings(input.hidden, 10));
  const doc = readDocument(current.data).doc;
  const home = doc.pages.find((p) => p.id === 'home' || p.path === '/');
  if (home && order.length) {
    const existingMap = new Map(home.sections.map((s) => [s.id, s]));
    const nextSections: Section[] = [];
    for (const sid of order) {
      const sec = existingMap.get(sid);
      if (sec && !hidden.has(sid)) nextSections.push(sec);
    }
    for (const s of home.sections) {
      if (!order.includes(s.id) && !hidden.has(s.id) && !nextSections.includes(s)) nextSections.push(s);
    }
    home.sections = nextSections;
  }
  doc.revision += 1;
  validateDocument(doc);
  const version = current.version + 1;
  const at = now();
  const compiled = await compileDocument(doc);
  const rawHtml = String(compiled.files.find((file) => file.path === '/index.html')?.body || '');
  const css = String(compiled.files.find((file) => file.path === '/style.css')?.body || '');
  const preview = { html: rawHtml.replace('</head>', `<style>${css}</style></head>`), css, hash: compiled.hash };
  const result = { siteId: current.id, version, state: current.state, site: doc, preview };
  const saved = await client.batch([
    { sql: 'UPDATE records SET data=?,version=?,updated=? WHERE id=? AND version=?', args: [JSON.stringify(doc), version, at, current.id, current.version] },
    { sql: `INSERT INTO events(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, 'site.sections.set', 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, current.id, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] },
  ], 'write');
  if (saved[0].rowsAffected !== 1 || saved[1].rowsAffected !== 1) throw conflict('Site was modified concurrently. Refresh and try again.');
  return result;
}

export async function executeSiteCompile(client: Client, bucket: R2Bucket | undefined, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, control?: D1Database, domain?: string, content?: R2Bucket): Promise<Record<string, unknown>> {
  if (!bucket) throw unavailable('Site release storage is not configured.');
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined); if (!current) throw notFound('Site was not found.');
  const authority = control ? await control.withSession('first-primary').prepare('SELECT site,epoch FROM sites WHERE workspace=?')
    .bind(context.workspace.id).first<{ site: string; epoch: number }>() : null;
  const releaseId = `rel_${crypto.randomUUID()}`;
  const currentDocument = readDocument(current.data).doc;
  const { manifest } = await saveRelease(client, bucket, content, context, current, releaseId, (currentDocument.releases?.length || 0) + 1, domain, authority?.epoch || 0);
  const token = crypto.randomUUID();
  if (control) await control.prepare('INSERT INTO previews(token,workspace,site,release,expires) VALUES(?,?,?,?,?)')
    .bind(token, context.workspace.id, current.id, releaseId, now() + 30 * 60_000).run();
  const result = { releaseId, hash: manifest.hash, version: current.version, ...(control ? { previewUrl: `/v1/site-previews/${token}/` } : {}) };
  await saveEvent(client, context, 'site.compile', current.id, key, inputHash, result);
  return result;
}

async function publishCurrent(client: Client, bucket: R2Bucket | undefined, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, action: 'site.publish' | 'site.refresh', control?: D1Database, domain?: string, content?: R2Bucket): Promise<Record<string, unknown>> {
  if (!bucket) throw unavailable('Site release storage is not configured.');
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined); if (!current) throw notFound('Site was not found.');
  const document = readDocument(current.data).doc;
  if (action === 'site.refresh' && (current.state !== 'live' || !document.currentRelease)) throw badRequest('Publish the site before refreshing its public bindings.');
  let epoch = 0;
  if (control) {
    const live = await control.withSession('first-primary').prepare('SELECT site,release,status,epoch FROM sites WHERE workspace=?')
      .bind(context.workspace.id).first<{ site: string; release: string; status: string; epoch: number }>();
    if (action === 'site.refresh' && (!live || live.site !== current.id || live.status !== 'active' || live.release !== document.currentRelease)) {
      throw conflict('Live publication changed. Refresh the site state before updating public facts.');
    }
    if (live) epoch = live.epoch;
  }
  let source: unknown = current.data;
  let candidate: ReleaseManifest | undefined;
  if (action === 'site.publish') {
    const release = text(input.releaseId, 160);
    const reviewed = await readCandidate(bucket, context, current.id, release);
    if (reviewed.manifest.version !== current.version || reviewed.manifest.hash !== input.hash) throw conflict('The reviewed candidate is stale or does not match this draft. Compile and review it again.');
    if (control && reviewed.manifest.host !== siteHost(domain, context.workspace.slug))
      throw conflict('The site address changed since review. Compile and review a new candidate.');
    if (control && (typeof reviewed.manifest.epoch !== 'number' || !Number.isSafeInteger(reviewed.manifest.epoch) || reviewed.manifest.epoch < 0))
      throw conflict('Compile and review a new candidate with current publication authority.');
    candidate = reviewed.manifest;
    source = reviewed.source;
    const report = await bucket.get(`workspaces/${context.workspace.id}/sites/${current.id}/releases/${release}/report.json`);
    if (!report) throw conflict('Compile and review this candidate before publishing it.');
    const parsed = JSON.parse(await report.text()) as { inspection?: { blocking?: { message?: string }[] } };
    const blocking = parsed.inspection?.blocking || [];
    if (blocking.length) throw conflict(`This candidate has ${blocking.length} blocking check${blocking.length === 1 ? '' : 's'}: ${String(blocking[0]?.message || 'resolve the blocking checks')}. Compile again after fixing them.`);
  }
  if (action === 'site.refresh') {
    const key = `workspaces/${context.workspace.id}/sites/${current.id}/releases/${document.currentRelease}/source.json`;
    const snapshot = await bucket.get(key);
    if (!snapshot) throw unavailable('Published source snapshot is unavailable. Publish the site again before refreshing.');
    source = JSON.parse(await snapshot.text()) as unknown;
    validateDocument(readDocument(source).doc);
  }
  const generation = (document.releases?.length || 0) + 1;
  const releaseId = candidate?.id || `rel_${crypto.randomUUID()}`;
  const built = candidate ? null : await saveRelease(client, bucket, content, context, { ...current, data: source, version: current.version }, releaseId, generation, domain, epoch);
  const manifest = candidate || built!.manifest;
  const itemCount = built?.itemCount || 0;
  const site = { ...document, currentRelease: releaseId, releases: [...(document.releases || []), manifest] }; const at = now(); const version = current.version + 1;
  const common = { siteId: current.id, releaseId, liveUrl: `/v1/sites/${encodeURIComponent(context.workspace.slug)}`, generation, state: 'live' };
  const result: Record<string, unknown> = action === 'site.refresh' ? { ...common, refreshed: true, itemCount } : common;
  const publicUrl = await activatePublication(control, domain, context, current.id, manifest, candidate ? manifest.epoch : undefined);
  if (publicUrl) { result.publicUrl = publicUrl; result.liveUrl = publicUrl; }
  const saved = await client.batch([
    { sql: "UPDATE records SET state='live',data=?,version=?,updated=? WHERE id=? AND version=?", args: [JSON.stringify(site), version, at, current.id, current.version] },
    { sql: `INSERT INTO events(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, current.id, action, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] },
    { sql: "UPDATE records SET state='replaced',version=version+1,updated=? WHERE type='site' AND state='live' AND id<>? AND EXISTS(SELECT 1 FROM events WHERE action_id=? AND idempotency_key=? AND record_id=?)", args: [at, current.id, action, key, current.id] },
  ], 'write');
  if (saved[0].rowsAffected !== 1 || saved[1].rowsAffected !== 1) throw conflict('The reviewed release may be live, but the workspace projection changed. Reload the site before retrying.');
  return publicUrl ? { ...result, publicUrl } : result;
}

export async function executeSitePublish(client: Client, bucket: R2Bucket | undefined, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, control?: D1Database, domain?: string, content?: R2Bucket): Promise<Record<string, unknown>> {
  return publishCurrent(client, bucket, context, input, key, inputHash, 'site.publish', control, domain, content);
}

export async function executeSiteRollback(client: Client, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, control?: D1Database, domain?: string, bucket?: R2Bucket, content?: R2Bucket): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined); if (!current) throw notFound('Site was not found.');
  const document = readDocument(current.data).doc;
  const releaseId = text(input.releaseId, 160); if (!document.releases?.some((release) => release.id === releaseId)) throw notFound('Site release was not found.');
  const site = { ...document, currentRelease: releaseId }; const at = now();
  const result: Record<string, unknown> = { siteId: current.id, releaseId, rolledBack: true, state: 'live' };
  const release = document.releases.find((entry) => entry.id === releaseId)!;
  const authority = control ? await control.withSession('first-primary').prepare('SELECT site,epoch FROM sites WHERE workspace=?')
    .bind(context.workspace.id).first<{ site: string; epoch: number }>() : null;
  if (control && release.host !== siteHost(domain, context.workspace.slug))
    throw conflict('This release was built for another primary address. Compile a new candidate for the current address.');
  if (control) {
    if (!bucket) throw unavailable('Site release storage is not configured.');
    const retained = await readCandidate(bucket, context, current.id, releaseId);
    const checked = await compileAll(client, retained.source, siteOrigin(domain, context.workspace.slug), assetReader(content, context, current.id));
    if (retained.manifest.hash !== release.hash || checked.hash !== release.hash)
      throw conflict('Public facts changed since this release. Compile and review a new candidate instead of restoring stale content.');
  }
  const publicUrl = await activatePublication(control, domain, context, current.id, release, authority?.epoch || 0);
  if (publicUrl) result.publicUrl = publicUrl;
  const saved = await client.batch([
    { sql: "UPDATE records SET state='live',data=?,version=version+1,updated=? WHERE id=? AND version=?", args: [JSON.stringify(site), at, current.id, current.version] },
    { sql: `INSERT INTO events(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, 'site.rollback', 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, current.id, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] },
  ], 'write');
  if (saved[0].rowsAffected !== 1 || saved[1].rowsAffected !== 1) throw conflict('The restored release may be live, but the workspace projection changed. Reload the site before retrying.');
  return result;
}

export async function executeSiteRefresh(client: Client, bucket: R2Bucket | undefined, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, control?: D1Database, domain?: string, content?: R2Bucket): Promise<Record<string, unknown>> {
  return publishCurrent(client, bucket, context, input, key, inputHash, 'site.refresh', control, domain, content);
}

export async function executeSiteUnpublish(client: Client, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, control?: D1Database): Promise<Record<string, unknown>> {
  if (!control) throw unavailable('Site publication authority is not configured.');
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined);
  if (!current) throw notFound('Site was not found.');
  const live = await control.withSession('first-primary').prepare('SELECT site,epoch,status FROM sites WHERE workspace=?')
    .bind(context.workspace.id).first<{ site: string; epoch: number; status: string }>();
  if (live?.status === 'active') {
    const blocked = await control.prepare("UPDATE sites SET status='paused',release='',hash='',epoch=epoch+1,updated=? WHERE workspace=? AND epoch=? AND status='active'")
      .bind(now(), context.workspace.id, live.epoch).run();
    if (blocked.meta.changes !== 1) throw conflict('Site publication changed concurrently. Refresh and try again.');
  }
  const site = { ...readDocument(current.data).doc, currentRelease: null };
  const at = now();
  const result = { siteId: current.id, unpublished: true };
  const saved = await client.batch([
    { sql: "UPDATE records SET state='draft',data=?,version=version+1,updated=? WHERE id=? AND version=?", args: [JSON.stringify(site), at, current.id, current.version] },
    { sql: `INSERT INTO events(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, 'site.unpublish', 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, current.id, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] },
  ], 'write');
  if (saved[0].rowsAffected !== 1 || saved[1].rowsAffected !== 1) throw conflict('Site changed while unpublishing. Public serving is blocked; refresh to reconcile the draft.');
  return result;
}

/**
 * Approved facts only: private workspace records never reach a model or a draft.
 * Prices and stock come from public bindings, copy details from the owner's own
 * request, and assets from the approved store.
 */
async function publicFacts(client: Client, input: Record<string, unknown>, previous: SiteDocument | null, context?: AccessContext): Promise<{ facts: Facts; judged: Record<string, unknown>; assets: { id: string; description: string }[]; assetsRegistered: Asset[] }> {
  const records = strings(input.records, 40).filter((id) => /^[a-zA-Z0-9._:-]{1,160}$/.test(id));
  const channel = text(input.channel, 40) || 'default';
  // No hand-picked records: fall back to the owner's published catalog so a store
  // with channel-priced stock gets a real /shop without selecting anything.
  const bound = records.length ? records : await publicVariants(client, channel);
  const items = bound.length ? await publicCatalog(client, bound, channel) : [];
  const serviceIds = strings(input.services, 40).filter((id) => /^[a-zA-Z0-9._:-]{1,160}$/.test(id));
  const services = serviceIds.length ? await publicRecords(client, serviceIds, 'service') : [];
  const features = strings(input.features, 6);
  const hours = strings(input.hours, 8);
  const proof = (Array.isArray(input.proof) ? input.proof : []).slice(0, 6).map((entry) => {
    const quote = object(entry);
    return { quote: text(quote.quote || quote.text, 300), author: text(quote.author || quote.name, 120) };
  }).filter((entry) => entry.quote && entry.author);
  const questions = (Array.isArray(input.faq) ? input.faq : []).slice(0, 12).map((entry) => {
    const faq = object(entry);
    return { q: text(faq.q || faq.question, 200), a: text(faq.a || faq.answer, 400) };
  }).filter((entry) => entry.q && entry.a);
  const contactEmail = text(input.email, 120) || (context?.identity?.email ? text(context.identity.email, 120) : '');
  const facts: Facts = {
    ...(items.length ? { items: items as Facts['items'], channel } : {}),
    ...(services.length ? { services: services as Facts['services'] } : {}),
    ...(features.length ? { features } : {}),
    ...(proof.length ? { proof } : {}),
    ...(questions.length ? { questions } : {}),
    ...(hours.length ? { hours } : {}),
    ...(text(input.address, 200) ? { address: text(input.address, 200) } : {}),
    ...(text(input.phone, 40) ? { phone: text(input.phone, 40) } : {}),
    ...(contactEmail ? { email: contactEmail } : {}),
    ...(text(input.notice, 300) ? { notice: text(input.notice, 300) } : {}),
    ...(Array.isArray(input.proofs) ? { proofs: strings(input.proofs, 6) } : {}),
    ...(text(input.season, 80) ? { season: text(input.season, 80) } : {}),
  };
  const judged = {
    catalog: items.slice(0, 20).map((item) => ({ title: item.title, price: item.price, currency: item.currency })),
    services: services.slice(0, 20).map((entry) => ({ title: entry.title })),
    features, hours,
    address: facts.address, phone: facts.phone, email: facts.email,
    questions: questions.map((entry) => entry.q),
  };
  const approved = (previous?.assets || []).filter((asset) => asset.kind === 'image' && asset.rights.approved);
  return {
    facts,
    judged,
    assets: approved.map((asset) => ({ id: asset.id, description: asset.alt || asset.id })),
    assetsRegistered: previous?.assets || [],
  };
}

/**
 * One bounded prose pass over the slots the builder left. A model outage keeps
 * the product usable: the deterministic copy stands and the reason is reported
 * instead of failing the request.
 */
async function writeDraft(
  ai: Ai | undefined,
  model: string | undefined,
  groqApiKey: string | undefined,
  site: SiteDocument,
  slots: Slot[],
  facts: Record<string, unknown>,
): Promise<{ wrote: boolean; claims: { text: string; evidence: readonly string[] }[]; note: string }> {
  if (!slots.length || (!ai && !groqApiKey)) return { wrote: false, claims: [], note: '' };
  const runner = new ModelRunner(ai, model || (groqApiKey ? GROQ_DEFAULT_MODEL : SITE_MODEL_FALLBACKS[0]), DEFAULT_BUDGET, groqApiKey);
  try {
    const texts = await writeCopy(runner, { brief: site.brief, voice: site.design.direction.voice, locale: site.locale, facts, slots });
    const ids = new Set(slots.map((slot) => slot.id));
    const walk = (nodes: Node[]) => nodes.forEach((node) => {
      const copy = texts[node.id];
      if (copy && ids.has(node.id)) node.props = { ...node.props, text: copy };
      walk(node.children || []);
    });
    site.pages.forEach((page) => page.sections.forEach((section) => walk(section.nodes)));
    const claims = await readClaims(runner, { brief: site.brief, texts: Object.values(texts) });
    return {
      wrote: true,
      claims: claims.map((claim) => ({ text: claim.text, evidence: claim.evidence ? [claim.evidence] : [] })),
      note: '',
    };
  } catch (error) {
    const reason = error instanceof BudgetExceeded
      ? 'The model budget for this run was reached.'
      : 'The model was unavailable, so plain brief copy was used.';
    return { wrote: false, claims: [], note: reason };
  }
}

/** Release history retained for rollback, newest last. */
export async function executeSiteReleases(client: Client, context: AccessContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined);
  if (!current) throw notFound('Site was not found.');
  const document = readDocument(current.data).doc;
  return { siteId: current.id, revision: document.revision, releases: document.releases || [] };
}

/** Read the stored release checks. Report files sit outside manifest.files and are never served. */
export async function executeSiteChecks(client: Client, bucket: R2Bucket | undefined, context: AccessContext, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!bucket) throw unavailable('Site release storage is not configured.');
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined);
  if (!current) throw notFound('Site was not found.');
  const release = text(input.releaseId, 160) || readDocument(current.data).doc.currentRelease || '';
  if (!/^rel_[a-f0-9-]{36}$/.test(release)) throw badRequest('Choose a compiled site candidate.');
  const report = await bucket.get(`workspaces/${context.workspace.id}/sites/${current.id}/releases/${release}/report.json`);
  if (!report) throw notFound('No checks were stored for this candidate.');
  const parsed = JSON.parse(await report.text()) as { inspection?: Record<string, unknown>; created?: number };
  return { siteId: current.id, releaseId: release, checks: parsed.inspection || null, created: parsed.created || null };
}

/** Copy that ties the site to a window of time, so the scout can ask if it still holds. */
const TEMPORAL = /(spring|summer|autumn|winter|christmas|xmas|easter|halloween|valentine|new year|black friday|cyber monday|season|launch|opening|limited|ending|expires|expired|through\s+\d|(?:jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|(?:19|20)\d{2})/i;

interface ScoutFinding {
  check: string;
  target: string;
  detail: string;
  fixed: boolean;
}

/**
 * Scout: schedule, then declared checks, then a draft revision and a Space
 * inbox item. Code re-resolves what the site publicly promises and repairs only
 * unambiguous drift; Jev flags time-sensitive copy it is given. Nothing here
 * publishes - the owner reviews the revision and closes the task.
 */
export async function executeSiteScout(client: Client, context: AccessContext, input: Record<string, unknown>, key: string, inputHash: string, typesafe?: string, control?: D1Database): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined);
  if (!current) throw notFound('Site was not found.');
  const { doc } = readDocument(current.data);
  const findings: ScoutFinding[] = [];
  const next: SiteDocument = structuredClone(doc);

  // Declared check: every collection the site promises still resolves publicly.
  for (const page of next.pages) {
    for (const section of page.sections) {
      const binding = section.bindings?.[0];
      const declared = binding?.params?.records || [];
      if (!binding || !declared.length) continue;
      const items = binding.query === 'records.public'
        ? await publicRecords(client, declared, String(binding.params?.type || 'pos.product'))
        : await publicCatalog(client, declared, String(binding.params?.channel || 'default'));
      const live = new Set(items.map((item) => String(item.id)));
      const stale = declared.filter((id) => !live.has(id));
      if (!stale.length) continue;
      section.bindings = [{ ...binding, params: { ...binding.params, records: declared.filter((id) => live.has(id)) } }];
      findings.push({ check: 'catalog', target: section.id, detail: `${stale.length} bound record(s) no longer resolve publicly and were dropped.`, fixed: true });
    }
  }

  // Declared check: publication blockers the site already carries.
  const inspection = inspectDocument(next);
  for (const issue of inspection.blocking.filter((entry) => entry.area === 'link' || entry.area === 'asset' || entry.area === 'journey').slice(0, 6)) {
    findings.push({ check: 'links', target: issue.path, detail: issue.message, fixed: false });
  }

  // Declared check: time-sensitive copy, in one batched judgment.
  const dated: { id: string; text: string }[] = [];
  for (const page of next.pages) for (const section of page.sections) {
    const walk = (nodes: Node[]) => nodes.forEach((node) => {
      const copy = text(node.props.text, 400);
      if ((node.kind === 'heading' || node.kind === 'text') && copy && TEMPORAL.test(copy)) dated.push({ id: node.id, text: copy });
      walk(node.children || []);
    });
    walk(section.nodes);
  }
  if (dated.length && typesafe) {
    const flagged = new Set(await flagDrift(typesafe, { control, workspace: context.workspace.id, version: 'scout-1' }, {
      today: new Date().toISOString().slice(0, 10),
      subjects: dated.slice(0, 8),
    }));
    for (const subject of dated) if (flagged.has(subject.id)) findings.push({ check: 'season', target: subject.id, detail: `Copy reads as time-bound: "${subject.text.slice(0, 90)}"`, fixed: false });
  }

  const repaired = findings.some((finding) => finding.fixed);
  const revision = repaired ? doc.revision + 1 : doc.revision;
  if (repaired) validateDocument(next);

  let taskId: string | null = null;
  if (findings.length) {
    const pending = await client.execute({ sql: "SELECT id FROM records WHERE type='task' AND state='open' AND archived IS NULL AND json_extract(data,'$.key')=? LIMIT 1", args: [`site.scout:${current.id}`] });
    if (!pending.rows.length) taskId = `rec_${crypto.randomUUID()}`;
  }

  const at = now();
  const result = { siteId: current.id, revision, findings: findings.slice(0, 12), taskId, published: false };
  const statements: InStatement[] = [];
  if (repaired) statements.push({ sql: 'UPDATE records SET data=?,version=?,updated=? WHERE id=? AND version=?', args: [JSON.stringify(next), current.version + 1, at, current.id, current.version] });
  if (taskId) statements.push({
    sql: 'INSERT INTO records (id,type,title,state,data,owner,assignee,due,version,created,updated) VALUES (?,?,?,?,?,?,?,NULL,1,?,?)',
    args: [taskId, 'task', `Review site: ${findings.length} finding${findings.length === 1 ? '' : 's'}`, 'open',
      JSON.stringify({ key: `site.scout:${current.id}`, siteId: current.id, findings: findings.slice(0, 12), description: findings.slice(0, 4).map((finding) => `${finding.check}: ${finding.detail}`).join(' ') }),
      context.identity.id, context.identity.id, at, at],
  });
  statements.push(repaired
    ? { sql: `INSERT INTO events(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, 'site.scout', 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, current.id, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] }
    : eventStatement({ action: 'site.scout', actor: context.identity.id, recordId: current.id, key, hash: inputHash, result }));
  const saved = await client.batch(statements, 'write');
  if (saved.some((response) => response.rowsAffected !== 1)) throw conflict('Site changed while the scout was running. Refresh and try again.');
  return result;
}
