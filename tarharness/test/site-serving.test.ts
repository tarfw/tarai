import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { Effect } from 'effect';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { executeGateway } from '../src/gateway/actions.ts';
import type { AccessContext } from '../src/types.ts';

let runtime: Miniflare;
let control: D1Database;
let bucket: R2Bucket;
const clients: ReturnType<typeof createClient>[] = [];
const origin = 'https://tar-sites.tar-54d.workers.dev';

beforeAll(async () => {
  runtime = new Miniflare(convertV4MiniflareOptions({
    name: 'sites-test', modules: true, compatibilityDate: '2026-09-05',
    script: readFileSync(new URL('../../sites/src/index.js', import.meta.url), 'utf8'),
    d1Databases: ['CONTROL'], r2Buckets: ['SITE_RELEASES'],
  }));
  control = await runtime.getD1Database('CONTROL') as unknown as D1Database;
  bucket = await runtime.getR2Bucket('SITE_RELEASES') as unknown as R2Bucket;
  for (const file of ['0001_control.sql', '0004_sites.sql']) {
    const sql = readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
    for (const statement of sql.split(';').filter((part) => part.trim())) await control.prepare(statement).run();
  }
  await control.prepare("INSERT INTO users(id,email,created_at,updated_at) VALUES('owner','owner@example.test',1,1)").run();
}, 60_000);

afterAll(async () => {
  for (const client of clients) client.close();
  await runtime?.dispose();
});

async function workspace(slug: string) {
  await control.prepare("INSERT INTO workspaces(id,owner_id,name,slug,mode,database_name,state,created_at,updated_at) VALUES(?,'owner',?,?,'work',?,'active',1,1)")
    .bind(slug, slug, slug, slug).run();
  const context: AccessContext = {
    identity: { id: 'owner', email: 'owner@example.test', name: 'Owner' },
    workspace: { id: slug, name: slug, slug, mode: 'work', databaseName: slug, databaseHost: slug, state: 'active' },
    member: { workspaceId: slug, userId: 'owner', role: 'owner', state: 'active' },
  };
  const client = createClient({ url: 'file::memory:' });
  clients.push(client);
  for (const statement of WORKSPACE_SCHEMA) await client.execute(statement);
  await client.execute("INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('capability','capability','Capabilities','active','{\"site\":true}','owner',1,1,1)");
  // A real published record: the storefront shows what the owner sells, never a stand-in.
  await client.execute("INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('store','pos.settings','Store','active','{\"currency\":\"INR\"}','owner',1,1,1)");
  await client.execute("INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('loaves','variant','Sourdough Loaf','active','{\"description\":\"Wood fired daily\"}','owner',1,1,1)");
  await client.execute("INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('loaves-price','price','Loaf price','active','{\"variant\":\"loaves\",\"channel\":\"default\",\"amount\":25000,\"currency\":\"INR\",\"starts\":1}','owner',1,1,1)");
  const run = (actionId: Parameters<typeof executeGateway>[2]['actionId'], key: string, input: Record<string, unknown>, domain = origin) =>
    Effect.runPromise(executeGateway(client, context, { actionId, idempotencyKey: key, input }, {
      publication: control, siteReleases: bucket, siteDomain: domain,
    }));
  const generated = await run('site.generate', `${slug}-generate`, { title: slug, prompt: 'A supplied business description', records: ['loaves'] });
  const compiled = await run('site.compile', `${slug}-compile`, { siteId: generated.siteId });
  await run('site.publish', `${slug}-publish`, { siteId: generated.siteId, releaseId: compiled.releaseId, hash: compiled.hash });
  return { run, client, siteId: String(generated.siteId), releaseId: String(compiled.releaseId) };
}

it('publishes, isolates, unpublishes and restores two real D1/R2 releases', async () => {
  const alpha = await workspace('alpha');
  const beta = await workspace('beta');
  const pointer = await control.prepare('SELECT domain,mode FROM sites WHERE workspace=?').bind('alpha').first();
  expect(pointer).toMatchObject({ domain: 'tar-sites.tar-54d.workers.dev', mode: 'path' });
  expect((await control.prepare('SELECT COUNT(*) AS count FROM hosts').first())?.count).toBe(0);
  const page = await runtime.dispatchFetch(`${origin}/alpha/`);
  expect(page.status).toBe(200);
  // The edge worker rewrites root-relative asset links into the path prefix.
  expect(await page.text()).toContain('href="/alpha/style.css');
  expect((await runtime.dispatchFetch(`${origin}/beta/`)).status).toBe(200);
  expect((await runtime.dispatchFetch(`${origin}/alpha/beta/`)).status).toBe(404);
  await alpha.run('site.unpublish', 'alpha-unpublish', { siteId: alpha.siteId });
  expect((await runtime.dispatchFetch(`${origin}/alpha/`)).status).toBe(404);
  expect((await runtime.dispatchFetch(`${origin}/beta/`)).status).toBe(200);
  await alpha.run('site.rollback', 'alpha-restore', { siteId: alpha.siteId, releaseId: alpha.releaseId });
  expect((await runtime.dispatchFetch(`${origin}/alpha/`)).status).toBe(200);
  expect((await alpha.client.execute({ sql: 'SELECT state FROM records WHERE id=?', args: [alpha.siteId] })).rows[0].state).toBe('live');
  // A collection bound to a live product publishes; archiving that product makes
  // the retained facts differ, so restoring the old release is refused.
  await alpha.client.execute("INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('product','variant','Approved product','active','{}','owner',1,1,1)");
  await alpha.client.execute("INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('product-price','price','Approved price','active','{\"variant\":\"product\",\"channel\":\"default\",\"amount\":4200,\"currency\":\"INR\",\"starts\":1}','owner',1,1,1)");
  await alpha.run('site.generate', 'alpha-catalog', { title: 'alpha', prompt: 'A supplied business description', records: ['product'] });
  const checked = await alpha.run('site.compile', 'alpha-recompile', { siteId: alpha.siteId });
  await alpha.run('site.publish', 'alpha-republish', { siteId: alpha.siteId, releaseId: checked.releaseId, hash: checked.hash });
  await alpha.run('site.unpublish', 'alpha-withdraw', { siteId: alpha.siteId });
  await alpha.client.execute("UPDATE records SET archived=2 WHERE id='product'");
  await expect(alpha.run('site.rollback', 'alpha-stale', { siteId: alpha.siteId, releaseId: checked.releaseId })).rejects.toThrow('Public facts changed');
  expect((await runtime.dispatchFetch(`${origin}/alpha/`)).status).toBe(404);
  const moved = await beta.run('site.compile', 'beta-host', { siteId: beta.siteId }, 'example.test');
  await beta.run('site.publish', 'beta-domain', { siteId: beta.siteId, releaseId: moved.releaseId, hash: moved.hash }, 'example.test');
  expect((await runtime.dispatchFetch(`${origin}/beta/`)).status).toBe(404);
  expect((await runtime.dispatchFetch('https://beta.example.test/')).status).toBe(200);
  await control.prepare("UPDATE workspaces SET state='archived' WHERE id='beta'").run();
  expect((await runtime.dispatchFetch('https://beta.example.test/')).status).toBe(404);
}, 90_000);
