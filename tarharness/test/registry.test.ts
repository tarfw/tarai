import { describe, expect, it } from 'vitest';
import { actionCatalog, interfaceCatalog } from '../src/registry/catalog.ts';

describe('registry contracts', () => {
  it('maps every Action to a registered interface', () => {
    const keys = new Set<string>(interfaceCatalog.map((item) => item.key));
    expect(actionCatalog.every((action) => keys.has(action.interfaceKey))).toBe(true);
    expect(actionCatalog.every((action) => action.version > 0 && action.output.length > 0)).toBe(true);
    expect(new Set(actionCatalog.map((action) => action.id)).size).toBe(actionCatalog.length);
  });
});
