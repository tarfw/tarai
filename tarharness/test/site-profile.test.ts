import { createClient } from '@libsql/client';
import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { executeGateway } from '../src/gateway/actions.ts';
import { TRADE_TAXONOMY } from '../src/brain/workspace-ai.ts';
import type { AccessContext } from '../src/types.ts';
import type { SiteDocument } from '../src/site/document.ts';
import { COMMERCE_MODELS, MODEL_CONFIDENCE, checkModelsGate, kindForModels } from '../src/site/blueprint.ts';
import { acceptedModels, buildProfile, fallbackProfile, merchantProfile, modelProbabilities, readIndustry, readModels } from '../src/site/profile.ts';
import { judgeProfile } from '../src/site/judgment.ts';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => {
  while (clients.length) clients.pop()?.close();
});

const ownerAccess: AccessContext = {
  identity: { id: 'owner_1', email: 'owner@parai.in', name: 'Ravi' },
  workspace: { id: 'ws_parai', name: 'Parai House', slug: 'parai-house', mode: 'work', databaseName: 'parai', databaseHost: 'parai', state: 'active' },
  member: { workspaceId: 'ws_parai', userId: 'owner_1', role: 'owner', state: 'active' },
};

async function workspace() {
  const client = createClient({ url: 'file::memory:' });
  clients.push(client);
  for (const statement of WORKSPACE_SCHEMA) await client.execute(statement);
  const at = Date.now();
  await client.execute({
    sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES('capability','capability','Capabilities','active','{\"site\":true}','owner_1',1,?,?)",
    args: [at, at],
  });
  return client;
}

async function generate(client: ReturnType<typeof createClient>, key: string, input: Record<string, unknown>) {
  return Effect.runPromise(executeGateway(client, ownerAccess, { actionId: 'site.generate', idempotencyKey: key, input }));
}

describe('Commerce model profile', () => {
  it('reads a model set out of the words the merchant used', () => {
    expect(fallbackProfile('Handloom silk sarees, Kanchipuram. Ready stock and custom bridal orders.').models).toEqual(['products', 'booking', 'quote']);
    expect(fallbackProfile('Wood fired pizza and coffee, dine in or take away.').models).toEqual(['food']);
    expect(fallbackProfile('Salon appointments and grooming classes.').models).toEqual(['booking']);
    expect(fallbackProfile('We sell an online course and a monthly subscription.').models).toEqual(['digital']);
    expect(fallbackProfile('Wholesale rice supplier, carton rates, minimum order 50kg.').models).toEqual(['bulk']);
  });

  it('keeps the model set non-empty when the description says nothing', () => {
    const profile = fallbackProfile('');
    expect(profile.models.length).toBeGreaterThan(0);
    expect(profile.ask).toBe(true);
    expect(profile.confidence.models).toBeLessThan(MODEL_CONFIDENCE);
  });

  it('asks the merchant when the model answer is too weak to build on', () => {
    expect(buildProfile({ models: ['products'], industry: 'general', capabilities: { pos: false, commerce: false, site: true, team: false }, confidence: { models: 0.55, industry: 0.9 } }).ask).toBe(true);
    expect(buildProfile({ models: ['products'], industry: 'general', capabilities: { pos: false, commerce: false, site: true, team: false }, confidence: { models: 0.9, industry: 0.9 } }).ask).toBe(false);
  });

  it('rejects models outside the approved set instead of guessing', () => {
    expect(readModels(['products', 'retail', '', 'Food', 'products', 'restaurant'])).toEqual(['products', 'food']);
    expect(merchantProfile(fallbackProfile('Saree shop'), { models: ['nonsense'] }).models).toEqual(['products']);
    expect(merchantProfile(fallbackProfile('Saree shop'), { models: ['digital'] }).ask).toBe(false);
    expect(readIndustry('not-a-trade', 'apparel')).toBe('apparel');
  });

  it('accepts only the models that clear the probability bar, strongest when none do', () => {
    expect(acceptedModels({ products: 0.9, food: 0.2, booking: 0.7, quote: 0.1, digital: 0.1, bulk: 0.3 }, 0.65)).toEqual(['products', 'booking']);
    expect(acceptedModels({ products: 0.1, food: 0.4, booking: 0.1, quote: 0.1, digital: 0.1, bulk: 0.1 }, 0.65)).toEqual(['food']);
  });

  it('derives the legacy business kind from the model set', () => {
    expect(kindForModels(['food'])).toBe('food');
    expect(kindForModels(['bulk', 'products'])).toBe('wholesale');
    expect(kindForModels(['booking'])).toBe('services');
    expect(kindForModels(['products'])).toBe('goods');
    expect(modelProbabilities('Saree shop').products).toBeGreaterThan(0.65);
  });

  it('judges a profile without a model key through the deterministic path', async () => {
    const profile = await judgeProfile(undefined, {}, { description: 'Bakery and cafe, takeaway orders' });
    expect(profile.models).toEqual(['food']);
    expect(COMMERCE_MODELS.some((model) => profile.models.includes(model))).toBe(true);
  });

  it('stores the profile on the blueprint so regeneration replays it', async () => {
    const client = await workspace();
    const generated = await generate(client, 'profile-gate', {
      title: 'Parai House',
      prompt: 'Handloom silk sarees, Kanchipuram. Ready stock and custom bridal orders.',
      faq: [{ q: 'Do you ship?', a: 'Across India in three days.' }],
    });
    const blueprint = (generated.site as SiteDocument).blueprint!;
    expect(blueprint.profile?.models).toEqual(['products', 'booking', 'quote']);
    expect(blueprint.profile?.industry).toBe('apparel');
    expect(TRADE_TAXONOMY[blueprint.profile!.industry]).toBeTruthy();

    const stated = await generate(client, 'profile-override', { title: 'Parai House', models: ['digital'], industry: 'services' });
    expect((stated.site as SiteDocument).blueprint!.profile!.models).toEqual(['digital']);
    expect((stated.site as SiteDocument).blueprint!.profile!.industry).toBe('services');
  });

  it('gates each model on the evidence that model actually needs', () => {
    const reachable = { email: 'hello@parai.in', phone: '9840000000' };
    const item = { id: 'prod_1', title: 'Kanchipuram saree' };
    const needs = (models: Parameters<typeof checkModelsGate>[0], facts: Parameters<typeof checkModelsGate>[1]) => checkModelsGate(models, facts).missing.map((entry) => entry.need);
    expect(needs(['products'], reachable)).toEqual(['item']);
    expect(checkModelsGate(['products'], { ...reachable, items: [item] }).ok).toBe(true);
    expect(needs(['food'], { ...reachable, items: [item] })).toEqual(['hours']);
    expect(needs(['booking'], reachable)).toEqual(['service']);
    expect(checkModelsGate(['booking'], { ...reachable, services: [{ id: 'svc_1', title: 'Bridal styling', price: 500000 }] }).ok).toBe(true);
    expect(needs(['bulk'], reachable)).toEqual(['item', 'minimum']);
    expect(needs(['quote'], {})).toEqual(['contact', 'enquiry']);
    // Two models sharing one gap list it once.
    expect(needs(['products', 'booking'], {})).toEqual(['contact', 'item', 'service']);
  });

  it('saves the saree shop as a draft that says what is missing before it can publish', async () => {
    const client = await workspace();
    const generated = await generate(client, 'gate-saree', {
      title: 'Parai House',
      prompt: 'Handloom silk sarees, Kanchipuram. Ready stock and custom bridal orders.',
    });
    expect(generated.state).toBe('draft');
    expect(generated.gate).toMatchObject({ ok: false });
    const needs = ((generated.missing ?? []) as { need: string }[]).map((entry) => entry.need);
    expect(needs).toContain('item');
    expect(needs).toContain('service');
    await expect(Effect.runPromise(executeGateway(client, ownerAccess, {
      actionId: 'site.publish', idempotencyKey: 'gate-saree-publish',
      input: { siteId: String(generated.siteId), releaseId: 'rel_00000000-0000-0000-0000-000000000000', hash: 'x' },
    }, { siteReleases: { put: async () => ({}), get: async () => null } as unknown as R2Bucket }))).rejects.toThrow('not ready to publish');
  });
});
