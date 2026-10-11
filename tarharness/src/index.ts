import { Effect } from 'effect';
import type { Client } from '@libsql/client/web';
import { verifyGoogleIdentity } from './auth/google.ts';
import { ControlStore } from './db/control.ts';
import { ensureNowDatabase, mintNowSyncToken, openWorkspaceDatabase, provisionWorkspaceDatabase, query } from './db/turso.ts';
import { executeGateway, type GatewayRequest } from './gateway/actions.ts';
import { HarnessError, badRequest, forbidden, notFound, unavailable } from './errors.ts';
import type { AccessContext, RecordItem } from './types.ts';
import { actionCatalog, interfaceCatalog } from './registry/catalog.ts';
import { moduleForAction, readCapabilities, readWorkspaceTools } from './registry/tools.ts';
import { buildWorkspaceCanvas } from './registry/canvas.ts';
import { posSummary, readPos } from './pos/store.ts';
import { readProductContent } from './pos/content.ts';
import { serveSitePreview } from './site/preview.ts';
import { readDocument } from './site/adapt.ts';
import { buildSite, defaultSite } from './site/build.ts';
import { defaultBlueprint } from './site/blueprint.ts';
import { exportDesign } from './site/design.ts';
import { compileDocument } from './site/compile.ts';
import { canExecute, canReadRecord, canRunFlowStep, canUseWorkRole, isCook, managesMembers, workRoleNames } from './access.ts';
import { inviteMember, listMembers, updateMember } from './team.ts';
import { providers, providerStatus, verifyEvent, chatResponse, type ChannelEnv, type Provider } from './channels/providers.ts';
import { beginLink, channelState, confirmLink, disconnect, proveLink, resolveSender } from './channels/store.ts';
import { enqueueCommand, processCommand } from './channels/jobs.ts';
import { searchContacts } from './contacts/search.ts';
import { acceptFlowRequest, sweepFlowDispatches } from './flows/dispatch.ts';
import { resolveContext, routineFromRecord } from './space/context.ts';
import { buildSpaceView, readInboxSource } from './space/view.ts';
import { authorityKey, ensureNowSchema, projectNow, readNow, replaceSource, retractMissing, retractSource } from './inbox/now.ts';
import { nextInTie } from './inbox/rank.ts';
import { evaluateMemberAccess, suggestCapabilities, suggestMember, type MemberAccessResult, type ToolAccessEvaluation } from './brain/workspace-ai.ts';
import { matchFlowSteps, type FlowMatchResult, type FlowStepMatch } from './brain/jev.ts';
import { canonicalTools } from './registry/tools.ts';
export { FlowWorkflow } from './flows/workflow.ts';

type RuntimeEnv = Env & ChannelEnv & { readonly TURSO_PLATFORM_TOKEN?: string; readonly TINYFISH_API_KEY?: string; readonly TYPESAFE_API_KEY?: string; readonly GROQ_API_KEY?: string; readonly PEXELS_API_KEY?: string; readonly SITE_BASE_DOMAIN?: string; readonly SITE_WORKER_ORIGIN?: string; readonly SITE_MODEL?: string };
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
async function withNowDatabase<A>(env: RuntimeEnv, user: string, work: (client: Client) => Promise<A>): Promise<A> {
  const database = await ensureNowDatabase(tursoEnv(env), user);
  const client = await Effect.runPromise(openWorkspaceDatabase(tursoEnv(env), database.Name, database.Hostname));
  try { return await work(client); } finally { client.close(); }
}

// The scout audits a published site at most once a day. CONTROL holds the last
// audit time so the background fan-out never opens a workspace database that is
// not due; the run only drafts a revision and files a Space item, never publishes.
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

async function routines(env: RuntimeEnv, accesses: readonly AccessContext[]) {
  const personal = accesses.find((item) => item.workspace.mode === 'personal');
  if (!personal) return [];
  return withWorkspace(env, personal, async (client) => {
    const rows = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: "SELECT id,data FROM records WHERE type='routine' AND state='active' AND archived IS NULL ORDER BY updated DESC" }));
    return rows.map((row) => routineFromRecord({ id: String(row.id), data: object(JSON.parse(String(row.data))) })).filter((item): item is NonNullable<typeof item> => Boolean(item));
  });
}

async function spaceResponse(request: Request, env: RuntimeEnv, url: URL) {
  const { value, control, accesses } = await activeAccesses(request, env);
  if (!accesses.length) throw notFound('No active workspace is available.');
  const saved = await Effect.runPromise(control.context(value.id));
  const requested = (url.searchParams.get('scope') || '').trim();
  if (requested && !accesses.some((item) => item.workspace.id === requested || item.workspace.slug === requested)) throw forbidden();
  const hold = saved?.mode === 'hold' && accesses.some((item) => item.workspace.id === saved.workspace) ? saved.workspace : undefined;
  const override = hold || requested;
  const zone = (url.searchParams.get('zone') || 'Asia/Kolkata').slice(0, 80);
  const suppliedAt = Number(url.searchParams.get('at') || Date.now());
  const at = Number.isSafeInteger(suppliedAt) && Math.abs(suppliedAt - Date.now()) < 86_400_000 ? suppliedAt : Date.now();
  const decision = resolveContext(accesses, override ? [] : await routines(env, accesses), { at, zone, override, role: hold ? saved?.role || undefined : undefined, held: Boolean(hold) });
  const selected = accesses.find((item) => item.workspace.id === decision.context.workspace.id);
  if (!selected) throw notFound('Space context is no longer available.');
  return withWorkspace(env, selected, (client) => buildSpaceView(client, selected, decision));
}

async function inboxResponse(request: Request, env: RuntimeEnv) {
  const { value, control, accesses } = await activeAccesses(request, env);
  const personal = accesses.find((current) => current.workspace.mode === 'personal');
  if (!personal) throw notFound('Personal Inbox is unavailable.');
  const saved = await Effect.runPromise(control.context(value.id));
  const hold = saved?.mode === 'hold' && accesses.some((current) => current.workspace.id === saved.workspace) ? saved.workspace : undefined;
  const parameters = new URL(request.url).searchParams;
  const zone = (parameters.get('zone') || 'UTC').slice(0, 80);
  const refresh = parameters.get('refresh');
  const decision = resolveContext(accesses, hold ? [] : await routines(env, accesses), {
    at: Date.now(), zone, override: hold, role: hold ? saved?.role || undefined : undefined, held: Boolean(hold),
  });
  const finish = async (projection: Awaited<ReturnType<typeof readNow>>, failed: string[]) => ({
    ...projection, partial: failed.length > 0, failed,
    grants: Object.fromEntries(accesses.map((current) => [current.workspace.id, authorityKey(current)])),
    next: failed.length || decision.decision === 'confirm' ? null : await nextInTie(projection.rows, decision.context, env.TYPESAFE_API_KEY),
    context: decision.context, decision: decision.decision, alternatives: decision.alternatives,
    sources: accesses.map((current) => ({ id: current.workspace.id, name: current.workspace.mode === 'personal' ? 'Personal' : current.workspace.name,
      slug: current.workspace.slug, mode: current.workspace.mode, role: current.member.workRole, owner: current.workspace.ownerName || 'You' })),
  });
  return withNowDatabase(env, value.id, async (client) => {
    await ensureNowSchema(client);
    await retractMissing(client, new Set(accesses.map((current) => current.workspace.id)));
    const previous = await readNow(client, accesses);
    const stale = accesses.filter((current) => refresh === current.workspace.id || refresh === current.workspace.slug
      || !previous.sync[current.workspace.id]
      || previous.authority[current.workspace.id] !== authorityKey(current)
      || Date.now() - previous.sync[current.workspace.id] > 60_000);
    if (!stale.length) return finish(previous, []);
    const settled = await Promise.allSettled(stale.map((current) => withWorkspace(env, current, (source) => readInboxSource(source, current))));
    const failed: string[] = [];
    for (const [index, result] of settled.entries()) {
      const source = stale[index].workspace.id;
      if (result.status === 'rejected') {
        failed.push(source);
        console.error(JSON.stringify({ event: 'inbox.source.failed', workspace: source, error: result.reason instanceof Error ? result.reason.message.slice(0, 300) : String(result.reason).slice(0, 300) }));
        continue;
      }
      try { await replaceSource(client, source, projectNow(result.value, value.id), authorityKey(stale[index])); }
      catch (error) {
        failed.push(source);
        console.error(JSON.stringify({ event: 'inbox.projection.failed', workspace: source, error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) }));
      }
    }
    const projection = await readNow(client, accesses);
    return finish(projection, failed);
  });
}

async function enqueueInboxSync(env: RuntimeEnv, workspace: string): Promise<void> {
  const members = await env.CONTROL.prepare("SELECT user_id FROM members WHERE workspace_id=? AND state='active'").bind(workspace).all<{ user_id: string }>();
  for (let offset = 0; offset < members.results.length; offset += 100) {
    await env.OUTBOX.sendBatch(members.results.slice(offset, offset + 100).map((member) => ({
      body: { kind: 'inbox.sync', workspace, user: member.user_id },
    })));
  }
}

async function syncMemberInbox(env: RuntimeEnv, workspace: string, user: string): Promise<void> {
  const person = await env.CONTROL.prepare('SELECT id,email,name FROM users WHERE id=?').bind(user).first<{ id: string; email: string; name: string | null }>();
  if (!person) return;
  const accesses = await Effect.runPromise(new ControlStore(env.CONTROL).listAccess(person));
  const personal = accesses.find((current) => current.workspace.mode === 'personal');
  if (!personal) return;
  const source = accesses.find((current) => current.workspace.id === workspace);
  const entries = source ? await withWorkspace(env, source, async (client) => projectNow(await readInboxSource(client, source), user)) : null;
  await withNowDatabase(env, user, async (client) => {
    await ensureNowSchema(client);
    if (entries && source) await replaceSource(client, workspace, entries, authorityKey(source));
    else await retractSource(client, workspace);
  });
}

async function createWorkspace(request: Request, env: RuntimeEnv): Promise<Response> {
  const { value: owner, control } = await identity(request, env);
  const body = await Effect.runPromise(parseJson(request));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const slug = cleanSlug(typeof body.slug === 'string' ? body.slug : name);
  if (!name || !slug) throw badRequest('Workspace name is required.');
  const databaseName = `${identityKey(owner.id)}-${slug}`.slice(0, 56);
  const input = { identity: owner, name, slug, databaseName, mode: 'work' as const };
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
      ], 'write');
    } finally {
      client.close();
    }
  } catch (err) {
    console.error('Initial site draft auto-generation note:', err);
  }
  return response({ workspace: { ...pending, databaseHost: undefined, state: 'active' } }, 201);
}

async function listDefinitions(client: Client) {
  const rows = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: 'SELECT id,kind,name,version,state,data FROM definitions WHERE state != \'archived\' ORDER BY updated_at DESC' }));
  return rows.map((item) => ({ id: String(item.id), kind: String(item.kind), name: String(item.name), version: Number(item.version), state: String(item.state), data: object(JSON.parse(String(item.data))) }));
}

async function workspaceCanvas(client: Client, member: AccessContext['member']) {
  if (isCook(member)) return [{ id: 'kitchen', kind: 'data', title: 'Kitchen', display: 'value', value: 'Open Now', caption: 'Prepare assigned orders in Now' }];
  const [definitions, counts] = await Promise.all([
    listDefinitions(client),
    Effect.runPromise(query<Record<string, unknown>>(client, { sql: `SELECT COUNT(*) AS records,
      SUM(CASE WHEN type='task' AND state='open' THEN 1 ELSE 0 END) AS open_tasks,
      SUM(CASE WHEN type LIKE 'pos.%' THEN 1 ELSE 0 END) AS pos_records
      FROM records WHERE archived IS NULL` })),
  ]);
  const count = counts[0] || {};
  const pos = Number(count.pos_records || 0) ? await posSummary(client) : undefined;
  return buildWorkspaceCanvas(definitions, { records: Number(count.records || 0), openTasks: Number(count.open_tasks || 0), pos }, member.role)
    .filter((card) => card.kind === 'data' ? member.workRole !== 'cashier' || !['pos-sales','records-total'].includes(card.id)
      : canExecute(member, card.kind === 'action' ? card.actionId : card.actionId || 'flow.start'));
}

async function channelRequest(request: Request, env: RuntimeEnv, provider: Provider, ctx: ExecutionContext) {
  const verified = await verifyEvent(request, provider, env);
  if (verified.ping) return Response.json({ type: 1 });
  const event = verified.event!;
  if (!event.userId || !event.tenantId || !event.channelId || !event.eventId) throw badRequest('A team channel and verified sender are required.');
  try {
    const link = /^link\s+([a-f0-9]{32})$/i.exec(event.text.trim());
    if (link) return chatResponse(provider, await proveLink(env.CONTROL, event, link[1]), event.userId);
    const sender = await resolveSender(env.CONTROL, event);
    const current = await Effect.runPromise(new ControlStore(env.CONTROL).access(sender.identity, sender.slug));
    if (/^(help|hi|hello)?$/i.test(event.text.trim())) return chatResponse(provider, 'Use TAR Now for your work. Commands: done <task-id>, start <order-id> <product-id>, ready <order-id> <product-id>. Your TAR role applies here.', event.userId);
    if (event.text.trim().toLowerCase() === 'status') {
      const result = await env.CONTROL.prepare('SELECT state,result FROM channel_commands WHERE workspace_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1').bind(current.workspace.id, current.identity.id).first<{ state: string; result: string | null }>();
      return chatResponse(provider, result ? `${result.state}: ${result.result || 'Your request is being processed.'}` : 'No chat requests yet.', event.userId);
    }
    const id = await enqueueCommand(env.CONTROL, current, event);
    ctx.waitUntil(env.OUTBOX.send({ kind: 'chat.command', id }).catch(() => { console.error(JSON.stringify({ event: 'chat.queue.unavailable', id })); }));
    return chatResponse(provider, 'Request saved. Use “status” to check the result, or open TAR → Members & chat.', event.userId);
  } catch (error) {
    // Never post business payloads, provider roles, or private details to the room.
    const message = error instanceof HarnessError ? error.message : 'Could not complete this request. Check TAR before trying again.';
    return chatResponse(provider, message, event.userId);
  }
}

async function handle(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const url = new URL(request.url); const path = url.pathname;
  const channelMatch = /^\/v1\/channels\/(slack|discord|google-chat)\/events$/.exec(path);
  if (request.method === 'POST' && channelMatch) return channelRequest(request, env, channelMatch[1] as Provider, ctx);
  if (request.method === 'GET' && path === '/health') return response({ ok: true, service: 'tarharness', now: new Date().toISOString(), tursoProvisioning: Boolean(env.TURSO_PLATFORM_TOKEN && env.TURSO_ORG && !env.TURSO_ORG.startsWith('REPLACE_')) });
  if (request.method === 'GET' && path === '/v1/actions') return response({ actions: actionCatalog.filter((action) => action.id !== 'flow.suggest' || Boolean(env.TYPESAFE_API_KEY)), interfaces: interfaceCatalog });
  const previewMatch = /^\/v1\/site-previews\/([a-f0-9-]{36})(\/.*)?$/.exec(path);
  if (request.method === 'GET' && previewMatch) return serveSitePreview(previewMatch[1], previewMatch[2] || '/', env.CONTROL, env.SITE_RELEASES, siteSecurityHeaders, {
    frame: url.searchParams.get('frame'),
    embed: url.searchParams.get('embed') === '1',
  });
  if (request.method === 'GET' && path === '/v1/space') return response(await spaceResponse(request, env, url));
  if (request.method === 'GET' && (path === '/v1/inbox/sync' || path === '/v1/inbox/replica')) {
    const { value, accesses } = await activeAccesses(request, env);
    const personal = accesses.find((current) => current.workspace.mode === 'personal');
    if (!personal) throw notFound('Personal Now database is unavailable.');
    await withNowDatabase(env, value.id, async (client) => {
      await ensureNowSchema(client);
      const grants = new Map(accesses.map((current) => [current.workspace.id, authorityKey(current)]));
      await retractMissing(client, new Set(grants.keys()));
      const projections = await client.execute('SELECT source,authority FROM projection');
      for (const projection of projections.rows) {
        const source = String(projection.source);
        if (String(projection.authority) !== grants.get(source)) await retractSource(client, source);
      }
    });
    const database = await ensureNowDatabase(tursoEnv(env), value.id);
    const authToken = await mintNowSyncToken(tursoEnv(env), database.Name);
    return response({ url: `libsql://${database.Hostname}`, authToken,
      expiresAt: Date.now() + 9 * 60_000, database: personal.workspace.id }, 200, { 'Cache-Control': 'no-store' });
  }
  if (request.method === 'GET' && path === '/v1/inbox') return response(await inboxResponse(request, env));
  if (request.method === 'PUT' && path === '/v1/context') {
    const { value, control, accesses } = await activeAccesses(request, env);
    const body = await Effect.runPromise(parseJson(request));
    const mode = body.mode === 'auto' ? 'auto' : body.mode === 'hold' ? 'hold' : null;
    if (!mode) throw badRequest('Context mode must be auto or hold.');
    const selected = mode === 'hold' ? accesses.find((item) => item.workspace.slug === body.scope || item.workspace.id === body.scope) : accesses[0];
    if (!selected) throw forbidden();
    const role = mode === 'hold' && typeof body.role === 'string' ? body.role.trim() : '';
    if (role.length > 80 || /[\u0000-\u001f\u007f]/.test(role)) throw badRequest('Choose a valid role.');
    if (role && selected.member.role === 'member') {
      const normalize = (value: string) => ['chef', 'cook', 'kitchen'].includes(value.trim().toLowerCase()) ? 'kitchen' : value.trim().toLowerCase();
      const grants = selected.member.roles?.length ? selected.member.roles : [selected.member.workRole || 'general'];
      if (!grants.some((grant) => normalize(grant) === normalize(role))) throw badRequest('Choose a work role granted in that workspace.');
    }
    const duration = typeof body.duration === 'number' && Number.isSafeInteger(body.duration) ? Math.min(Math.max(body.duration, 900_000), 604_800_000) : 43_200_000;
    await Effect.runPromise(control.saveContext(value.id, selected.workspace.id, mode, mode === 'hold' ? Date.now() + duration : null, role || null));
    return response({ context: { mode, scope: mode === 'hold' ? selected.workspace.slug : null, role: role || null, expires: mode === 'hold' ? Date.now() + duration : null } });
  }
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
  if (request.method === 'POST' && path === '/v1/ai/workspace-suggest') {
    await identity(request, env);
    const body = await Effect.runPromise(parseJson(request));
    const brief = typeof body.brief === 'string' ? body.brief : '';
    return response(await suggestCapabilities(env.TYPESAFE_API_KEY, brief));
  }
  const publicSiteMatch = /^\/v1\/sites\/([a-z0-9-]+)(\/.*)?$/.exec(path);
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
          { sql: 'DELETE FROM events' },
          { sql: 'DELETE FROM definitions' },
          { sql: 'DELETE FROM runs' },
        ], 'write');
      } catch { /* proceed */ }
    });
    await env.CONTROL.batch([
      env.CONTROL.prepare('DELETE FROM sites WHERE workspace=?').bind(current.workspace.id),
      env.CONTROL.prepare('DELETE FROM channel_commands WHERE workspace_id=?').bind(current.workspace.id),
      env.CONTROL.prepare('DELETE FROM channel_identities WHERE workspace_id=?').bind(current.workspace.id),
      env.CONTROL.prepare('DELETE FROM channel_link_requests WHERE workspace_id=?').bind(current.workspace.id),
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
  if (request.method === 'POST' && nested === 'ai/member-suggest') {
    const body = await Effect.runPromise(parseJson(request));
    const duties = typeof body.duties === 'string' ? body.duties : '';
    return response(await suggestMember(env.TYPESAFE_API_KEY, duties));
  }
  if (request.method === 'POST' && nested === 'ai/member-access') {
    const body = await Effect.runPromise(parseJson(request));
    const brief = typeof body.brief === 'string' ? body.brief : '';
    let cachedResult: MemberAccessResult | null = null;
    if (brief.trim()) {
      try {
        await withWorkspace(env, current, async (client) => {
          const cached = await client.execute({
            sql: "SELECT answers, model FROM assessments WHERE kind='access' AND evidence=? AND expires>? ORDER BY created DESC LIMIT 1",
            args: [brief.trim(), Date.now()],
          });
          if (cached.rows.length > 0) {
            const evals = JSON.parse(String(cached.rows[0].answers)) as ToolAccessEvaluation[];
            const suggestedAccess = evals.filter((item) => item.on).map((item) => item.id);
            cachedResult = {
              brief: brief.trim(),
              evaluations: evals,
              suggestedAccess,
              model: String(cached.rows[0].model),
              review: true,
            };
          }
        });
      } catch { /* proceed */ }
    }
    if (cachedResult) return response(cachedResult);
    const result = await evaluateMemberAccess(env.TYPESAFE_API_KEY, brief, canonicalTools);
    ctx.waitUntil(withWorkspace(env, current, async (client) => {
      try {
        await client.execute({
          sql: `INSERT INTO assessments(id, kind, evidence, questions, answers, model, expires, created)
                VALUES(?, 'access', ?, ?, ?, ?, ?, ?)`,
          args: [
            crypto.randomUUID(),
            brief.trim(),
            JSON.stringify(canonicalTools.map((t) => ({ id: t.id, description: t.description }))),
            JSON.stringify(result.evaluations),
            result.model || 'heuristic',
            Date.now() + 86400000,
            Date.now(),
          ],
        });
      } catch (err) {
        console.error(JSON.stringify({ event: 'assessment.cache.failed', error: String(err) }));
      }
    }));
    return response(result);
  }
  if (request.method === 'POST' && nested === 'ai/flow-match') {
    const body = await Effect.runPromise(parseJson(request));
    let lines: string[] = [];
    if (Array.isArray(body.steps)) lines = body.steps.map(String);
    else if (Array.isArray(body.lines)) lines = body.lines.map(String);
    else if (typeof body.text === 'string') lines = body.text.split('\n');
    lines = lines.map((l) => l.trim()).filter((l) => l.length > 0);
    const evidenceKey = lines.join('\n');
    let cachedFlowResult: FlowMatchResult | null = null;
    if (lines.length > 0) {
      try {
        await withWorkspace(env, current, async (client) => {
          const cached = await client.execute({
            sql: "SELECT answers, model FROM assessments WHERE kind='flow' AND evidence=? AND expires>? ORDER BY created DESC LIMIT 1",
            args: [evidenceKey, Date.now()],
          });
          if (cached.rows.length > 0) {
            const steps = JSON.parse(String(cached.rows[0].answers)) as FlowStepMatch[];
            cachedFlowResult = {
              steps,
              model: String(cached.rows[0].model),
              review: true,
            };
          }
        });
      } catch { /* proceed */ }
    }
    if (cachedFlowResult) return response(cachedFlowResult);
    const result = await matchFlowSteps(env.TYPESAFE_API_KEY, lines, canonicalTools);
    ctx.waitUntil(withWorkspace(env, current, async (client) => {
      try {
        await client.execute({
          sql: `INSERT INTO assessments(id, kind, evidence, questions, answers, model, expires, created)
                VALUES(?, 'flow', ?, ?, ?, ?, ?, ?)`,
          args: [
            crypto.randomUUID(),
            evidenceKey,
            JSON.stringify(lines),
            JSON.stringify(result.steps),
            result.model || 'heuristic',
            Date.now() + 86400000,
            Date.now(),
          ],
        });
      } catch (err) {
        console.error(JSON.stringify({ event: 'assessment.cache.failed', error: String(err) }));
      }
    }));
    return response(result);
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
    ctx.waitUntil(syncMemberInbox(env, current.workspace.id, user).catch((error) => console.error(JSON.stringify({ event: 'inbox.member.sync.failed', error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) }))));
    return response(result);
  }
  if (request.method === 'GET' && nested === 'team-chat') return response({ ...await channelState(env.CONTROL, current), providers: providerStatus(env), canManage: managesMembers(current.member), role: current.member.role, workRole: current.member.workRole || 'general' });
  if (request.method === 'POST' && nested === 'team-chat/link') {
    const body = await Effect.runPromise(parseJson(request)); const provider = body.provider as Provider;
    if (!providers.includes(provider)) throw badRequest('Choose Slack, Discord or Google Chat.');
    if (!providerStatus(env).find((item) => item.id === provider)?.configured) throw unavailable('Provider setup is required before linking.');
    return response(await beginLink(env.CONTROL, current, provider, String(body.purpose)), 201);
  }
  if (request.method === 'POST' && nested === 'team-chat/confirm') {
    const body = await Effect.runPromise(parseJson(request));
    return response(await confirmLink(env.CONTROL, current, String(body.id), body.joinUrl));
  }
  if (request.method === 'POST' && nested === 'team-chat/disconnect') {
    const body = await Effect.runPromise(parseJson(request));
    return response(await disconnect(env.CONTROL, current, body.destination === true));
  }
    if (request.method === 'GET' && nested === 'actions') return response({ actions: actionCatalog.filter((action) => canExecute(current.member, action.id)
      && (action.id !== 'flow.suggest' || Boolean(env.TYPESAFE_API_KEY))
      && (action.id !== 'web.search' || Boolean(env.TINYFISH_API_KEY)))
      .map((action) => ({ ...action, workRoles: workRoleNames.filter((role) => canUseWorkRole(role, action.id)) })), interfaces: interfaceCatalog });
  if (request.method === 'POST' && /^actions\/flow\.(start|advance)$/.test(nested)) {
    const key = request.headers.get('Idempotency-Key') || '';
    const input = await Effect.runPromise(parseJson(request));
    const actionId = nested.slice(8) as GatewayRequest['actionId'];
    const result = await acceptFlowRequest(env, current, { actionId, idempotencyKey: key, input });
    ctx.waitUntil(enqueueInboxSync(env, current.workspace.id).catch((error) => console.error(JSON.stringify({ event: 'inbox.queue.failed', error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) }))));
    return response(result, 201);
  }
  return withWorkspace(env, current, async (client) => {
    if (request.method === 'GET' && nested === 'tools') return response(await readWorkspaceTools(client, current, { search: Boolean(env.TINYFISH_API_KEY) }));
    const nowMatch = /^now\/(.+)$/.exec(nested);
    if (request.method === 'GET' && nowMatch) {
      const id = decodeURIComponent(nowMatch[1]);
      const source = await readInboxSource(client, current);
      const row = projectNow(source, current.identity.id).find((entry) => entry.id === id);
      if (!row) throw notFound('This work is no longer available. Refresh Now.');
      const item = [...source.tasks, ...source.orders, ...source.work].find((candidate) => candidate.id === row.target
        && (candidate.type !== 'pos.order' || candidate.data.projectionRole === row.role || candidate.data.projectionRole === undefined))
        || source.runs.filter((run) => run.id === row.target).map((run): RecordItem => ({ id: run.id, type: 'flow.run', title: run.title,
          state: run.state, data: { step: run.step + 1, flow: run.flow, parent: run.parent }, owner: null,
          assignee: current.identity.id, version: run.version, createdAt: run.updated, updatedAt: run.updated }))[0];
      if (!item) throw notFound('Source record not found.');
      return response({ row, record: item, workspace: source.workspace });
    }
    const productContentMatch = /^pos\/products\/([^/]+)\/content$/.exec(nested);
    if (request.method === 'GET' && productContentMatch) {
      if (isCook(current.member)) throw forbidden();
      if (current.member.role === 'guest') throw forbidden();
      return response({ content: await readProductContent(client, env.PRODUCT_CONTENT, current, decodeURIComponent(productContentMatch[1])) });
    }
    if (request.method === 'GET' && /^pos\/(overview|products|orders|customers)$/.test(nested)) {
      const offset = Number(url.searchParams.get('offset') || 0);
      if (!Number.isSafeInteger(offset) || offset < 0) throw badRequest('Invalid page.');
      if (current.member.role === 'guest') throw forbidden();
      return response(await readPos(client, current, nested.slice(4), url.searchParams.get('q') || '', offset));
    }
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
        const kind = isService ? 'services' : isFood ? 'food' : 'goods';

        const blueprint = defaultBlueprint(kind);
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
      const stored = object(typeof row.data === 'string' ? JSON.parse(row.data) : row.data);
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
      if (current.member.role === 'guest' || isCook(current.member)) throw forbidden();
      const id = consentMatch[1];
      const found = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: "SELECT * FROM records WHERE id=? AND type IN ('person','organization') AND archived IS NULL", args: [id] }));
      if (!found[0]) throw notFound('Contact not found.');
      if (!canReadRecord(current.member, record(found[0]))) throw forbidden();
      const rows = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: 'SELECT id,contact,channel,purpose,state,source,actor,created FROM consents WHERE contact=? ORDER BY created DESC,id DESC LIMIT 100', args: [id] }));
      return response({ consents: rows.map((item) => ({ id: String(item.id), contact: String(item.contact), channel: String(item.channel), purpose: String(item.purpose), state: String(item.state), source: String(item.source), actor: String(item.actor), created: Number(item.created) })) });
    }
    if (request.method === 'GET' && nested === 'flows') {
      const definitions = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: "SELECT id,name,version,state,data FROM definitions WHERE kind='flow' AND state='published' ORDER BY name COLLATE NOCASE" }));
      const runs = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: "SELECT * FROM runs WHERE state IN ('ready','blocked') ORDER BY updated_at DESC LIMIT 100" }));
      const enabled = (await readCapabilities(client)).enabled;
      const allBooks = definitions.map((item) => ({ id: String(item.id), name: String(item.name), version: Number(item.version), data: object(JSON.parse(String(item.data))) }))
        .filter((book) => {
          const actions = Array.isArray(book.data.actions) ? book.data.actions.map(object) : [];
          return actions.every((action) => { const module = moduleForAction(String(action.id || '')); return module === null || enabled[module]; });
        });
      const startable = allBooks.filter((book) => {
        const actions = Array.isArray(book.data.actions) ? book.data.actions.map(object) : [];
        return Boolean(actions[0] && canRunFlowStep(current.member, actions[0], current.identity.id));
      });
      const active = await Promise.all(runs.map(async (item) => {
        const context = object(JSON.parse(String(item.context)));
        const owner = String(context.startedBy || '');
        if (!(await runVisible(client, current.member, owner, item.record_id)) && !canContinueRun(current.member, context)) return null;
        const book = allBooks.find((candidate) => candidate.id === String(item.flow_id));
        if (!book) return null;
        return { id: String(item.id), flowId: String(item.flow_id), name: book.name, flowVersion: Number(item.flow_version), state: String(item.state), actionId: typeof item.action_id === 'string' ? item.action_id : null, recordId: typeof item.record_id === 'string' ? item.record_id : null, step: Number(context.step || 0), version: Number(item.version), updatedAt: Number(item.updated_at) };
      }));
      const visibleRuns = active.filter((item): item is NonNullable<typeof item> => item !== null);
      const visibleBookIds = new Set([...startable.map((book) => book.id), ...visibleRuns.map((run) => run.flowId)]);
      const books = allBooks.filter((book) => visibleBookIds.has(book.id));
      return response({ books, runs: visibleRuns });
    }
    const runMatch = /^runs\/([A-Za-z0-9_-]+)$/.exec(nested);
    if (request.method === 'GET' && runMatch) {
      const rows = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: 'SELECT * FROM runs WHERE id=?', args: [decodeURIComponent(runMatch[1])] }));
      const item = rows[0]; if (!item) throw notFound('Flow Book run not found.');
      const runContext = object(JSON.parse(String(item.context)));
      const owner = String(runContext.startedBy || '');
      if (!(await runVisible(client, current.member, owner, item.record_id)) && !canContinueRun(current.member, runContext)) throw forbidden();
      const full = owner === current.identity.id || managesMembers(current.member);
      const saved = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: 'SELECT id,action,occurrence,state,input,output,version,created,updated FROM steps WHERE run=? ORDER BY occurrence', args: [String(item.id)] }));
      const steps = saved.map((row) => ({ id: String(row.id), action: String(row.action), occurrence: Number(row.occurrence), state: String(row.state), input: full ? object(JSON.parse(String(row.input))) : {}, output: full && row.output !== null ? object(JSON.parse(String(row.output))) : null, version: Number(row.version), created: Number(row.created), updated: Number(row.updated) }));
      const visibleContext = full ? runContext : { source: runContext.source, step: runContext.step, actions: Array.isArray(runContext.actions) ? runContext.actions.map((entry) => { const action = object(entry); return { id: action.id, version: action.version, auto: action.auto, role: action.role }; }) : [] };
      return response({ run: { id: String(item.id), flowId: String(item.flow_id), flowVersion: Number(item.flow_version), state: String(item.state), actionId: typeof item.action_id === 'string' ? item.action_id : null, recordId: typeof item.record_id === 'string' ? item.record_id : null, context: visibleContext, version: Number(item.version), updatedAt: Number(item.updated_at), steps } });
    }
    if (request.method === 'GET' && nested === 'canvas') return response({ cards: await workspaceCanvas(client, current.member) });
    if (request.method === 'GET' && nested === 'definitions') return response({ definitions: await listDefinitions(client) });
    const actionMatch = /^actions\/([a-z.]+)$/.exec(nested);
    if (request.method === 'POST' && actionMatch) {
      const key = request.headers.get('Idempotency-Key') || ''; const input = await Effect.runPromise(parseJson(request));
      const actionId = actionMatch[1] as GatewayRequest['actionId'];
      if (actionId === 'routine.save') {
        const allowed = await Effect.runPromise(new ControlStore(env.CONTROL).listAccess(current.identity));
        const target = allowed.find((item) => item.workspace.id === input.workspace || item.workspace.slug === input.workspace);
        if (!target) throw badRequest('Choose a workspace you can access.');
        if (target.member.role === 'member' && typeof input.role === 'string' && input.role.trim()) {
          const normalize = (value: string) => ['chef', 'cook', 'kitchen'].includes(value.trim().toLowerCase()) ? 'kitchen' : value.trim().toLowerCase();
          const grants = target.member.roles?.length ? target.member.roles : [target.member.workRole || 'general'];
          if (!grants.some((role) => normalize(role) === normalize(input.role as string))) throw badRequest('Choose a work role granted in that workspace.');
        }
        input.workspace = target.workspace.slug;
      }
      const action = { actionId, idempotencyKey: key, input };
      const result = await Effect.runPromise(executeGateway(client, current, action, { productContent: env.PRODUCT_CONTENT, siteReleases: env.SITE_RELEASES, publication: env.CONTROL, siteDomain: env.SITE_WORKER_ORIGIN || env.SITE_BASE_DOMAIN, ai: env.AI, tinyfish: env.TINYFISH_API_KEY, typesafe: env.TYPESAFE_API_KEY, siteModel: env.SITE_MODEL, groqApiKey: env.GROQ_API_KEY, pexelsApiKey: env.PEXELS_API_KEY }));
      ctx.waitUntil(enqueueInboxSync(env, current.workspace.id).catch((error) => console.error(JSON.stringify({ event: 'inbox.queue.failed', error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) }))));
      return response(result, 201);
    }
    throw notFound('Route not found.');
  });
}

export default {
  fetch(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> { return handle(request, env, ctx).catch(errorResponse); },
  async queue(batch: MessageBatch<unknown>, env: RuntimeEnv): Promise<void> {
    for (const message of batch.messages) {
      const body = object(message.body);
      if (body.kind === 'inbox.sync' && typeof body.workspace === 'string' && typeof body.user === 'string') {
        try { await syncMemberInbox(env, body.workspace, body.user); message.ack(); }
        catch { message.retry({ delaySeconds: 60 }); }
        continue;
      }
      if (body.kind !== 'chat.command' || typeof body.id !== 'string') { message.ack(); continue; }
      try {
        await processCommand(env.CONTROL, body.id, (current, work) => withWorkspace(env, current, work), { productContent: env.PRODUCT_CONTENT, siteReleases: env.SITE_RELEASES, publication: env.CONTROL, siteDomain: env.SITE_WORKER_ORIGIN || env.SITE_BASE_DOMAIN, ai: env.AI, typesafe: env.TYPESAFE_API_KEY, siteModel: env.SITE_MODEL, groqApiKey: env.GROQ_API_KEY, pexelsApiKey: env.PEXELS_API_KEY });
        const completed = await env.CONTROL.prepare("SELECT workspace_id FROM channel_commands WHERE id=? AND state='completed'").bind(body.id).first<{ workspace_id: string }>();
        if (completed) await enqueueInboxSync(env, completed.workspace_id);
        message.ack();
      } catch { message.retry({ delaySeconds: 60 }); }
    }
  },
  async scheduled(_controller: ScheduledController, env: RuntimeEnv): Promise<void> {
    await sweepFlowDispatches(env);
    await scoutPublishedSites(env);
    await env.CONTROL.prepare('DELETE FROM previews WHERE expires<=?').bind(Date.now()).run();
    await env.CONTROL.prepare('DELETE FROM channel_link_requests WHERE expires_at<=?').bind(Date.now()).run();
    await env.CONTROL.prepare("UPDATE channel_commands SET state='failed',result='Processing interrupted. Check TAR before retrying.' WHERE state='processing' AND attempts>=5 AND due_at<=?").bind(Date.now()).run();
    const due = await env.CONTROL.prepare("SELECT id FROM channel_commands WHERE state IN ('pending','processing') AND due_at<=? AND attempts<5 ORDER BY due_at LIMIT 100").bind(Date.now()).all<{id: string}>();
    if (due.results.length) await env.OUTBOX.sendBatch(due.results.map((item) => ({ body: { kind: 'chat.command', id: item.id } })));
  },
} satisfies ExportedHandler<RuntimeEnv>;
