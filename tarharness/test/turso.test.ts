import { Effect } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openWorkspaceDatabase } from '../src/db/turso.ts';

const client = vi.hoisted(() => ({ execute: vi.fn(), close: vi.fn() }));
vi.mock('@libsql/client/web', () => ({ createClient: vi.fn(() => client) }));

const env = { TURSO_ORG: 'test', TURSO_PLATFORM_TOKEN: 'platform', TURSO_GROUP: 'default' };

describe('opening workspace databases', () => {
  beforeEach(() => {
    client.execute.mockClear();
    client.close.mockClear();
    vi.unstubAllGlobals();
  });

  it('shares a short-lived token and never runs schema writes during reads', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ jwt: 'database-token' }));
    vi.stubGlobal('fetch', fetch);
    const [first, second] = await Promise.all([
      Effect.runPromise(openWorkspaceDatabase(env, 'personal', 'db.example.com')),
      Effect.runPromise(openWorkspaceDatabase(env, 'personal', 'db.example.com')),
    ]);
    const third = await Effect.runPromise(openWorkspaceDatabase(env, 'personal', 'db.example.com'));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(client.execute).not.toHaveBeenCalled();
    first.close(); second.close(); third.close();
  });

  it('does not keep a failed token request in cache', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(Response.json({ jwt: 'database-token' }));
    vi.stubGlobal('fetch', fetch);
    await expect(Effect.runPromise(openWorkspaceDatabase(env, 'retry', 'db.example.com'))).rejects.toThrow();
    await Effect.runPromise(openWorkspaceDatabase(env, 'retry', 'db.example.com'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
