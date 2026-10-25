/**
 * Site assets: provenance, rights and generated illustrations.
 *
 * Media lives in the existing content bucket under a site prefix and is copied
 * into an immutable release only when its rights are approved. Generated images
 * are marked as illustrations and can never stand in for product evidence.
 */

import type { Client } from '@libsql/client/web';
import { badRequest, conflict, notFound, unavailable } from '../errors.ts';
import type { AccessContext } from '../types.ts';
import { eventStatement } from '../gateway/commit.ts';
import type { Asset } from './document.ts';
import { readDocument } from './adapt.ts';
import { applyPatch, type PatchOperation } from './patch.ts';
import { validateDocument } from './validate.ts';
import { getSiteRecord } from './store.ts';

const now = () => Date.now();
const text = (value: unknown, max = 200): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export const ASSET_TYPES: Record<string, { kinds: string[]; limit: number }> = {
  'image/png': { kinds: ['image'], limit: 4_000_000 },
  'image/jpeg': { kinds: ['image'], limit: 4_000_000 },
  'image/webp': { kinds: ['image'], limit: 4_000_000 },
  'image/avif': { kinds: ['image'], limit: 4_000_000 },
  'image/gif': { kinds: ['image'], limit: 4_000_000 },
  'image/svg+xml': { kinds: ['image', 'icon'], limit: 200_000 },
  'video/mp4': { kinds: ['video'], limit: 8_000_000 },
  'video/webm': { kinds: ['video'], limit: 8_000_000 },
  'font/woff2': { kinds: ['font'], limit: 1_000_000 },
};

const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif',
  'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'font/woff2': 'woff2',
};

const IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function digest(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer));
  return [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function assetKey(context: AccessContext, siteId: string, asset: { id: string; mime: string }): string {
  return `workspaces/${context.workspace.id}/sites/${siteId}/assets/${asset.id}.${EXT[asset.mime] || 'bin'}`;
}

/** Reader used by the compiler to copy approved media into a release. */
export function assetReader(bucket: R2Bucket | undefined, context: AccessContext, siteId: string) {
  return async (asset: Asset): Promise<Uint8Array | null> => {
    if (!bucket) return null;
    const object = await bucket.get(assetKey(context, siteId, asset));
    if (!object) return null;
    return new Uint8Array(await object.arrayBuffer());
  };
}

export interface StoredAsset {
  id: string;
  kind: string;
  mime: string;
  bytes: number;
  hash: string;
  width?: number;
  height?: number;
  alt?: string;
  rights: { source: string; license: string; approved: boolean; note?: string };
  generated?: boolean;
  prompt?: string;
  placeholder?: boolean;
}

export async function store(
  bucket: R2Bucket | undefined,
  context: AccessContext,
  siteId: string,
  input: { mime: string; kind: string; bytes: Uint8Array; alt?: string; source: string; license: string; approved: boolean; generated?: boolean; prompt?: string; width?: number; height?: number; placeholder?: boolean },
): Promise<StoredAsset> {
  if (!bucket) throw unavailable('Site asset storage is not configured.');
  const allowed = ASSET_TYPES[input.mime];
  if (!allowed || !allowed.kinds.includes(input.kind)) throw badRequest('Choose a registered asset type.');
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > allowed.limit) throw badRequest(`Assets must be between 1 byte and ${Math.floor(allowed.limit / 1_000_000)}MB.`);
  const id = `asset-${crypto.randomUUID()}`;
  const asset: StoredAsset = {
    id, kind: input.kind, mime: input.mime, bytes: input.bytes.byteLength, hash: await digest(input.bytes),
    ...(input.width ? { width: input.width } : {}), ...(input.height ? { height: input.height } : {}),
    ...(input.alt ? { alt: input.alt } : {}),
    rights: { source: input.source.slice(0, 200), license: input.license.slice(0, 120), approved: input.approved },
    ...(input.generated ? { generated: true } : {}),
    ...(input.prompt ? { prompt: input.prompt.slice(0, 300) } : {}),
    ...(input.placeholder ? { placeholder: true } : {}),
  };
  await bucket.put(assetKey(context, siteId, asset), input.bytes, {
    httpMetadata: { contentType: input.mime },
    customMetadata: { workspace: context.workspace.id, site: siteId, asset: id, generated: input.generated ? 'true' : 'false', placeholder: input.placeholder ? 'true' : 'false' },
  });
  return asset;
}

export async function attach(
  client: Client,
  context: AccessContext,
  siteId: string,
  operations: PatchOperation[],
  key: string,
  inputHash: string,
  action: string,
): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, siteId);
  if (!current) throw notFound('Site was not found.');
  const { doc } = readDocument(current.data);
  const next = applyPatch(doc, { base: doc.revision, operations, respectLocks: false });
  validateDocument(next);
  const version = current.version + 1;
  const at = now();
  const result: Record<string, unknown> = { siteId, version, revision: next.revision, site: next, assets: next.assets };
  const saved = await client.batch([
    { sql: 'UPDATE records SET data=?,version=?,updated=? WHERE id=? AND version=?', args: [JSON.stringify(next), version, at, siteId, current.version] },
    { sql: `INSERT INTO move(id,kind,record_id,action_id,state,actor_id,input_hash,idempotency_key,data,created_at,updated_at)
      SELECT ?, 'action', ?, ?, 'accepted', ?, ?, ?, ?, ?, ? WHERE changes()=1`, args: [`evt_${crypto.randomUUID()}`, siteId, action, context.identity.id, inputHash, key, JSON.stringify({ result }), at, at] },
  ], 'write');
  if (saved[0].rowsAffected !== 1 || saved[1].rowsAffected !== 1) throw conflict('Site changed while attaching the asset. Refresh and try again.');
  return result;
}

export async function executeSiteAssetUpload(
  client: Client,
  bucket: R2Bucket | undefined,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  inputHash: string,
): Promise<Record<string, unknown>> {
  const siteId = text(input.siteId, 160) || (await getSiteRecord(client))?.id || '';
  if (!siteId) throw notFound('Site was not found.');
  const data = text(input.data, 12_000_000);
  if (!data) throw badRequest('Provide the asset bytes.');
  let bytes: Uint8Array;
  try { bytes = decodeBase64(data); } catch { throw badRequest('Asset data must be base64 encoded.'); }
  const mime = text(input.mime, 80).toLowerCase();
  const kind = text(input.kind, 20) || ASSET_TYPES[mime]?.kinds[0] || 'image';
  const rights = object(input.rights);
  const asset = await store(bucket, context, siteId, {
    mime, kind, bytes,
    alt: text(input.alt, 300),
    source: text(rights.source, 200) || 'workspace upload',
    license: text(rights.license, 120) || 'owned',
    approved: rights.approved === true,
    width: Number(input.width) || undefined,
    height: Number(input.height) || undefined,
  });
  return attach(client, context, siteId, [{ op: 'add_asset', asset: asset as never }], key, inputHash, 'site.asset.upload');
}

/** Generate one illustrative image; generated media never evidences product facts. */
export async function executeSiteAssetGenerate(
  client: Client,
  bucket: R2Bucket | undefined,
  ai: Ai | undefined,
  context: AccessContext,
  input: Record<string, unknown>,
  key: string,
  inputHash: string,
): Promise<Record<string, unknown>> {
  if (!ai) throw unavailable('Image generation is not configured.');
  const siteId = text(input.siteId, 160) || (await getSiteRecord(client))?.id || '';
  if (!siteId) throw notFound('Site was not found.');
  const prompt = text(input.prompt, 300);
  if (!prompt) throw badRequest('Describe the illustration to generate.');
  let output: unknown;
  try {
    output = await ai.run(IMAGE_MODEL, { prompt, steps: Number(input.steps) || 4 });
  } catch (cause) {
    throw unavailable('Illustration generation failed. Try again shortly.', cause);
  }
  const bytes = output instanceof Uint8Array
    ? output
    : output instanceof ArrayBuffer
      ? new Uint8Array(output)
      : typeof (output as { image?: unknown })?.image === 'string'
        ? decodeBase64(String((output as { image: string }).image))
        : null;
  if (!bytes?.byteLength) throw unavailable('Illustration generation returned no image.');
  const asset = await store(bucket, context, siteId, {
    mime: 'image/png', kind: 'image', bytes,
    alt: text(input.alt, 300) || prompt,
    source: 'generated illustration', license: 'generated', approved: false,
    generated: true, prompt,
  });
  return attach(client, context, siteId, [{ op: 'add_asset', asset: asset as never }], key, inputHash, 'site.asset.generate');
}

export async function executeSiteAssets(
  client: Client,
  context: AccessContext,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const current = await getSiteRecord(client, text(input.siteId, 160) || undefined);
  if (!current) throw notFound('Site was not found.');
  const { doc } = readDocument(current.data);
  const used = new Set<string>();
  const walk = (nodes: { props?: Record<string, unknown>; children?: unknown[] }[]) => (nodes || []).forEach((node) => {
    if (typeof node.props?.asset === 'string') used.add(String(node.props.asset));
    if (Array.isArray(node.props?.assets)) (node.props.assets as unknown[]).forEach((id) => used.add(String(id)));
    walk((node.children || []) as { props?: Record<string, unknown>; children?: unknown[] }[]);
  });
  doc.pages.forEach((page) => page.sections.forEach((section) => walk(section.nodes as never)));
  return {
    siteId: current.id,
    revision: doc.revision,
    assets: doc.assets.map((asset) => ({
      ...asset,
      used: used.has(asset.id),
      url: `/media/${asset.id}.${EXT[asset.mime] || 'bin'}`,
      bytes: asset.bytes,
    })),
  };
}
