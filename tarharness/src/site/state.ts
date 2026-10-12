/**
 * The merchant's own state, and what the publish gate demands of it (parai §7).
 *
 * Only what the owner supplies moves this hash: the bullets they dictated, the facts they
 * recorded, the photos they took, the model set they confirmed. Generated copy, judgment
 * picks and stand-in photography are deliberately outside it — they are what the pipeline
 * writes, so hashing them would let one build re-trigger the next. Two callers read it:
 * `site.publishLatest` decides whether a publish has to rebuild first, and the scheduled
 * sweep decides whether a live store has drifted away from what its owner recorded.
 */

import { type CommerceModel, type GateFacts, type GateResult, type SiteFacts, checkModelsGate, modelsOf } from './blueprint.ts';
import type { Asset, SiteDocument } from './document.ts';

/** Owner-supplied photography. A Pexels stand-in the pipeline adds is not the merchant's state. */
export function merchantPhotos(assets?: readonly Asset[]): string[] {
  return (assets || [])
    .filter((asset) => !asset.placeholder && !asset.rights.source.startsWith('pexels'))
    .map((asset) => asset.id)
    .sort();
}

export interface StateInput {
  bullets?: readonly string[];
  facts: SiteFacts;
  photos?: readonly string[];
  models?: readonly CommerceModel[];
}

/** Stable across revisions: the same merchant state hashes to the same value. */
export async function stateHash(input: StateInput): Promise<string> {
  const payload = JSON.stringify({
    bullets: [...(input.bullets || [])].sort(),
    items: input.facts.items?.length ?? 0,
    itemIds: input.facts.items?.map((item) => item.id).sort(),
    phone: input.facts.phone || '',
    proofs: [...(input.facts.proofs || [])].sort(),
    season: input.facts.season || '',
    notice: input.facts.notice || '',
    address: input.facts.address || '',
    photos: [...(input.photos || [])].sort(),
    models: [...(input.models || [])].sort(),
  });
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The gate re-read against the facts on record now, with no model call. */
export function gateReport(doc: SiteDocument | { blueprint?: SiteDocument['blueprint'] }, facts: GateFacts): GateResult {
  return checkModelsGate(modelsOf(doc.blueprint), facts);
}

/** Whether a live store still shows what its owner has since recorded. */
export async function isDirty(doc: SiteDocument, input: StateInput): Promise<boolean> {
  const stored = doc.blueprint?.hash;
  if (!stored) return true;
  return (await stateHash({ ...input, models: doc.blueprint?.profile.models })) !== stored;
}

export interface Drift {
  /** The merchant state on record right now, which names the rebuild if one is due. */
  readonly state: string;
  readonly dirty: boolean;
  /** Why the sweep must leave this draft alone; empty when it may rebuild it. */
  readonly held: string;
}

/**
 * What the scheduled sweep asks before it touches anything: has the owner's own state moved,
 * and is the draft still the pipeline's to rewrite? A hand edit or a lock belongs to the
 * merchant, so the sweep reports instead of overwriting, and Publish stays the owner's call.
 */
export async function drift(doc: SiteDocument, input: StateInput): Promise<Drift> {
  const state = await stateHash({ ...input, models: doc.blueprint?.profile.models });
  const held = doc.provenance?.generator === 'merchant' ? 'merchant'
    : doc.locks.length ? 'locked'
    : '';
  return { state, dirty: state !== doc.blueprint?.hash, held };
}
