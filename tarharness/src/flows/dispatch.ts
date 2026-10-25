import type { Client } from '@libsql/client/web';
import { Effect } from 'effect';
import { ControlStore } from '../db/control.ts';
import { openWorkspaceDatabase } from '../db/turso.ts';
import { executeGateway, type GatewayRequest, type GatewayServices } from '../gateway/actions.ts';
import { fingerprint } from '../gateway/commit.ts';
import { HarnessError, conflict, unavailable } from '../errors.ts';
import type { AccessContext } from '../types.ts';

export type FlowEnv = Env & { readonly TURSO_PLATFORM_TOKEN?: string; readonly TINYFISH_API_KEY?: string; readonly TYPESAFE_API_KEY?: string };
type Dispatch = { id: string; workspace: string; actor: string; action: GatewayRequest['actionId']; token: string; hash: string; payload: string; run: string | null; instance: string | null; state: string; attempts: number; due: number };
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const services = (env: FlowEnv): GatewayServices => ({ productContent: env.PRODUCT_CONTENT, siteReleases: env.SITE_RELEASES, ai: env.AI, tinyfish: env.TINYFISH_API_KEY, typesafe: env.TYPESAFE_API_KEY });

export async function openFlowDatabase(env: FlowEnv, current: AccessContext): Promise<Client> {
  if (!env.TURSO_PLATFORM_TOKEN || !env.TURSO_ORG) throw unavailable('Workspace storage is not configured.');
  return Effect.runPromise(openWorkspaceDatabase({ TURSO_ORG: env.TURSO_ORG, TURSO_PLATFORM_TOKEN: env.TURSO_PLATFORM_TOKEN, TURSO_GROUP: env.TURSO_GROUP || 'default' }, current.workspace.databaseName, current.workspace.databaseHost!));
}

async function openWorkspaceById(env: FlowEnv, id: string): Promise<Client> {
  const row = await env.CONTROL.prepare("SELECT database_name AS name,database_host AS host FROM workspaces WHERE id=? AND state='active'").bind(id).first<{ name: string; host: string | null }>();
  if (!row?.host || !env.TURSO_PLATFORM_TOKEN) throw unavailable('Workspace storage is unavailable.');
  return Effect.runPromise(openWorkspaceDatabase({ TURSO_ORG: env.TURSO_ORG, TURSO_PLATFORM_TOKEN: env.TURSO_PLATFORM_TOKEN, TURSO_GROUP: env.TURSO_GROUP || 'default' }, row.name, row.host));
}

export async function blockFlowRun(env: FlowEnv, workspace: string, runId: string, reason: string): Promise<void> {
  const client = await openWorkspaceById(env, workspace);
  try {
    const found = await client.execute({ sql: 'SELECT context,version,state FROM runs WHERE id=?', args: [runId] });
    const row = found.rows[0];
    if (!row || row.state !== 'ready') return;
    const context = { ...object(JSON.parse(String(row.context))), reason };
    const at = Date.now();
    await client.batch([
      { sql: "UPDATE runs SET state='blocked',context=?,version=version+1,updated_at=? WHERE id=? AND version=? AND state='ready'", args: [JSON.stringify(context), at, runId, Number(row.version)] },
      { sql: `INSERT INTO move(id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
        SELECT ?, 'run', ?, NULL, NULL, 'blocked', NULL, ?, ?, ?, ?, ? WHERE changes()=1`,
        args: [`evt_${crypto.randomUUID()}`, runId, await fingerprint({ runId, reason }), `block:${runId}:${row.version}`, JSON.stringify({ reason }), at, at] },
    ], 'write');
  } finally { client.close(); }
}

async function load(env: FlowEnv, id: string): Promise<Dispatch | null> {
  return env.CONTROL.prepare('SELECT * FROM dispatches WHERE id=?').bind(id).first<Dispatch>();
}

export async function acceptFlowRequest(env: FlowEnv, current: AccessContext, request: GatewayRequest): Promise<Record<string, unknown>> {
  if (!['flow.start', 'flow.advance'].includes(request.actionId) || !request.idempotencyKey || request.idempotencyKey.length > 200) throw conflict('A Flow Book action and operation key are required.');
  const hash = await fingerprint({ actor: current.identity.id, action: request.actionId, input: request.input });
  const id = await fingerprint({ workspace: current.workspace.id, token: request.idempotencyKey });
  const at = Date.now();
  await env.CONTROL.prepare(`INSERT OR IGNORE INTO dispatches(id,workspace,actor,action,token,hash,payload,state,due,created,updated)
    VALUES(?,?,?,?,?,?,?,'accepted',?,?,?)`).bind(id, current.workspace.id, current.identity.id, request.actionId, request.idempotencyKey, hash, JSON.stringify(request.input), at, at, at).run();
  const saved = await load(env, id);
  if (!saved || saved.hash !== hash || saved.actor !== current.identity.id || saved.action !== request.actionId) throw conflict('This operation key was already used for a different Flow Book request.');
  if (saved.state === 'failed') throw conflict('This Flow Book request failed. Review it and retry with a new operation key.');
  const result = await processFlowRequest(env, id);
  if (!result) throw unavailable('Flow Book request is being processed. Retry with the same operation key.');
  return result;
}

export async function processFlowRequest(env: FlowEnv, id: string): Promise<Record<string, unknown> | null> {
  const at = Date.now();
  const claimed = await env.CONTROL.prepare(`UPDATE dispatches SET state='processing',attempts=attempts+1,due=?,updated=?
    WHERE id=? AND state='accepted' AND due<=? AND attempts<10`).bind(at + 60_000, at, id, at).run();
  const saved = await load(env, id);
  if (!saved) return null;
  if (!claimed.meta.changes) {
    if (saved.run) {
      const current = await Effect.runPromise(new ControlStore(env.CONTROL).accessFor(saved.workspace, saved.actor));
      const client = await openFlowDatabase(env, current);
      try {
        const row = await client.execute({ sql: 'SELECT data FROM events WHERE idempotency_key=?', args: [saved.token] });
        return row.rows[0] ? object(object(JSON.parse(String(row.rows[0].data))).result) : null;
      } finally { client.close(); }
    }
    return null;
  }
  try {
    const current = await Effect.runPromise(new ControlStore(env.CONTROL).accessFor(saved.workspace, saved.actor));
    const client = await openFlowDatabase(env, current);
    let result: Record<string, unknown>;
    try {
      result = await Effect.runPromise(executeGateway(client, current, { actionId: saved.action, idempotencyKey: saved.token, input: object(JSON.parse(saved.payload)) }, services(env)));
    } finally { client.close(); }
    const run = object(result.run);
    if (typeof run.id !== 'string') throw unavailable('Flow Book run was not returned.');
    await env.CONTROL.prepare("UPDATE dispatches SET run=?,payload='{}',state='running',due=?,updated=? WHERE id=? AND state='processing'").bind(run.id, Date.now(), Date.now(), id).run();
    await reconcileFlowDispatch(env, id);
    return result;
  } catch (cause) {
    const retry = !(cause instanceof HarnessError && cause.status < 500) && saved.attempts < 10;
    await env.CONTROL.prepare('UPDATE dispatches SET state=?,due=?,updated=? WHERE id=? AND state=\'processing\'')
      .bind(retry ? 'accepted' : 'failed', Date.now() + Math.min(300_000, 5_000 * (saved.attempts + 1)), Date.now(), id).run();
    throw cause;
  }
}

export async function reconcileFlowDispatch(env: FlowEnv, id: string): Promise<void> {
  const saved = await load(env, id);
  if (!saved || saved.state !== 'running' || !saved.run) return;
  const client = await openWorkspaceById(env, saved.workspace);
  let step = 0; let auto = false; let actor = saved.actor;
  try {
    const result = await client.execute({ sql: 'SELECT state,context FROM runs WHERE id=?', args: [saved.run] });
    const run = result.rows[0];
    if (!run) throw unavailable('Flow Book run cannot be found.');
    const context = object(JSON.parse(String(run.context)));
    const actions = Array.isArray(context.actions) ? context.actions.map(object) : [];
    step = Number(context.step || 0);
    auto = run.state === 'ready' && Number.isSafeInteger(step) && object(actions[step]).auto === true;
    actor = typeof context.startedBy === 'string' ? context.startedBy : saved.actor;
  } finally { client.close(); }
  if (!auto) {
    await env.CONTROL.prepare("UPDATE dispatches SET state='done',due=?,updated=? WHERE id=? AND state='running'").bind(Date.now(), Date.now(), id).run();
    return;
  }
  const instance = `${saved.run}:${step}`;
  if (saved.instance) {
    const previous = await env.FLOWS.get(saved.instance);
    const status = (await previous.status()).status;
    if (status === 'errored') {
      if (saved.attempts >= 6) {
        await blockFlowRun(env, saved.workspace, saved.run, 'runner retry limit reached');
        await env.CONTROL.prepare("UPDATE dispatches SET state='failed',updated=? WHERE id=?").bind(Date.now(), id).run();
        return;
      }
      await previous.restart();
      await env.CONTROL.prepare('UPDATE dispatches SET attempts=attempts+1,due=?,updated=? WHERE id=?')
        .bind(Date.now() + 300_000, Date.now(), id).run();
      return;
    }
    if (status === 'terminated') {
      await blockFlowRun(env, saved.workspace, saved.run, 'runner was terminated');
      await env.CONTROL.prepare("UPDATE dispatches SET state='failed',updated=? WHERE id=?").bind(Date.now(), id).run();
      return;
    }
    if (status !== 'complete') {
      await env.CONTROL.prepare('UPDATE dispatches SET due=?,updated=? WHERE id=?').bind(Date.now() + 300_000, Date.now(), id).run();
      return;
    }
    if (saved.instance === instance) {
      await blockFlowRun(env, saved.workspace, saved.run, 'runner completed without advancing');
      await env.CONTROL.prepare("UPDATE dispatches SET state='failed',updated=? WHERE id=?").bind(Date.now(), id).run();
      return;
    }
  }
  if (saved.instance !== instance) {
    try { await env.FLOWS.create({ id: instance, params: { workspace: saved.workspace, actor, run: saved.run, step } }); }
    catch (cause) {
      const existing = await env.FLOWS.get(instance).catch(() => null);
      if (!existing) throw cause;
    }
    await env.CONTROL.prepare('UPDATE dispatches SET instance=?,due=?,updated=? WHERE id=?').bind(instance, Date.now() + 300_000, Date.now(), id).run();
    return;
  }
}

export async function sweepFlowDispatches(env: FlowEnv): Promise<void> {
  const due = await env.CONTROL.prepare("SELECT id,state,attempts FROM dispatches WHERE state IN ('accepted','processing','running') AND due<=? ORDER BY due LIMIT 50").bind(Date.now()).all<{ id: string; state: string; attempts: number }>();
  for (const item of due.results) {
    try {
      if (item.state === 'processing') {
        await env.CONTROL.prepare("UPDATE dispatches SET state='accepted' WHERE id=? AND state='processing' AND due<=?").bind(item.id, Date.now()).run();
      }
      if (item.state !== 'running') await processFlowRequest(env, item.id);
      else await reconcileFlowDispatch(env, item.id);
    } catch (cause) {
      console.error(JSON.stringify({ event: 'flow.dispatch.failed', id: item.id, error: cause instanceof Error ? cause.message : String(cause) }));
    }
  }
}
