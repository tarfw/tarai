import type { Client } from '@libsql/client/web';
import { badRequest, conflict, notFound, unavailable } from '../errors.ts';
import type { AccessContext } from '../types.ts';

type Data = Record<string, unknown>;
const object = (value: unknown): Data => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const productKey = (workspaceId: string, productId: string, version: number) => `workspaces/${workspaceId}/products/${productId}/content-v${version}.json`;

function content(input: Data) {
  const sourceUrl = text(input.sourceUrl, 2_000);
  if (sourceUrl && !/^https:\/\//i.test(sourceUrl)) throw badRequest('Reference page must use an HTTPS URL.');
  return {
    longDescription: text(input.longDescription, 40_000),
    specifications: text(input.specifications, 20_000),
    sourceUrl,
    sourceNotes: text(input.sourceNotes, 30_000),
    updatedAt: Date.now(),
  };
}

export async function saveProductContent(client: Client, bucket: R2Bucket | undefined, context: AccessContext, input: Data, event: { key: string; hash: string }) {
  if (!bucket) throw unavailable('Product content storage is not configured.');
  const productId = text(input.productId, 200);
  const version = Number(input.version);
  const rows = await client.execute({ sql: "SELECT title,data,version FROM records WHERE id=? AND type='pos.product' AND archived IS NULL", args: [productId] });
  if (!rows.rows[0]) throw notFound('Product not found.');
  if (!Number.isSafeInteger(version) || Number(rows.rows[0].version) !== version) throw conflict('Product changed. Reload before saving content.');
  const payload = content(input);
  const body = JSON.stringify(payload);
  const key = productKey(context.workspace.id, productId, version + 1);
  await bucket.put(key, body, { httpMetadata: { contentType: 'application/json; charset=utf-8' }, customMetadata: { workspaceId: context.workspace.id, productId } });
  const current = object(JSON.parse(String(rows.rows[0].data)));
  const previousKey = typeof current.contentKey === 'string' ? current.contentKey : '';
  const summary = payload.longDescription.slice(0, 200);
  const at = Date.now();
  const result = { productId, version: version + 1, contentKey: key, contentBytes: new TextEncoder().encode(body).byteLength };
  const tx = await client.transaction('write');
  try {
    const latest = await tx.execute({ sql: "SELECT version FROM records WHERE id=? AND type='pos.product' AND archived IS NULL", args: [productId] });
    if (Number(latest.rows[0]?.version) !== version) throw conflict('Product changed. Reload before saving content.');
    await tx.execute({ sql: 'UPDATE records SET data=?,version=version+1,updated=? WHERE id=? AND version=?', args: [JSON.stringify({ ...current, contentKey: key, contentBytes: result.contentBytes, contentSummary: summary }), at, productId, version] });
    await tx.execute({ sql: `INSERT INTO events(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at) VALUES(?,'action',?,'pos.product.content.save','accepted',?,?,?,?,?,?)`, args: ['evt_' + crypto.randomUUID(), productId, context.identity.id, event.hash, event.key, JSON.stringify({ result }), at, at] });
    await tx.commit();
  } catch (cause) { await tx.rollback().catch(() => undefined); throw cause; }
  finally { tx.close(); }
  if (previousKey && previousKey !== key) await bucket.delete(previousKey).catch(() => undefined);
  return result;
}

export async function readProductContent(client: Client, bucket: R2Bucket | undefined, context: AccessContext, productId: string) {
  if (!bucket) throw unavailable('Product content storage is not configured.');
  const rows = await client.execute({ sql: "SELECT data FROM records WHERE id=? AND type='pos.product' AND archived IS NULL", args: [productId] });
  if (!rows.rows[0]) throw notFound('Product not found.');
  const key = object(JSON.parse(String(rows.rows[0].data))).contentKey;
  if (typeof key !== 'string' || !key) return {};
  const stored = await bucket.get(key);
  return stored ? object(await stored.json()) : {};
}
