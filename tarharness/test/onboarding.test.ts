import { afterEach, describe, expect, it, vi } from 'vitest';
import { planMoment } from '../src/brain/moments.ts';
import { onboardingPlan } from '../src/onboarding/plan.ts';
import { cardDeck, dealDeck, firstInboxSeed, normalizeDeck } from '../src/tools/registry.ts';

const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('onboarding deck selection', () => {
  it('validates, dedupes and caps chosen cards in registry order', () => {
    expect(normalizeDeck(['pos', 'nope', 'pos', 'channel', 'site'], 2)).toEqual(['pos', 'site']);
    expect(normalizeDeck(['site', 'channel'])).toEqual(['site', 'channel']);
    expect(normalizeDeck('not-an-array')).toEqual([]);
  });

  it('keeps the nature recipe as a floor when cards are added', () => {
    const deck = dealDeck('food', ['site'], 10);
    expect(deck).toContain('pos');
    expect(deck).toContain('catalog');
    expect(deck).toContain('site');
    expect(deck).toContain('contact');
  });

  it('seeds the first NEXT from a card the deck actually carries', () => {
    expect(firstInboxSeed(['catalog', 'pos'])).toMatchObject({ tool: 'catalog', title: 'Add your first item', action: 'catalog.item.save' });
    expect(firstInboxSeed(['task', 'site'])).toMatchObject({ tool: 'task', title: 'Mark Done', action: 'task.complete' });
    expect(firstInboxSeed(['site'])).toBeNull();
  });
});

describe('plan moment', () => {
  it('falls back to the recipe without a key, never blocking', async () => {
    const verdict = await planMoment(undefined, 'Tea shop. Snacks to go. Just me.');
    expect(verdict.nature).toBe('food');
    expect(verdict.work).toEqual(cardDeck('food'));
    expect(verdict.personal).toEqual(['task', 'expense']);
    expect(verdict.model).toBeNull();
  });

  it('asks one Jev call and reads nature, risk and both decks', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json({
      model: 'jev-test',
      answers: {
        nature: { choice: 'food', confidence: 0.9, probabilities: { food: 0.9, shop: 0.1 } },
        risk: { probability: 0.02 },
        work_site: { probability: 0.9 },
        work_stock: { probability: 0.1 },
        personal_task: { probability: 0.95 },
        personal_expense: { probability: 0.8 },
        personal_payment: { probability: 0.2 },
      },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const verdict = await planMoment('key', 'Tea shop. Snacks to go.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as { questions: Record<string, unknown> };
    expect(body.questions.work_pos).toBeTruthy();
    expect(body.questions.personal_task).toBeTruthy();
    expect(verdict.nature).toBe('food');
    expect(verdict.work).toContain('site');
    expect(verdict.work).not.toContain('stock');
    expect(verdict.personal).toEqual(['task', 'expense']);
    expect(verdict.risk).toBe(0.02);
    expect(verdict.model).toBe('jev-test');
  });

  it('returns the fallback deck when Jev fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    const verdict = await planMoment('key', 'Tea shop. Snacks to go.');
    expect(verdict.work).toEqual(cardDeck('food'));
    expect(verdict.model).toBeNull();
  });
});

describe('onboarding plan', () => {
  it('uses the owner words and recipe without keys', async () => {
    const plan = await onboardingPlan({ words: 'Tea shop. Snacks to go. Just me.', audience: 'Walk-ins' });
    expect(plan.name).toBe('Tea shop');
    expect(plan.summary).toBe('Tea shop. Snacks to go. Just me.');
    expect(plan.work).toContain('catalog');
    expect(plan.personal).toEqual(['task', 'expense']);
    expect(plan.catalog).toHaveLength(14);
    expect(plan.models).toEqual({ llm: null, jev: null });
  });

  it('lets Groq write only the name and summary', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/models')) return json({ data: [{ id: 'openai/gpt-oss-120b' }] });
      if (url.includes('systemone')) return json({
        model: 'jev-test',
        answers: {
          nature: { choice: 'shop', confidence: 0.8, probabilities: { shop: 0.8, food: 0.2 } },
          risk: { probability: 0.01 },
          work_stock: { probability: 0.9 },
          personal_expense: { probability: 0.7 },
        },
      });
      return json({ choices: [{ message: { content: JSON.stringify({ name: 'Chai Point', summary: 'A tea shop selling chai and snacks to walk-in customers.' }) } }], usage: {} });
    });
    vi.stubGlobal('fetch', fetchMock);
    const plan = await onboardingPlan({ typesafeKey: 'jev', groqApiKey: 'groq', groqModel: 'openai/gpt-oss-120b', words: 'Tea shop. Snacks to go.', audience: 'Walk-ins' });
    expect(plan.name).toBe('Chai Point');
    expect(plan.summary).toBe('A tea shop selling chai and snacks to walk-in customers.');
    expect(plan.nature).toBe('shop');
    expect(plan.work).toContain('stock');
    expect(plan.personal).toContain('expense');
    expect(plan.models).toEqual({ llm: 'openai/gpt-oss-120b', jev: 'jev-test' });
  });
});
