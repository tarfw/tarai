import { describe, expect, it } from 'vitest';
import { defersToFlow, matchCoreTools } from '../src/tools/match.ts';

describe('core matcher: a card name is a deck change', () => {
  it('reads a bare card request', () => {
    expect(matchCoreTools('add site')).toEqual(['site']);
    expect(matchCoreTools('Add the storefront card')).toEqual(['site']);
    expect(matchCoreTools('site')).toEqual(['site']);
  });

  it('reads more than one card', () => {
    expect(matchCoreTools('add site and billing')).toEqual(['invoice', 'site']);
    expect(matchCoreTools('show my products and expenses')).toEqual(['catalog', 'expense']);
  });

  it('never matches a job that mentions a card', () => {
    expect(matchCoreTools('add site with ordering')).toEqual([]);
    expect(matchCoreTools('print labels')).toEqual([]);
    expect(matchCoreTools('add a card')).toEqual([]);
  });

  it('defers to a plan when the words carry a schedule or a sequence', () => {
    expect(defersToFlow('count cash every day at 10')).toBe(true);
    expect(defersToFlow('when an order arrives, send a message')).toBe(true);
    expect(defersToFlow('remove the site card')).toBe(true);
    expect(defersToFlow('add site')).toBe(false);
  });
});
