import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';

describe('workspace schema', () => {
  it('creates the complete clean schema idempotently', async () => {
    const db = createClient({ url: 'file::memory:' });
    try {
      for (const sql of WORKSPACE_SCHEMA) await db.execute(sql);
      for (const sql of WORKSPACE_SCHEMA) await db.execute(sql);
      const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      const names = tables.rows.map((row) => String(row.name));
      // The tarfw floor: record, move, current, skill, run, inbox (+ legacy
      // tables still serving the un-migrated writers until Tile 3 drops them).
      for (const floor of ['records', 'move', 'current', 'skill', 'inbox', 'run']) {
        expect(names).toContain(floor);
      }
      expect(names).not.toContain('events');
      expect(names).not.toContain('patches');
      // The event feed is a view over move, not a table.
      const views = await db.execute("SELECT name FROM sqlite_master WHERE type='view'");
      expect(views.rows.map((row) => String(row.name))).toContain('events');
      const through = await db.execute('SELECT kind, actor_id, idempotency_key FROM events LIMIT 0');
      expect(through.columns).toEqual(['kind', 'actor_id', 'idempotency_key']);
    } finally { db.close(); }
  });
});
