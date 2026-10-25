// Trade taxonomy and deterministic fallbacks shared by the site engine at
// build time. No model calls live here; the runtime suggest calls of the old
// workspace-ai module are gone.

export const TRADE_TAXONOMY: Record<string, string> = {
  apparel: 'Handloom & Apparel Atelier',
  food: 'Food & Beverage Service',
  grocery: 'Retail & Grocery',
  health: 'Healthcare & Pharmacy',
  jewellery: 'Jewellery & Ornaments',
  electronics: 'Electronics & Hardware',
  services: 'Digital Services & Consulting',
  general: 'General Retail & Merchant',
};

export interface TradeClassification {
  readonly id: string;
  readonly title: string;
  readonly confidence: number;
}

export interface FallbackCapabilities { pos: boolean; commerce: boolean; site: boolean; register: boolean; team: boolean }

export function fallbackTrade(brief: string): TradeClassification {
  const text = brief.toLowerCase();
  if (/\b(saree|handloom|silk|apparel|boutique|tailor|cloth|weaving|garment|textile)\b/i.test(text)) {
    return { id: 'apparel', title: TRADE_TAXONOMY.apparel, confidence: 0.95 };
  }
  if (/\b(cafe|coffee|tea|restaurant|food|bakery|kitchen|dining|bistro|mess|eatery)\b/i.test(text)) {
    return { id: 'food', title: TRADE_TAXONOMY.food, confidence: 0.95 };
  }
  if (/\b(grocery|supermarket|provision|mart|fruits|vegetable|store|kirana)\b/i.test(text)) {
    return { id: 'grocery', title: TRADE_TAXONOMY.grocery, confidence: 0.92 };
  }
  if (/\b(clinic|pharmacy|medical|doctor|hospital|health|chemist)\b/i.test(text)) {
    return { id: 'health', title: TRADE_TAXONOMY.health, confidence: 0.94 };
  }
  if (/\b(jewel|gold|silver|diamond|ornament)\b/i.test(text)) {
    return { id: 'jewellery', title: TRADE_TAXONOMY.jewellery, confidence: 0.95 };
  }
  if (/\b(electronic|mobile|computer|hardware|appliance|repair)\b/i.test(text)) {
    return { id: 'electronics', title: TRADE_TAXONOMY.electronics, confidence: 0.92 };
  }
  if (/\b(software|agency|consulting|tech|digital|design|service)\b/i.test(text)) {
    return { id: 'services', title: TRADE_TAXONOMY.services, confidence: 0.90 };
  }
  return { id: 'general', title: TRADE_TAXONOMY.general, confidence: 0.85 };
}

export function fallbackCapabilities(brief: string): FallbackCapabilities {
  const text = brief.toLowerCase();
  const posKeywords = /\b(pos|point of sale|cashier|counter|register|restaurant|cafe|bar|kitchen|dining|food|table|takeout|retail|checkout|shop|store)\b/i;
  const commerceKeywords = /\b(commerce|catalog|item|items|variant|variants|product|products|inventory|stock|supplier|suppliers|purchase|purchases|order|orders|invoice|invoices|billing|payment|payments|refund|refunds|quote|quotes|warehouse|shipment|shipments|sales)\b/i;
  const siteKeywords = /\b(site|sites|website|websites|web|storefront|landing|page|pages|online|portal|publish|brand|catalog|whatsapp)\b/i;
  const teamKeywords = /\b(team|staff|cashier|manager|member|employees|shift)\b/i;

  const pos = posKeywords.test(text);
  const commerce = commerceKeywords.test(text);
  const site = siteKeywords.test(text);
  const team = teamKeywords.test(text);

  return {
    pos: pos || text.includes('food') || text.includes('sale'),
    register: pos || text.includes('cash') || text.includes('counter'),
    commerce: commerce || (!pos && !site),
    site: site || text.includes('site'),
    team: team || false,
  };
}
