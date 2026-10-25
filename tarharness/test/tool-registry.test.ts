import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKSPACE_SCHEMA } from '../src/db/schema.ts';
import { NATURE_RECIPES, TOOLS, TOOL_IDS, cardDeck, deckStatement, findTool, readCardStack, readDeck, toolForAction } from '../src/tools/registry.ts';
import { commitWrite, currentStatement } from '../src/truth/write.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const clients: ReturnType<typeof createClient>[] = [];
afterEach(() => { clients.splice(0).forEach((client) => client.close()); });

async function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'tar-registry-test-'));
  const client = createClient({ url: pathToFileURL(join(directory, 'workspace.db')).href }); clients.push(client);
  for (const sql of WORKSPACE_SCHEMA) await client.execute(sql);
  return client;
}

describe('tool registry', () => {
  it('holds exactly the 14 tools, each with a card, a shape and a reach', () => {
    expect(TOOLS.map((tool) => tool.id)).toEqual([...TOOL_IDS]);
    for (const tool of TOOLS) {
      expect(tool.card.title.length, `${tool.id} card title`).toBeGreaterThan(0);
      expect(['list', 'sale', 'chat', 'sheet', 'site']).toContain(tool.shape);
      expect(['none', 'data', 'customer', 'money']).toContain(tool.reach);
      expect(tool.card.tap.label.length, `${tool.id} tap label`).toBeGreaterThan(0);
      // the number is chosen by role: both roles name a field
      expect(tool.card.number.owner.length).toBeGreaterThan(0);
      expect(tool.card.number.member.length).toBeGreaterThan(0);
    }
  });

  it('assigns every registered action to exactly one tool', () => {
    const owners = new Map<string, string>();
    for (const tool of TOOLS) {
      for (const action of tool.actions) {
        expect(owners.has(action), `${action} claimed twice`).toBe(false);
        owners.set(action, tool.id);
      }
    }
    expect(toolForAction('pos.checkout')).toBe('pos');
    expect(toolForAction('catalog.item.save')).toBe('catalog');
    expect(toolForAction('invoice.issue')).toBe('invoice');
    expect(toolForAction('nope.nope')).toBeNull();
  });

  it('deals each nature a deck from its recipe, never a deferred tool', () => {
    for (const [nature, recipe] of Object.entries(NATURE_RECIPES)) {
      const deck = cardDeck(nature as keyof typeof NATURE_RECIPES);
      for (const id of recipe) expect(deck).toContain(id);
      expect(deck).toContain('contact');
      expect(deck).toContain('member');
      expect(deck).not.toContain('channel'); // deferred until its adapter lands
    }
    expect(cardDeck('food')[0]).toBe('pos');
  });

  it('reads the card stack with the number chosen by role', async () => {
    const client = await workspace();
    const deck = cardDeck('food');
    await commitWrite(client, [
      deckStatement(deck),
      currentStatement('card', 'pos', { salesToday: 'Rs. 18,450', billsToday: '9 bills', pending: 'drawer out Rs. 350' }),
      currentStatement('card', 'catalog', { itemCount: '14 items' }),
    ]);
    expect(await readDeck(client)).toEqual(deck);
    const ownerCards = await readCardStack(client, 'owner', deck);
    const pos = ownerCards.find((view) => view.tool === 'pos')!;
    expect(pos.number).toBe('Rs. 18,450');
    expect(pos.pendingLine).toBe('drawer out Rs. 350');
    const memberCards = await readCardStack(client, 'member', deck);
    expect(memberCards.find((view) => view.tool === 'pos')!.number).toBe('9 bills');
    expect(memberCards.find((view) => view.tool === 'catalog')!.number).toBe('14 items');
    // a card with no current yet answers null, never a fake number
    expect(memberCards.find((view) => view.tool === 'expense')!.number).toBeNull();
  });

  it('the registry is the shape law: sale is pos, chat is channel, site has no screen', () => {
    expect(findTool('pos')!.shape).toBe('sale');
    expect(findTool('channel')!.shape).toBe('chat');
    expect(findTool('site')!.shape).toBe('site');
    expect(TOOLS.filter((tool) => tool.shape === 'list').length).toBe(11);
  });
});
