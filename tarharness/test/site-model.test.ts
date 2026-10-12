import { createClient } from '@libsql/client';
import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { executeGateway } from '../src/gateway/actions.ts';
import type { AccessContext } from '../src/types.ts';
import type { SiteDocument } from '../src/site/document.ts';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => {
  while (clients.length) clients.pop()?.close();
  vi.unstubAllGlobals();
});

function fakeBucket(): R2Bucket & { objects: Map<string, string> } {
  const objects = new Map<string, string>();
  return {
    objects,
    put: async (key: string, value: string) => { objects.set(key, String(value)); return {} as R2Object; },
    get: async (key: string) => { const value = objects.get(key); return value === undefined ? null : ({ size: value.length, text: async () => value } as unknown as R2ObjectBody); },
  } as unknown as R2Bucket & { objects: Map<string, string> };
}

async function createTestWorkspace() {
  const client = createClient({ url: 'file::memory:' });
  clients.push(client);
  for (const statement of WORKSPACE_SCHEMA) await client.execute(statement);
  const at = Date.now();
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('capability','capability','Capabilities','active',?, 'owner_1',1,?,?)",
    args: [JSON.stringify({ site: true, pos: false, commerce: false }), at, at] });
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('settings','pos.settings','Store','active','{\"currency\":\"INR\"}','owner_1',1,?,?)", args: [at, at] });
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('prod_garlic','pos.product','Garlic Bread','active','{\"price\":15000,\"shortDescription\":\"Fresh with herbs\"}','owner_1',1,?,?)", args: [at, at] });
  return client;
}

const ownerAccess: AccessContext = {
  identity: { id: 'owner_1', email: 'owner@slicehouse.in', name: 'Muthu' },
  workspace: { id: 'ws_slice_house_0001', name: 'Slice House', slug: 'slice-house', mode: 'work', databaseName: 'slice', databaseHost: 'slice', state: 'active' },
  member: { workspaceId: 'ws_slice_house_0001', userId: 'owner_1', role: 'owner', state: 'active' },
};

// The builder composes hero-line and story-body as the two prose slots of this
// brief; the model may only rewrite those.
const COPY = { texts: [
  { id: 'hero-line', text: 'A wood fired pizza shop in the heart of the city.' },
  { id: 'story-body', text: 'Dough made fresh, fired in small batches.' },
] };
const CLAIMS = { claims: [{ text: 'Wood fired every day since 2019', evidence: 'The brief mentions a wood fired pizza shop.' }] };

function scriptedAi(responses: unknown[]): Ai {
  let index = 0;
  return {
    run: async () => {
      const answer = responses[Math.min(index, responses.length - 1)];
      index += 1;
      if (answer instanceof Error) throw answer;
      return { response: JSON.stringify(answer) };
    },
  } as unknown as Ai;
}

async function generate(client: Awaited<ReturnType<typeof createTestWorkspace>>, services: Record<string, unknown>, key: string) {
  return Effect.runPromise(executeGateway(client, ownerAccess, {
    actionId: 'site.generate', idempotencyKey: key, input: { title: 'Slice House', prompt: 'A wood fired pizza shop', records: ['prod_garlic'] },
  }, services));
}

const heroLine = (site: SiteDocument): string => {
  const hero = site.pages[0].sections.find((section) => section.id === 'hero')!;
  return String(hero.nodes.find((node) => node.id === 'hero-line')!.props.text);
};

describe('site prose and claims', () => {
  it('composes a deterministic draft with no model key, leaving claims empty', async () => {
    const client = await createTestWorkspace();
    const result = await generate(client, {}, 'compose-nokey');
    const site = result.site as SiteDocument;
    expect(site.schema).toBe('2.0.0');
    expect(site.pages.map((page) => page.path)).toEqual(['/']);
    expect(result.composed).toBe(false);
    expect(heroLine(site)).toContain('wood fired pizza shop');
    expect(site.claims ?? []).toEqual([]);
  });

  it('rewrites only the builder slots with prose and records an unchecked claim', async () => {
    const client = await createTestWorkspace();
    const result = await generate(client, { ai: scriptedAi([COPY, CLAIMS]), siteModel: 'test-model' }, 'compose-prose');
    const site = result.site as SiteDocument;
    expect(result.composed).toBe(true);
    expect(heroLine(site)).toBe('A wood fired pizza shop in the heart of the city.');
    // Code keeps prices and layout out of model reach, so the structure stays the builder's.
    expect(site.pages[0].sections.map((section) => section.id)).toEqual(['header', 'catalog', 'hero', 'story', 'contact', 'footer']);
    // Without a judgment key an asserted claim stays unresolved rather than trusted.
    expect(site.claims?.[0].text).toContain('Wood fired every day');
    expect(site.claims?.[0].verdict).toBe('unsupported');
  });

  it('keeps the product usable by falling back to plain copy when the model is out', async () => {
    const client = await createTestWorkspace();
    const failing = { run: async () => { throw new Error('model unavailable'); } } as unknown as Ai;
    const result = await generate(client, { ai: failing }, 'compose-fallback');
    const site = result.site as SiteDocument;
    expect(site.schema).toBe('2.0.0');
    expect(result.composed).toBe(false);
    expect(result.note).toContain('model was unavailable');
    expect(heroLine(site)).toContain('wood fired pizza shop');
  });

  it('blocks publication when a judgment contradicts a claim’s evidence', async () => {
    const client = await createTestWorkspace();
    const bucket = fakeBucket();
    // A fresh Response per call: the body stream can only be read once, and the
    // creation fan-out runs before the claim check, so both consume it.
    const judgement = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      model: 'jev-latest',
      answers: { c0: { type: 'choice', choice: 'contradicted', confidence: 0.94 } },
    }), { status: 200 }));
    vi.stubGlobal('fetch', judgement);
    const generated = await generate(client, { ai: scriptedAi([COPY, CLAIMS]), typesafe: 'test-key' }, 'compose-claim');
    const siteId = String(generated.siteId);
    const stored = await client.execute({ sql: 'SELECT data FROM records WHERE id=?', args: [siteId] });
    expect((JSON.parse(String(stored.rows[0].data)) as SiteDocument).claims?.[0].verdict).toBe('contradicted');

    const compiled = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.compile', idempotencyKey: 'claim-compile', input: { siteId },
    }, { siteReleases: bucket }));
    const checks = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.checks', idempotencyKey: 'claim-checks', input: { siteId, releaseId: compiled.releaseId },
    }, { siteReleases: bucket }));
    expect((checks.checks as { blocking: { area: string }[] }).blocking.some((issue) => issue.area === 'claim')).toBe(true);
    await expect(Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'claim-publish', input: { siteId, releaseId: compiled.releaseId, hash: compiled.hash },
    }, { siteReleases: bucket }))).rejects.toThrow('blocking check');
  });

  it('writes prose through the Groq chat completion endpoint in one batched pass', async () => {
    const client = await createTestWorkspace();
    let fetchCount = 0;
    const groqFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      fetchCount += 1;
      const parsedBody = JSON.parse(String(init?.body || '{}'));
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer test-groq-key' });
      expect(parsedBody.model).toBe('qwen/qwen3.8-27b');
      expect(parsedBody.response_format).toEqual({ type: 'json_object' });
      const content = fetchCount === 1 ? JSON.stringify(COPY) : JSON.stringify(CLAIMS);
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', groqFetch);
    const result = await generate(client, { groqApiKey: 'test-groq-key', siteModel: 'qwen/qwen3.8-27b' }, 'compose-groq');
    const site = result.site as SiteDocument;
    expect(site.schema).toBe('2.0.0');
    expect(site.pages.map((page) => page.path)).toEqual(['/']);
    expect(heroLine(site)).toBe('A wood fired pizza shop in the heart of the city.');
    expect(fetchCount).toBe(2);
  });
});
