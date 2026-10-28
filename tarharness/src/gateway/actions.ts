import type { Client, InStatement } from '@libsql/client/web';
import { Effect } from 'effect';
import { badRequest, conflict, forbidden, notFound, unavailable } from '../errors.ts';
import { query } from '../db/turso.ts';
import type { AccessContext, FlowDefinition, FlowRun, RecordItem } from '../types.ts';
import { findAction, type ActionId } from '../registry/catalog.ts';
import { canExecute, canReadRecord, canRunFlowStep } from '../access.ts';
import { executeSiteGenerate, executeSiteDesigns, executeSiteScout, executeSiteCompile, executeSitePublish, executeSitePublishLatest, executeSiteRollback, executeSiteRefresh, executeSiteUnpublish, executeSiteChecks, executeSiteReleases, executeSiteBriefAdd, executeSiteBriefRemove, executeSiteNoticeSet, executeSiteSectionsSet } from '../site/store.ts';
import { executeSiteAsk, executeSiteDesignImport, executeSiteEdit, executeSiteUndo } from '../site/edit.ts';
import { executeSiteAssetGenerate, executeSiteAssetUpload, executeSiteAssets } from '../site/asset.ts';
import { appendEvent, eventStatement, findReplay, fingerprint, runStatement, stamp, stepStatement } from './commit.ts';
import { commerceActionIds } from '../commerce/catalog.ts';
import { executeCommerce } from '../commerce/store.ts';
import { refreshCards, seedInbox, settleInbox, toolsTouchedBy } from '../truth/cards.ts';
import { executeChannelLog, executeChannelSend } from '../channel/adapters.ts';

type GatewayError = ReturnType<typeof badRequest> | ReturnType<typeof conflict> | ReturnType<typeof forbidden> | ReturnType<typeof notFound> | ReturnType<typeof unavailable>;
export interface GatewayRequest { readonly idempotencyKey: string; readonly actionId: ActionId; readonly input: Record<string, unknown>; }
export interface GatewayServices { readonly productContent?: R2Bucket; readonly telegramBotToken?: string; readonly siteReleases?: R2Bucket; readonly publication?: D1Database; readonly siteDomain?: string; readonly ai?: Ai; readonly tinyfish?: string; readonly typesafe?: string; readonly siteModel?: string; readonly groqApiKey?: string; readonly pexelsApiKey?: string }

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


const managedCommerceTypes = new Set([
  'item', 'variant', 'price', 'stock', 'purchase', 'order', 'invoice', 'payment',
  'refund', 'posting', 'movement', 'receipt', 'capability',
  'expense', 'transfer', 'supplier',
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
  return Effect.flatMap(Effect.tryPromise({
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
      for (const field of registeredAction.fields) {
        const value = request.input[field.key];
        if (field.required && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))) throw badRequest(`${field.label} is required.`);
        if ((field.kind === 'number' || field.kind === 'money' || field.kind === 'percent') && value !== undefined && (!Number.isFinite(Number(value)))) throw badRequest(`${field.label} must be a number.`);
        if (field.kind === 'email' && typeof value === 'string' && value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw badRequest(`${field.label} must be a valid email address.`);
      }
      const hash = await fingerprint({ actor: context.identity.id, action: request.actionId, input: request.input });
      const replay = await findReplay(client, request.idempotencyKey, hash);
      if (replay) return object(replay.result);
      const at = stamp();
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
            sql: `INSERT INTO move (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
                  SELECT ?, 'action', NULL, 'brief', ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`,
            args: [`evt_${crypto.randomUUID()}`, request.actionId, context.identity.id, hash, request.idempotencyKey, json({ result }), at, at],
          },
        ], 'write');
        return result;
      }
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
          { sql: `INSERT INTO move (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
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
          { sql: `INSERT INTO move (id,kind,run_id,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
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

      throw badRequest(`Action ${request.actionId} is not executable through the gateway.`);
    },
    catch: (cause) => cause instanceof Error && '_tag' in cause ? cause as GatewayError : unavailable('Action execution failed.', cause),
  }), (result) => Effect.promise(async () => {
    // Derived, best-effort, never fails the write: card numbers and inbox rows.
    try {
      const tools = toolsTouchedBy(request.actionId);
      if (tools.length) await refreshCards(client, tools);
      await settleInbox(client, context, request.actionId);
      await seedInbox(client, context, request.actionId, result);
    } catch (cause) {
      console.error(JSON.stringify({ event: 'derived.refresh.failed', action: request.actionId, error: cause instanceof Error ? cause.message : String(cause) }));
    }
    return result;
  }));
}
