import { Effect } from 'effect';
import type { Client } from '@libsql/client/web';
import { verifyGoogleIdentity } from './auth/google.ts';
import { mintSession, verifySession } from './auth/session.ts';
import { ControlStore } from './db/control.ts';
import { openWorkspaceDatabase, provisionWorkspaceDatabase, query } from './db/turso.ts';
import { executeGateway, type GatewayRequest } from './gateway/actions.ts';
import { HarnessError, badRequest, forbidden, notFound, unavailable } from './errors.ts';
import type { AccessContext, RecordItem } from './types.ts';
import { actionCatalog, findAction, interfaceCatalog } from './registry/catalog.ts';
import { serveSitePreview } from './site/preview.ts';
import { placeOrder, resolvePublicSite } from './site/checkout.ts';
import { readDocument } from './site/adapt.ts';
import { buildSite, defaultSite } from './site/build.ts';
import { defaultBlueprint } from './site/blueprint.ts';
import { exportDesign } from './site/design.ts';
import { compileDocument } from './site/compile.ts';
import { siteRegenerate } from './site/store.ts';
import { canExecute, canReadRecord, canRunFlowStep, managesMembers } from './access.ts';
import { inviteMember, listMembers, updateMember } from './team.ts';
import { searchContacts } from './contacts/search.ts';
import { cardDeck, deckStatement, findTool, readCardStack, readDeck, toolForAction } from './tools/registry.ts';
import { ask, confirmSkill, findSkill, listSkills } from './skill/engine.ts';
import { proposePlan } from './skill/propose.ts';
import { advanceRun, listRuns, startRun } from './skill/run.ts';
import { birthMoment, hireMoment, importMoment } from './brain/moments.ts';
import { deriveGate, mayExecute, missingFields } from './truth/gate.ts';
import { currentStatement, inboxStatement, lastMoveId, readInbox } from './truth/write.ts';

type RuntimeEnv = Env & { readonly TURSO_PLATFORM_TOKEN?: string; readonly TAR_SESSION_SECRET?: string; readonly TELEGRAM_BOT_TOKEN?: string; readonly TYPESAFE_API_KEY?: string; readonly GROQ_API_KEY?: string; readonly PEXELS_API_KEY?: string; readonly SITE_BASE_DOMAIN?: string; readonly SITE_WORKER_ORIGIN?: string; readonly SITE_MODEL?: string };
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
const now = () => Date.now();
const cleanSlug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const identityKey = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 32);

function response(value: unknown, status = 200, extra: HeadersInit = {}): Response { return new Response(JSON.stringify(value), { status, headers: { ...jsonHeaders, ...corsHeaders, ...extra } }); }
function errorResponse(error: unknown): Response {
  if (error instanceof HarnessError) return response({ error: error.message, ...(error.code ? { code: error.code } : {}) }, error.status);
  console.error(JSON.stringify({ event: 'tarharness.error', error: error instanceof Error ? error.message : String(error) }));
  return response({ error: 'Internal server error.' }, 500);
}
function parseJson(request: Request): Effect.Effect<Record<string, unknown>, HarnessError> {
  const length = Number(request.headers.get('Content-Length') || '0');
  if (length > 100_000) return Effect.fail(badRequest('Request is too large.'));
  return Effect.tryPromise({ try: async () => object(await request.json()), catch: () => badRequest('Request body must be JSON.') });
}
function tursoEnv(env: RuntimeEnv) {
  if (!env.TURSO_PLATFORM_TOKEN || !env.TURSO_ORG || env.TURSO_ORG.startsWith('REPLACE_')) throw unavailable('Turso provisioning is not configured.');
  return { TURSO_ORG: env.TURSO_ORG, TURSO_PLATFORM_TOKEN: env.TURSO_PLATFORM_TOKEN, TURSO_GROUP: env.TURSO_GROUP || 'default' };
}
function record(row: Record<string, unknown>): RecordItem {
  return {
    id: String(row.id), type: String(row.type), title: String(row.title), state: String(row.state), data: object(JSON.parse(String(row.data))),
    owner: typeof row.owner === 'string' ? row.owner : null,
    assignee: typeof row.assignee === 'string' ? row.assignee : null,
    version: Number(row.version),
    createdAt: Number(row.created),
    updatedAt: Number(row.updated)
  };
}

async function siteSecurityHeaders(html: string, contentType: string): Promise<Record<string, string>> {
  const scriptHashes: string[] = [];
  if (contentType.startsWith('text/html')) {
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1])));
      scriptHashes.push(`'sha256-${btoa(String.fromCharCode(...digest))}'`);
    }
  }
  return {
    'Content-Security-Policy': [
      "default-src 'none'", "base-uri 'none'", "object-src 'none'", "form-action 'self'", "frame-ancestors 'none'",
      `script-src 'self'${scriptHashes.length ? ` ${scriptHashes.join(' ')}` : ''}`,
      "style-src 'self' 'unsafe-inline'", "img-src 'self' https: data:", "font-src 'self' data:", "connect-src 'none'",
    ].join('; '),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

async function runVisible(client: Client, member: AccessContext['member'], actor: string, recordId: unknown) {
  if (member.role === 'guest') return false;
  if (actor === member.userId || member.role === 'owner' || member.role === 'admin') return true;
  if (typeof recordId !== 'string') return false;
  const rows = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: 'SELECT * FROM records WHERE id=? AND archived IS NULL', args: [recordId] }));
  return Boolean(rows[0] && canReadRecord(member, record(rows[0])));
}

function canContinueRun(member: AccessContext['member'], context: Record<string, unknown>) {
  const actions = Array.isArray(context.actions) ? context.actions.map(object) : [];
  const step = Number(context.step || 0);
  const current = Number.isSafeInteger(step) && step >= 0 ? actions[step] : undefined;
  return Boolean(current && canRunFlowStep(member, current, String(context.startedBy || '')));
}

async function identity(request: Request, env: RuntimeEnv) {
  // One credential after the first exchange: the TAR session. Google tokens
  // still verify during the transition so nothing falls over mid-build.
  const session = await verifySession(env, request.headers.get('Authorization'));
  if (session) return { value: session, control: new ControlStore(env.CONTROL) };
  const value = await Effect.runPromise(verifyGoogleIdentity(request.headers.get('Authorization'), env));
  const control = new ControlStore(env.CONTROL);
  await Effect.runPromise(control.upsertUser(value));
  return { value, control };
}
async function access(request: Request, env: RuntimeEnv, slug: string): Promise<{ readonly access: AccessContext; readonly control: ControlStore }> {
  const current = await identity(request, env);
  return { access: await Effect.runPromise(current.control.access(current.value, slug)), control: current.control };
}
async function withWorkspace<A>(env: RuntimeEnv, current: AccessContext, work: (client: Client) => Promise<A>): Promise<A> {
  const client = await Effect.runPromise(openWorkspaceDatabase(tursoEnv(env), current.workspace.databaseName, current.workspace.databaseHost!));
  try { return await work(client); } finally { client.close(); }
}

// The scout audits a published site at most once a day. CONTROL holds the last
// audit time so the background fan-out never opens a workspace database that is
// not due; the run only drafts a revision, never publishes.
const SCOUT_INTERVAL = 24 * 60 * 60_000;
async function scoutPublishedSites(env: RuntimeEnv): Promise<void> {
  if (!env.SITE_RELEASES) return;
  const due = await env.CONTROL.prepare("SELECT s.workspace,s.site,s.scouted,w.name,w.slug,w.database_name,w.database_host,w.owner_id FROM sites s JOIN workspaces w ON w.id=s.workspace WHERE s.status='active' AND s.release<>'' AND w.state='active' AND w.database_host IS NOT NULL AND s.scouted<? ORDER BY s.scouted LIMIT 20")
    .bind(now() - SCOUT_INTERVAL).all<{ workspace: string; site: string; scouted: number; name: string; slug: string; database_name: string; database_host: string; owner_id: string }>();
  for (const item of due.results) {
    // Claim the slot first so overlapping crons never scout the same site twice.
    const claim = await env.CONTROL.prepare('UPDATE sites SET scouted=? WHERE workspace=? AND scouted=?').bind(now(), item.workspace, item.scouted).run();
    if (claim.meta.changes !== 1) continue;
    const context: AccessContext = {
      identity: { id: item.owner_id, email: '', name: 'Site scout' },
      workspace: { id: item.workspace, name: item.name, slug: item.slug, mode: 'work', databaseName: item.database_name, databaseHost: item.database_host, state: 'active' },
      member: { workspaceId: item.workspace, userId: item.owner_id, role: 'owner', state: 'active' },
    };
    try {
      const client = await Effect.runPromise(openWorkspaceDatabase(tursoEnv(env), item.database_name, item.database_host));
      try {
        await Effect.runPromise(executeGateway(client, context, {
          actionId: 'site.scout', idempotencyKey: `scout-${item.site}-${now()}`, input: { siteId: item.site },
        }, { typesafe: env.TYPESAFE_API_KEY, publication: env.CONTROL }));
      } finally { client.close(); }
    } catch (cause) {
      console.error(JSON.stringify({ event: 'site.scout.failed', workspace: item.workspace, error: cause instanceof Error ? cause.message : String(cause) }));
    }
  }
}

// The sweep re-reads what the owner has since recorded and rebuilds the draft when that state
// moved. It never publishes: a live store keeps serving its release until its owner taps
// Publish, and a draft a hand edit owns is left alone.
const REGEN_INTERVAL = 15 * 60_000;
const REGEN_PER_TICK = 8;
async function regenerateDriftedSites(env: RuntimeEnv): Promise<void> {
  const due = await env.CONTROL.prepare(`SELECT s.workspace,s.site,s.regen,w.name,w.slug,w.database_name,w.database_host,w.owner_id FROM sites s JOIN workspaces w ON w.id=s.workspace WHERE w.state='active' AND w.database_host IS NOT NULL AND s.regen<? ORDER BY s.regen LIMIT ${REGEN_PER_TICK}`)
    .bind(now() - REGEN_INTERVAL).all<{ workspace: string; site: string; regen: number; name: string; slug: string; database_name: string; database_host: string; owner_id: string }>();
  for (const item of due.results) {
    // Claim the slot first so overlapping crons never rebuild the same site twice.
    const claim = await env.CONTROL.prepare('UPDATE sites SET regen=? WHERE workspace=? AND regen=?').bind(now(), item.workspace, item.regen).run();
    if (claim.meta.changes !== 1) continue;
    const context: AccessContext = {
      identity: { id: item.owner_id, email: '', name: 'Site sweep' },
      workspace: { id: item.workspace, name: item.name, slug: item.slug, mode: 'work', databaseName: item.database_name, databaseHost: item.database_host, state: 'active' },
      member: { workspaceId: item.workspace, userId: item.owner_id, role: 'owner', state: 'active' },
    };
    try {
      const client = await Effect.runPromise(openWorkspaceDatabase(tursoEnv(env), item.database_name, item.database_host));
      try {
        const result = await siteRegenerate(client, context, {
          control: env.CONTROL, domain: env.SITE_WORKER_ORIGIN || env.SITE_BASE_DOMAIN, releases: env.SITE_RELEASES, content: env.PRODUCT_CONTENT,
          ai: env.AI, typesafe: env.TYPESAFE_API_KEY, model: env.SITE_MODEL, groqApiKey: env.GROQ_API_KEY, pexelsApiKey: env.PEXELS_API_KEY,
        }, item.site);
        if (result.rebuilt || result.held) console.error(JSON.stringify({ event: 'site.regen', workspace: item.workspace, site: item.site, rebuilt: Boolean(result.rebuilt), held: result.held || '', missing: (result.missing as unknown[] | undefined)?.length ?? 0 }));
      } finally { client.close(); }
    } catch (cause) {
      console.error(JSON.stringify({ event: 'site.regen.failed', workspace: item.workspace, error: cause instanceof Error ? cause.message : String(cause) }));
    }
  }
}

async function provision(control: ControlStore, env: RuntimeEnv, pending: { id: string; databaseName: string }) {
  try {
    const provisioned = await Effect.runPromise(provisionWorkspaceDatabase(tursoEnv(env), pending.databaseName));
    await Effect.runPromise(control.activateWorkspace(pending.id, provisioned.host));
    return provisioned;
  } catch (cause) {
    await Effect.runPromise(control.failWorkspace(pending.id, cause)).catch(() => undefined);
    throw cause;
  }
}

async function ensurePersonalWorkspace(owner: Awaited<ReturnType<typeof identity>>['value'], control: ControlStore, env: RuntimeEnv) {
  const key = identityKey(owner.id);
  const pending = await Effect.runPromise(control.ensurePersonalWorkspace({ identity: owner, name: 'Personal', slug: `personal-${key}`, databaseName: key, mode: 'personal' }));
  if (pending.state !== 'active') await provision(control, env, pending);
}

async function activeAccesses(request: Request, env: RuntimeEnv) {
  const { value, control } = await identity(request, env);
  await ensurePersonalWorkspace(value, control, env);
  let workspaces = await Effect.runPromise(control.listWorkspaces(value.id));
  for (const entry of workspaces) {
    if (entry.role === 'owner' && entry.workspace.state === 'provisioning') await provision(control, env, entry.workspace);
  }
  return { value, control, accesses: await Effect.runPromise(control.listAccess(value)) };
}

async function createWorkspace(request: Request, env: RuntimeEnv): Promise<Response> {
  const { value: owner, control } = await identity(request, env);
  const body = await Effect.runPromise(parseJson(request));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const slug = cleanSlug(typeof body.slug === 'string' ? body.slug : name);
  if (!name || !slug) throw badRequest('Workspace name is required.');
  const databaseName = `${identityKey(owner.id)}-${slug}`.slice(0, 56);
  const input = { identity: owner, name, slug, databaseName, mode: 'work' as const };
  // Birth: Jev names the nature, code deals the cards. One call, once.
  const words = typeof body.words === 'string' ? body.words : name;
  const birth = await birthMoment(env.TYPESAFE_API_KEY, words);
  const pending = await Effect.runPromise(control.resumeErroredWorkspace(input)) ?? await Effect.runPromise(control.createPendingWorkspace(input));
  const provisioned = await provision(control, env, pending);
  try {
    const client = await Effect.runPromise(openWorkspaceDatabase(tursoEnv(env), pending.databaseName, provisioned.host));
    try {
      const siteDoc = defaultSite(name, `${name} — official online store, products and services.`);
      const siteId = `site_${crypto.randomUUID()}`;
      const at = Date.now();
      await client.batch([
        { sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES(?,'site',?,'draft',?,?,1,?,?)", args: [siteId, name, JSON.stringify(siteDoc), owner.id, at, at] },
        // Birth deals the cards (general recipe until Jev names the nature at
        // the birth moment) and seeds the first NEXT: never a blank Canvas.
        deckStatement(cardDeck(birth.nature)),
        currentStatement('card', 'catalog', { itemCount: '0 items', pending: 'add your first item' }),
        currentStatement('workspace', 'nature', { nature: birth.nature, confidence: birth.confidence, doubt: birth.doubt }),
        inboxStatement({ member: owner.id, tool: 'catalog', reach: 'data', title: 'Add your first item', action: 'catalog.item.save' }),
      ], 'write');
    } finally {
      client.close();
    }
  } catch (err) {
    console.error('Initial site draft auto-generation note:', err);
  }
  return response({ workspace: { ...pending, databaseHost: undefined, state: 'active' } }, 201);
}

async function handle(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const url = new URL(request.url); const path = url.pathname;
  if (request.method === 'GET' && path === '/health') return response({ ok: true, service: 'tarharness', now: new Date().toISOString(), tursoProvisioning: Boolean(env.TURSO_PLATFORM_TOKEN && env.TURSO_ORG && !env.TURSO_ORG.startsWith('REPLACE_')) });
  if (request.method === 'GET' && path === '/v1/actions') return response({ actions: actionCatalog, interfaces: interfaceCatalog });
  // --- the TAR API door: session, /me, slice, intent ---
  if (request.method === 'POST' && path === '/v1/auth/session') {
    const google = await Effect.runPromise(verifyGoogleIdentity(request.headers.get('Authorization'), env));
    const control = new ControlStore(env.CONTROL);
    await Effect.runPromise(control.upsertUser(google));
    const session = await mintSession(env, google);
    return response({ token: session.token, expiresAt: session.expiresAt, user: google });
  }
  if (request.method === 'GET' && path === '/v1/me') {
    const { value, control } = await identity(request, env);
    await ensurePersonalWorkspace(value, control, env);
    const workspaces = await Effect.runPromise(control.listWorkspaces(value.id));
    const badges = await Promise.all(workspaces.map(async (entry) => {
      if (entry.workspace.state !== 'active' || !entry.workspace.databaseHost) return 0;
      try {
        return await withWorkspace(env, { identity: value, workspace: entry.workspace, member: { workspaceId: entry.workspace.id, userId: value.id, role: entry.role, workRole: entry.workRole, roles: entry.roles, state: 'active' } },
          (client) => client.execute({ sql: "SELECT COUNT(*) FROM inbox WHERE member=? AND status='pending'", args: [value.id] }).then((rows) => Number(rows.rows[0]?.[0] ?? 0)));
      } catch { return 0; }
    }));
    return response({ user: value, workspaces: workspaces.map((entry, index) => ({
      id: entry.workspace.id, name: entry.workspace.name, slug: entry.workspace.slug, mode: entry.workspace.mode,
      role: entry.role, state: entry.workspace.state, badge: badges[index],
    })) });
  }
  if (request.method === 'GET' && path === '/v1/slice') {
    const slug = url.searchParams.get('ws') || '';
    if (!slug) throw badRequest('The ws parameter names the workspace.');
    const { access: current } = await access(request, env, slug);
    return withWorkspace(env, current, async (client) => {
      const version = await lastMoveId(client);
      const etag = `"${version ?? 'empty'}"`;
      if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: { ETag: etag, ...corsHeaders } });
      const [inbox, deck, skills] = await Promise.all([readInbox(client, current.member.userId), readDeck(client), listSkills(client)]);
      const cards = await readCardStack(client, current.member.role, deck);
      const sorted = [...inbox].sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.due ?? Infinity) - (b.due ?? Infinity) || b.created - a.created);
      return response({ version, next: sorted[0] ?? null, inbox: sorted, cards, skills, workspace: { id: current.workspace.id, name: current.workspace.name, slug: current.workspace.slug, mode: current.workspace.mode, role: current.member.role } }, 200, { ETag: etag });
    });
  }
  if (request.method === 'POST' && path === '/v1/intent') {
    const body = await Effect.runPromise(parseJson(request));
    const slug = typeof body.ws === 'string' ? body.ws : '';
    const actionName = typeof body.action === 'string' ? body.action : '';
    const key = typeof body.key === 'string' ? body.key : '';
    if (!slug || !actionName || !key) throw badRequest('An intent needs ws, action and key.');
    const confirmed = body.confirmed === true;
    const { access: current } = await access(request, env, slug);
    const registered = findAction(actionName);
    if (!registered) throw notFound(`Action ${actionName} is not registered.`);
    const owner = toolForAction(registered.id);
    const reach = owner ? findTool(owner)!.reach : 'data';
    const required = registered.fields.filter((field) => field.required).map((field) => field.key);
    const input = object(body.input);
    const gate = deriveGate({ action: { reach, requiredFields: required }, input, confirmed });
    if (!mayExecute(reach, gate, confirmed)) {
      return response({ gate, missing: missingFields(required, input), action: registered.id, reach }, 202);
    }
    const result = await withWorkspace(env, current, (client) =>
      Effect.runPromise(executeGateway(client, current, { actionId: registered.id as GatewayRequest['actionId'], idempotencyKey: key, input }, { productContent: env.PRODUCT_CONTENT, siteReleases: env.SITE_RELEASES, publication: env.CONTROL, siteDomain: env.SITE_WORKER_ORIGIN || env.SITE_BASE_DOMAIN, ai: env.AI, typesafe: env.TYPESAFE_API_KEY, siteModel: env.SITE_MODEL, groqApiKey: env.GROQ_API_KEY, pexelsApiKey: env.PEXELS_API_KEY, telegramBotToken: env.TELEGRAM_BOT_TOKEN })));
    const client = await Effect.runPromise(openWorkspaceDatabase(tursoEnv(env), current.workspace.databaseName, current.workspace.databaseHost!));
    try {
      const version = await lastMoveId(client);
      return response({ result, version }, 201);
    } finally { client.close(); }
  }
  const previewMatch = /^\/v1\/site-previews\/([a-f0-9-]{36})(\/.*)?$/.exec(path);
  if (request.method === 'GET' && previewMatch) return serveSitePreview(previewMatch[1], previewMatch[2] || '/', env.CONTROL, env.SITE_RELEASES, siteSecurityHeaders, {
    frame: url.searchParams.get('frame'),
    embed: url.searchParams.get('embed') === '1',
  });
  if (request.method === 'GET' && path === '/v1/workspaces') {
    const { value, control } = await identity(request, env);
    await ensurePersonalWorkspace(value, control, env);
    let workspaces = await Effect.runPromise(control.listWorkspaces(value.id));
    for (const entry of workspaces) {
      if (entry.role === 'owner' && entry.workspace.mode === 'work' && entry.workspace.state === 'provisioning') {
        await provision(control, env, entry.workspace);
      }
    }
    workspaces = await Effect.runPromise(control.listWorkspaces(value.id));
    return response({ workspaces: workspaces.map(({ workspace, role, workRole, roles }) => ({ id: workspace.id, name: workspace.name, slug: workspace.slug, scope: workspace.slug, role, workRole, roles, owner: workspace.mode === 'personal' ? 'You' : workspace.ownerName || 'Workspace owner', mode: workspace.mode, state: workspace.state })) });
  }
  if (request.method === 'POST' && path === '/v1/workspaces') return createWorkspace(request, env);
  const publicSiteMatch = /^\/v1\/sites\/([a-z0-9-]+)(\/.*)?$/.exec(path);
  const publicOrderMatch = /^\/v1\/sites\/([a-z0-9-]+)\/order$/.exec(path);
  if (request.method === 'POST' && publicOrderMatch) {
    // The published storefront posts the buyer's cart here through its own worker, which
    // already resolved the slug; the harness re-resolves it so the endpoint is safe alone.
    const body = await Effect.runPromise(parseJson(request));
    const site = await resolvePublicSite(env.CONTROL, publicOrderMatch[1]);
    const client = await Effect.runPromise(openWorkspaceDatabase(tursoEnv(env), site.databaseName, site.databaseHost));
    try {
      const idempotencyKey = request.headers.get('Idempotency-Key') || `web-${crypto.randomUUID()}`;
      const placed = await placeOrder(client, site, {
        slug: site.slug, lines: body.lines, name: body.name, phone: body.phone, note: body.note, extra: body.extra, key: idempotencyKey,
      });
      // The published storefront proxies this from its own worker, so no browser needs
      // CORS here; a money endpoint stays same-origin only.
      return new Response(JSON.stringify(placed), { status: 201, headers: jsonHeaders });
    } finally { client.close(); }
  }
  if (request.method === 'GET' && publicSiteMatch) {
    const siteSlug = publicSiteMatch[1];
    const wsRow = await env.CONTROL.prepare("SELECT * FROM workspaces WHERE slug=? AND state='active' LIMIT 1").bind(siteSlug).first<Record<string, unknown>>();
    if (!wsRow) throw notFound('Site not found.');
    const authority = await env.CONTROL.withSession('first-primary').prepare('SELECT release,status,domain,mode FROM sites WHERE workspace=?')
      .bind(String(wsRow.id)).first<{ release: string; status: string; domain: string; mode: string }>();
    if (!authority || authority.status !== 'active' || !authority.release) throw notFound('Site is not published.');
    if (!/^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/.test(authority.domain)) throw unavailable('Published address is unavailable.');
    const requestedPath = publicSiteMatch[2] || '/';
    if (/%(?:2f|5c|00|25)/i.test(requestedPath) || /[\\\u0000-\u001f]/.test(requestedPath) || requestedPath.split('/').some((part) => part === '.' || part === '..')) throw badRequest('Invalid site path.');
    const target = new URL(`https://${authority.domain}${authority.mode === 'path' ? `/${siteSlug}` : ''}${requestedPath}`);
    target.search = url.search;
    return new Response(null, { status: 308, headers: { Location: target.toString(), 'Cache-Control': 'no-store' } });
  }
  const match = /^\/v1\/workspaces\/([a-z0-9-]+)(?:\/(.*))?$/.exec(path);
  if (!match) throw notFound('Route not found.');
  const slug = match[1]; const nested = match[2] || '';
  const { access: current } = await access(request, env, slug);
  if (request.method === 'DELETE' && !nested) {
    if (current.member.role !== 'owner' || current.workspace.mode === 'personal') {
      throw forbidden();
    }
    await withWorkspace(env, current, async (client) => {
      try {
        await client.batch([
          { sql: 'DELETE FROM records' },
          { sql: 'DELETE FROM move' },
          { sql: 'DELETE FROM run' },
        ], 'write');
      } catch { /* proceed */ }
    });
    await env.CONTROL.batch([
      env.CONTROL.prepare('DELETE FROM sites WHERE workspace=?').bind(current.workspace.id),
      env.CONTROL.prepare('DELETE FROM workspace_invites WHERE workspace_id=?').bind(current.workspace.id),
      env.CONTROL.prepare('DELETE FROM members WHERE workspace_id=?').bind(current.workspace.id),
      env.CONTROL.prepare('DELETE FROM workspaces WHERE id=?').bind(current.workspace.id),
    ]);
    try {
      if (env.SITE_RELEASES) {
        const listed = await env.SITE_RELEASES.list({ prefix: `workspaces/${current.workspace.id}/` });
        if (listed.objects.length) await env.SITE_RELEASES.delete(listed.objects.map((o) => o.key));
      }
      if (env.PRODUCT_CONTENT) {
        const listed = await env.PRODUCT_CONTENT.list({ prefix: `workspaces/${current.workspace.id}/` });
        if (listed.objects.length) await env.PRODUCT_CONTENT.delete(listed.objects.map((o) => o.key));
      }
    } catch { /* proceed */ }
    return response({ deleted: true, workspaceId: current.workspace.id });
  }
  if (request.method === 'GET' && nested === 'members') {
    const roster = await listMembers(env.CONTROL, current);
    const enriched = await withWorkspace(env, current, async (client) => {
      try {
        const partyRows = await client.execute("SELECT id, title, data FROM records WHERE type='party' AND archived IS NULL");
        const partyMap = new Map<string, { brief?: string; access?: string[] }>();
        for (const row of partyRows.rows) {
          try {
            const parsed = JSON.parse(String(row.data));
            const brief = typeof parsed.brief === 'string' ? parsed.brief : undefined;
            const access = Array.isArray(parsed.access) ? parsed.access.map(String) : undefined;
            const entry = { brief, access };
            if (typeof parsed.email === 'string') partyMap.set(parsed.email.toLowerCase(), entry);
            if (typeof parsed.userId === 'string') partyMap.set(parsed.userId, entry);
            if (typeof row.title === 'string' && row.title.includes('@')) partyMap.set(row.title.toLowerCase(), entry);
            partyMap.set(String(row.id), entry);
          } catch { /* ignore */ }
        }
        return roster.map((raw) => {
          const item = raw as Record<string, unknown>;
          const party = (item.id ? partyMap.get(String(item.id)) : undefined) || (typeof item.email === 'string' ? partyMap.get(item.email.toLowerCase()) : undefined);
          return {
            ...item,
            ...(party?.brief ? { brief: party.brief } : {}),
            ...(party?.access ? { access: party.access } : {}),
          };
        });
      } catch {
        return roster;
      }
    });
    return response({ members: enriched, currentUserId: current.identity.id });
  }
  if (request.method === 'POST' && nested === 'members') {
    const body = await Effect.runPromise(parseJson(request));
    const invitation = await inviteMember(env.CONTROL, current, body);
    if (body.brief || (Array.isArray(body.access) && body.access.length > 0)) {
      await withWorkspace(env, current, async (client) => {
        try {
          const email = String(body.email || '').trim().toLowerCase();
          const accessArr = Array.isArray(body.access) ? body.access.map(String) : [];
          const briefStr = typeof body.brief === 'string' ? body.brief : '';
          const existing = await client.execute({
            sql: "SELECT id FROM records WHERE type='party' AND (title=? OR json_extract(data, '$.email')=?) AND archived IS NULL LIMIT 1",
            args: [email, email],
          });
          const stamp = Date.now();
          if (existing.rows.length > 0) {
            const partyId = String(existing.rows[0].id);
            await client.execute({
              sql: "UPDATE records SET data=?, version=version+1, updated=? WHERE id=?",
              args: [
                JSON.stringify({ kind: 'member', email, role: body.role || 'member', workrole: body.workRole || 'general', brief: briefStr, access: accessArr }),
                stamp,
                partyId,
              ],
            });
          } else {
            const partyId = 'party_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
            await client.execute({
              sql: `INSERT INTO records(id, type, title, state, data, owner, assignee, due, version, created, updated)
                    VALUES(?, 'party', ?, 'active', ?, ?, NULL, NULL, 1, ?, ?)`,
              args: [
                partyId,
                email,
                JSON.stringify({ kind: 'member', email, role: body.role || 'member', workrole: body.workRole || 'general', brief: briefStr, access: accessArr }),
                current.identity.id,
                stamp,
                stamp,
              ],
            });
          }
        } catch (err) {
          console.error(JSON.stringify({ event: 'party.save.failed', error: String(err) }));
        }
      });
    }
    return response({ invitation }, 201);
  }
  if (request.method === 'PUT' && nested.startsWith('members/')) {
    const user = decodeURIComponent(nested.slice(8));
    const body = await Effect.runPromise(parseJson(request));
    const result = await updateMember(env.CONTROL, current, user, body);
    if (body.brief !== undefined || body.access !== undefined) {
      await withWorkspace(env, current, async (client) => {
        try {
          const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
          const partyRows = await client.execute({
            sql: `SELECT id, data, version FROM records WHERE type='party' AND (
              id=? OR owner=? OR json_extract(data, '$.userId')=?
              ${email ? "OR lower(title)=? OR json_extract(data, '$.email')=?" : ''}
            ) AND archived IS NULL LIMIT 1`,
            args: email ? [user, user, user, email, email] : [user, user, user],
          });
          const accessArr = Array.isArray(body.access) ? body.access.map(String) : [];
          const briefStr = typeof body.brief === 'string' ? body.brief : '';
          const stamp = Date.now();
          if (partyRows.rows.length > 0) {
            const row = partyRows.rows[0];
            const prevData = JSON.parse(String(row.data));
            const nextData = {
              ...prevData,
              brief: briefStr,
              access: accessArr,
              workrole: body.workRole || prevData.workrole,
              role: body.role || prevData.role,
              ...(email ? { email } : {}),
            };
            await client.execute({
              sql: "UPDATE records SET data=?, version=version+1, updated=? WHERE id=?",
              args: [JSON.stringify(nextData), stamp, String(row.id)],
            });
          } else {
            await client.execute({
              sql: `INSERT INTO records(id, type, title, state, data, owner, assignee, due, version, created, updated)
                    VALUES(?, 'party', ?, 'active', ?, ?, NULL, NULL, 1, ?, ?)`,
              args: [
                user,
                email || user,
                JSON.stringify({ kind: 'member', userId: user, email, role: body.role || 'member', workrole: body.workRole || 'general', brief: briefStr, access: accessArr }),
                user,
                stamp,
                stamp,
              ],
            });
          }
        } catch (err) {
          console.error(JSON.stringify({ event: 'party.update.failed', error: String(err) }));
        }
      });
    }
    return response(result);
  }
    if (request.method === 'GET' && nested === 'actions') return response({ actions: actionCatalog.filter((action) => canExecute(current.member, action.id)), interfaces: interfaceCatalog });
  return withWorkspace(env, current, async (client) => {
    if (request.method === 'DELETE' && nested === 'site') {
      if (current.member.role === 'guest') throw forbidden();
      await client.batch([
        { sql: "DELETE FROM records WHERE type='site'" },
      ], 'write');
      await env.CONTROL.prepare("DELETE FROM sites WHERE workspace=?").bind(current.workspace.id).run();
      try {
        if (env.SITE_RELEASES) {
          const listed = await env.SITE_RELEASES.list({ prefix: `workspaces/${current.workspace.id}/` });
          if (listed.objects.length) await env.SITE_RELEASES.delete(listed.objects.map((o) => o.key));
        }
      } catch { /* proceed */ }
      const initialDoc = defaultSite(current.workspace.name, `${current.workspace.name} — official online store, products and services.`);
      const siteId = `site_${crypto.randomUUID()}`;
      const at = Date.now();
      await client.batch([
        { sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES(?,'site',?,'draft',?,?,1,?,?)", args: [siteId, current.workspace.name, JSON.stringify(initialDoc), current.identity.id, at, at] },
      ], 'write');
      return response({ reset: true, siteId, site: initialDoc });
    }
    if (request.method === 'GET' && nested === 'site') {
      let siteRows = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: "SELECT * FROM records WHERE type='site' AND archived IS NULL ORDER BY updated DESC LIMIT 1" }));
      if (siteRows.length) {
        const candidate = object(typeof siteRows[0].data === 'string' ? JSON.parse(String(siteRows[0].data)) : siteRows[0].data);
        const legacyPurposes = new Set(['chrome', 'introduction', 'categories', 'collection', 'recommendations', 'press', 'action']);
        const hasLegacy = !candidate.blueprint || (Array.isArray(candidate.pages) && candidate.pages.some((p: any) => Array.isArray(p.sections) && p.sections.some((s: any) => legacyPurposes.has(String(s.purpose)))));
        if (hasLegacy) {
          await client.batch([
            { sql: "DELETE FROM records WHERE type='site'" },
          ], 'write');
          siteRows = [];
        }
      }
      if (!siteRows.length) {
        const briefRow = await Effect.runPromise(query<Record<string, unknown>>(client, {
          sql: "SELECT data FROM records WHERE id='brief' AND type='brief' AND archived IS NULL LIMIT 1",
        }));
        let inheritedBrief: string[] = [];
        let inheritedTrade = '';
        if (briefRow.length && briefRow[0].data) {
          try {
            const td = object(typeof briefRow[0].data === 'string' ? JSON.parse(String(briefRow[0].data)) : briefRow[0].data);
            if (Array.isArray(td.brief)) inheritedBrief = td.brief.map(String).filter(Boolean).slice(0, 20);
            if (typeof td.trade === 'string') inheritedTrade = td.trade.trim();
          } catch { /* ignore */ }
        }

        const tradeLower = inheritedTrade.toLowerCase();
        const isService = tradeLower.includes('service') || tradeLower.includes('consulting') || tradeLower.includes('tailor') || tradeLower.includes('clinic') || tradeLower.includes('salon');
        const isFood = tradeLower.includes('food') || tradeLower.includes('beverage') || tradeLower.includes('bakery') || tradeLower.includes('restaurant') || tradeLower.includes('cafe');
        const models = isFood ? ['food' as const] : isService ? ['booking' as const, 'quote' as const] : ['products' as const];

        const blueprint = defaultBlueprint(models);
        const built = buildSite({
          title: current.workspace.name,
          brief: { goal: `${current.workspace.name} online`, audience: inheritedTrade, tone: '' },
          facts: {},
          blueprint,
          assets: [],
        });
        const initialDoc = built.doc;
        if (inheritedBrief.length) {
          initialDoc.brief = { ...initialDoc.brief, bullets: inheritedBrief, accepted: inheritedBrief };
        }

        const siteId = `site_${crypto.randomUUID()}`;
        const at = Date.now();
        await client.batch([
          { sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES(?,'site',?,'draft',?,?,1,?,?)", args: [siteId, current.workspace.name, JSON.stringify(initialDoc), current.identity.id, at, at] },
        ], 'write');
        siteRows = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: "SELECT * FROM records WHERE id=? LIMIT 1", args: [siteId] }));
      }
      const row = siteRows[0];
      const publication = await env.CONTROL.withSession('first-primary').prepare('SELECT domain,mode,release,status FROM sites WHERE workspace=? AND site=?')
        .bind(current.workspace.id, String(row.id)).first<{ domain: string; mode: string; release: string; status: string }>();
      const stored = object(typeof row.data === 'string' ? JSON.parse(String(row.data)) : row.data);
      const { doc } = readDocument(stored);
      const history = Array.isArray((stored as { history?: unknown[] }).history) ? (stored as { history: unknown[] }).history : [];
      const designMarkdown = exportDesign(doc.design);
      let previewHtml = '';
      try {
        const compiled = await compileDocument(doc);
        const html = String(compiled.files.find((f) => f.path === '/index.html')?.body || '');
        const css = String(compiled.files.find((f) => f.path === '/style.css')?.body || '');
        previewHtml = html.replace('</head>', `<style>${css}</style></head>`);
      } catch { /* fallback */ }
      return response({ site: { id: String(row.id), version: Number(row.version), state: String(row.state), data: doc },
        schema: '2.0.0',
        history,
        designMarkdown,
        html: previewHtml,
        publicUrl: publication?.status === 'active' ? `https://${publication.domain}${publication.mode === 'path' ? `/${slug}` : ''}` : null,
        liveRelease: publication?.status === 'active' ? publication.release : null,
        publicationState: publication?.status || null });
    }
    if (request.method === 'GET' && nested === 'records') {
      const type = url.searchParams.get('type');
      const search = (url.searchParams.get('q') || '').trim();
      const offset = Number(url.searchParams.get('offset') || 0);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw badRequest('Invalid record page.');
      if (search.length > 120) throw badRequest('Record search is too long.');
      if (current.member.role === 'guest' && type?.startsWith('pos.')) throw forbidden();
      const rows = await Effect.runPromise(query<Record<string, unknown>>(client, type
        ? { sql: "SELECT * FROM records WHERE type=? AND archived IS NULL AND (?='' OR instr(lower(title),lower(?))>0 OR instr(lower(data),lower(?))>0) ORDER BY updated DESC,id LIMIT 101 OFFSET ?", args: [type, search, search, search, offset] }
        : { sql: "SELECT * FROM records WHERE archived IS NULL AND (?='' OR instr(lower(title),lower(?))>0 OR instr(lower(data),lower(?))>0) ORDER BY updated DESC,id LIMIT 101 OFFSET ?", args: [search, search, search, offset] }));
      return response({ records: rows.slice(0, 100).map(record).filter((item) => canReadRecord(current.member, item)), next: rows.length > 100 ? offset + 100 : null });
    }
    const recordMatch = /^records\/([A-Za-z0-9_-]+)$/.exec(nested);
    if (request.method === 'GET' && recordMatch) {
      const found = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: 'SELECT * FROM records WHERE id=? AND archived IS NULL', args: [recordMatch[1]] }));
      if (!found[0]) throw notFound('Record not found.');
      const item = record(found[0]);
      if (!canReadRecord(current.member, item)) throw forbidden();
      return response({ record: item });
    }
    if (request.method === 'GET' && nested === 'contacts') {
      const offset = Number(url.searchParams.get('offset') || 0);
      return response(await searchContacts(client, current.member, url.searchParams.get('q') || '', offset));
    }
    const linksMatch = /^records\/([A-Za-z0-9_-]+)\/links$/.exec(nested);
    if (request.method === 'GET' && linksMatch) {
      const id = decodeURIComponent(linksMatch[1]);
      const found = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: 'SELECT * FROM records WHERE id=? AND archived IS NULL', args: [id] }));
      if (!found[0]) throw notFound('Record not found.');
      if (!canReadRecord(current.member, record(found[0]))) throw forbidden();
      const rows = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: `SELECT l.id,l.source,l.target,l.role,l.since,l.until,
        CASE WHEN l.source=? THEN target.id ELSE source.id END AS otherid,
        CASE WHEN l.source=? THEN target.type ELSE source.type END AS othertype,
        CASE WHEN l.source=? THEN target.title ELSE source.title END AS othername,
        CASE WHEN l.source=? THEN target.data ELSE source.data END AS otherdata,
        CASE WHEN l.source=? THEN target.assignee ELSE source.assignee END AS otherassignee
        FROM links l JOIN records source ON source.id=l.source AND source.archived IS NULL JOIN records target ON target.id=l.target AND target.archived IS NULL
        WHERE l.source=? OR l.target=? ORDER BY COALESCE(l.since,l.created) DESC`, args: [id, id, id, id, id, id, id] }));
      const visible = rows.filter((item) => canReadRecord(current.member, { type: String(item.othertype), data: object(JSON.parse(String(item.otherdata))), assignee: typeof item.otherassignee === 'string' ? item.otherassignee : null }));
      return response({ links: visible.map((item) => ({ id: String(item.id), role: String(item.role), since: item.since === null ? null : Number(item.since), until: item.until === null ? null : Number(item.until), other: { id: String(item.otherid), type: String(item.othertype), name: String(item.othername) } })) });
    }
    const consentMatch = /^records\/([A-Za-z0-9_-]+)\/consents$/.exec(nested);
    if (request.method === 'GET' && consentMatch) {
      if (current.member.role === 'guest') throw forbidden();
      const id = consentMatch[1];
      const found = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: "SELECT * FROM records WHERE id=? AND type IN ('person','organization') AND archived IS NULL", args: [id] }));
      if (!found[0]) throw notFound('Contact not found.');
      if (!canReadRecord(current.member, record(found[0]))) throw forbidden();
      const rows = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: 'SELECT id,contact,channel,purpose,state,source,actor,created FROM consents WHERE contact=? ORDER BY created DESC,id DESC LIMIT 100', args: [id] }));
      return response({ consents: rows.map((item) => ({ id: String(item.id), contact: String(item.contact), channel: String(item.channel), purpose: String(item.purpose), state: String(item.state), source: String(item.source), actor: String(item.actor), created: Number(item.created) })) });
    }
    if (request.method === 'GET' && nested === 'skills') return response({ skills: await listSkills(client) });
    if (request.method === 'POST' && nested === 'deck') {
      const body = await Effect.runPromise(parseJson(request));
      const tools = (Array.isArray(body.tools) ? body.tools : []).map(String).filter((id) => Boolean(findTool(id)) && !findTool(id)!.deferred);
      await client.batch([deckStatement(tools as typeof import('./tools/registry.ts').TOOL_IDS[number][])], 'write');
      return response({ deck: tools });
    }
    const toolRows = /^tool\/([a-z]+)\/rows$/.exec(nested);
    if (request.method === 'GET' && toolRows) {
      const tool = findTool(toolRows[1]);
      if (!tool || !tool.rowType) throw notFound('Tool rows not found.');
      const search = (url.searchParams.get('q') || '').trim().toLowerCase();
      const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
      const rows = await Effect.runPromise(query<Record<string, unknown>>(client, {
        sql: "SELECT id,type,title,state,data,version,created,updated FROM records WHERE type=? AND archived IS NULL AND (?='' OR instr(lower(title),lower(?))>0) ORDER BY updated DESC LIMIT 51 OFFSET ?",
        args: [tool.rowType, search, search, offset],
      }));
      let visible = rows.slice(0, 50).map((row) => ({ id: String(row.id), type: String(row.type), title: String(row.title), state: String(row.state), data: object(typeof row.data === 'string' ? JSON.parse(String(row.data)) : row.data), assignee: null, version: Number(row.version), updatedAt: Number(row.updated) }))
        .filter((row) => canReadRecord(current.member, row));
      if (tool.id === 'catalog' && visible.length) {
        // the sale needs the sellable variant under each item
        const variants = await Effect.runPromise(query<Record<string, unknown>>(client, {
          sql: "SELECT json_extract(data,'$.item') AS item, id FROM records WHERE type='variant' AND archived IS NULL",
        }));
        const byItem = new Map<string, string>();
        for (const row of variants) byItem.set(String(row.item), String(row.id));
        visible = visible.map((row) => ({ ...row, data: { ...row.data, variantId: byItem.get(row.id) ?? null } }));
      }
      return response({ tool: tool.id, rows: visible, next: rows.length > 50 ? offset + 50 : null });
    }
    if (request.method === 'GET' && nested === 'runs') return response({ runs: await listRuns(client) });
    const runPost = /^runs\/([A-Za-z0-9_-]+)\/advance$/.exec(nested);
    if (request.method === 'POST' && runPost) {
      const body = await Effect.runPromise(parseJson(request));
      const skill = await findSkill(client, runPost[1]);
      if (skill) {
        const run = await startRun(client, current, skill, request.headers.get('Idempotency-Key') || `run-${crypto.randomUUID()}`);
        return response({ run }, 201);
      }
      const view = await advanceRun(client, current, runPost[1], {
        execute: async (actionId, input, key) => Effect.runPromise(executeGateway(client, current, { actionId: actionId as GatewayRequest['actionId'], idempotencyKey: key, input }, { productContent: env.PRODUCT_CONTENT, siteReleases: env.SITE_RELEASES, publication: env.CONTROL, siteDomain: env.SITE_WORKER_ORIGIN || env.SITE_BASE_DOMAIN, ai: env.AI, typesafe: env.TYPESAFE_API_KEY, siteModel: env.SITE_MODEL, groqApiKey: env.GROQ_API_KEY, pexelsApiKey: env.PEXELS_API_KEY })),
      }, object(body.input));
      return response({ run: view });
    }
    const actionMatch = /^actions\/([A-Za-z0-9_.-]+)$/.exec(nested);
    if (request.method === 'POST' && actionMatch) {
      const key = request.headers.get('Idempotency-Key') || ''; const input = await Effect.runPromise(parseJson(request));
      const registered = findAction(actionMatch[1]);
      const actionId = (registered?.id || actionMatch[1]) as GatewayRequest['actionId'];
      const action = { actionId, idempotencyKey: key, input };
      const result = await Effect.runPromise(executeGateway(client, current, action, { productContent: env.PRODUCT_CONTENT, siteReleases: env.SITE_RELEASES, publication: env.CONTROL, siteDomain: env.SITE_WORKER_ORIGIN || env.SITE_BASE_DOMAIN, ai: env.AI, typesafe: env.TYPESAFE_API_KEY, siteModel: env.SITE_MODEL, groqApiKey: env.GROQ_API_KEY, pexelsApiKey: env.PEXELS_API_KEY }));
      return response(result, 201);
    }
    throw notFound('Route not found.');
  });
}

export default {
  fetch(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> { return handle(request, env, ctx).catch(errorResponse); },
  async scheduled(_controller: ScheduledController, env: RuntimeEnv): Promise<void> {
    await scoutPublishedSites(env);
    await regenerateDriftedSites(env);
    await env.CONTROL.prepare('DELETE FROM previews WHERE expires<=?').bind(Date.now()).run();
  },
} satisfies ExportedHandler<RuntimeEnv>;
