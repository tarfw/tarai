import { afterEach, describe, expect, it, vi } from 'vitest';
import { canRunSkill, memberTools } from '../src/access.ts';
import { cardMoment } from '../src/brain/moments.ts';
import { nextDeck } from '../src/tools/registry.ts';
import type { Member } from '../src/types.ts';

const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
const member = (overrides: Partial<Member>): Member => ({ workspaceId: 'ws', userId: 'u', role: 'member', state: 'active', ...overrides });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('memberTools', () => {
  it('reads the deck a hired role carries', () => {
    const cashier = member({ workRole: 'cashier' });
    expect([...memberTools(cashier)].sort()).toEqual(['contact', 'order', 'pos', 'register', 'task']);
  });

  it('an explicit whitelist wins and legacy ids map onto the registry', () => {
    const granted = member({ access: ['item', 'pos'] });
    expect([...memberTools(granted)].sort()).toEqual(['catalog', 'pos']);
  });
});

describe('canRunSkill', () => {
  it('a skill is theirs only when every step is theirs', () => {
    const cashier = member({ workRole: 'cashier' });
    expect(canRunSkill(cashier, [{ action: 'register.count' }])).toBe(true);
    expect(canRunSkill(cashier, [{ action: 'register.count' }, { action: 'catalog.item.save' }])).toBe(false);
    expect(canRunSkill(cashier, [])).toBe(false);
  });
});

describe('cardMoment', () => {
  it('adds the card the words name and asks once per card', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json({
      model: 'jev-test',
      answers: {
        add_register: { probability: 0.9 },
        add_site: { probability: 0.2 },
        drop_catalog: { probability: 0.1 },
        drop_pos: { probability: 0.05 },
      },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const verdict = await cardMoment('key', 'a cash drawer for the counter', ['pos', 'catalog'], 'work');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as { questions: Record<string, unknown> };
    expect(body.questions.add_register).toBeTruthy();
    expect(body.questions.drop_catalog).toBeTruthy();
    expect(body.questions.add_pos).toBeUndefined();
    expect(verdict.add).toEqual(['register']);
    expect(verdict.remove).toEqual([]);
    expect(verdict.confidence).toBeCloseTo(0.9);
    expect(verdict.model).toBe('jev-test');
  });

  it('drops the card the owner says they no longer need', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({
      model: 'jev-test',
      answers: { drop_site: { probability: 0.86 }, add_register: { probability: 0.1 } },
    })));
    const verdict = await cardMoment('key', "I don't need the online store", ['site', 'pos'], 'work');
    expect(verdict.remove).toEqual(['site']);
    expect(verdict.add).toEqual([]);
  });

  it('never changes a deck without a key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await cardMoment(undefined, 'a cash drawer', ['pos'], 'work')).toEqual({ add: [], remove: [], confidence: 0, model: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stays put when Jev fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    expect((await cardMoment('key', 'a cash drawer', ['pos'], 'work')).add).toEqual([]);
  });

  it('personal mode only offers personal cards', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json({ model: 'jev-test', answers: { add_task: { probability: 0.8 } } }));
    vi.stubGlobal('fetch', fetchMock);
    await cardMoment('key', 'my personal to-dos', [], 'personal');
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as { questions: Record<string, unknown> };
    expect(body.questions.add_task).toBeTruthy();
    expect(body.questions.add_pos).toBeUndefined();
  });
});

describe('nextDeck', () => {
  it('adds missing cards in registry order and drops dealt ones', () => {
    expect(nextDeck(['site', 'pos'], ['register'], new Set(['site']))).toEqual(['pos', 'register']);
  });

  it('a confirmed change never empties the Canvas', () => {
    expect(() => nextDeck(['pos'], [], new Set(['pos']))).toThrow('one card');
  });
});
