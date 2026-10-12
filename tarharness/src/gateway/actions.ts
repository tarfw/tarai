import type { Client, InStatement } from '@libsql/client/web';
import { Effect } from 'effect';
import { badRequest, conflict, forbidden, notFound, unavailable } from '../errors.ts';
import { query } from '../db/turso.ts';
import type { AccessContext, FlowDefinition, FlowRun, RecordItem } from '../types.ts';
import { findAction, type ActionId } from '../registry/catalog.ts';
import { executePos } from '../pos/store.ts';
import { draftProduct, saveProductContent } from '../pos/content.ts';
import { canExecute, canReadRecord, canRunFlowStep } from '../access.ts';
import { executeSiteGenerate, executeSiteDesigns, executeSiteScout, executeSiteCompile, executeSitePublish, executeSitePublishLatest, executeSiteRollback, executeSiteRefresh, executeSiteUnpublish, executeSiteChecks, executeSiteReleases, executeSiteBriefAdd, executeSiteBriefRemove, executeSiteNoticeSet, executeSiteSectionsSet } from '../site/store.ts';
import { executeSiteAsk, executeSiteDesignImport, executeSiteEdit, executeSiteUndo } from '../site/edit.ts';
import { executeSiteAssetGenerate, executeSiteAssetUpload, executeSiteAssets } from '../site/asset.ts';
import { searchWeb } from '../web/search.ts';
import { appendEvent, eventStatement, findReplay, fingerprint, runStatement, stamp, stepStatement } from './commit.ts';
import { suggest } from '../brain/jev.ts';
import { claimTurn, completeTurn, failTurn } from './turns.ts';
import { commerceActionIds } from '../commerce/catalog.ts';
import { executeCommerce } from '../commerce/store.ts';
import { isModule, moduleForAction, readCapabilities } from '../registry/tools.ts';

type GatewayError = ReturnType<typeof badRequest> | ReturnType<typeof conflict> | ReturnType<typeof forbidden> | ReturnType<typeof notFound> | ReturnType<typeof unavailable>;
export interface GatewayRequest { readonly idempotencyKey: string; readonly actionId: ActionId; readonly input: Record<string, unknown>; }
export interface GatewayServices { readonly productContent?: R2Bucket; readonly siteReleases?: R2Bucket; readonly publication?: D1Database; readonly siteDomain?: string; readonly ai?: Ai; readonly tinyfish?: string; readonly typesafe?: string; readonly siteModel?: string; readonly groqApiKey?: string; readonly pexelsApiKey?: string }

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 200): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const json = (value: unknown) => JSON.stringify(value);
const rowToRecord = (row: Record<string, unknown>): RecordItem => ({
  id: String(row.id), type: String(row.type), title: String(row.title), state: String(row.state), data: object(typeof row.data === 'string' ? JSON.parse(row.data) : row.data),
  owner: typeof row.owner === 'string' ? row.owner : null,
  assignee: typeof row.assignee === 'string' ? row.assignee : null,
  version: Number(row.version),
  createdAt: Number(row.created),
  updatedAt: Number(row.updated),
});
const bookActions = new Set(['record.create', 'contact.create', 'organization.create', 'task.create', 'site.generate', 'web.search', 'pos.register.count', 'pos.register.close']);
const unattendedActions = new Set(['record.create', 'contact.create', 'organization.create', 'task.create']);
const managedCommerceTypes = new Set([
  'item', 'variant', 'price', 'stock', 'purchase', 'order', 'invoice', 'payment',
  'refund', 'posting', 'movement', 'receipt', 'capability',
  'expense', 'statement', 'reconciliation', 'period', 'transfer', 'batch',
  'recipe', 'production', 'booking', 'time', 'trip', 'fare', 'shift', 'attendance',
  'payroll', 'supplier', 'quote', 'pick', 'pack', 'shipment', 'return', 'inspection',
  'quality', 'forecast', 'plan',
]);
function validateContactDetails(values: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(values)) {
    if (!['email', 'phone', 'website'].includes(key) || value === null || value === '') continue;
    if (typeof value !== 'string' || value.length > 500) throw badRequest('Contact details must be short text.');
    if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw badRequest('Email address is invalid.');
    if (key === 'phone' && !/^[+0-9 ()-]{4,30}$/.test(value)) throw badRequest('Phone number is invalid.');
    if (key === 'website') {
      try { if (new URL(value).protocol !== 'https:') throw new Error('Invalid protocol'); }
      catch { throw badRequest('Website must be an HTTPS URL.'); }
    }
  }
}

export function executeGateway(client: Client, context: AccessContext, request: GatewayRequest, services: GatewayServices = {}): Effect.Effect<Record<string, unknown>, GatewayError> {
  return Effect.tryPromise({
    try: async () => {
      if (!request.idempotencyKey || request.idempotencyKey.length > 200) throw badRequest('Idempotency-Key is required.');
      const registeredAction = findAction(request.actionId);
      let memberToCheck = context.member;
      if (memberToCheck.role === 'member' && !memberToCheck.access && memberToCheck.userId) {
        try {
          const email = context.identity.email ? context.identity.email.trim().toLowerCase() : '';
          const partyRow = await client.execute({
            sql: `SELECT data FROM records WHERE type='party' AND (
              id=? OR owner=? OR json_extract(data, '$.userId')=?
              ${email ? "OR lower(title)=? OR json_extract(data, '$.email')=?" : ''}
            ) AND archived IS NULL LIMIT 1`,
            args: email ? [memberToCheck.userId, memberToCheck.userId, memberToCheck.userId, email, email] : [memberToCheck.userId, memberToCheck.userId, memberToCheck.userId],
          });
          if (partyRow.rows.length > 0) {
            const parsed = JSON.parse(String(partyRow.rows[0].data));
            if (Array.isArray(parsed.access)) {
              memberToCheck = { ...memberToCheck, access: parsed.access.map(String), brief: typeof parsed.brief === 'string' ? parsed.brief : undefined };
            }
          }
        } catch { /* ignore */ }
      }
      if (!registeredAction || !canExecute(memberToCheck, request.actionId)) throw forbidden();
      const module = moduleForAction(request.actionId);
      if (module && !(await readCapabilities(client)).enabled[module]) throw forbidden();
      for (const field of registeredAction.fields) {
        const value = request.input[field.key];
        if (field.required && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))) throw badRequest(`${field.label} is required.`);
        if (field.kind === 'number' && value !== undefined && (!Number.isFinite(Number(value)))) throw badRequest(`${field.label} must be a number.`);
        if (field.kind === 'email' && typeof value === 'string' && value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw badRequest(`${field.label} must be a valid email address.`);
      }
      const hash = await fingerprint({ actor: context.identity.id, action: request.actionId, input: request.input });
      const replay = await findReplay(client, request.idempotencyKey, hash);
      if (replay) return object(replay.result);
      const at = stamp();
      if (request.actionId === 'capability.save') {
        const module = request.input.module;
        const enabled = request.input.enabled;
        const baseVersion = Number(request.input.baseVersion);
        if (!isModule(module) || typeof enabled !== 'boolean' || !Number.isSafeInteger(baseVersion) || baseVersion < 0) throw badRequest('Choose a capability and current version.');
        const current = await readCapabilities(client);
        if (current.version !== baseVersion) throw conflict('Tools changed. Refresh and try again.');
        const targetModule = module === 'pos' ? 'commerce' : module;
        const next = { ...current.enabled, [targetModule]: enabled, pos: targetModule === 'commerce' ? enabled : current.enabled.pos };
        const result = { enabled: next, version: baseVersion + 1 };
        const committed = await client.batch([
          baseVersion === 0
            ? { sql: "INSERT OR IGNORE INTO records (id,type,title,state,data,owner,assignee,due,version,created,updated) VALUES ('capability','capability','Capabilities','active',?,?,NULL,NULL,1,?,?)", args: [json(next), context.identity.id, at, at] }
            : { sql: "UPDATE records SET data=?,version=version+1,updated=? WHERE id='capability' AND type='capability' AND version=? AND archived IS NULL", args: [json(next), at, baseVersion] },
          { sql: `INSERT INTO events (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
            SELECT ?, 'action', NULL, 'capability', ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`,
            args: [`evt_${crypto.randomUUID()}`, request.actionId, context.identity.id, hash, request.idempotencyKey, json({ result }), at, at] },
        ], 'write');
        if (committed[0]?.rowsAffected !== 1 || committed[1]?.rowsAffected !== 1) throw conflict('Tools changed. Refresh and try again.');
        return result;
      }
      if (request.actionId === 'brief.save') {
        const rawBrief = request.input.brief;
        const briefList = Array.isArray(rawBrief) ? rawBrief.map(String) : typeof rawBrief === 'string' ? rawBrief.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
        const tradeVal = typeof request.input.trade === 'string' ? request.input.trade : typeof request.input.trade === 'object' && request.input.trade !== null ? String((request.input.trade as { title?: unknown }).title || '') : '';
        const payload = { brief: briefList, trade: tradeVal };
        const result = { saved: true, brief: briefList, trade: tradeVal };
        await client.batch([
          {
            sql: `INSERT INTO records (id, type, title, state, data, owner, assignee, due, version, created, updated)
                  VALUES ('brief', 'brief', 'Workspace Brief', 'active', ?, ?, NULL, NULL, 1, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET data=excluded.data, version=records.version+1, updated=excluded.updated`,
            args: [json(payload), context.identity.id, at, at],
          },
          {
            sql: `INSERT INTO events (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
                  SELECT ?, 'action', NULL, 'brief', ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`,
            args: [`evt_${crypto.randomUUID()}`, request.actionId, context.identity.id, hash, request.idempotencyKey, json({ result }), at, at],
          },
        ], 'write');
        return result;
      }
      if (request.actionId === 'pos.product.content.save') return saveProductContent(client, services.productContent, context, request.input, { key: request.idempotencyKey, hash });
      if (request.actionId === 'pos.product.draft') {
        const result = await draftProduct(services.ai, request.input);
        await appendEvent(client, { action: request.actionId, actor: context.identity.id, key: request.idempotencyKey, hash, result });
        return result;
      }
      if (request.actionId.startsWith('pos.')) return executePos(client, context, request.actionId, request.input, request.idempotencyKey, hash);
      if (commerceActionIds.has(request.actionId)) return executeCommerce(client, context, request.actionId, request.input, request.idempotencyKey, hash, services.typesafe);
      if (request.actionId === 'site.generate') return executeSiteGenerate(client, context, request.input, request.idempotencyKey, hash, services.typesafe, services.ai, services.publication, services.siteModel, services.groqApiKey, services.productContent, services.pexelsApiKey);
      if (request.actionId === 'site.edit') return executeSiteEdit(client, context, request.input, request.idempotencyKey, hash, services.siteReleases);
      if (request.actionId === 'site.ask') return executeSiteAsk(client, context, request.input, services.typesafe, services.publication, services.ai, services.siteModel, services.groqApiKey);
      if (request.actionId === 'site.scout') return executeSiteScout(client, context, request.input, request.idempotencyKey, hash, services.typesafe, services.publication);
      if (request.actionId === 'site.undo') return executeSiteUndo(client, context, request.input, request.idempotencyKey, hash, services.siteReleases);
      if (request.actionId === 'site.design.import') return executeSiteDesignImport(client, context, request.input, request.idempotencyKey, hash, services.siteReleases);
      if (request.actionId === 'site.asset.upload') return executeSiteAssetUpload(client, services.productContent, context, request.input, request.idempotencyKey, hash);
      if (request.actionId === 'site.asset.generate') return executeSiteAssetGenerate(client, services.productContent, services.ai, context, request.input, request.idempotencyKey, hash);
      if (request.actionId === 'site.assets') return executeSiteAssets(client, context, request.input);
      if (request.actionId === 'site.checks') return executeSiteChecks(client, services.siteReleases, context, request.input);
      if (request.actionId === 'site.releases') return executeSiteReleases(client, context, request.input);
      if (request.actionId === 'site.designs') return executeSiteDesigns(client, context, request.input);
      if (request.actionId === 'site.compile') return executeSiteCompile(client, services.siteReleases, context, request.input, request.idempotencyKey, hash, services.publication, services.siteDomain, services.productContent);
      if (request.actionId === 'site.publish') return executeSitePublish(client, services.siteReleases, context, request.input, request.idempotencyKey, hash, services.publication, services.siteDomain, services.productContent);
      if (request.actionId === 'site.publishLatest') return executeSitePublishLatest(client, context, request.input, request.idempotencyKey, hash, {
        control: services.publication, domain: services.siteDomain, releases: services.siteReleases, content: services.productContent,
        ai: services.ai, typesafe: services.typesafe, model: services.siteModel, groqApiKey: services.groqApiKey, pexelsApiKey: services.pexelsApiKey,
      });
      if (request.actionId === 'site.rollback') return executeSiteRollback(client, context, request.input, request.idempotencyKey, hash, services.publication, services.siteDomain, services.siteReleases, services.productContent);
      if (request.actionId === 'site.refresh') return executeSiteRefresh(client, services.siteReleases, context, request.input, request.idempotencyKey, hash, services.publication, services.siteDomain, services.productContent);
      if (request.actionId === 'site.unpublish') return executeSiteUnpublish(client, context, request.input, request.idempotencyKey, hash, services.publication);
      if (request.actionId === 'site.brief.add') return executeSiteBriefAdd(client, context, request.input, request.idempotencyKey, hash, services.typesafe, services.publication);
      if (request.actionId === 'site.brief.remove') return executeSiteBriefRemove(client, context, request.input, request.idempotencyKey, hash, services.typesafe, services.publication);
      if (request.actionId === 'site.notice.set') return executeSiteNoticeSet(client, context, request.input, request.idempotencyKey, hash);
      if (request.actionId === 'site.sections.set') return executeSiteSectionsSet(client, context, request.input, request.idempotencyKey, hash, services.typesafe, services.ai, services.publication, services.siteModel, services.groqApiKey, services.productContent, services.pexelsApiKey);
      if (request.actionId === 'web.search') {
        const claimed = await claimTurn(client, request.idempotencyKey, hash);
        if (claimed.result) return claimed.result;
        try {
          const result = await searchWeb(services.tinyfish, request.input);
          await completeTurn(client, { action: request.actionId, actor: context.identity.id, key: request.idempotencyKey, hash, result }, claimed.lease!);
          return result;
        } catch (cause) { await failTurn(client, request.idempotencyKey, hash, claimed.lease!); throw cause; }
      }
      if (request.actionId === 'flow.suggest') {
        const claimed = await claimTurn(client, request.idempotencyKey, hash);
        if (claimed.result) return claimed.result;
        try {
          const result = (await suggest(services.typesafe, text(request.input.prompt, 2000))) as unknown as Record<string, unknown>;
          await completeTurn(client, { action: request.actionId, actor: context.identity.id, key: request.idempotencyKey, hash, result }, claimed.lease!);
          return result;
        } catch (cause) { await failTurn(client, request.idempotencyKey, hash, claimed.lease!); throw cause; }
      }

      if (request.actionId === 'flow.publish') {
        const flowId = text(request.input.flowId, 160); const name = text(request.input.name, 100); const description = text(request.input.description, 400);
        const actions = Array.isArray(request.input.actions) ? request.input.actions.map(object).map((item) => ({
          id: text(item.id, 160), version: findAction(text(item.id, 160))?.version ?? 0,
          auto: item.auto === true, role: item.auto === true ? '' : text(item.role, 80).toLowerCase(), input: object(item.input),
        })) : [];
        if (!/^book\.[a-z0-9]{1,80}$/.test(flowId) || !name || !actions.length || actions.length > 20 || actions.some((item) => !item.id)) throw badRequest('A Flow Book name and between 1 and 20 Actions are required.');
        if (actions.some((item) => !findAction(item.id) || item.id === 'flow.start' || item.id === 'flow.advance' || item.id === 'flow.publish' || !bookActions.has(item.id))) throw badRequest('Flow Book contains an unavailable Action.');
        if (actions.some((item) => item.auto && (!unattendedActions.has(item.id) || JSON.stringify(item.input).length > 8_000 || findAction(item.id)!.fields.some((field) => field.required && (item.input[field.key] === undefined || item.input[field.key] === null || item.input[field.key] === ''))))) throw badRequest('Automatic steps require a supported internal Action and complete reviewed input.');
        const enabled = (await readCapabilities(client)).enabled;
        if (actions.some((item) => { const module = moduleForAction(item.id); return module !== null && !enabled[module]; })) throw badRequest('Enable each step’s capability before publishing this Flow Book.');
        const result = { flowId, published: true };
        const statements: InStatement[] = [
          { sql: `INSERT INTO definitions (id,kind,name,version,state,data,created_at,updated_at) VALUES (?, 'flow', ?, 1, 'published', ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name,version=definitions.version+1,state='published',data=excluded.data,updated_at=excluded.updated_at`, args: [flowId, name, json({ source: 'book', description, actions }), at, at] },
          { sql: `INSERT INTO editions(id,definition,version,name,data,created)
            SELECT id||':'||version,id,version,name,data,? FROM definitions WHERE id=?`, args: [at, flowId] },
        ];
        statements.push(eventStatement({ action: request.actionId, actor: context.identity.id, key: request.idempotencyKey, hash, result }));
        await client.batch(statements, 'write');
        return result;
      }

      if (request.actionId === 'routine.save') {
        if (context.workspace.mode !== 'personal') throw badRequest('Space routines are saved in Personal.');
        const id = text(request.input.id, 160);
        const label = text(request.input.label, 80); const workspace = text(request.input.workspace, 160); const role = text(request.input.role, 80);
        const start = text(request.input.start, 5); const end = text(request.input.end, 5);
        const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
        if (!label || !workspace || !validTime(start) || !validTime(end) || start === end) throw badRequest('Choose a context, workspace and valid start and end times.');
        const rawDays = text(request.input.days, 40) || '0,1,2,3,4,5,6';
        const days = [...new Set(rawDays.split(',').map((value) => Number(value.trim())))];
        if (!days.length || days.some((value) => !Number.isInteger(value) || value < 0 || value > 6)) throw badRequest('Days must use numbers 0 through 6.');
        const priority = Number(request.input.priority ?? 0);
        if (!Number.isSafeInteger(priority) || priority < 0 || priority > 100) throw badRequest('Priority must be an integer from 0 to 100.');
        const existing = id ? (await query<Record<string, unknown>>(client, { sql: "SELECT * FROM records WHERE id=? AND type='routine' AND archived IS NULL", args: [id] }).pipe(Effect.runPromise))[0] : null;
        if (id && (!existing || existing.owner !== context.identity.id)) throw notFound('Space routine not found.');
        if (existing && Number(existing.version) !== Number(request.input.baseVersion)) throw conflict('Routine changed. Reload Space and try again.');
        const record: RecordItem = {
          id: existing ? String(existing.id) : `rec_${crypto.randomUUID()}`, type: 'routine', title: label, state: 'active',
          data: { workspace, label, role, start, end, days, priority }, owner: context.identity.id, assignee: null,
          version: existing ? Number(existing.version) + 1 : 1, createdAt: existing ? Number(existing.created) : at, updatedAt: at,
        };
        if (existing) {
          const committed = await client.batch([
            { sql: "UPDATE records SET title=?,state='active',data=?,version=version+1,updated=? WHERE id=? AND version=?", args: [label, json(record.data), at, record.id, Number(existing.version)] },
            { sql: `INSERT INTO events (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
              SELECT ?, 'action', NULL, ?, ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, record.id, request.actionId, context.identity.id, hash, request.idempotencyKey, json({ result: { record } }), at, at] },
          ], 'write');
          if (committed[0]?.rowsAffected !== 1 || committed[1]?.rowsAffected !== 1) throw conflict('Routine changed. Reload Space and try again.');
        } else {
          await client.batch([
            { sql: 'INSERT INTO records (id,type,title,state,data,owner,assignee,due,version,created,updated) VALUES (?,?,?,?,?,?,?,?,1,?,?)', args: [record.id, record.type, record.title, record.state, json(record.data), record.owner, null, null, at, at] },
            eventStatement({ action: request.actionId, actor: context.identity.id, recordId: record.id, key: request.idempotencyKey, hash, result: { record } }),
          ], 'write');
        }
        return { record };
      }

      if (request.actionId === 'routine.remove') {
        if (context.workspace.mode !== 'personal') throw badRequest('Space routines are saved in Personal.');
        const id = text(request.input.id, 160); const version = Number(request.input.baseVersion);
        if (!id || !Number.isSafeInteger(version)) throw badRequest('Routine and version are required.');
        const found = await query<Record<string, unknown>>(client, { sql: "SELECT owner,version FROM records WHERE id=? AND type='routine' AND archived IS NULL", args: [id] }).pipe(Effect.runPromise);
        if (!found[0] || found[0].owner !== context.identity.id) throw notFound('Space routine not found.');
        if (Number(found[0].version) !== version) throw conflict('Routine changed. Reload Space and try again.');
        const result = { id };
        const committed = await client.batch([
          { sql: "UPDATE records SET state='archived',archived=?,version=version+1,updated=? WHERE id=? AND version=? AND archived IS NULL", args: [at, at, id, version] },
          { sql: `INSERT INTO events (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
            SELECT ?, 'action', NULL, ?, ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, id, request.actionId, context.identity.id, hash, request.idempotencyKey, json({ result }), at, at] },
        ], 'write');
        if (committed[0]?.rowsAffected !== 1 || committed[1]?.rowsAffected !== 1) throw conflict('Routine changed. Reload Space and try again.');
        return result;
      }

      if (request.actionId === 'agent.save') {
        const name = text(request.input.name, 40).trim();
        if (!name) throw badRequest('Agent name is required.');
        const found = await query<Record<string, unknown>>(client, {
          sql: "SELECT id, version FROM records WHERE type='agent' AND owner=? AND archived IS NULL LIMIT 1",
          args: [context.identity.id],
        }).pipe(Effect.runPromise);
        const existing = found[0];
        const record: RecordItem = {
          id: existing ? String(existing.id) : `rec_${crypto.randomUUID()}`,
          type: 'agent',
          title: name,
          state: 'active',
          data: { name },
          owner: context.identity.id,
          assignee: null,
          version: existing ? Number(existing.version) + 1 : 1,
          createdAt: at,
          updatedAt: at,
        };
        if (existing) {
          const committed = await client.batch([
            { sql: "UPDATE records SET title=?, data=?, version=version+1, updated=? WHERE id=?", args: [name, json(record.data), at, record.id] },
            eventStatement({ action: request.actionId, actor: context.identity.id, recordId: record.id, key: request.idempotencyKey, hash, result: { name, record } }),
          ], 'write');
          if (committed[0]?.rowsAffected !== 1) throw conflict('Agent record could not be updated.');
        } else {
          await client.batch([
            { sql: "INSERT INTO records (id,type,title,state,data,owner,assignee,due,version,created,updated) VALUES (?,?,?,?,?,?,?,?,1,?,?)", args: [record.id, record.type, record.title, record.state, json(record.data), record.owner, null, null, at, at] },
            eventStatement({ action: request.actionId, actor: context.identity.id, recordId: record.id, key: request.idempotencyKey, hash, result: { name, record } }),
          ], 'write');
        }
        return { name, record };
      }

      if (request.actionId === 'record.create' || request.actionId === 'task.create' || request.actionId === 'contact.create' || request.actionId === 'organization.create') {
        const type = request.actionId === 'task.create' ? 'task' : request.actionId === 'contact.create' ? 'person' : request.actionId === 'organization.create' ? 'organization' : text(request.input.type, 80);
        const title = text(request.actionId === 'contact.create' || request.actionId === 'organization.create' ? request.input.name : request.input.title, 240);
        if (!type || !title) throw badRequest('Record type and title are required.');
        if (request.actionId === 'record.create' && (!/^[a-z][a-z0-9.]{0,79}$/.test(type) || ['person', 'organization', 'relationship', 'task', 'routine', 'site', 'flow', 'run', 'event'].includes(type) || managedCommerceTypes.has(type) || type.startsWith('pos.'))) throw badRequest('Use the registered domain action for this record type.');
        const assignee = request.actionId === 'task.create' ? text(request.input.assigneeId, 160) || context.identity.id : text(request.input.assigneeId, 160) || null;
        const data = request.actionId === 'record.create' || request.actionId === 'task.create' ? object(request.input.data) : Object.fromEntries(['email', 'phone', 'website'].flatMap((key) => { const value = text(request.input[key], 500); return value ? [[key, value]] : []; }));
        if (type === 'person' || type === 'organization') validateContactDetails(data);
        const record: RecordItem = { id: `rec_${crypto.randomUUID()}`, type, title, state: request.actionId === 'task.create' ? 'open' : 'active', data, owner: context.identity.id, assignee, version: 1, createdAt: at, updatedAt: at };
        await client.batch([
          { sql: `INSERT INTO records (id,type,title,state,data,owner,assignee,due,version,created,updated) VALUES (?,?,?,?,?,?,?,?,1,?,?)`, args: [record.id, record.type, record.title, record.state, json(record.data), record.owner, record.assignee, null, at, at] },
          eventStatement({ action: request.actionId, actor: context.identity.id, recordId: record.id, key: request.idempotencyKey, hash, result: { record } }),
        ], 'write');
        return { record };
      }

      if (request.actionId === 'relationship.create') {
        const source = text(request.input.source, 160); const target = text(request.input.target, 160); const role = text(request.input.role, 120);
        const since = request.input.since === undefined ? null : Number(request.input.since); const until = request.input.until === undefined ? null : Number(request.input.until);
        if (!source || !target || source === target || !role || (since !== null && !Number.isSafeInteger(since)) || (until !== null && !Number.isSafeInteger(until)) || (since !== null && until !== null && until < since)) throw badRequest('Choose a person, organization, role and valid date range.');
        const records = await query<Record<string, unknown>>(client, { sql: 'SELECT id,type FROM records WHERE id IN (?,?) AND archived IS NULL', args: [source, target] }).pipe(Effect.runPromise);
        const person = records.find((item) => String(item.id) === source); const organization = records.find((item) => String(item.id) === target);
        if (!person || !organization) throw notFound('Person or organization record not found.');
        if (person.type !== 'person' || organization.type !== 'organization') throw badRequest('Relationships connect a person to an organization.');
        if (!canReadRecord(context.member, rowToRecord(person)) || !canReadRecord(context.member, rowToRecord(organization))) throw forbidden();
        const link = { id: `link_${crypto.randomUUID()}`, source, target, role, since, until };
        try {
          await client.batch([
            { sql: 'INSERT INTO links(id,source,target,role,since,until,data,actor,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)', args: [link.id, source, target, role, since, until, json({}), context.identity.id, at, at] },
            eventStatement({ action: request.actionId, actor: context.identity.id, recordId: source, key: request.idempotencyKey, hash, result: { link } }),
          ], 'write');
        } catch (cause) {
          if (cause instanceof Error && /unique/i.test(cause.message)) throw conflict('This active relationship already exists.');
          throw cause;
        }
        return { link };
      }

      if (request.actionId === 'relationship.end') {
        const id = text(request.input.id, 160); const until = Number(request.input.until);
        if (!id || !Number.isSafeInteger(until)) throw badRequest('Relationship and a valid end date are required.');
        const found = await query<Record<string, unknown>>(client, { sql: 'SELECT * FROM links WHERE id=?', args: [id] }).pipe(Effect.runPromise);
        const link = found[0]; if (!link) throw notFound('Relationship not found.');
        if (link.until !== null) throw conflict('This relationship has already ended.');
        if (link.since !== null && until < Number(link.since)) throw badRequest('End date cannot be earlier than start date.');
        const linked = await query<Record<string, unknown>>(client, { sql: 'SELECT * FROM records WHERE id IN (?,?) AND archived IS NULL', args: [String(link.source), String(link.target)] }).pipe(Effect.runPromise);
        if (linked.length !== 2) throw notFound('A linked record is unavailable.');
        if (linked.some((item) => !canReadRecord(context.member, rowToRecord(item)))) throw forbidden();
        const committed = await client.batch([
          { sql: 'UPDATE links SET until=?,actor=?,updated=? WHERE id=? AND until IS NULL', args: [until, context.identity.id, at, id] },
          { sql: `INSERT INTO events (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
            SELECT ?, 'action', NULL, ?, ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`,
            args: [`evt_${crypto.randomUUID()}`, String(link.source), request.actionId, context.identity.id, hash, request.idempotencyKey, json({ result: { id, until } }), at, at] },
        ], 'write');
        if (committed[0]?.rowsAffected !== 1 || committed[1]?.rowsAffected !== 1) throw conflict('This relationship was already changed. Refresh and try again.');
        return { id, until };
      }

      if (request.actionId === 'consent.record') {
        const contactId = text(request.input.contactId, 160);
        const channel = text(request.input.channel, 30).toLowerCase();
        const purpose = text(request.input.purpose, 30).toLowerCase();
        const state = text(request.input.state, 20).toLowerCase();
        const source = text(request.input.source, 1000);
        if (!['email', 'sms', 'phone', 'whatsapp'].includes(channel) || !['marketing', 'transactional', 'support'].includes(purpose) || !['granted', 'revoked'].includes(state) || source.length < 8) throw badRequest('Choose a valid channel, purpose, decision and evidence.');
        const rows = await query<Record<string, unknown>>(client, { sql: "SELECT * FROM records WHERE id=? AND type IN ('person','organization') AND archived IS NULL", args: [contactId] }).pipe(Effect.runPromise);
        if (!rows[0]) throw notFound('Contact not found.');
        if (!canReadRecord(context.member, rowToRecord(rows[0]))) throw forbidden();
        const consent = { id: `consent_${crypto.randomUUID()}`, contact: contactId, channel, purpose, state, source, actor: context.identity.id, created: at };
        await client.batch([
          { sql: 'INSERT INTO consents(id,contact,channel,purpose,state,source,actor,created) VALUES(?,?,?,?,?,?,?,?)', args: [consent.id, contactId, channel, purpose, state, source, context.identity.id, at] },
          eventStatement({ action: request.actionId, actor: context.identity.id, recordId: contactId, key: request.idempotencyKey, hash, result: { consent } }),
        ], 'write');
        return { consent };
      }

      if (request.actionId === 'record.update') {
        const recordId = text(request.input.recordId, 160); const baseVersion = Number(request.input.baseVersion);
        if (!recordId || !Number.isInteger(baseVersion)) throw badRequest('Record ID and base version are required.');
        const records = await query<Record<string, unknown>>(client, { sql: 'SELECT * FROM records WHERE id=? AND archived IS NULL', args: [recordId] }).pipe(Effect.runPromise);
        const current = records[0]; if (!current) throw notFound('Record not found.');
        const type = String(current.type);
        if (type.startsWith('pos.') || managedCommerceTypes.has(type) || ['site', 'relationship', 'routine'].includes(type)) throw badRequest('Use the registered domain action to update this record.');
        if (Number(current.version) !== baseVersion) throw conflict('Record changed. Refresh and try again.');
        const title = text(request.input.title, 240) || String(current.title);
        const patch = object(request.input.data);
        if (['person', 'organization'].includes(type) && Object.keys(patch).some((key) => !['email', 'phone', 'website'].includes(key))) throw badRequest('Contact edits may only change contact details.');
        if (['person', 'organization'].includes(type)) validateContactDetails(patch);
        if (type === 'task' && Object.keys(patch).some((key) => !['description'].includes(key))) throw badRequest('Task edits may only change its description.');
        const nextData = { ...object(JSON.parse(String(current.data))), ...patch };
        const state = text(request.input.state, 80) || String(current.state);
        if ((['person', 'organization', 'task'].includes(type)) && state !== String(current.state)) throw badRequest('Use the registered action to change this record state.');
        const committed = await client.batch([
          { sql: 'UPDATE records SET title=?,state=?,data=?,version=version+1,updated=? WHERE id=? AND version=?', args: [title, state, json(nextData), at, recordId, baseVersion] },
          { sql: `INSERT INTO events (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
            SELECT ?, 'action', NULL, ?, ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`,
            args: [`evt_${crypto.randomUUID()}`, recordId, request.actionId, context.identity.id, hash, request.idempotencyKey, json({ result: { recordId, version: baseVersion + 1 } }), at, at] },
        ], 'write');
        if (committed[0]?.rowsAffected !== 1 || committed[1]?.rowsAffected !== 1) throw conflict('Record changed. Refresh and try again.');
        return { recordId, version: baseVersion + 1 };
      }

      if (request.actionId === 'task.complete') {
        const taskId = text(request.input.taskId, 160); if (!taskId) throw badRequest('Task ID is required.');
        const records = await query<Record<string, unknown>>(client, { sql: 'SELECT * FROM records WHERE id=? AND type=\'task\' AND archived IS NULL', args: [taskId] }).pipe(Effect.runPromise);
        const task = records[0]; if (!task) throw notFound('Task not found.');
        if (!canReadRecord(context.member, rowToRecord(task))) throw forbidden();
        if (task.assignee && task.assignee !== context.identity.id && context.member.role !== 'owner' && context.member.role !== 'admin') throw forbidden();
        if (task.state !== 'open') throw conflict('Only open tasks can be completed.');
        const transaction = await client.transaction('write');
        try {
          const update = await transaction.execute({ sql: 'UPDATE records SET state=\'completed\',version=version+1,updated=? WHERE id=? AND version=?', args: [at, taskId, Number(task.version)] });
          if (update.rowsAffected !== 1) throw conflict('Task changed. Refresh and try again.');
          await transaction.execute(eventStatement({ action: request.actionId, actor: context.identity.id, recordId: taskId, key: request.idempotencyKey, hash, result: { taskId, state: 'completed' } }));
          await transaction.commit();
        } catch (cause) {
          await transaction.rollback().catch(() => undefined);
          throw cause;
        } finally { transaction.close(); }
        return { taskId, state: 'completed' };
      }

      if (request.actionId === 'flow.advance') {
        const runId = text(request.input.runId, 160); const actionId = text(request.input.actionId, 160); let input = object(request.input.data);
        const rows = await query<Record<string, unknown>>(client, { sql: 'SELECT * FROM runs WHERE id=?', args: [runId] }).pipe(Effect.runPromise);
        const current = rows[0]; if (!current) throw notFound('Flow Book run not found.');
        if (typeof current.record_id === 'string') {
          const linked = await query<Record<string, unknown>>(client, { sql: 'SELECT * FROM records WHERE id=? AND archived IS NULL', args: [current.record_id] }).pipe(Effect.runPromise);
          if (!linked[0]) throw notFound('The record linked to this Flow Book is unavailable.');
          if (!canReadRecord(context.member, rowToRecord(linked[0]))) throw forbidden();
        }
        const runContext = object(JSON.parse(String(current.context)));
        const actions = Array.isArray(runContext.actions) ? runContext.actions.map(object) : [];
        const index = Number(runContext.step || 0);
        if (String(current.state) !== 'ready' || !Number.isInteger(index) || index < 0 || index >= actions.length) throw conflict('This Flow Book is not waiting for a step. Refresh its status.');
        const expected = text(actions[index].id, 160);
        if (!expected || expected !== actionId) throw conflict('The Flow Book changed. Refresh before continuing.');
        if (actions[index].auto === true) throw conflict('This step is dispatched by the Flow Book runner. Refresh its status.');
        if (!canRunFlowStep(context.member, actions[index], String(runContext.startedBy || ''))) throw forbidden();
        if (['pos.register.count', 'pos.register.close'].includes(expected)) {
          if (typeof current.record_id !== 'string') throw badRequest('Link this Flow Book run to an open register.');
          const registerRows = await query<Record<string, unknown>>(client, { sql: "SELECT type,state FROM records WHERE id=? AND archived IS NULL", args: [current.record_id] }).pipe(Effect.runPromise);
          if (registerRows[0]?.type !== 'pos.register' || registerRows[0]?.state !== 'open') throw conflict('The linked register is no longer open.');
          input = { ...input, registerId: current.record_id };
        }
        if (Number(actions[index].version || 0) > 0 && findAction(expected)?.version !== Number(actions[index].version)) throw conflict('This Flow Book step needs a reviewed action migration before it can continue.');
        if (['flow.start', 'flow.advance', 'flow.publish'].includes(expected) || (runContext.source === 'book' && !bookActions.has(expected))) throw badRequest('This Flow Book contains a non-runnable Action.');
        const childKey = `flow:${runId}:${index}`;
        const result = await Effect.runPromise(executeGateway(client, context, { actionId: expected as ActionId, idempotencyKey: childKey, input }, services));
        const nextIndex = index + 1; const nextAction = nextIndex < actions.length ? text(actions[nextIndex].id, 160) : null;
        const nextContext = { ...runContext, step: nextIndex, outputs: [...(Array.isArray(runContext.outputs) ? runContext.outputs : []), { actionId: expected, result }] };
        const nextState = nextAction ? 'ready' : 'completed'; const finishedAt = nextAction ? null : at; const nextVersion = Number(current.version) + 1;
        const nextRun = { id: runId, flowId: String(current.flow_id), flowVersion: Number(current.flow_version), state: nextState, actionId: nextAction, step: nextIndex, version: nextVersion };
        const eventResult = { run: nextRun, result };
        const committed = await client.batch([
          { sql: 'UPDATE runs SET state=?,action_id=?,context=?,version=?,finished_at=?,updated_at=? WHERE id=? AND version=? AND state=\'ready\'', args: [nextState, nextAction, json(nextContext), nextVersion, finishedAt, at, runId, Number(current.version)] },
          stepStatement(runId, index, expected, input, result, at),
          { sql: `INSERT INTO events (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
            SELECT ?, 'action', ?, ?, ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`,
            args: [`evt_${crypto.randomUUID()}`, runId, typeof current.record_id === 'string' ? current.record_id : null, request.actionId, context.identity.id, hash, request.idempotencyKey, json({ result: eventResult }), at, at] },
        ], 'write');
        if (committed[0]?.rowsAffected !== 1 || committed[1]?.rowsAffected !== 1 || committed[2]?.rowsAffected !== 1) throw conflict('This Flow Book step was already continued. Refresh its status.');
        return eventResult;
      }

      const flowId = text(request.input.flowId, 160); if (!flowId) throw badRequest('Flow ID is required.');
      const definitions = await query<Record<string, unknown>>(client, { sql: 'SELECT * FROM definitions WHERE id=? AND kind=\'flow\' AND state=\'published\'', args: [flowId] }).pipe(Effect.runPromise);
      const flowDefinition = definitions[0]; if (!flowDefinition) throw notFound('Published Flow not found.');
      const data = object(JSON.parse(String(flowDefinition.data))); const actions = Array.isArray(data.actions) ? data.actions.map(object) : [];
      const first = actions[0]; if (!first || !text(first.id)) throw badRequest('Flow needs at least one Action.');
      const source = text(data.source, 40);
      if (actions.length > 20 || actions.some((item) => !findAction(text(item.id, 160)) || (source === 'book' && !bookActions.has(text(item.id, 160))) || (Number(item.version || 0) > 0 && findAction(text(item.id, 160))?.version !== Number(item.version)))) throw badRequest('Flow Book has an invalid, changed or unavailable Action.');
      const enabled = (await readCapabilities(client)).enabled;
      if (actions.some((item) => { const module = moduleForAction(text(item.id, 160)); return module !== null && !enabled[module]; })) throw forbidden();
      if (source === 'book' && !canRunFlowStep(context.member, first, context.identity.id)) throw forbidden();
      const recordId = text(request.input.recordId, 160) || null;
      const usesRegister = actions.some((item) => ['pos.register.count', 'pos.register.close'].includes(text(item.id, 160)));
      if (usesRegister && !recordId) throw badRequest('Choose the open register this Flow Book will update.');
      if (recordId) {
        const linked = await query<Record<string, unknown>>(client, { sql: 'SELECT * FROM records WHERE id=? AND archived IS NULL', args: [recordId] }).pipe(Effect.runPromise);
        if (!linked[0]) throw notFound('Related record not found.');
        if (!canReadRecord(context.member, rowToRecord(linked[0]))) throw forbidden();
        if (usesRegister && (String(linked[0].type) !== 'pos.register' || String(linked[0].state) !== 'open')) throw badRequest('Choose an open register record.');
      }
      const initialContext = { ...object(request.input.context), source, startedBy: context.identity.id, actions, step: 0, outputs: [] };
      const run: FlowRun = { id: `run_${crypto.randomUUID()}`, flowId, flowVersion: Number(flowDefinition.version), occurrence: request.idempotencyKey, recordId, state: 'ready', actionId: text(first.id), context: initialContext, version: 1 };
      await client.batch([
        runStatement({ id: run.id, flowId: run.flowId, flowVersion: run.flowVersion, occurrence: run.occurrence, recordId: run.recordId, state: run.state, actionId: run.actionId, context: run.context }),
        eventStatement({ action: request.actionId, actor: context.identity.id, runId: run.id, recordId: run.recordId, key: request.idempotencyKey, hash, result: { run } }),
      ], 'write');
      return { run };
    },
    catch: (cause) => cause instanceof Error && '_tag' in cause ? cause as GatewayError : unavailable('Action execution failed.', cause),
  });
}

export async function executeAutomaticFlowStep(client: Client, context: AccessContext, runId: string, expectedStep: number, services: GatewayServices = {}): Promise<{ state: string; step: number; advanced: boolean }> {
  const rows = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: 'SELECT * FROM runs WHERE id=?', args: [runId] }));
  const current = rows[0];
  if (!current) throw notFound('Flow Book run not found.');
  const runContext = object(JSON.parse(String(current.context)));
  const actions = Array.isArray(runContext.actions) ? runContext.actions.map(object) : [];
  const index = Number(runContext.step || 0);
  if (runContext.startedBy !== context.identity.id) throw forbidden();
  if (String(current.state) !== 'ready' || !Number.isSafeInteger(index) || index < 0 || index >= actions.length) return { state: String(current.state), step: index, advanced: false };
  if (index !== expectedStep) return { state: 'ready', step: index, advanced: index > expectedStep };
  const step = actions[index];
  const actionId = text(step.id, 160);
  if (step.auto !== true) return { state: 'ready', step: index, advanced: false };
  if (runContext.source !== 'book' || !unattendedActions.has(actionId) || !findAction(actionId) || findAction(actionId)?.version !== Number(step.version)) throw conflict('This automatic step needs review before it can resume.');
  if (typeof current.record_id === 'string') {
    const linked = await Effect.runPromise(query<Record<string, unknown>>(client, { sql: 'SELECT * FROM records WHERE id=? AND archived IS NULL', args: [current.record_id] }));
    if (!linked[0] || !canReadRecord(context.member, rowToRecord(linked[0]))) throw forbidden();
  }
  const input = object(step.input);
  const childKey = `flow:${runId}:${index}`;
  const result = await Effect.runPromise(executeGateway(client, context, { actionId: actionId as ActionId, idempotencyKey: childKey, input }, services));
  const nextIndex = index + 1;
  const nextAction = nextIndex < actions.length ? text(actions[nextIndex].id, 160) : null;
  const nextState = nextAction ? 'ready' : 'completed';
  const nextContext = { ...runContext, step: nextIndex, outputs: [...(Array.isArray(runContext.outputs) ? runContext.outputs : []), { actionId, result }] };
  const at = stamp();
  const progress = { run: { id: runId, flowId: String(current.flow_id), flowVersion: Number(current.flow_version), state: nextState, actionId: nextAction, step: nextIndex, version: Number(current.version) + 1 }, result };
  const hash = await fingerprint({ actor: context.identity.id, action: 'flow.advance', input: { runId, actionId, data: input } });
  const committed = await client.batch([
    { sql: "UPDATE runs SET state=?,action_id=?,context=?,version=version+1,finished_at=?,updated_at=? WHERE id=? AND version=? AND state='ready'", args: [nextState, nextAction, json(nextContext), nextAction ? null : at, at, runId, Number(current.version)] },
    stepStatement(runId, index, actionId, input, result, at),
    { sql: `INSERT INTO events (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, ?, 'flow.advance', 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`,
      args: [`evt_${crypto.randomUUID()}`, runId, typeof current.record_id === 'string' ? current.record_id : null, context.identity.id, hash, `auto:${runId}:${index}`, json({ result: progress }), at, at] },
  ], 'write');
  if (committed[0]?.rowsAffected !== 1) return { state: 'ready', step: index, advanced: false };
  if (committed[1]?.rowsAffected !== 1 || committed[2]?.rowsAffected !== 1) throw unavailable('Flow Book progress could not be saved.');
  return { state: nextState, step: nextIndex, advanced: true };
}
