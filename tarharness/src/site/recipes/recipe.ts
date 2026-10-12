/**
 * The recipe contract (parai §5.2). A recipe is data: it names a layout primitive from the
 * grammar, the slots it fills, the tokens it may touch and the settings a merchant can turn.
 * Markup stays in TypeScript, where the CSS budget and the token resolver already live.
 */

import type { CommerceModel, SectionKind } from '../blueprint.ts';
import { SECTION_KINDS } from '../blueprint.ts';
import type { SectionLayout } from '../document.ts';

export type SectionType = SectionKind;
export const SECTION_TYPES: readonly SectionType[] = SECTION_KINDS;

/** Whether a recipe can render without the content a slot asks for. */
export type SlotNeed = 'required' | 'optional';

/**
 * Where a slot's content comes from: `brief.*` and `facts.*` for what the merchant said,
 * `route.*` for where a button can point, `photos[i]` / `items[i..j]` / `services[i..j]`
 * for the store's own records.
 */
export interface RecipeSlot {
  source: string;
  /** Characters the renderer will show; the prose pass writes longer and the layout clips. */
  max?: number;
  /** How many entries a list slot asks for. */
  count?: number;
}

export type SettingType = 'boolean' | 'text' | 'choice';

/** What the merchant-facing editor builds its controls from, with a working default. */
export interface RecipeSetting {
  type: SettingType;
  default: boolean | string;
  options?: string[];
  max?: number;
}

export interface RecipeLayout {
  kind: SectionLayout;
  ratio?: string;
  collapse?: string;
  height?: string;
  scrim?: string;
  columns?: number;
}

export interface RecipeSource {
  /** The pattern this layout follows, described in structure rather than in anyone's words. */
  pattern: string;
  /** What was studied, and the promise that no copy, colour or asset came from it. */
  reference: string;
}

export interface Recipe {
  id: string;
  type: SectionType;
  models: CommerceModel[];
  /** Keyed by slot name: what the renderer cannot do without. */
  needs: Record<string, SlotNeed>;
  layout: RecipeLayout;
  slots: Record<string, RecipeSlot>;
  /** Role to token path (`color.ink`), never a hex, a length or a font name. */
  tokens: Record<string, string>;
  settings: Record<string, RecipeSetting>;
  /** Neutral stand-ins so an empty store still renders a shape, never a template's copy. */
  fallback: Record<string, string>;
  source: RecipeSource;
}

export const SETTING_TYPES: readonly SettingType[] = ['boolean', 'text', 'choice'] as const;
export const SLOT_NEEDS: readonly SlotNeed[] = ['required', 'optional'] as const;

/** Token groups a recipe may reach into; anything else is a literal in disguise. */
export const TOKEN_GROUPS = ['color', 'type', 'space', 'shape'] as const;
