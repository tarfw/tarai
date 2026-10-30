// Site assets: bytes live in the content bucket; only the record keeps the
// provenance. Rights are checked once, at upload; publish copies the bytes.

import type { Client } from '@libsql/client/web';
import { badRequest, conflict, notFound, unavailable } from '../errors.ts';
import type { AccessContext } from '../types.ts';
import { eventStatement } from '../gateway/commit.ts';
import { getSiteRecord, readSite } from './store.ts';

const now = () => Date.now();
const text = (value: unknown, max = 200): string => typeof value === 'string' ? value.trim().slice(0, max) : '';

export const ASSET_TYPES: Record<string, number> = {
  'image/png': 4_000_000, 'image/jpeg': 4_000_000, 'image/webp': 4_000_000,
  'image/avif': 4_000_000, 'image/gif': 4_000_000, 'image/svg+xml': 200_000,
};

const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'image/avif': 'avif', 'image/gif': 'gif', 'image/svg+xml': 'svg',
};

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function assetKey(context: AccessContext, siteId: string, asset: { id: string; mime: string }): string {
  return `workspaces/${context.workspace.id}/sites/${siteId}/assets/${asset.id}.${EXT[asset.mime] || 'bin'}`;
}

export async function readAsset(bucket: R2Bucket, context: AccessContext, siteId: string, asset: { id: string; mime: string }): Promise<Uint8Array | null> {
  const stored = await bucket.get(assetKey(context, siteId, asset));
  return stored ? new Uint8Array(await stored.arrayBuffer()) : null;
}

export async function executeSiteAssetUpload(
  client: Client,
  bucket: R2Bucket | undefined,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  hash: string,
): Promise<Record<string, unknown>> {
  if (!bucket) throw unavailable('Site asset storage is not configured.');
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined);
  if (!current) throw notFound('Site was not found.');
  const doc = readSite(current.data);
  if (!doc) throw badRequest('Rebuild the site draft before adding media.');
  const mime = text(input.mime, 60);
  const limit = ASSET_TYPES[mime];
  if (!limit) throw badRequest('Choose a registered image type.');
  const raw = text(input.data, 8_000_000);
  if (!raw) throw badRequest('Image data is required.');
  let bytes: Uint8Array;
  try { bytes = decodeBase64(raw); } catch { throw badRequest('Image data must be base64.'); }
  if (!bytes.byteLength || bytes.byteLength > limit) throw badRequest(`Assets must be between 1 byte and ${Math.floor(limit / 1_000_000)}MB.`);
  const asset = { id: `asset-${crypto.randomUUID()}`, mime, alt: text(input.alt, 120) || undefined };
  await bucket.put(assetKey(context, current.id, asset), bytes, {
    httpMetadata: { contentType: mime },
    customMetadata: { workspace: context.workspace.id, site: current.id, asset: asset.id },
  });
  const assets = [...doc.assets, asset].slice(0, 12);
  const next = { ...doc, assets, revision: doc.revision + 1 };
  const result = { siteId: current.id, revision: next.revision, assets };
  const at = now();
  const saved = await client.batch([
    { sql: 'UPDATE records SET data=?,version=?,updated=? WHERE id=? AND version=?', args: [JSON.stringify(next), current.version + 1, at, current.id, current.version] },
    eventStatement({ action: 'site.asset.upload', actor: context.identity.id, recordId: current.id, key, hash, result }),
  ], 'write');
  if (saved[0]?.rowsAffected !== 1 || saved[1]?.rowsAffected !== 1) throw conflict('Site changed while attaching the asset. Refresh and try again.');
  return result;
}
