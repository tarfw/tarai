import { createClient } from '@libsql/client';
import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { executeGateway } from '../src/gateway/actions.ts';
import type { AccessContext } from '../src/types.ts';
import type { SiteDocument } from '../src/site/document.ts';
import type { PatchOperation } from '../src/site/patch.ts';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => { while (clients.length) clients.pop()?.close(); });

function releaseBucket(): R2Bucket & { objects: Map<string, string> } {
  const objects = new Map<string, string>();
  return {
    objects,
    put: async (key: string, value: string) => { objects.set(key, String(value)); return {} as R2Object; },
    get: async (key: string) => { const value = objects.get(key); return value === undefined ? null : ({ text: async () => value } as unknown as R2ObjectBody); },
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
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('settings','pos.settings','Store','active','{\"currency\":\"INR\"}','owner_1',1,?,?)", args: [at, at] });
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('prod_garlic','pos.product','Garlic Bread','active','{\"price\":15000,\"shortDescription\":\"Fresh with herbs\"}','owner_1',1,?,?)", args: [at, at] });
  return client;
}

const ownerAccess: AccessContext = {
  identity: { id: 'owner_1', email: 'owner@slicehouse.in', name: 'Muthu' },
  workspace: { id: 'ws_slice_house_0001', name: 'Slice House', slug: 'slice-house', mode: 'work', databaseName: 'slice', databaseHost: 'slice', state: 'active' },
  member: { workspaceId: 'ws_slice_house_0001', userId: 'owner_1', role: 'owner', state: 'active' },
};

async function ask(client: Awaited<ReturnType<typeof createTestWorkspace>>, siteId: string, command: string, target?: string) {
  return Effect.runPromise(executeGateway(client, ownerAccess, {
    actionId: 'site.ask', idempotencyKey: `ask-${command}`, input: { siteId, command, ...(target ? { target } : {}) },
  }));
}

async function generate(client: Awaited<ReturnType<typeof createTestWorkspace>>, siteId?: string) {
  return Effect.runPromise(executeGateway(client, ownerAccess, {
    actionId: 'site.generate', idempotencyKey: `gen-${siteId || 'new'}-${Math.random()}`,
    input: { title: 'Slice House', prompt: 'Wood fired pizza, dine in and takeaway', records: ['prod_garlic'], ...(siteId ? { siteId } : {}) },
  }));
}

async function apply(client: Awaited<ReturnType<typeof createTestWorkspace>>, siteId: string, base: number, operations: unknown) {
  return Effect.runPromise(executeGateway(client, ownerAccess, {
    actionId: 'site.edit', idempotencyKey: `edit-${Math.random()}`,
    input: { siteId, base, operations, summary: 'Merchant choice' },
  }, { siteReleases: releaseBucket() }));
}

function stored(client: Awaited<ReturnType<typeof createTestWorkspace>>, siteId: string): Promise<SiteDocument> {
  return client.execute({ sql: 'SELECT data FROM records WHERE id=?', args: [siteId] })
    .then((row) => JSON.parse(String(row.rows[0].data)) as SiteDocument);
}

function recipeIdOf(doc: SiteDocument, kind: string): string | undefined {
  for (const page of doc.pages) for (const section of page.sections) {
    if (section.id === kind) return section.recipe?.id;
  }
  return undefined;
}

function nodeText(doc: SiteDocument, id: string): string | undefined {
  for (const page of doc.pages) for (const section of page.sections) for (const node of section.nodes) {
    if (node.id === id) return typeof node.props.text === 'string' ? node.props.text : undefined;
  }
  return undefined;
}

describe('merchant overrides', () => {
  it('answers a named layout, design or section as a remembered choice', async () => {
    const client = await createTestWorkspace();
    const generated = await generate(client);
    const siteId = String(generated.siteId);

    const layout = await ask(client, siteId, 'turn the catalog into rails');
    expect(layout.target).toBe('catalog');
    expect(layout.operations).toEqual([{ op: 'set_override', kind: 'recipe', target: 'catalog', value: 'rail' }]);

    const design = await ask(client, siteId, 'use the bright shelf design');
    expect(design.operations).toEqual([{ op: 'set_override', kind: 'design', value: 'bold' }]);

    const hidden = await ask(client, siteId, 'hide the story section');
    expect(hidden.operations).toEqual([{ op: 'set_override', kind: 'hide', target: 'story' }]);

    // The same words without a design to point at stay in the value lanes.
    const value = await ask(client, siteId, 'make the hero background ink', 'hero');
    expect((value.operations as PatchOperation[])[0]?.op).toBe('set_style');
  });

  it('keeps a layout and a design through a regeneration', async () => {
    const client = await createTestWorkspace();
    const generated = await generate(client);
    const siteId = String(generated.siteId);
    const site = generated.site as SiteDocument;

    const asked = await ask(client, siteId, 'use the bright shelf design');
    await apply(client, siteId, site.revision, asked.operations);
    const rails = await ask(client, siteId, 'turn the catalog into rails');
    const before = await stored(client, siteId);
    const edited = await apply(client, siteId, before.revision, rails.operations);
    const withOverrides = edited.site as SiteDocument;
    expect(withOverrides.blueprint.overrides?.design).toBe('bold');
    expect(withOverrides.blueprint.overrides?.recipes?.catalog).toBe('rail');
    expect(withOverrides.design.theme).toBe('bold');
    expect(recipeIdOf(withOverrides, 'catalog')).toBe('rail');

    const again = await generate(client, siteId);
    const regenerated = await stored(client, siteId);
    expect(again.version).toBe(Number(edited.revision) + 1);
    expect(regenerated.blueprint.overrides?.design).toBe('bold');
    expect(regenerated.blueprint.overrides?.recipes?.catalog).toBe('rail');
    expect(regenerated.design.theme).toBe('bold');
    expect(recipeIdOf(regenerated, 'catalog')).toBe('rail');
  });

  it('never lets generated copy overwrite words the merchant wrote', async () => {
    const client = await createTestWorkspace();
    const generated = await generate(client);
    const siteId = String(generated.siteId);
    const site = generated.site as SiteDocument;
    const hero = site.pages[0].sections.find((section) => section.id === 'hero')!;
    const heading = hero.nodes.find((node) => node.kind === 'heading')!;

    const edited = await apply(client, siteId, site.revision, [
      { op: 'set_override', kind: 'text', target: heading.id, value: 'Slow nights, hot crust' },
    ]);
    const held = edited.site as SiteDocument;
    expect(held.blueprint.overrides?.text?.[heading.id]).toBe('Slow nights, hot crust');
    expect(nodeText(held, heading.id)).toBe('Slow nights, hot crust');

    await generate(client, siteId);
    expect(nodeText(await stored(client, siteId), heading.id)).toBe('Slow nights, hot crust');
  });

  it('stamps a saved setting into the section and keeps it through a rebuild', async () => {
    const client = await createTestWorkspace();
    const generated = await generate(client);
    const siteId = String(generated.siteId);
    const site = generated.site as SiteDocument;

    const edited = await apply(client, siteId, site.revision, [
      { op: 'set_override', kind: 'settings', target: 'hero', value: { label: 'Order now' } },
    ]);
    const doc = edited.site as SiteDocument;
    expect(doc.blueprint.overrides?.settings?.hero?.label).toBe('Order now');
    const hero = doc.pages[0].sections.find((section) => section.id === 'hero')!;
    expect(hero.recipe?.settings?.label).toBe('Order now');
    // The renderer reads the stamped setting, so the saved choice shows without a rebuild.
    expect(String(edited.html)).toContain('Order now');

    await generate(client, siteId);
    const again = await stored(client, siteId);
    expect(again.blueprint.overrides?.settings?.hero?.label).toBe('Order now');
    const rebuilt = again.pages[0].sections.find((section) => section.id === 'hero')!;
    expect(rebuilt.recipe?.settings?.label).toBe('Order now');
  });

  it('refuses to hide a section the store needs and asks what to change instead', async () => {
    const client = await createTestWorkspace();
    const generated = await generate(client);
    const asked = await ask(client, String(generated.siteId), 'hide the catalog');
    expect(asked.operations).toEqual([]);
    expect((asked.questions as string[]).length).toBe(1);
    expect(String((asked.questions as string[])[0])).toContain('catalog');
  });

  it('clears an override and hands that choice back to the system', async () => {
    const client = await createTestWorkspace();
    const generated = await generate(client);
    const siteId = String(generated.siteId);
    const site = generated.site as SiteDocument;

    const asked = await ask(client, siteId, 'turn the catalog into rails');
    const edited = await apply(client, siteId, site.revision, asked.operations);
    expect((edited.site as SiteDocument).blueprint.overrides?.recipes?.catalog).toBe('rail');

    const cleared = await apply(client, siteId, Number(edited.revision), [{ op: 'clear_override', kind: 'recipe', target: 'catalog' }]);
    const doc = cleared.site as SiteDocument;
    expect(doc.blueprint.overrides?.recipes?.catalog).toBeUndefined();
    expect(recipeIdOf(doc, 'catalog')).not.toBe('rail');
  });

  it('turns public ordering on and off, and the switch survives a regeneration', async () => {
    const client = await createTestWorkspace();
    const generated = await generate(client);
    const siteId = String(generated.siteId);
    const sections = (ordering: string) => Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.sections.set', idempotencyKey: `ordering-${ordering}-${Math.random()}`,
      input: { siteId, ordering },
    }, { siteReleases: releaseBucket() }));

    // The storefront does not take money until the owner says so (D11).
    expect((generated.site as SiteDocument).policy?.publicOrdering).not.toBe(true);
    const on = await sections('on');
    expect((on.site as SiteDocument).policy?.publicOrdering).toBe(true);

    // A later regeneration carries the policy forward instead of resetting it.
    const rebuilt = await generate(client, siteId);
    expect((rebuilt.site as SiteDocument).policy?.publicOrdering).toBe(true);

    const off = await sections('off');
    expect((off.site as SiteDocument).policy?.publicOrdering).toBe(false);
  });
});
