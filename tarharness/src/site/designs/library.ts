/**
 * The design loader: turns the build's committed tokens into the `Design` the renderer
 * already consumes. Groups the source cannot speak — elevation, layout and motion — stay
 * here as code floors, so a reference file can never ship an animation the owner did not
 * ask for or a shadow the 150 KB budget cannot carry.
 */

import type { Design, DesignElevation, DesignLayout, DesignMotion } from '../design.ts';
import type { DesignIndex, DesignIndexRow, DesignTokens } from './contract.ts';
import { GENERATED_DEFAULT, GENERATED_INDEX, GENERATED_TOKENS } from './library.generated.ts';

/**
 * Ids stored before the migration, plus the brand nicknames cached snapshots still post.
 * Dropped once no release carries them (parai §3.6).
 */
export const LEGACY_IDS: Record<string, string> = {
  'dark-luxury': 'luxury',
  mollie: 'luxury',
  'neon-pop': 'bold',
  'magic-spoon': 'bold',
  'high-protein': 'bold',
  'harvest-editorial': 'warm',
  arte: 'warm',
  'arte*': 'warm',
};

export const CODE_FLOORS: { elevation: DesignElevation; layout: DesignLayout; motion: DesignMotion } = {
  elevation: { low: 2, high: 8 },
  layout: { columns: 3, gap: 16, align: 'start' },
  motion: { duration: 200, easing: 'easeout', reduce: true },
};

export function libraryIndex(): DesignIndex {
  return GENERATED_INDEX;
}

export function libraryRows(): DesignIndexRow[] {
  return GENERATED_INDEX.designs;
}

export function libraryDefault(): string {
  return GENERATED_DEFAULT;
}

export function libraryDesignIds(): string[] {
  return Object.keys(GENERATED_TOKENS).sort();
}

/** Ids stored before the migration, and the brand nicknames cached snapshots still post. */
export function canonicalDesignId(id?: string | null): string {
  if (!id) return GENERATED_DEFAULT;
  return LEGACY_IDS[id] ?? id;
}

export function tokensFor(id?: string | null): DesignTokens | undefined {
  return GENERATED_TOKENS[canonicalDesignId(id)];
}

export function toDesign(tokens: DesignTokens): Design {
  return {
    theme: tokens.id,
    direction: {
      audience: tokens.direction.audience,
      purpose: tokens.direction.purpose,
      voice: tokens.direction.voice,
      density: tokens.density,
      idea: tokens.direction.idea,
    },
    color: { ...tokens.color },
    type: { ...tokens.type },
    space: { ...tokens.space },
    shape: { ...tokens.shape },
    elevation: { ...CODE_FLOORS.elevation },
    layout: { ...CODE_FLOORS.layout },
    motion: { ...CODE_FLOORS.motion },
    guidance: [...tokens.guidance],
    source: {
      reference: `${tokens.source.file}#${tokens.source.hash}`,
      hash: tokens.source.hash,
      revision: 0,
      decisions: [],
    },
  };
}

/** Unknown or legacy ids fall back to the reviewed default; the library never 404s a site. */
export function designFor(id?: string | null): Design {
  const tokens = tokensFor(id) ?? GENERATED_TOKENS[GENERATED_DEFAULT];
  return toDesign(tokens);
}

/**
 * What a merchant is shown: the reviewed label, one plain-language sentence and the
 * palette they can see. Source brands, licence notes and token files stay in the build.
 */
export interface DesignOption {
  id: string;
  name: string;
  desc: string;
  swatches: string[];
  tone: string;
  density: string;
}

export function designOptions(): DesignOption[] {
  return libraryRows().map((row) => ({
    id: row.id,
    name: row.label,
    desc: row.desc,
    swatches: [...row.swatches],
    tone: row.tone,
    density: row.density,
  }));
}
