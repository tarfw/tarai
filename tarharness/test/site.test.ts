import { createClient } from '@libsql/client';
import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { executeGateway } from '../src/gateway/actions.ts';
import { siteRegenerate } from '../src/site/store.ts';
import type { AccessContext } from '../src/types.ts';
import type { SiteDocument } from '../src/site/document.ts';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => {
  while (clients.length) clients.pop()?.close();
});

function releaseBucket(): R2Bucket & { objects: Map<string, string> } {
  const objects = new Map<string, string>();
  return {
    objects,
    put: async (key: string, value: string) => { objects.set(key, String(value)); return {} as R2Object; },
    get: async (key: string) => { const value = objects.get(key); return value === undefined ? null : ({ size: value.length, text: async () => value } as unknown as R2ObjectBody); },
    delete: async (key: string) => { objects.delete(key); },
  } as unknown as R2Bucket & { objects: Map<string, string> };
}

async function createTestWorkspace() {
  const client = createClient({ url: 'file::memory:' });
  clients.push(client);
  for (const statement of WORKSPACE_SCHEMA) await client.execute(statement);
  const at = Date.now();
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('capability','capability','Capabilities','active',?, 'owner_1',1,?,?)",
    args: [JSON.stringify({ site: true, pos: false, commerce: false }), at, at] });
  // A real published record: the storefront shows what the owner sells, never a stand-in.
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('prod_menu','pos.settings','Store','active','{\"currency\":\"INR\"}','owner_1',1,?,?)", args: [at, at] });
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('prod_garlic','pos.product','Garlic Bread','active','{\"price\":15000,\"shortDescription\":\"Fresh with herbs\"}','owner_1',1,?,?)", args: [at, at] });
  return client;
}

const ownerAccess: AccessContext = {
  identity: { id: 'owner_1', email: 'owner@slicehouse.in', name: 'Muthu' },
  workspace: { id: 'ws_slice', name: 'Slice House', slug: 'slice-house', mode: 'work', databaseName: 'slice', databaseHost: 'slice', state: 'active' },
  member: { workspaceId: 'ws_slice', userId: 'owner_1', role: 'owner', state: 'active' },
};

async function generate(client: Awaited<ReturnType<typeof createTestWorkspace>>, key: string, input: Record<string, unknown> = { title: 'Slice House', prompt: 'Pizza', records: ['prod_garlic'] }) {
  return Effect.runPromise(executeGateway(client, ownerAccess, { actionId: 'site.generate', idempotencyKey: key, input }));
}

async function candidate(client: Awaited<ReturnType<typeof createTestWorkspace>>, bucket: R2Bucket, siteId: string, key: string, domain?: string) {
  const compiled = await Effect.runPromise(executeGateway(client, ownerAccess, {
    actionId: 'site.compile', idempotencyKey: key, input: { siteId },
  }, { siteReleases: bucket, siteDomain: domain }));
  return { siteId, releaseId: String(compiled.releaseId), hash: String(compiled.hash) };
}

async function storedSite(client: Awaited<ReturnType<typeof createTestWorkspace>>, siteId: string): Promise<SiteDocument> {
  const row = await client.execute({ sql: 'SELECT data FROM records WHERE id=?', args: [siteId] });
  return JSON.parse(String(row.rows[0].data)) as SiteDocument;
}

const releaseFile = (site: SiteDocument, bucket: R2Bucket & { objects: Map<string, string> }, index: number, path: string): string => {
  const file = site.releases![index].files.find((entry) => entry.path === path)!;
  return String(bucket.objects.get(file.key));
};

/** What the owner does to sell something: a variant with a current channel price. */
async function addChannelItem(client: Awaited<ReturnType<typeof createTestWorkspace>>, id: string, title: string, amount: number): Promise<void> {
  const at = Date.now();
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES(?,'variant',?,'active',?,'owner_1',1,?,?)",
    args: [id, title, JSON.stringify({ item: 'prod_menu', description: `Fresh ${title}` }), at, at] });
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES(?,'price',?,'active',?,'owner_1',1,?,?)",
    args: [`${id}_price`, `Price of ${title}`, JSON.stringify({ variant: id, channel: 'default', amount, currency: 'INR', starts: at - 1000 }), at, at] });
}

describe('TAR Site lifecycle', () => {
  it('composes a valid single-page v2 draft whose only script is its own interaction runtime', async () => {
    const client = await createTestWorkspace();
    const first = await generate(client, 'compose-default');
    expect(first.version).toBe(1);
    expect(first.state).toBe('draft');
    const site = first.site as SiteDocument;
    expect(site.schema).toBe('2.0.0');
    expect(site.pages.map((page) => page.path)).toEqual(['/']);
    const preview = (first.preview as { html: string }).html;
    expect(preview).toContain('<!DOCTYPE html>');
    expect(preview).toContain('<html lang="en">');
    expect(preview).toContain('<meta property="og:title"');
    expect(preview).toContain('application/ld+json');
    expect(preview).toContain('Slice House');
    expect(preview).toContain('<script src="/site.js" defer>'); // A header menu cannot open without it
    expect(preview).not.toMatch(/<script[^>]+src="https?:/); // never a third-party script
    expect(preview).not.toContain('Signature Margherita');
    expect(site.claims ?? []).toEqual([]);
  });

  it('holds an empty storefront back and names what the merchant still has to supply', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const empty = await generate(client, 'gate-empty', { title: 'Slice House', prompt: 'Pizza' });
    expect(empty.state).toBe('draft');
    expect(empty.gate).toMatchObject({ ok: false });
    expect(((empty.missing ?? []) as { need: string }[]).map((entry) => entry.need)).toContain('item');
    expect((empty.site as SiteDocument).blueprint!.gate.ok).toBe(false);

    const preview = (empty.preview as { html: string }).html;
    // The honest empty shelf: nothing is invented in place of the owner's catalog.
    expect(preview).toContain('arriving shortly');
    for (const standIn of ['Signature Margherita', 'Garlic Bread', 'Product 1', '₹']) expect(preview).not.toContain(standIn);

    const reviewed = await candidate(client, bucket, String(empty.siteId), 'gate-compile');
    await expect(Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'gate-publish', input: reviewed,
    }, { siteReleases: bucket }))).rejects.toThrow('not ready to publish');
  });

  it('publishes the store in one call, and answers with what is missing when it cannot', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const draft = await generate(client, 'latest-draft', { title: 'Slice House', prompt: 'Pizza' });
    const siteId = String(draft.siteId);

    const blocked = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publishLatest', idempotencyKey: 'latest-blocked', input: { siteId },
    }, { siteReleases: bucket }));
    expect(blocked.published).toBe(false);
    expect(blocked.state).toBe('draft');
    expect(((blocked.missing ?? []) as { need: string }[]).map((entry) => entry.need)).toContain('item');
    // Nothing was compiled for a store that cannot publish, so the bucket holds no candidate.
    expect(bucket.objects.size).toBe(0);
    expect((await storedSite(client, siteId)).currentRelease).toBeFalsy();

    // The owner supplies the item they were told to add, then taps Publish again. One call
    // rebuilds the draft from the new facts and puts it live.
    const live = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publishLatest', idempotencyKey: 'latest-live', input: { siteId, records: ['prod_garlic'] },
    }, { siteReleases: bucket }));
    expect(live.published).toBe(true);
    expect(live.state).toBe('live');
    expect(live.regenerated).toBe(true);
    const site = await storedSite(client, siteId);
    expect(site.currentRelease).toBe(String(live.releaseId));
    expect(site.blueprint!.gate.ok).toBe(true);
    expect(releaseFile(site, bucket, site.releases!.length - 1, '/index.html')).toContain('Garlic Bread');

    // One merchant tap is one idempotency key: the retry replays, it does not republish.
    const replay = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publishLatest', idempotencyKey: 'latest-live', input: { siteId, records: ['prod_garlic'] },
    }, { siteReleases: bucket }));
    expect(replay).toEqual(live);
    const events = await client.execute({ sql: 'SELECT action_id FROM events WHERE idempotency_key=?', args: ['latest-live'] });
    expect(events.rows.map((row) => String(row.action_id))).toEqual(['site.publishLatest']);
  });

  it('rebuilds a draft when the owner records something new, and leaves a hand-edited store alone', async () => {
    const client = await createTestWorkspace();
    const draft = await generate(client, 'regen-draft', { title: 'Slice House', prompt: 'Pizza' });
    const siteId = String(draft.siteId);
    const built = await storedSite(client, siteId);
    expect(built.provenance).toMatchObject({ generator: 'agent', state: built.blueprint!.hash });

    // Nothing the owner recorded has moved, so the sweep passes the store by.
    expect(await siteRegenerate(client, ownerAccess, {}, siteId)).toMatchObject({ dirty: false });

    // A published channel price is the owner's signal that the item is real and for sale.
    await addChannelItem(client, 'var_choco', 'Chocolate Bread', 12000);
    const rebuilt = await siteRegenerate(client, ownerAccess, {}, siteId);
    expect(rebuilt).toMatchObject({ dirty: true, rebuilt: true });
    const fresh = await storedSite(client, siteId);
    expect(fresh.revision).toBeGreaterThan(built.revision);
    expect(JSON.stringify(fresh.pages)).toContain('Chocolate Bread');
    expect(fresh.provenance).toMatchObject({ generator: 'agent', state: fresh.blueprint!.hash });
    // The rebuild read the state it wrote, so the next tick has nothing to do.
    expect(await siteRegenerate(client, ownerAccess, {}, siteId)).toMatchObject({ dirty: false });

    // A hand edit is the owner's work: the sweep reports it instead of rebuilding over it.
    await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'regen-edit',
      input: { siteId, base: fresh.revision, operations: [{ op: 'set_text', target: 'hero-title', value: 'Muthu’s own headline' }] },
    }));
    await addChannelItem(client, 'var_rasm', 'Rasm Bun', 14000);
    const held = await siteRegenerate(client, ownerAccess, {}, siteId);
    expect(held).toMatchObject({ dirty: true, held: 'merchant' });
    const untouched = await storedSite(client, siteId);
    expect(untouched.provenance?.generator).toBe('merchant');
    expect(JSON.stringify(untouched.pages)).toContain('Muthu’s own headline');
    expect(JSON.stringify(untouched.pages)).not.toContain('Rasm Bun');
  });

  it('executes site.generate through the Gateway with idempotency', async () => {
    const client = await createTestWorkspace();
    const req = { actionId: 'site.generate' as const, idempotencyKey: 'site-gen-1',
      input: { title: 'Slice House', prompt: 'Best wood-fired pizza in Chennai', style: 'bold' } };
    const first = await Effect.runPromise(executeGateway(client, ownerAccess, req));
    expect(first.siteId).toBeDefined();
    expect((first.site as SiteDocument).design.theme).toBe('bold');
    expect(first.version).toBe(1);
    const replay = await Effect.runPromise(executeGateway(client, ownerAccess, req));
    expect(replay).toEqual(first);
    await expect(Effect.runPromise(executeGateway(client, ownerAccess, { ...req, input: { title: 'Different' } })))
      .rejects.toThrow('already used with different input');
  });

  it('replays a compiled candidate from the Gateway idempotency record', async () => {
    const client = await createTestWorkspace();
    const generated = await generate(client, 'site-gen-compile');
    const bucket = releaseBucket();
    const request = { actionId: 'site.compile' as const, idempotencyKey: 'site-compile-1', input: { siteId: String(generated.siteId) } };
    const first = await Effect.runPromise(executeGateway(client, ownerAccess, request, { siteReleases: bucket }));
    const replay = await Effect.runPromise(executeGateway(client, ownerAccess, request, { siteReleases: bucket }));
    expect(replay).toEqual(first);
  });

  it('publishes a verified site and supports rollback to an earlier release', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const generated = await generate(client, 'site-gen-3');
    const siteId = String(generated.siteId);

    const pub = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'site-pub-1', input: await candidate(client, bucket, siteId, 'site-candidate-1'),
    }, { siteReleases: bucket }));
    expect(pub.state).toBe('live');
    expect(pub.liveUrl).toBe('/v1/sites/slice-house');
    expect(pub.releaseId).toBeDefined();
    expect([...bucket.objects.values()].some((body) => body.includes('Slice House'))).toBe(true);

    const manifest = (await storedSite(client, siteId)).releases![0];
    for (const file of manifest.files) {
      const body = bucket.objects.get(file.key);
      expect(body).toBeDefined();
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
      const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      expect(file.hash).toBe(expected);
    }

    const firstReleaseId = String(pub.releaseId);

    await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'site-edit-v2', input: { siteId, base: 1, operations: [{ op: 'set_text', target: 'hero-title', value: 'Chennai’s Best Slice' }] },
    }, { siteReleases: bucket }));

    const pub2 = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'site-pub-2', input: await candidate(client, bucket, siteId, 'site-candidate-2'),
    }, { siteReleases: bucket }));
    expect(pub2.generation).toBe(2);

    const roll = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.rollback', idempotencyKey: 'site-rollback-1', input: { siteId, releaseId: firstReleaseId },
    }));
    expect(roll.rolledBack).toBe(true);
    expect(roll.releaseId).toBe(firstReleaseId);
  });

  it('uses the workspace slug for the public URL', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const generated = await generate(client, 'site-url-generate');
    const siteId = String(generated.siteId);
    const published = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'site-url-publish', input: await candidate(client, bucket, siteId, 'site-url-candidate'),
    }, { siteReleases: bucket }));
    expect(published.liveUrl).toBe('/v1/sites/slice-house');
  });

  it('regenerates the canonical record and retains its published releases', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const first = await generate(client, 'canonical-first');
    const published = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'canonical-publish', input: await candidate(client, bucket, String(first.siteId), 'canonical-candidate'),
    }, { siteReleases: bucket }));
    const second = await generate(client, 'canonical-second', { title: 'Slice House', prompt: 'Pizza and bread' });
    expect(second.siteId).toBe(first.siteId);
    expect((second.site as SiteDocument).currentRelease).toBe(published.releaseId);
    const rows = await client.execute("SELECT COUNT(*) AS count FROM records WHERE type='site' AND state='live'");
    expect(Number(rows.rows[0].count)).toBe(1);
  });

  it('refreshes public facts into a new release without an inference charge', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const at = Date.now();
    await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('pos.settings','pos.settings','Store','active','{\"currency\":\"INR\"}','owner_1',1,?,?)", args: [at, at] });
    await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('prod_1','pos.product','Garlic Bread','active','{\"price\":15000,\"description\":\"Fresh with herbs\"}','owner_1',1,?,?)", args: [at, at] });

    const generated = await generate(client, 'site-refresh-generate', { title: 'Slice House', prompt: 'Pizza', records: ['prod_1'], channel: 'default' });
    const siteId = String(generated.siteId);
    await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'site-refresh-initial', input: await candidate(client, bucket, siteId, 'site-refresh-candidate'),
    }, { siteReleases: bucket }));

    const firstRelease = await storedSite(client, siteId);
    expect(releaseFile(firstRelease, bucket, 0, '/index.html')).toContain('₹150.00');

    await client.execute({ sql: "UPDATE records SET data='{\"price\":19900}' WHERE id='prod_1'", args: [] });
    const refreshed = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.refresh', idempotencyKey: 'site-refresh-1', input: { siteId },
    }, { siteReleases: bucket }));
    expect(refreshed.refreshed).toBe(true);
    // Single-page storefront binds catalog.public on the home page.
    expect(refreshed.itemCount).toBe(1);

    const site = await storedSite(client, siteId);
    expect(site.releases).toHaveLength(2);
    const catalog = releaseFile(site, bucket, 1, '/index.html');
    expect(catalog).toContain('Garlic Bread');
    expect(catalog).toContain('₹199.00');
    expect(catalog).not.toContain('₹150.00');
  });

  it('rejects a stale or mismatched compiled candidate', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const generated = await generate(client, 'stale-generate');
    const siteId = String(generated.siteId);
    const reviewed = await candidate(client, bucket, siteId, 'stale-compile');
    await expect(Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'wrong-hash', input: { ...reviewed, hash: 'wrong' },
    }, { siteReleases: bucket }))).rejects.toThrow('stale or does not match');
    await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'stale-edit', input: { siteId, base: 1, operations: [{ op: 'set_text', target: 'hero-title', value: 'New draft' }] },
    }, { siteReleases: bucket }));
    await expect(Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'stale-publish', input: reviewed,
    }, { siteReleases: bucket }))).rejects.toThrow('stale or does not match');
    const row = await client.execute({ sql: 'SELECT state,data FROM records WHERE id=?', args: [siteId] });
    expect(row.rows[0].state).toBe('draft');
    expect((JSON.parse(String(row.rows[0].data)) as SiteDocument).releases).toEqual([]);
  });

  it('blocks refresh after unpublishing while preserving release history', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const generated = await generate(client, 'withdraw-generate');
    const siteId = String(generated.siteId);
    await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'withdraw-publish', input: await candidate(client, bucket, siteId, 'withdraw-compile'),
    }, { siteReleases: bucket }));
    let status = 'active';
    const control = {
      withSession: () => ({ prepare: () => ({ bind: () => ({ first: async () => ({ site: siteId, epoch: 1, status }) }) }) }),
      prepare: () => ({ bind: () => ({ run: async () => { status = 'paused'; return { meta: { changes: 1 } }; } }) }),
    } as unknown as D1Database;
    const withdrawn = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.unpublish', idempotencyKey: 'withdraw-action', input: { siteId },
    }, { publication: control }));
    expect(withdrawn.unpublished).toBe(true);
    expect(status).toBe('paused');
    const row = await client.execute({ sql: 'SELECT state,data FROM records WHERE id=?', args: [siteId] });
    expect(row.rows[0].state).toBe('draft');
    expect((JSON.parse(String(row.rows[0].data)) as SiteDocument).releases).toHaveLength(1);
    await expect(Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.refresh', idempotencyKey: 'withdraw-refresh', input: { siteId },
    }, { siteReleases: bucket }))).rejects.toThrow('Publish the site before refreshing');
  });

  it('keeps the draft unpublished when CONTROL activation fails', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const generated = await generate(client, 'control-generate');
    const siteId = String(generated.siteId);
    const reviewed = await candidate(client, bucket, siteId, 'control-compile', 'sites.example.test');
    const control = {
      withSession: () => ({ prepare: () => ({ bind: () => ({ first: async () => null }) }) }),
      batch: async () => { throw new Error('CONTROL unavailable'); },
    } as unknown as D1Database;
    await expect(Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'control-publish', input: reviewed,
    }, { siteReleases: bucket, publication: control, siteDomain: 'sites.example.test' }))).rejects.toThrow('Action execution failed.');
    const row = await client.execute({ sql: 'SELECT state,data FROM records WHERE id=?', args: [siteId] });
    expect(row.rows[0].state).toBe('draft');
    expect((JSON.parse(String(row.rows[0].data)) as SiteDocument).currentRelease).toBeNull();
  });

  it('pins canonical metadata, sitemap and robots to the compiled candidate', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const generated = await generate(client, 'seo-generate');
    const siteId = String(generated.siteId);
    const compiled = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.compile', idempotencyKey: 'seo-compile', input: { siteId },
    }, { siteReleases: bucket, siteDomain: 'sites.example.test' }));
    const prefix = `workspaces/${ownerAccess.workspace.id}/sites/${siteId}/releases/${compiled.releaseId}`;
    expect(bucket.objects.get(`${prefix}/index.html`)).toContain('href="https://slice-house.sites.example.test/"');
    expect(bucket.objects.get(`${prefix}/sitemap.xml`)).toContain('<loc>https://slice-house.sites.example.test/</loc>');
    expect(bucket.objects.get(`${prefix}/robots.txt`)).toContain('Sitemap: https://slice-house.sites.example.test/sitemap.xml');
  });

  it('publishes a reviewed candidate on a shared Workers.dev path', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const generated = await generate(client, 'worker-generate');
    const siteId = String(generated.siteId);
    const origin = 'https://tar-sites.tar-54d.workers.dev';
    const reviewed = await candidate(client, bucket, siteId, 'worker-compile', origin);
    const prefix = `workspaces/${ownerAccess.workspace.id}/sites/${siteId}/releases/${reviewed.releaseId}`;
    expect(bucket.objects.get(`${prefix}/index.html`)).toContain('href="https://tar-sites.tar-54d.workers.dev/slice-house/"');
    expect(bucket.objects.get(`${prefix}/sitemap.xml`)).toContain('<loc>https://tar-sites.tar-54d.workers.dev/slice-house/</loc>');
    const moved = {
      withSession: () => ({ prepare: () => ({ bind: () => ({ first: async () => ({ site: siteId, epoch: 1, release: 'another', hash: 'another', domain: 'tar-sites.tar-54d.workers.dev', mode: 'path', status: 'active' }) }) }) }),
    } as unknown as D1Database;
    await expect(Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'worker-competing-publish', input: reviewed,
    }, { siteReleases: bucket, publication: moved, siteDomain: origin }))).rejects.toThrow('Live publication changed since');
    const statements: string[] = [];
    const control = {
      withSession: () => ({ prepare: (sql: string) => ({ bind: () => ({ first: async () => { statements.push(sql); return null; } }) }) }),
      prepare: (sql: string) => ({ bind: () => { statements.push(sql); return {}; } }),
      batch: async (batch: unknown[]) => { expect(batch).toHaveLength(1); return [{ meta: { changes: 1 } }]; },
    } as unknown as D1Database;
    const published = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'worker-publish', input: reviewed,
    }, { siteReleases: bucket, publication: control, siteDomain: origin }));
    expect(published.publicUrl).toBe(`${origin}/slice-house`);
    expect(statements.some((sql) => sql.includes('INSERT INTO sites('))).toBe(true);
    expect(statements.some((sql) => sql.includes('INSERT INTO hosts('))).toBe(false);
  });

  it('excludes active workspace records unless they are approved for the public binding', async () => {
    const client = await createTestWorkspace();
    await client.execute("INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('private','pos.product','Private inventory','active','{\"price\":100}','owner_1',1,1,1)");
    const generated = await generate(client, 'private-generate', { title: 'Shop', prompt: 'A supplied description' });
    const bucket = releaseBucket();
    await candidate(client, bucket, String(generated.siteId), 'private-compile');
    expect([...bucket.objects.values()].join('\n')).not.toContain('Private inventory');
  });

  it('uses only an approved variant and its current price in the selected channel', async () => {
    const client = await createTestWorkspace();
    const at = Date.now();
    const records = [
      { id: 'visible', type: 'variant', title: 'Approved variant', data: {} },
      { id: 'hidden', type: 'variant', title: 'Private variant', data: {} },
      { id: 'web', type: 'price', title: 'Web price', data: { variant: 'visible', amount: 10000, currency: 'USD', channel: 'web', starts: 1 } },
      { id: 'internal', type: 'price', title: 'Internal price', data: { variant: 'visible', amount: 90000, currency: 'USD', channel: 'wholesale', starts: 1 } },
      { id: 'expired', type: 'price', title: 'Expired price', data: { variant: 'visible', amount: 80000, currency: 'USD', channel: 'web', starts: 1, ends: at - 1000 } },
      { id: 'future', type: 'price', title: 'Future price', data: { variant: 'visible', amount: 70000, currency: 'USD', channel: 'web', starts: at + 60_000 } },
      { id: 'private', type: 'price', title: 'Private price', data: { variant: 'hidden', amount: 60000, currency: 'USD', channel: 'web', starts: 1 } },
    ];
    await client.batch(records.map((record) => ({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES(?,?,?,'active',?,'owner_1',1,?,?)",
      args: [record.id, record.type, record.title, JSON.stringify(record.data), at, at] })), 'write');
    const generated = await generate(client, 'prices-generate', { title: 'Shop', prompt: 'A supplied description', records: ['visible'], channel: 'web' });
    const siteId = String(generated.siteId);
    const bucket = releaseBucket();
    const reviewed = await candidate(client, bucket, siteId, 'prices-compile');
    const page = bucket.objects.get(`workspaces/${ownerAccess.workspace.id}/sites/${siteId}/releases/${reviewed.releaseId}/index.html`);
    expect(page).toContain('Approved variant');
    expect(page).toContain('$100.00');
    expect(page).not.toContain('Private variant');
    for (const price of ['$900.00', '$800.00', '$700.00', '$600.00']) expect(page).not.toContain(price);
  });

  it('auto-binds the owner\'s channel-priced catalog into a real shop with no hand-picked records', async () => {
    const client = await createTestWorkspace();
    const at = Date.now();
    const records = [
      { id: 'loaf', type: 'variant', title: 'Sourdough Loaf', data: { description: 'Wood fired daily' } },
      { id: 'croissant', type: 'variant', title: 'Butter Croissant', data: {} },
      { id: 'staff', type: 'variant', title: 'Staff Only Item', data: {} },
      { id: 'p1', type: 'price', title: 'Loaf price', data: { variant: 'loaf', amount: 4500, currency: 'USD', channel: 'default', starts: 1 } },
      { id: 'p2', type: 'price', title: 'Croissant price', data: { variant: 'croissant', amount: 300, currency: 'USD', channel: 'default', starts: 1 } },
      { id: 'p3', type: 'price', title: 'Wholesale price', data: { variant: 'staff', amount: 100, currency: 'USD', channel: 'wholesale', starts: 1 } },
    ];
    await client.batch(records.map((record) => ({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES(?,?,?,'active',?,'owner_1',1,?,?)",
      args: [record.id, record.type, record.title, JSON.stringify(record.data), at, at] })), 'write');
    // No records passed: the two default-channel priced variants are discovered automatically,
    // while a bare variant with only a wholesale price stays private.
    const generated = await generate(client, 'autobind-generate', { title: 'Bakery', prompt: 'A wood fired bakery' });
    const site = generated.site as SiteDocument;
    expect(site.pages.map((page) => page.path)).toEqual(['/']);
    const bucket = releaseBucket();
    const reviewed = await candidate(client, bucket, String(generated.siteId), 'autobind-compile');
    const page = bucket.objects.get(`workspaces/${ownerAccess.workspace.id}/sites/${generated.siteId}/releases/${reviewed.releaseId}/index.html`);
    expect(page).toContain('Sourdough Loaf');
    expect(page).toContain('$45.00');
    expect(page).toContain('Butter Croissant');
    expect(page).not.toContain('Staff Only Item');
  });
});

describe('design library API', () => {
  it('serves reviewed designs and nothing the merchant has no business seeing', async () => {
    const client = await createTestWorkspace();
    const generated = await generate(client, 'designs-api');
    const result = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.designs', idempotencyKey: 'designs-listed', input: { siteId: String(generated.siteId) },
    }));
    const designs = result.designs as { id: string; name: string; desc: string; swatches: string[]; tone: string; density: string }[];
    expect(designs.map((design) => design.id)).toEqual(['bold', 'luxury', 'warm']);
    expect(result.default).toBe('luxury');
    for (const design of designs) {
      expect(design.swatches.length).toBeGreaterThanOrEqual(3);
      expect(design.swatches.every((swatch) => /^#[0-9a-f]{6}$/.test(swatch))).toBe(true);
      expect(design.name).toBeTruthy();
      expect(design.desc).toBeTruthy();
    }
    // parai D13: the source files, their brands and their licence notes stay in the build.
    const payload = JSON.stringify(result).toLowerCase();
    for (const leak of ['mollie', 'magic spoon', 'arte', 'high protein', 'refero', 'design1.md', 'license', 'attribution', 'reviewer']) {
      expect(payload, `designs payload leaked "${leak}"`).not.toContain(leak);
    }
  });

  it('answers the sections a model set demands, and accepts models as words', async () => {
    const client = await createTestWorkspace();
    const result = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.designs', idempotencyKey: 'designs-models', input: { models: 'products, booking, nonsense' },
    }));
    expect(result.models).toEqual(['products', 'booking']);
    const required = result.sections as { required: string[]; optional: string[] };
    expect(required.required).toEqual(['header', 'hero', 'catalog', 'booking', 'faq', 'policy', 'contact', 'footer']);
    expect(required.optional).toEqual(['announcement', 'spotlight', 'story', 'trust']);
  });

  it('reports the stored models when a site is named', async () => {
    const client = await createTestWorkspace();
    const generated = await generate(client, 'designs-site-models', { title: 'Kanchi Silks', prompt: 'Handloom silk sarees, custom bridal orders', models: ['products', 'quote'], records: ['prod_garlic'] });
    const result = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.designs', idempotencyKey: 'designs-stored', input: { siteId: String(generated.siteId) },
    }));
    expect(result.models).toEqual(['products', 'quote']);
    const site = generated.site as SiteDocument;
    expect(['bold', 'luxury', 'warm']).toContain(site.design.theme);
    expect((site.blueprint?.profile?.models || []).sort()).toEqual(['products', 'quote']);
  });
});
