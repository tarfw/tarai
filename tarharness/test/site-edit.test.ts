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
  // A real published record: a storefront is built from what the owner sells.
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('settings','pos.settings','Store','active','{\"currency\":\"INR\"}','owner_1',1,?,?)", args: [at, at] });
  await client.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('prod_garlic','pos.product','Garlic Bread','active','{\"price\":15000,\"shortDescription\":\"Fresh with herbs\"}','owner_1',1,?,?)", args: [at, at] });
  return client;
}

const ownerAccess: AccessContext = {
  identity: { id: 'owner_1', email: 'owner@slicehouse.in', name: 'Muthu' },
  workspace: { id: 'ws_slice_house_0001', name: 'Slice House', slug: 'slice-house', mode: 'work', databaseName: 'slice', databaseHost: 'slice', state: 'active' },
  member: { workspaceId: 'ws_slice_house_0001', userId: 'owner_1', role: 'owner', state: 'active' },
};

async function generatedSite(client: Awaited<ReturnType<typeof createTestWorkspace>>) {
  const result = await Effect.runPromise(executeGateway(client, ownerAccess, {
    actionId: 'site.generate', idempotencyKey: `gen-${Math.random()}`, input: { title: 'Slice House', prompt: 'Pizza', records: ['prod_garlic'] },
  }));
  const site = result.site as SiteDocument;
  return { siteId: String(result.siteId), site, version: Number(result.version) };
}

describe('site ask and edit', () => {
  it('resolves explicit section and value words without inference', async () => {
    const client = await createTestWorkspace();
    const { siteId, site } = await generatedSite(client);
    const asked = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-explicit',
      input: { siteId, command: 'make the hero background ink' },
    }));
    expect(asked.target).toBe('hero');
    expect(asked.targetKind).toBe('section');
    expect(asked.questions).toEqual([]);
    const operations = asked.operations as { op: string; target: string; value: { base: Record<string, unknown> } }[];
    expect(operations).toHaveLength(1);
    expect(operations[0].op).toBe('set_style');
    expect(operations[0].value.base.background).toBe('token:color.ink');

    const edited = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'edit-explicit',
      input: { siteId, base: site.revision, operations: asked.operations, summary: String(asked.summary) },
    }, { siteReleases: releaseBucket() }));
    expect(edited.revision).toBe(site.revision + 1);
    const diff = edited.diff as { target: string; kind: string }[];
    expect(diff.some((entry) => entry.target === 'hero' && entry.kind === 'style')).toBe(true);
    const stored = await client.execute({ sql: 'SELECT data,version FROM records WHERE id=?', args: [siteId] });
    const document = JSON.parse(String(stored.rows[0].data));
    const hero = document.pages[0].sections.find((section: { id: string }) => section.id === 'hero');
    const heading = hero.nodes.find((node: { kind: string }) => node.kind === 'heading');
    expect(document.revision).toBe(site.revision + 1);
    expect(heading.props.text).toBe('Slice House');
  });

  it('uses a judgment only for the ambiguous value and asks when nothing resolves', async () => {
    const client = await createTestWorkspace();
    const { siteId, site } = await generatedSite(client);
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'jev-latest',
      answers: { 'q:background': { type: 'choice', choice: 'token:color.accent', confidence: 0.92 } },
    }), { status: 200 }));
    vi.stubGlobal('fetch', request);
    const asked = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-ambiguous',
      input: { siteId, command: 'give the hero a bolder background' },
    }, { typesafe: 'test-key' }));
    expect(asked.target).toBe('hero');
    const operations = asked.operations as { op: string; value: { base: Record<string, unknown> } }[];
    expect(operations[0]?.value.base.background).toBe('token:color.accent');
    expect(request).toHaveBeenCalled();

    const vague = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-vague', input: { siteId, command: 'make it nicer' },
    }));
    expect(vague.target).toBeNull();
    expect((vague.questions as string[]).length).toBeGreaterThan(0);
    void site;
  });

  it('resolves layout columns, tone and copy changes via Jev decision system', async () => {
    const client = await createTestWorkspace();
    const { siteId, site } = await generatedSite(client);
    const layoutRequest = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      model: 'jev-latest',
      answers: {
        target: { type: 'choice', choice: 'hero', confidence: 0.95 },
        columns: { type: 'choice', choice: '2', confidence: 0.95 },
        align: { type: 'choice', choice: 'start', confidence: 0.9 },
        density: { type: 'choice', choice: 'airy', confidence: 0.88 },
        tone: { type: 'choice', choice: 'ink', confidence: 0.91 },
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', layoutRequest);

    const asked = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-layout-jev',
      input: { siteId, command: 'Two columns, image left, text right, more breathing room, darker tone' },
    }, { typesafe: 'test-key' }));

    expect(asked.target).toBe('hero');
    const ops = asked.operations as { op: string; target: string; value: unknown }[];
    expect(ops.some((op) => op.op === 'set_layout')).toBe(true);
    expect(ops.some((op) => op.op === 'set_style')).toBe(true);

    const edited = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'edit-layout-jev',
      input: { siteId, base: site.revision, operations: asked.operations, summary: String(asked.summary) },
    }, { siteReleases: releaseBucket() }));

    const updatedSite = edited.site as SiteDocument;
    const hero = updatedSite.pages[0].sections.find((s) => s.id === 'hero');
    expect(hero?.layout.columns).toBe(2);
    expect(hero?.layout.kind).toBe('grid');
  });

  it('resolves deterministic layout and spacing commands without API key', async () => {
    const client = await createTestWorkspace();
    const { siteId, site } = await generatedSite(client);
    const asked = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-two-cols',
      input: { siteId, command: 'Two columns with airy spacing', target: 'hero' },
    }));
    const ops = asked.operations as { op: string; target: string; value: unknown }[];
    expect(ops.some((op) => op.op === 'set_layout')).toBe(true);
    expect(ops.some((op) => op.op === 'set_style')).toBe(true);

    const edited = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'edit-two-cols',
      input: { siteId, base: site.revision, operations: asked.operations, summary: String(asked.summary) },
    }, { siteReleases: releaseBucket() }));

    const updated = edited.site as SiteDocument;
    const intro = updated.pages[0].sections.find((s) => s.id === asked.target);
    expect(intro?.layout.columns).toBe(2);
    expect(intro?.layout.kind).toBe('grid');
  });

  it('rejects stale patches and locked targets', async () => {
    const client = await createTestWorkspace();
    const { siteId, site } = await generatedSite(client);
    await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'edit-lock',
      input: { siteId, base: site.revision, operations: [{ op: 'lock', target: 'hero', kind: 'section' }] },
    }, { siteReleases: releaseBucket() }));
    const afterLock = await client.execute({ sql: 'SELECT version FROM records WHERE id=?', args: [siteId] });
    const version = Number(afterLock.rows[0].version);

    await expect(Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'edit-locked-target',
      input: { siteId, base: version, operations: [{ op: 'set_text', target: 'hero-title', value: 'Blocked' }] },
    }, { siteReleases: releaseBucket() }))).rejects.toThrow('locked');

    await expect(Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'edit-stale',
      input: { siteId, base: version - 1, operations: [{ op: 'set_text', target: 'hero-title', value: 'Stale' }] },
    }, { siteReleases: releaseBucket() }))).rejects.toThrow('changed since this patch');
  });

  it('undo restores an earlier revision as a new revision', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const { siteId, site } = await generatedSite(client);
    await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'edit-for-undo',
      input: { siteId, base: site.revision, operations: [{ op: 'set_text', target: 'hero-title', value: 'Changed headline' }] },
    }, { siteReleases: bucket }));
    const undo = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.undo', idempotencyKey: 'undo-1', input: { siteId },
    }, { siteReleases: bucket }));
    expect(undo.undone).toBe(site.revision);
    expect(undo.revision).toBe(site.revision + 2);
    const restored = undo.site as SiteDocument;
    const hero = restored.pages[0].sections.find((section) => section.id === 'hero');
    const heading = hero?.nodes.find((node) => node.kind === 'heading');
    expect(heading?.props.text).toBe('Slice House');
  });

  it('handles global theme changes directly via set_token operations with zero questions', async () => {
    const client = await createTestWorkspace();
    const { siteId, site } = await generatedSite(client);
    const asked = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-darker-theme',
      input: { siteId, command: 'Darker Theme' },
    }));
    expect(asked.target).toBeNull();
    expect(asked.questions).toEqual([]);
    const operations = asked.operations as { op: string; token: string; value: string }[];
    expect(operations.length).toBeGreaterThanOrEqual(7);
    expect(operations.some((op) => op.op === 'set_token' && op.token === 'token:color.canvas' && op.value === '#111111')).toBe(true);

    const edited = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.edit', idempotencyKey: 'edit-darker-theme',
      input: { siteId, base: site.revision, operations: asked.operations, summary: String(asked.summary) },
    }, { siteReleases: releaseBucket() }));

    const updated = edited.site as SiteDocument;
    expect(updated.design.color.canvas).toBe('#111111');
    expect(updated.design.color.ink).toBe('#f8fafc');

    // Test Chalk theme
    const askedChalk = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-chalk-theme',
      input: { siteId, command: 'Chalk Theme' },
    }));
    expect(askedChalk.questions).toEqual([]);
    expect((askedChalk.operations as { op: string; token: string; value: string }[]).some((op) => op.token === 'token:color.canvas' && op.value === '#edebe4')).toBe(true);

    // Test Lookbook theme
    const askedLookbook = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-lookbook-theme',
      input: { siteId, command: 'Lookbook' },
    }));
    expect(askedLookbook.questions).toEqual([]);
    expect((askedLookbook.operations as { op: string; token: string; value: string }[]).some((op) => op.token === 'token:color.ink' && op.value === '#000000')).toBe(true);

    // Test Editorial theme
    const askedEditorial = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-editorial-theme',
      input: { siteId, command: 'Editorial Theme' },
    }));
    expect(askedEditorial.questions).toEqual([]);
    expect((askedEditorial.operations as { op: string; token: string; value: string }[]).some((op) => op.token === 'token:color.accent' && op.value === '#4d49fc')).toBe(true);
  });

  it('handles deterministic quick prompts without specified target', async () => {
    const client = await createTestWorkspace();
    const { siteId, site } = await generatedSite(client);

    // Photo Bigger fallback to collection
    const askedPhoto = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-photo-bigger',
      input: { siteId, command: 'Photo Bigger' },
    }));
    expect(askedPhoto.questions).toEqual([]);
    expect((askedPhoto.operations as unknown[]).length).toBeGreaterThan(0);

    // Run Festive Sale fallback to promo / intro
    const askedSale = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-festive-sale',
      input: { siteId, command: 'Run Festive Sale' },
    }));
    expect(askedSale.questions).toEqual([]);
    expect((askedSale.operations as unknown[]).length).toBeGreaterThan(0);

    // Add Location fallback to contact / hours
    const askedLocation = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-add-location',
      input: { siteId, command: 'Add Location' },
    }));
    expect(askedLocation.questions).toEqual([]);
    expect((askedLocation.operations as unknown[]).length).toBeGreaterThan(0);
  });

  it('handles contextual visual director chip prompts targeted at sections', async () => {
    const client = await createTestWorkspace();
    const { siteId, site } = await generatedSite(client);

    // 1. Dark Tone on Hero
    const darkTone = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-hero-dark-tone',
      input: { siteId, target: 'hero', command: 'Dark Tone' },
    }));
    expect(darkTone.questions).toEqual([]);
    const darkToneOps = darkTone.operations as { op: string; value: { base: Record<string, unknown> } }[];
    expect(darkToneOps.some((op) => op.op === 'set_style' && op.value.base.background === 'token:color.ink')).toBe(true);

    // 2. Light Tone on Hero
    const lightTone = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-hero-light-tone',
      input: { siteId, target: 'hero', command: 'Light Tone' },
    }));
    expect(lightTone.questions).toEqual([]);
    const lightToneOps = lightTone.operations as { op: string; value: { base: Record<string, unknown> } }[];
    expect(lightToneOps.some((op) => op.op === 'set_style' && op.value.base.background === 'token:color.canvas')).toBe(true);

    // 3. Split Layout on Hero
    const splitLayout = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-hero-split',
      input: { siteId, target: 'hero', command: 'Split Layout' },
    }));
    expect(splitLayout.questions).toEqual([]);
    const splitOps = splitLayout.operations as { op: string; value: { kind: string; columns?: number } }[];
    expect(splitOps.some((op) => op.op === 'set_layout' && op.value.kind === 'flex')).toBe(true);

    // 4. Full Bleed on Hero
    const fullBleed = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-hero-full-bleed',
      input: { siteId, target: 'hero', command: 'Full Bleed' },
    }));
    expect(fullBleed.questions).toEqual([]);
    const bleedOps = fullBleed.operations as { op: string; value: { kind: string; width?: string } }[];
    expect(bleedOps.some((op) => op.op === 'set_layout' && op.value.width === 'full')).toBe(true);

    // 5. Bold Title on Hero
    const boldTitle = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-hero-bold-title',
      input: { siteId, target: 'hero', command: 'Bold Title' },
    }));
    expect(boldTitle.questions).toEqual([]);
    const boldOps = boldTitle.operations as { op: string; value: { level?: number } }[];
    expect(boldOps.some((op) => op.op === 'set_props' && op.value.level === 1)).toBe(true);

    // 6. Retail site with collection section
    const retailResult = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.generate', idempotencyKey: `gen-retail-${Math.random()}`, input: { title: 'Kanchi Silks', prompt: 'Kanchi luxury silk sarees retail', models: ['products'], records: ['prod_garlic'] },
    }));
    const retailSiteId = String(retailResult.siteId);
    const retailSite = retailResult.site as SiteDocument;
    const collectionId = retailSite.pages[0].sections.find((s) => s.purpose === 'collection' || s.purpose === 'catalog')?.id || retailSite.pages[0].sections[0].id;

    // List View on Collection
    const listView = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-collection-list-view',
      input: { siteId: retailSiteId, target: collectionId, command: 'List View' },
    }));
    expect(listView.questions).toEqual([]);
    const listOps = listView.operations as { op: string; value: { columns?: number } }[];
    expect(listOps.some((op) => op.op === 'set_layout' && op.value.columns === 1)).toBe(true);

    // 7. Dark Cards on Collection
    const darkCards = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.ask', idempotencyKey: 'ask-collection-dark-cards',
      input: { siteId: retailSiteId, target: collectionId, command: 'Dark Cards' },
    }));
    expect(darkCards.questions).toEqual([]);
    const cardOps = darkCards.operations as { op: string; value: { base: Record<string, unknown> } }[];
    expect(cardOps.some((op) => op.op === 'set_style' && op.value.base.background === 'token:color.surface')).toBe(true);
  });
});

describe('site checks gate publication', () => {
  it('stores checks with a candidate and refuses to publish blocking findings', async () => {
    const client = await createTestWorkspace();
    const bucket = releaseBucket();
    const generated = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.generate', idempotencyKey: 'checks-generate', input: { title: 'Slice House', prompt: 'Pizza', records: ['prod_garlic'] },
    }));
    const siteId = String(generated.siteId);
    const row = await client.execute({ sql: 'SELECT data FROM records WHERE id=?', args: [siteId] });
    const document = JSON.parse(String(row.rows[0].data)) as SiteDocument;
    document.assets.push({
      id: 'logo', kind: 'image', key: `workspaces/ws_slice_house_0001/sites/${siteId}/assets/logo.png`,
      mime: 'image/png', bytes: 64, hash: 'b'.repeat(64), width: 100, height: 100, alt: 'Slice House logo',
      rights: { source: 'upload', license: 'owned', approved: false },
    });
    document.pages[0].sections.find((section) => section.id === 'hero')!.nodes.push({ id: 'hero-logo', kind: 'image', props: { asset: 'logo' } });
    await client.execute({ sql: 'UPDATE records SET data=? WHERE id=?', args: [JSON.stringify(document), siteId] });

    const compiled = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.compile', idempotencyKey: 'checks-compile', input: { siteId },
    }, { siteReleases: bucket }));
    const checks = await Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.checks', idempotencyKey: 'checks-read', input: { siteId, releaseId: compiled.releaseId },
    }, { siteReleases: bucket }));
    const inspection = checks.checks as { blocking: { message: string }[]; advisory: unknown[] };
    expect(inspection.blocking.some((issue) => issue.message.includes('approved rights'))).toBe(true);

    await expect(Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'checks-publish',
      input: { siteId, releaseId: compiled.releaseId, hash: compiled.hash },
    }, { siteReleases: bucket }))).rejects.toThrow('blocking check');
  });
});
