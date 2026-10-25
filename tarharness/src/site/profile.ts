/**
 * Commerce model classification: Jev proposes, code validates.
 *
 * The model set decides which sections a store must have and what the publish
 * gate demands, so every answer is filtered through COMMERCE_MODELS here and the
 * set is never allowed to be empty.
 */

import { TRADE_TAXONOMY, fallbackCapabilities, fallbackTrade } from '../brain/trade.ts';
import { COMMERCE_MODELS, MODEL_CONFIDENCE, type CommerceModel, type ModelProfile } from './blueprint.ts';

/** Plain verb phrases per model: used in Jev instructions and in merchant prompts. */
export const MODEL_MEANING: Record<CommerceModel, string> = {
  products: 'sell items a customer buys directly',
  food: 'serve prepared food or drinks to order',
  booking: 'reserve a time or a slot with the customer',
  quote: 'price each job after an enquiry',
  digital: 'deliver a download, course or subscription',
  bulk: 'sell in volume to trade buyers',
};

const SIGNALS: Record<CommerceModel, RegExp> = {
  products: /\b(saree|handloom|textile|garment|cloth|apparel|boutique|showroom|shop|store|mart|retail|product|goods|jewellery|jewelry|watch|footwear|hardware|stock)\b/i,
  food: /\b(cafe|coffee|tea|restaurant|bakery|kitchen|dining|bistro|eatery|mess|tiffin|meal|food|snack|juice|swiggy|zomato)\b/i,
  booking: /\b(book|booking|appointment|slot|reservation|salon|studio|class|session|tuition|bridal|event|rental|repair|taxi|driver)\b/i,
  quote: /\b(quote|quotation|enquiry|inquiry|custom|bespoke|tailor|measurement|estimate|consult|design service|installation)\b/i,
  digital: /\b(course|download|ebook|pdf|template|software|subscription|subscribe|membership|digital|online class)\b/i,
  bulk: /\b(bulk|wholesale|supplier|distributor|dealer|trade price|carton|pallet|minimum order|moq|procurement)\b/i,
};

/** Probability per model read from the words the merchant used; no model involved. */
export function modelProbabilities(text: string): Record<CommerceModel, number> {
  return Object.fromEntries(COMMERCE_MODELS.map((model) => [model, SIGNALS[model].test(text) ? 0.9 : 0.1])) as Record<CommerceModel, number>;
}

/**
 * Keep only models the evidence supports. When nothing clears the bar the
 * strongest signal wins, so a store always has one model to build against.
 */
export function acceptedModels(probabilities: Record<CommerceModel, number>, threshold: number): CommerceModel[] {
  const supported = COMMERCE_MODELS.filter((model) => (probabilities[model] ?? 0) >= threshold);
  if (supported.length) return supported;
  const best = COMMERCE_MODELS.reduce((top, model) => ((probabilities[model] ?? 0) > (probabilities[top] ?? 0) ? model : top), 'products' as CommerceModel);
  return [best];
}

export function readIndustry(value: unknown, fallback: string): string {
  const industry = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return industry && TRADE_TAXONOMY[industry] ? industry : fallback;
}

export function confidenceIn(probabilities: Record<CommerceModel, number>, models: readonly CommerceModel[]): number {
  if (!models.length) return 0;
  const total = models.reduce((sum, model) => sum + (probabilities[model] ?? 0), 0);
  return Number((total / models.length).toFixed(2));
}

/** Applies the code rules: non-empty set, known industry, ask when too weak. */
export function buildProfile(input: {
  models: readonly CommerceModel[];
  industry: string;
  capabilities: { pos: boolean; commerce: boolean; site: boolean; team: boolean };
  confidence: { models: number; industry: number };
}): ModelProfile {
  const models: CommerceModel[] = input.models.length ? [...new Set(input.models)] : ['products'];
  return {
    models,
    industry: readIndustry(input.industry, 'general'),
    capabilities: input.capabilities,
    confidence: {
      models: Number(input.confidence.models.toFixed(2)),
      industry: Number(input.confidence.industry.toFixed(2)),
    },
    ask: input.confidence.models < MODEL_CONFIDENCE,
  };
}

export function fallbackProfile(text: string): ModelProfile {
  const trimmed = (text || '').trim().slice(0, 2000) || 'General business';
  const probabilities = modelProbabilities(trimmed);
  const models = acceptedModels(probabilities, 0.65);
  const trade = fallbackTrade(trimmed);
  const capabilities = fallbackCapabilities(trimmed);
  return buildProfile({
    models,
    industry: trade.id,
    capabilities: { pos: capabilities.pos, commerce: capabilities.commerce, site: capabilities.site, team: capabilities.team },
    confidence: { models: confidenceIn(probabilities, models), industry: trade.confidence },
  });
}

/** Models the merchant named themselves. Unknown words are dropped, not guessed. */
export function readModels(value: unknown): CommerceModel[] {
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\n]+/) : [];
  const found: CommerceModel[] = [];
  for (const entry of entries) {
    const model = typeof entry === 'string' ? entry.trim().toLowerCase() : '';
    if (COMMERCE_MODELS.includes(model as CommerceModel) && !found.includes(model as CommerceModel)) found.push(model as CommerceModel);
  }
  return found;
}

/** What the merchant stated beats the proposal, and stops the ask. */
export function merchantProfile(proposal: ModelProfile, input: Record<string, unknown>): ModelProfile {
  const models = readModels(input.models);
  const industry = readIndustry(input.industry, proposal.industry);
  if (!models.length && industry === proposal.industry) return proposal;
  return {
    ...proposal,
    models: models.length ? models : proposal.models,
    industry,
    confidence: { ...proposal.confidence, models: models.length ? 1 : proposal.confidence.models },
    ask: models.length ? false : proposal.ask,
  };
}
