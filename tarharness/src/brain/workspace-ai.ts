import { askSystemOne, choiceOf, noulOf, type SystemOneQuestion } from './systemone.ts';
import { canonicalTools, type ToolDefinition } from '../registry/tools.ts';

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

export interface WorkspaceCapabilitiesResult {
  readonly capabilities: {
    readonly pos: boolean;
    readonly commerce: boolean;
    readonly site: boolean;
    readonly register?: boolean;
    readonly team?: boolean;
  };
  readonly trade: TradeClassification;
  readonly tools?: string[];
  readonly confidence: Record<string, number>;
  readonly model?: string;
  readonly review: true;
}

export interface MemberSuggestionResult {
  readonly role: 'member' | 'admin';
  readonly workRole: string;
  readonly roles: string[];
  readonly tools: string[];
  readonly suggestedActions: string[];
  readonly permissions: string[];
  readonly confidence: number | null;
  readonly model?: string;
  readonly review: true;
}

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

export interface FallbackCapabilities { pos: boolean; commerce: boolean; site: boolean; register: boolean; team: boolean }

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

export function toolsForTrade(
  tradeId: string,
  capabilities: { pos: boolean; commerce: boolean; site: boolean; register?: boolean; team?: boolean }
): string[] {
  const tools: string[] = ['item', 'order', 'invoice', 'payment', 'expense'];

  if (['apparel', 'food', 'grocery', 'health', 'jewellery', 'electronics', 'general'].includes(tradeId)) {
    tools.splice(1, 0, 'inventory');
  }

  if (capabilities.pos || capabilities.register) {
    tools.unshift('pos', 'register');
  }

  if (capabilities.site) {
    tools.push('site');
  }

  tools.push('members');

  return [...new Set(tools)];
}

export async function suggestCapabilities(apiKey: string | undefined, brief: string): Promise<WorkspaceCapabilitiesResult> {
  const text = brief.trim().slice(0, 2000);
  const fallback = fallbackCapabilities(text || 'General business');
  const initialTrade = fallbackTrade(text || 'General business');
  const initialTools = toolsForTrade(initialTrade.id, fallback);

  if (!apiKey || !text) {
    return {
      capabilities: fallback,
      trade: initialTrade,
      tools: initialTools,
      confidence: { pos: 0.85, commerce: 0.85, site: 0.85, trade: initialTrade.confidence },
      review: true,
    };
  }

  const outcome = await askSystemOne(apiKey, {
    timeout: 8_000,
    state: { brief: text },
    questions: {
      trade: {
        type: 'choice',
        instructions: 'Classify this enterprise into its primary commercial trade or atelier category based on its business name and operational brief facts.',
        criteria: {
          apparel: 'Handloom, saree, boutique, textile, tailoring, fabric, or garment atelier',
          food: 'Restaurant, cafe, bakery, eatery, tea stall, kitchen, or food service',
          grocery: 'Grocery, supermarket, provision store, daily food items, or produce',
          health: 'Pharmacy, medical store, clinic, doctor, dispensary, or healthcare',
          jewellery: 'Jewellery, gold, silver, diamonds, or precious ornaments',
          electronics: 'Electronics, mobile devices, computer, or appliance sales and repair',
          services: 'Professional services, agency, consulting, software, or creative service',
          general: 'General merchant, trader, department store, or miscellaneous retail',
        },
      },
      pos: {
        type: 'choice',
        instructions: 'Does this business need a Point of Sale (POS) tool for retail/counter sales, restaurant food/kitchen orders, or cash register checkout?',
        criteria: {
          include: 'Enable Point of Sale tools',
          skip: 'Do not enable Point of Sale tools',
          unsure: 'Unsure',
        },
      },
      commerce: {
        type: 'choice',
        instructions: 'Does this business need Commerce tools for product catalog, stock/inventory, purchasing from suppliers, invoices, or customer orders?',
        criteria: {
          include: 'Enable Commerce tools',
          skip: 'Do not enable Commerce tools',
          unsure: 'Unsure',
        },
      },
      site: {
        type: 'choice',
        instructions: 'Does this business need a public website or storefront generated and published online?',
        criteria: {
          include: 'Enable Site Studio for public website',
          skip: 'Do not enable website tools',
          unsure: 'Unsure',
        },
      },
      team: {
        type: 'choice',
        instructions: 'Does this business require multi-person staff management, cashier roles, or team member coordination?',
        criteria: {
          include: 'Enable team member management',
          skip: 'Solo operator only',
          unsure: 'Unsure',
        },
      },
    },
  });

  if (!outcome.ok) {
    return {
      capabilities: fallback,
      trade: initialTrade,
      tools: initialTools,
      confidence: { pos: 0.7, commerce: 0.7, site: 0.7, trade: initialTrade.confidence },
      review: true,
    };
  }

  const tradeAnswer = choiceOf(outcome.value.answers.trade);
  const posAnswer = choiceOf(outcome.value.answers.pos);
  const commerceAnswer = choiceOf(outcome.value.answers.commerce);
  const siteAnswer = choiceOf(outcome.value.answers.site);
  const teamAnswer = choiceOf(outcome.value.answers.team);

  const tradeId = tradeAnswer.choice || initialTrade.id;
  const tradeTitle = TRADE_TAXONOMY[tradeId] || initialTrade.title;
  const tradeConfidence = tradeAnswer.confidence ?? initialTrade.confidence;

  const pos = posAnswer.choice === 'include' ? true : posAnswer.choice === 'skip' ? false : fallback.pos;
  const commerce = commerceAnswer.choice === 'include' ? true : commerceAnswer.choice === 'skip' ? false : fallback.commerce;
  const site = siteAnswer.choice === 'include' ? true : siteAnswer.choice === 'skip' ? false : fallback.site;
  const team = teamAnswer.choice === 'include' ? true : teamAnswer.choice === 'skip' ? false : fallback.team;

  const tools = toolsForTrade(tradeId, { pos, register: pos, commerce, site, team });

  return {
    capabilities: { pos, register: pos, commerce, site, team },
    trade: { id: tradeId, title: tradeTitle, confidence: tradeConfidence },
    tools,
    confidence: {
      trade: tradeConfidence,
      pos: posAnswer.confidence ?? 0.8,
      commerce: commerceAnswer.confidence ?? 0.8,
      site: siteAnswer.confidence ?? 0.8,
      team: teamAnswer.confidence ?? 0.8,
    },
    model: outcome.value.model,
    review: true,
  };
}

export function stripNegations(text: string): { cleanText: string; deniedTools: Set<string> } {
  const deniedTools = new Set<string>();
  const lower = text.toLowerCase();

  if (/\b(no access to|not? for|no|not|never|without)\s+(sales?|pos|counter|selling|checkout)\b/i.test(lower)) {
    deniedTools.add('pos');
    deniedTools.add('cashier');
  }
  if (/\b(no access to|not? for|no|not|never|without)\s+(cash|drawer|register|cash box)\b/i.test(lower)) {
    deniedTools.add('register');
  }
  if (/\b(no access to|not? for|no|not|never|without)\s+(money|payments?|upi|refunds?)\b/i.test(lower)) {
    deniedTools.add('payment');
  }
  if (/\b(no access to|not? for|no|not|never|without)\s+(stock|inventory|ingredients?)\b/i.test(lower)) {
    deniedTools.add('inventory');
  }
  if (/\b(no access to|not? for|no|not|never|without)\s+(orders?)\b/i.test(lower)) {
    deniedTools.add('order');
  }
  if (/\b(no access to|not? for|no|not|never|without)\s+(billing|invoices?|bills?)\b/i.test(lower)) {
    deniedTools.add('invoice');
  }

  const cleanText = lower.replace(/\b(no access to|not? for|no|not|never|without)\s+[^.,;\n]+/gi, ' ');
  return { cleanText, deniedTools };
}

function fallbackMember(duties: string): { role: 'member' | 'admin'; workRole: string; roles: string[]; tools: string[]; suggestedActions: string[]; permissions: string[] } {
  const { cleanText, deniedTools } = stripNegations(duties);

  const roles: string[] = [];
  const suggestedActions: string[] = [];
  const permissions: string[] = [];

  if (/\b(chef|cook|kitchen|food|prep|prepare|prepares|cooking|baker|bakery|tailor|tailoring|sew|sewing|weave|weaves|weaving|loom|craft|artisan|assemble|assembly|production|manufacture|maker)\b/i.test(cleanText)) {
    roles.push('chef');
    permissions.push('Kitchen & workshop order preparation');
    permissions.push('Order handoff & status');
    suggestedActions.push('order.create', 'order.handoff', 'stock.adjust');
  }

  if (!deniedTools.has('cashier') && /\b(cashier|checkout|register|counter|sell|selling|sale|sales|billing point|clerk)\b/i.test(cleanText)) {
    roles.push('cashier');
    permissions.push('Record sales & checkout');
    permissions.push('Open & count register');
    suggestedActions.push('pos.open', 'pos.checkout', 'pos.register.open', 'pos.register.count');
  }

  if (/\b(product|products|stock|inventory|catalog|item|items|variant|variants|price|prices)\b/i.test(cleanText)) {
    roles.push('manager');
    permissions.push('Manage catalog & variants');
    permissions.push('Adjust stock & pricing');
    suggestedActions.push('catalog.item.save', 'catalog.variant.save', 'price.set', 'stock.adjust');
  }

  if (/\b(delivery|driver|courier|dispatch|pickup|dropoff|dropoffs|rider|transit|shipment)\b/i.test(cleanText)) {
    roles.push('courier');
    permissions.push('Deliver orders');
    permissions.push('Track shipments');
    suggestedActions.push('pos.order.reach', 'pos.order.collect', 'pos.order.deliver', 'shipment.track');
  }

  if (/\b(server|waiter|waitress|waitstaff|service|tables|table|reception|front desk|customer service|intake)\b/i.test(cleanText)) {
    roles.push('server');
    permissions.push('Customer service & intake');
    suggestedActions.push('pos.order.save', 'pos.customer.save');
  }

  if (/\b(accountant|finance|invoice|invoices|payment|payments|expense|expenses|billing|tax|taxes|bank)\b/i.test(cleanText)) {
    roles.push('accountant');
    permissions.push('Issue invoices & record payments');
    permissions.push('Record expenses & bank reconciliation');
    suggestedActions.push('invoice.issue', 'payment.record', 'expense.record', 'bank.reconcile');
  }

  if (/\b(warehouse|pick|packing|packer|picker|freight|transfer|transfers|godown|stockroom|storage)\b/i.test(cleanText)) {
    roles.push('warehouse');
    permissions.push('Warehouse picking & packing');
    permissions.push('Stock transfers');
    suggestedActions.push('warehouse.pick', 'warehouse.pack', 'stock.transfer');
  }

  if (/\b(buyer|procurement|purchase|purchases|purchasing|sourcing|quote|quotes|supplier|suppliers)\b/i.test(cleanText)) {
    roles.push('buyer');
    permissions.push('Supplier quotes & purchasing');
    suggestedActions.push('quote.request', 'quote.record', 'purchase.create', 'purchase.submit');
  }

  if (!roles.length) {
    roles.push('general');
    permissions.push('Create tasks & view workspace records');
    suggestedActions.push('task.create', 'record.create');
  }

  const primaryRole = roles[0];
  const tools = toolsForRole(primaryRole, duties);
  return {
    role: 'member',
    workRole: primaryRole,
    roles,
    tools,
    suggestedActions: [...new Set(suggestedActions)],
    permissions: [...new Set(permissions)],
  };
}

export function toolsForRole(role: string, dutiesText: string): string[] {
  const { cleanText, deniedTools } = stripNegations(dutiesText);
  const tools: string[] = [];
  const r = role.toLowerCase().trim();

  if (r === 'chef' || r === 'cook' || r === 'kitchen') {
    tools.push('order', 'inventory');
  } else if (r === 'cashier') {
    tools.push('pos', 'register', 'payment');
  } else if (r === 'courier' || r === 'delivery') {
    tools.push('order');
  } else if (r === 'warehouse') {
    tools.push('inventory', 'order');
  } else if (r === 'manager') {
    tools.push('item', 'inventory', 'order', 'members');
  } else if (r === 'accountant' || r === 'finance') {
    tools.push('invoice', 'payment', 'expense', 'register');
  } else if (r === 'server' || r === 'waiter') {
    tools.push('pos', 'order');
  }

  // Keywords in cleanText
  if (!deniedTools.has('pos') && /\b(pos|counter sales?|sell)\b/i.test(cleanText)) tools.push('pos');
  if (!deniedTools.has('register') && /\b(register|cash drawer|cash in|cash out)\b/i.test(cleanText)) tools.push('register');
  if (!deniedTools.has('item') && /\b(product|catalog|item|items|price)\b/i.test(cleanText)) tools.push('item');
  if (!deniedTools.has('inventory') && /\b(inventory|stock|ingredients?)\b/i.test(cleanText)) tools.push('inventory');
  if (!deniedTools.has('order') && /\b(order|orders)\b/i.test(cleanText)) tools.push('order');
  if (!deniedTools.has('invoice') && /\b(invoice|bill|billing|gst)\b/i.test(cleanText)) tools.push('invoice');
  if (!deniedTools.has('payment') && /\b(payment|upi|card|refund)\b/i.test(cleanText)) tools.push('payment');
  if (!deniedTools.has('expense') && /\b(expense|expenses|petty cash)\b/i.test(cleanText)) tools.push('expense');
  if (!deniedTools.has('site') && /\b(site|website|storefront|online)\b/i.test(cleanText)) tools.push('site');
  if (!deniedTools.has('members') && /\b(team|members|staff)\b/i.test(cleanText)) tools.push('members');

  const canonicalIds = new Set(['pos', 'register', 'item', 'inventory', 'order', 'invoice', 'payment', 'expense', 'site', 'members']);
  return Array.from(new Set(tools)).filter((id) => canonicalIds.has(id) && !deniedTools.has(id));
}

export async function suggestMember(
  apiKey: string | undefined,
  duties: string,
  _enabledCapabilities?: { pos?: boolean; commerce?: boolean; site?: boolean },
): Promise<MemberSuggestionResult> {
  const text = duties.trim().slice(0, 2000);
  const fallback = fallbackMember(text || 'General member');
  if (!apiKey || !text) {
    return {
      ...fallback,
      confidence: 0.85,
      review: true,
    };
  }

  const outcome = await askSystemOne(apiKey, {
    timeout: 8_000,
    state: { duties: text },
    questions: {
      role: {
        type: 'choice',
        instructions: 'Which primary operational role best matches the duties described for this workspace member across all commercial domains?',
        criteria: {
          cashier: 'Sales & Checkout (counter sales, cashier, retail desk, billing point, cash drawer transactions)',
          chef: 'Operations & Production (order prep, kitchen cooking, tailoring/weaving, workshop crafting, artisan work)',
          courier: 'Fulfillment & Delivery (order packing, courier dispatch, driver delivery, parcel dropoffs)',
          warehouse: 'Inventory & Warehouse (stock audits, goods receiving, godown storage, picking & packing, wastage)',
          manager: 'Store Management (catalog, items, pricing variants, team coordination, store oversight)',
          accountant: 'Finance & Accounting (invoicing, bookkeeping, tax, payments reconciliation, expense tracking)',
          server: 'Customer Service & Floor (client intake, service desk, appointments, front counter assistance)',
          buyer: 'Purchasing & Procurement (supplier quotes, purchase orders, vendor sourcing, restocking)',
          general: 'General Team (administrative tasks, shared records, operational assistance)',
        },
      },
    },
  });

  if (!outcome.ok) {
    return {
      ...fallback,
      confidence: 0.7,
      review: true,
    };
  }

  const { deniedTools } = stripNegations(text);
  const answer = choiceOf(outcome.value.answers.role);
  let matchedRole = answer.choice && answer.choice !== 'none' ? answer.choice : fallback.workRole;
  if (matchedRole === 'cashier' && deniedTools.has('cashier')) {
    matchedRole = fallback.workRole;
  }
  const mergedRoles = [matchedRole, ...fallback.roles.filter((r) => r !== matchedRole)];
  const tools = toolsForRole(matchedRole, text);

  return {
    role: fallback.role,
    workRole: matchedRole,
    roles: mergedRoles,
    tools,
    suggestedActions: fallback.suggestedActions,
    permissions: fallback.permissions,
    confidence: answer.confidence ?? 0.85,
    model: outcome.value.model,
    review: true,
  };
}

export interface ToolAccessEvaluation {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kind: 'tool' | 'human' | 'channel' | 'flow' | 'site';
  readonly reach: 'none' | 'customer' | 'money' | 'data';
  readonly probability: number;
  readonly on: boolean;
  readonly ask: boolean;
}

export interface MemberAccessResult {
  readonly brief: string;
  readonly evaluations: ToolAccessEvaluation[];
  readonly suggestedAccess: string[];
  readonly model?: string;
  readonly review: true;
}

const toolKeywords: Record<string, RegExp> = {
  pos: /\b(pos|point of sale|counter sales?|counter|cashier|checkout|barcode|receipt|kadanai|sell|selling)\b/i,
  register: /\b(register|cash drawer|drawer|cash in|cash out|count (physical )?cash|float|shift|closing drawer)\b/i,
  item: /\b(products?|catalog|items?|variants?|prices?|photos?|units?|mrp)\b/i,
  inventory: /\b(inventory|stock|count stock|damage|wastage|transfers?|godown|warehouse|audit)\b/i,
  order: /\b(orders?|take orders?|reserve stock|shipping|courier|delivery|pack(ing)?|parcel)\b/i,
  invoice: /\b(billing|bills?|invoice|invoices|gst|tax invoice)\b/i,
  payment: /\b(payments?|upi|cash received|card|refunds?|settle|settlement)\b/i,
  expense: /\b(expenses?|daily expenses?|petty cash|tea|kaapi|packaging|fuel|expenditure)\b/i,
  purchase: /\b(purchases?|purchase orders?|po|suppliers?|vendors?|quotes?|buy supplies|procurement)\b/i,
  members: /\b(members?|team|staff|roles?|briefs?|permissions?|invite|cashier and packer)\b/i,
  contact: /\b(contacts?|customers?|phone numbers?|directory|suppliers? phone)\b/i,
  human: /\b(you do|manual|physical|pack box|lock shop|lock shutter|call|chore|hand)\b/i,
  flow: /\b(flow|flows?|routines?|checklist|closing( the shop)?|opening( the shop)?|handover)\b/i,
  site: /\b(site|sites?|online store|storefront|website|landing|theme|catalog sync)\b/i,
  inbox: /\b(inbox|team feed|task feed|now|work queue)\b/i,
  chat: /\b(chat|whatsapp chat|wa\.me|message customer|manual chat)\b/i,
  whatsapp: /\b(whatsapp api|cloud waba|official whatsapp|automated bills|pdf bill|meta api)\b/i,
  telegram: /\b(telegram|telegram bot|team alerts|closing report|channel)\b/i,
};

function fallbackToolProbability(toolId: string, brief: string): number {
  const { cleanText, deniedTools } = stripNegations(brief);
  if (deniedTools.has(toolId)) return 0.05;

  const matcher = toolKeywords[toolId];
  if (matcher && matcher.test(cleanText)) {
    if (toolId === 'pos') return 0.95;
    if (toolId === 'register') return 0.93;
    if (toolId === 'flow') return 0.91;
    return 0.88;
  }
  return 0.10;
}

export async function evaluateMemberAccess(
  apiKey: string | undefined,
  brief: string,
  activeTools?: readonly ToolDefinition[],
): Promise<MemberAccessResult> {
  const text = brief.trim().slice(0, 2000);
  const tools = activeTools || canonicalTools;
  const { deniedTools } = stripNegations(text);

  let rawProbabilities: Record<string, number> = {};
  let model: string | undefined;

  if (apiKey && text) {
    const questions: Record<string, SystemOneQuestion> = {};
    for (const tool of tools) {
      questions[tool.id] = {
        type: 'noul',
        instructions: `Does \`brief\` say this person needs ${tool.description}?`,
      };
    }
    const outcome = await askSystemOne(apiKey, {
      timeout: 8_000,
      state: { brief: text },
      questions,
    });
    if (outcome.ok) {
      model = outcome.value.model;
      for (const tool of tools) {
        const answer = noulOf(outcome.value.answers[tool.id]);
        rawProbabilities[tool.id] = answer.probability !== null ? answer.probability : fallbackToolProbability(tool.id, text);
      }
    } else {
      for (const tool of tools) {
        rawProbabilities[tool.id] = fallbackToolProbability(tool.id, text);
      }
    }
  } else {
    for (const tool of tools) {
      rawProbabilities[tool.id] = fallbackToolProbability(tool.id, text);
    }
  }

  const evaluations: ToolAccessEvaluation[] = tools.map((tool) => {
    let prob = rawProbabilities[tool.id] ?? 0.10;
    if (deniedTools.has(tool.id)) {
      prob = 0.05;
    }
    const isMoney = tool.reach === 'money';
    // Rules kept in code:
    // >= 0.80: Pre-ticked (on: true), UNLESS sensitive (reach: money) which is NEVER pre-ticked
    // 0.20 - 0.80: Unticked ask me (ask: true)
    // <= 0.20: Hidden under More (on: false, ask: false)
    const on = !deniedTools.has(tool.id) && !isMoney && prob >= 0.80;
    const ask = !deniedTools.has(tool.id) && (isMoney ? prob >= 0.20 : (prob >= 0.20 && prob < 0.80));

    return {
      id: tool.id,
      title: tool.title,
      description: tool.description,
      kind: tool.kind,
      reach: tool.reach,
      probability: Number(prob.toFixed(2)),
      on,
      ask,
    };
  });

  const suggestedAccess = evaluations.filter((item) => item.on).map((item) => item.id);

  return {
    brief: text,
    evaluations,
    suggestedAccess,
    model,
    review: true,
  };
}
