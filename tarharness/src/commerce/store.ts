import type { Client, Transaction } from '@libsql/client/web';
import { badRequest, conflict, notFound } from '../errors.ts';
import { eventStatement, findReplay } from '../gateway/commit.ts';
import type { AccessContext } from '../types.ts';

type Data = Record<string, unknown>;
type Row = { id: string; type: string; title: string; state: string; data: Data; version: number };
type Line = { variant: string; quantity: number; cost?: number };
const json = (value: unknown) => JSON.stringify(value);
const text = (value: unknown, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Data => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const integer = (value: unknown, label: string, minimum = 0) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > 100_000_000) throw badRequest(`${label} is invalid.`);
  return value;
};
const money = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < 0) throw badRequest(`${label} exceeds the supported exact amount.`);
  return value;
};
const currency = (value: unknown) => {
  const code = text(value, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw badRequest('A three letter currency is required.');
  return code;
};
const location = (value: unknown) => text(value, 100) || 'main';
const timestamp = (value: unknown, label: string) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw badRequest(`${label} is invalid.`);
  return value;
};
const status = (value: unknown) => {
  if (value === undefined || value === '' || value === 'active') return 'active';
  if (value === 'archived') return 'archived';
  throw badRequest('Status must be active or archived.');
};
const attributes = (value: unknown): Data => {
  if (value === undefined || value === '') return {};
  if (typeof value === 'string') {
    try { return object(JSON.parse(value)); } catch { throw badRequest('Attributes must be valid JSON.'); }
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value as Data;
  throw badRequest('Attributes must be a JSON object.');
};
const decode = (value: Record<string, unknown>): Row => ({ id: String(value.id), type: String(value.type), title: String(value.title), state: String(value.state), data: object(JSON.parse(String(value.data))), version: Number(value.version) });

function lines(value: unknown, cost = false): Line[] {
  let source = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch { throw badRequest('Lines must be valid JSON.'); }
  }
  if (!Array.isArray(source) || source.length < 1 || source.length > 100) throw badRequest('One to 100 lines are required.');
  const parsed = source.map((entry) => {
    const item = object(entry); const variant = text(item.variant, 160); const quantity = integer(item.quantity, 'Line quantity', 1);
    if (!variant) throw badRequest('Every line needs a variant.');
    return { variant, quantity, ...(cost ? { cost: integer(item.cost, 'Line cost') } : {}) };
  });
  if (new Set(parsed.map((line) => line.variant)).size !== parsed.length) throw badRequest('Combine duplicate variant lines.');
  return parsed;
}

async function get(db: Pick<Transaction, 'execute'>, id: string, type?: string): Promise<Row> {
  const result = await db.execute({ sql: `SELECT * FROM records WHERE id=?${type ? ' AND type=?' : ''} AND archived IS NULL`, args: type ? [id, type] : [id] });
  if (!result.rows[0]) throw notFound(`${type || 'Record'} not found.`);
  return decode(result.rows[0]);
}

async function insert(db: Transaction, type: string, title: string, state: string, data: Data, actor: string, at: number, id = `rec_${crypto.randomUUID()}`): Promise<Row> {
  await db.execute({ sql: 'INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES(?,?,?,?,?,?,1,?,?)', args: [id, type, title, state, json(data), actor, at, at] });
  return { id, type, title, state, data, version: 1 };
}

async function revise(db: Transaction, current: Row, title: string, state: string, data: Data, at: number, version: number): Promise<Row> {
  if (current.version !== version) throw conflict('Record changed. Reload before saving.');
  const updated = await db.execute({ sql: 'UPDATE records SET title=?,state=?,data=?,version=version+1,updated=? WHERE id=? AND version=?', args: [title, state, json(data), at, current.id, version] });
  if (updated.rowsAffected !== 1) throw conflict('Record changed. Reload before saving.');
  return { id: current.id, type: current.type, title, state, data, version: version + 1 };
}

async function stock(db: Transaction, variant: string, place: string, at: number, actor: string): Promise<Row> {
  const found = await db.execute({ sql: "SELECT * FROM records WHERE type='stock' AND json_extract(data,'$.variant')=? AND json_extract(data,'$.location')=? AND archived IS NULL", args: [variant, place] });
  if (found.rows[0]) return decode(found.rows[0]);
  return insert(db, 'stock', `Stock ${variant} at ${place}`, 'active', { variant, location: place, onhand: 0, reserved: 0 }, actor, at);
}

async function setStock(db: Transaction, current: Row, onhand: number, reserved: number, at: number) {
  if (!Number.isSafeInteger(onhand) || !Number.isSafeInteger(reserved) || onhand < 0 || reserved < 0 || reserved > onhand) throw conflict('Stock is no longer sufficient. Refresh and try again.');
  const update = await db.execute({ sql: 'UPDATE records SET data=?,version=version+1,updated=? WHERE id=? AND version=?', args: [json({ ...current.data, onhand, reserved }), at, current.id, current.version] });
  if (update.rowsAffected !== 1) throw conflict('Stock changed. Refresh and try again.');
}

async function posting(db: Transaction, reference: string, lines: Data[], actor: string, at: number) {
  if (lines.some((line) => !Number.isSafeInteger(Number(line.debit || 0)) || !Number.isSafeInteger(Number(line.credit || 0))
    || Number(line.debit || 0) < 0 || Number(line.credit || 0) < 0)) throw new Error('Invalid posting amount.');
  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  if (!Number.isSafeInteger(debit) || debit !== credit) throw new Error('Unbalanced posting.');
  return insert(db, 'posting', `Posting ${reference}`, 'posted', { reference, lines, debit, credit }, actor, at);
}


/** Cash the register should hold: opening float + cash in - cash out since it opened. */
async function expectedRegisterCash(db: Pick<Transaction, 'execute'>, register: Row, at: number): Promise<number> {
  const opened = Number(register.data.opened || 0);
  const [ins, outs] = await Promise.all([
    db.execute({ sql: "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) FROM records WHERE type='payment' AND json_extract(data,'$.method')='cash' AND json_extract(data,'$.invoice') IS NOT NULL AND created>=? AND archived IS NULL", args: [opened] }),
    db.execute({ sql: "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) FROM records WHERE ((type='refund' AND json_extract(data,'$.method')='cash') OR (type='expense' AND state='recorded')) AND created>=? AND archived IS NULL", args: [opened] }),
  ]);
  return Number(register.data.opening || 0) + Number(ins.rows[0][0]) - Number(outs.rows[0][0]);
}

export async function executeCommerce(client: Client, context: AccessContext, action: string, input: Data, key: string, hash: string, typesafeKey?: string): Promise<Data> {
  const db = await client.transaction('write');
  try {
    const replay = await findReplay(db, key, hash);
    if (replay) { await db.commit(); return replay.result as Data; }
    const at = Date.now(); const actor = context.identity.id;
    let result: Data;

    if (action === 'catalog.item.save') {
      const name = text(input.name);
      const generatedSku = name ? name.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 30) : '';
      const sku = text(input.sku, 80) || generatedSku;
      const id = text(input.id, 160);
      if (!name || !sku) throw badRequest('Item name and code are required.');
      const current = id ? await get(db, id, 'item') : null;
      const duplicate = await db.execute({ sql: "SELECT id FROM records WHERE type='item' AND json_extract(data,'$.sku')=? AND id!=? AND archived IS NULL", args: [sku, id] });
      if (duplicate.rows.length) throw conflict('Item code already belongs to another item.');
      const unit = text(input.unit, 40) || 'each';
      const tax = integer(input.tax ?? 0, 'Tax rate');
      if (tax > 10000) throw badRequest('Tax rate is invalid.');
      const state = status(input.status);

      const category = text(input.category, 100);
      const photoUrl = text(input.photoUrl, 500);
      const price = input.price !== undefined && input.price !== '' ? integer(Number(input.price), 'Price') : undefined;
      const mrp = input.mrp !== undefined && input.mrp !== '' ? integer(Number(input.mrp), 'MRP') : price;
      const stockQty = input.stock !== undefined && input.stock !== '' ? integer(Number(input.stock), 'Initial stock') : undefined;

      const itemData: Data = {
        ...current?.data,
        sku,
        unit,
        tax,
        ...(category ? { category } : {}),
        ...(photoUrl ? { photoUrl } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(mrp !== undefined ? { mrp } : {}),
      };

      const savedItem = current
        ? await revise(db, current, name, state, itemData, at, integer(input.version, 'Version', 1))
        : await insert(db, 'item', name, state, itemData, actor, at);

      const createdVariants: Data[] = [];
      const createdPrices: Data[] = [];
      const createdStocks: Data[] = [];

      // 1. Process explicit variants if provided
      if (Array.isArray(input.variants) && input.variants.length > 0) {
        for (let i = 0; i < input.variants.length; i++) {
          const varEntry = object(input.variants[i]);
          const varOption = text(varEntry.option) || text(varEntry.name) || `Option ${i + 1}`;
          const varName = text(varEntry.name) || `${name} (${varOption})`;
          const varSku = text(varEntry.sku, 80) || `${sku}-${i + 1}`;
          const varBarcode = text(varEntry.barcode, 80) || varSku;
          const varPrice = varEntry.price !== undefined ? integer(Number(varEntry.price), 'Variant price') : (price ?? 0);
          const varStock = varEntry.stock !== undefined ? integer(Number(varEntry.stock), 'Variant stock') : (stockQty ?? 0);
          const varDim = text(varEntry.dimension) || 'option';

          const varRecord = await insert(db, 'variant', varName, 'active', {
            item: savedItem.id,
            sku: varSku,
            barcode: varBarcode,
            attributes: { [varDim]: varOption },
          }, actor, at);
          createdVariants.push(varRecord);

          if (varPrice > 0 || price !== undefined) {
            const priceRecord = await insert(db, 'price', `${varName} price`, 'active', {
              variant: varRecord.id,
              amount: varPrice,
              currency: 'INR',
              channel: 'default',
              starts: at,
              ends: null,
            }, actor, at);
            createdPrices.push(priceRecord);
          }

          if (varStock > 0) {
            const currentStock = await stock(db, varRecord.id, 'main', at, actor);
            await setStock(db, currentStock, varStock, 0, at);
            createdStocks.push({ variant: varRecord.id, onhand: varStock });
          }
        }
      } else if (price !== undefined || stockQty !== undefined) {
        // 2. Single item / default variant
        const existingVar = await db.execute({ sql: "SELECT id FROM records WHERE type='variant' AND json_extract(data,'$.item')=? AND archived IS NULL LIMIT 1", args: [savedItem.id] });
        if (!existingVar.rows[0]) {
          const defaultVar = await insert(db, 'variant', `${name} Default`, 'active', {
            item: savedItem.id,
            sku,
            barcode: sku,
            attributes: { default: true },
          }, actor, at);
          createdVariants.push(defaultVar);

          if (price !== undefined) {
            const priceRecord = await insert(db, 'price', `${name} price`, 'active', {
              variant: defaultVar.id,
              amount: price,
              currency: 'INR',
              channel: 'default',
              starts: at,
              ends: null,
            }, actor, at);
            createdPrices.push(priceRecord);
          }

          if (stockQty !== undefined && stockQty > 0) {
            const currentStock = await stock(db, defaultVar.id, 'main', at, actor);
            await setStock(db, currentStock, stockQty, 0, at);
            createdStocks.push({ variant: defaultVar.id, onhand: stockQty });
          }
        }
      }

      result = {
        item: savedItem,
        ...(createdVariants.length ? { variants: createdVariants } : {}),
        ...(createdPrices.length ? { prices: createdPrices } : {}),
        ...(createdStocks.length ? { stocks: createdStocks } : {}),
      };
    } else if (action === 'catalog.variant.save') {
      const item = await get(db, text(input.item, 160), 'item'); const name = text(input.name); const sku = text(input.sku, 80); const id = text(input.id, 160);
      if (item.state !== 'active') throw conflict('The item is archived.');
      if (!name || !sku) throw badRequest('Variant name and SKU are required.');
      const current = id ? await get(db, id, 'variant') : null;
      const barcode = text(input.barcode, 80); const details = input.attributes === undefined ? object(current?.data.attributes) : attributes(input.attributes);
      const duplicate = await db.execute({ sql: "SELECT id FROM records WHERE type='variant' AND id!=? AND archived IS NULL AND (json_extract(data,'$.sku')=? OR (?!='' AND json_extract(data,'$.barcode')=?))", args: [id, sku, barcode, barcode] });
      if (duplicate.rows.length) throw conflict('SKU or barcode already belongs to another variant.');
      const state = status(input.status);
      if (state === 'archived' && current) {
        const reserved = await db.execute({ sql: "SELECT id FROM records WHERE type='stock' AND json_extract(data,'$.variant')=? AND json_extract(data,'$.reserved')>0 AND archived IS NULL LIMIT 1", args: [current.id] });
        if (reserved.rows.length) throw conflict('Release reserved stock before archiving the variant.');
      }
      const data = { ...current?.data, item: item.id, sku, barcode, attributes: details };
      result = { variant: current ? await revise(db, current, name, state, data, at, integer(input.version, 'Version', 1))
        : await insert(db, 'variant', name, state, data, actor, at) };
    } else if (action === 'price.set') {
      const variant = await get(db, text(input.variant, 160), 'variant'); const amount = integer(input.amount, 'Price'); const code = currency(input.currency);
      if (variant.state !== 'active') throw conflict('The variant is archived.');
      const channel = text(input.channel, 40) || 'default';
      const starts = input.starts === undefined ? at : timestamp(input.starts, 'Start time');
      const ends = input.ends === undefined || input.ends === '' ? null : timestamp(input.ends, 'End time');
      if (ends !== null && ends <= starts) throw badRequest('Price end must be after its start.');
      const active = await db.execute({ sql: "SELECT * FROM records WHERE type='price' AND state='active' AND json_extract(data,'$.variant')=? AND json_extract(data,'$.channel')=? AND archived IS NULL ORDER BY json_extract(data,'$.starts') DESC", args: [variant.id, channel] });
      for (const entry of active.rows.map(decode)) {
        const before = Number(entry.data.starts); const after = entry.data.ends === null ? Number.POSITIVE_INFINITY : Number(entry.data.ends);
        if (before >= starts && before < (ends ?? Number.POSITIVE_INFINITY)) {
          await db.execute({ sql: "UPDATE records SET state='replaced',version=version+1,updated=? WHERE id=?", args: [at, entry.id] });
        } else if (before < starts && after > starts) {
          await db.execute({ sql: 'UPDATE records SET data=?,version=version+1,updated=? WHERE id=?', args: [json({ ...entry.data, ends: starts }), at, entry.id] });
        }
      }
      result = { price: await insert(db, 'price', `${variant.title} price`, 'active', { variant: variant.id, amount, currency: code, channel, starts, ends }, actor, at) };
    } else if (action === 'stock.adjust') {
      const variant = await get(db, text(input.variant, 160), 'variant'); const quantity = integer(Math.abs(Number(input.quantity)), 'Quantity', 1) * (Number(input.quantity) < 0 ? -1 : 1); const reason = text(input.reason);
      if (!reason) throw badRequest('A stock adjustment reason is required.');
      if (variant.state !== 'active') throw conflict('The variant is archived.');
      const place = location(input.location);
      const current = await stock(db, variant.id, place, at, actor); const onhand = Number(current.data.onhand) + quantity; const reserved = Number(current.data.reserved);
      await setStock(db, current, onhand, reserved, at);
      result = { stock: { id: current.id, location: place, onhand, reserved, version: current.version + 1 }, movement: await insert(db, 'movement', reason, 'posted', { variant: variant.id, location: place, quantity, balance: onhand, reason }, actor, at) };
    } else if (action === 'purchase.create') {
      const supplier = text(input.supplier, 160); await get(db, supplier); const purchaseLines = lines(input.lines, true); let total = 0;
      const code = currency(input.currency); const place = location(input.location);
      const savedLines: Data[] = [];
      for (const line of purchaseLines) {
        const variant = await get(db, line.variant, 'variant');
        if (variant.state !== 'active') throw conflict('The variant is archived.');
        total = money(total + money(line.quantity * (line.cost || 0), 'Purchase line'), 'Purchase total');
        savedLines.push({ ...line, title: variant.title, received: 0 });
      }
      result = { purchase: await insert(db, 'purchase', `Purchase ${supplier}`, 'ordered', { supplier, lines: savedLines, total, currency: code, location: place }, actor, at) };
    } else if (action === 'purchase.receive') {
      const purchase = await get(db, text(input.purchase, 160), 'purchase'); const version = integer(input.version, 'Version', 1);
      if (purchase.version !== version || !['ordered', 'partial'].includes(purchase.state)) throw conflict('Purchase order changed or is not open.');
      const ordered = (Array.isArray(purchase.data.lines) ? purchase.data.lines : []).map(object);
      const receivedLines = input.lines ? lines(input.lines) : ordered.map((line) => ({ variant: String(line.variant), quantity: Number(line.quantity) - Number(line.received || 0) })).filter((line) => line.quantity > 0);
      let receivedTotal = 0;
      for (const received of receivedLines) {
        const line = ordered.find((item) => item.variant === received.variant); if (!line || received.quantity > Number(line.quantity) - Number(line.received || 0)) throw conflict('Received quantity exceeds the purchase remainder.');
        const place = String(purchase.data.location);
        const current = await stock(db, received.variant, place, at, actor); const onhand = Number(current.data.onhand) + received.quantity;
        await setStock(db, current, onhand, Number(current.data.reserved), at);
        await insert(db, 'movement', 'Purchase receipt', 'posted', { variant: received.variant, location: place, quantity: received.quantity, balance: onhand, purchase: purchase.id }, actor, at);
        receivedTotal = money(receivedTotal + money(received.quantity * Number(line.cost), 'Receipt line'), 'Receipt total');
        line.received = Number(line.received || 0) + received.quantity;
      }
      const complete = ordered.every((line) => Number(line.received) === Number(line.quantity));
      const state = complete ? 'received' : 'partial';
      const update = await db.execute({ sql: 'UPDATE records SET state=?,data=?,version=version+1,updated=? WHERE id=? AND version=?', args: [state, json({ ...purchase.data, lines: ordered }), at, purchase.id, version] });
      if (update.rowsAffected !== 1) throw conflict('Purchase order changed.');
      const receipt = await insert(db, 'receipt', `Receipt ${purchase.id}`, 'posted', { purchase: purchase.id, lines: receivedLines, amount: receivedTotal, currency: purchase.data.currency, location: purchase.data.location }, actor, at);
      const ledger = await posting(db, receipt.id, [{ account: 'inventory', debit: receivedTotal }, { account: 'payable', credit: receivedTotal }], actor, at);
      result = { receipt, purchase: { id: purchase.id, state, version: version + 1 }, posting: ledger };
    } else if (action === 'order.create') {
      const requested = lines(input.lines); const priced: Data[] = []; let total = 0; let subtotal = 0; let taxes = 0; let code = '';
      const place = location(input.location); const channel = text(input.channel, 40) || 'default';
      for (const line of requested) {
        const variant = await get(db, line.variant, 'variant');
        if (variant.state !== 'active') throw conflict('The variant is archived.');
        const item = await get(db, String(variant.data.item), 'item');
        if (item.state !== 'active') throw conflict('The item is archived.');
        const priceRows = await db.execute({ sql: "SELECT * FROM records WHERE type='price' AND state='active' AND json_extract(data,'$.variant')=? AND json_extract(data,'$.channel')=? AND json_extract(data,'$.starts')<=? AND (json_extract(data,'$.ends') IS NULL OR json_extract(data,'$.ends')>?) AND archived IS NULL ORDER BY json_extract(data,'$.starts') DESC,updated DESC LIMIT 1", args: [variant.id, channel, at, at] });
        if (!priceRows.rows[0]) throw conflict(`No active price exists for ${variant.title}.`);
        const price = decode(priceRows.rows[0]); const current = await stock(db, variant.id, place, at, actor); const onhand = Number(current.data.onhand); const reserved = Number(current.data.reserved);
        if (onhand - reserved < line.quantity) throw conflict(`${variant.title} has insufficient available stock.`);
        await setStock(db, current, onhand, reserved + line.quantity, at);
        const amount = Number(price.data.amount); const lineCurrency = String(price.data.currency);
        if (code && code !== lineCurrency) throw conflict('An order cannot mix currencies.');
        code = lineCurrency;
        const gross = money(amount * line.quantity, 'Order line'); const tax = money(Math.round(gross * Number(item.data.tax || 0) / 10000), 'Order tax');
        subtotal = money(subtotal + gross, 'Order subtotal'); taxes = money(taxes + tax, 'Order tax'); total = money(total + gross + tax, 'Order total');
        priced.push({ variant: variant.id, item: item.id, title: variant.title, quantity: line.quantity, price: amount, tax, total: gross + tax, pricing: price.id });
      }
      const customer = text(input.customer, 160) || null; if (customer) await get(db, customer);
      result = { order: await insert(db, 'order', `Order ${new Date(at).toISOString()}`, 'open', { customer, lines: priced, subtotal, tax: taxes, total, currency: code, channel, location: place }, actor, at) };
    } else if (action === 'order.fulfill' || action === 'order.cancel') {
      const order = await get(db, text(input.order, 160), 'order'); const version = integer(input.version, 'Version', 1);
      if (order.version !== version || order.state !== 'open') throw conflict('Order changed or is not open.');
      for (const item of (Array.isArray(order.data.lines) ? order.data.lines : []).map(object)) {
        const place = String(order.data.location);
        const current = await stock(db, String(item.variant), place, at, actor); const quantity = Number(item.quantity);
        const onhand = Number(current.data.onhand) - (action === 'order.fulfill' ? quantity : 0); const reserved = Number(current.data.reserved) - quantity;
        await setStock(db, current, onhand, reserved, at);
        if (action === 'order.fulfill') await insert(db, 'movement', 'Order fulfilment', 'posted', { variant: item.variant, location: place, quantity: -quantity, balance: onhand, order: order.id }, actor, at);
      }
      const state = action === 'order.fulfill' ? 'fulfilled' : 'cancelled'; const update = await db.execute({ sql: 'UPDATE records SET state=?,version=version+1,updated=? WHERE id=? AND version=?', args: [state, at, order.id, version] });
      if (update.rowsAffected !== 1) throw conflict('Order changed.'); result = { order: { id: order.id, state, version: version + 1 } };
    } else if (action === 'invoice.issue') {
      const order = await get(db, text(input.order, 160), 'order');
      if (order.state !== 'fulfilled') throw conflict('Fulfil the order before issuing its invoice.');
      const existing = await db.execute({ sql: "SELECT id FROM records WHERE type='invoice' AND json_extract(data,'$.order')=? AND archived IS NULL", args: [order.id] });
      if (existing.rows.length) throw conflict('This order already has an invoice.');
      const due = input.due === undefined || input.due === '' ? null : timestamp(input.due, 'Due time');
      const invoice = await insert(db, 'invoice', `Invoice ${order.id}`, 'issued', { order: order.id, customer: order.data.customer || null,
        lines: order.data.lines, subtotal: order.data.subtotal, tax: order.data.tax, total: order.data.total, net: order.data.total,
        paid: 0, refunded: 0, currency: order.data.currency, due }, actor, at);
      const ledger = await posting(db, invoice.id, [{ account: 'receivable', debit: order.data.total }, { account: 'revenue', credit: order.data.subtotal }, { account: 'tax', credit: order.data.tax }], actor, at);
      result = { invoice, posting: ledger };
    } else if (action === 'payment.record') {
      const invoice = await get(db, text(input.invoice, 160), 'invoice'); const amount = integer(input.amount, 'Payment', 1); const paid = Number(invoice.data.paid || 0); const net = Number(invoice.data.net);
      if (!['issued', 'partial'].includes(invoice.state) || paid + amount > net) throw conflict('Payment exceeds the open invoice balance.');
      const method = text(input.method, 40); if (!method) throw badRequest('Payment method is required.');
      const provider = text(input.provider, 80) || method; const reference = text(input.reference, 160);
      if (method !== 'cash' && !reference) throw badRequest('A payment reference is required for a noncash method.');
      if (reference) {
        const duplicate = await db.execute({ sql: "SELECT id FROM records WHERE type='payment' AND json_extract(data,'$.provider')=? AND json_extract(data,'$.reference')=? AND archived IS NULL LIMIT 1", args: [provider, reference] });
        if (duplicate.rows.length) throw conflict('This provider payment reference is already recorded.');
      }
      const payment = await insert(db, 'payment', `Payment ${invoice.id}`, 'recorded', { invoice: invoice.id, amount, method, provider, reference: reference || null, currency: invoice.data.currency }, actor, at);
      const nextPaid = paid + amount; const state = nextPaid === net ? 'paid' : 'partial';
      const updated = await db.execute({ sql: 'UPDATE records SET state=?,data=?,version=version+1,updated=? WHERE id=? AND version=?', args: [state, json({ ...invoice.data, paid: nextPaid }), at, invoice.id, invoice.version] });
      if (updated.rowsAffected !== 1) throw conflict('Invoice changed.');
      const ledger = await posting(db, payment.id, [{ account: method === 'cash' ? 'cash' : 'bank', debit: amount }, { account: 'receivable', credit: amount }], actor, at);
      result = { payment, invoice: { id: invoice.id, state, paid: nextPaid, version: invoice.version + 1 }, posting: ledger };
    } else if (action === 'refund.record') {
      const payment = await get(db, text(input.payment, 160), 'payment'); const invoice = await get(db, String(payment.data.invoice), 'invoice'); const amount = integer(input.amount, 'Refund', 1); const previous = await db.execute({ sql: "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) AS amount FROM records WHERE type='refund' AND json_extract(data,'$.payment')=? AND archived IS NULL", args: [payment.id] });
      if (Number(previous.rows[0].amount) + amount > Number(payment.data.amount)) throw conflict('Refund exceeds the remaining payment amount.');
      const reason = text(input.reason); if (!reason) throw badRequest('Refund reason is required.');
      const provider = text(input.provider, 80) || String(payment.data.provider); const reference = text(input.reference, 160);
      if (payment.data.method !== 'cash' && !reference) throw badRequest('A refund reference is required for a noncash method.');
      if (reference) {
        const duplicate = await db.execute({ sql: "SELECT id FROM records WHERE type='refund' AND json_extract(data,'$.provider')=? AND json_extract(data,'$.reference')=? AND archived IS NULL LIMIT 1", args: [provider, reference] });
        if (duplicate.rows.length) throw conflict('This provider refund reference is already recorded.');
      }
      const refunded = money(Number(invoice.data.refunded) + amount, 'Refund total');
      const net = money(Number(invoice.data.total) - refunded, 'Invoice net');
      const paid = Number(invoice.data.paid) - amount;
      if (paid < 0 || paid > net) throw conflict('Refund exceeds the refundable invoice balance.');
      const refund = await insert(db, 'refund', `Refund ${payment.id}`, 'recorded', { payment: payment.id, invoice: invoice.id, amount, reason, provider, reference: reference || null, currency: payment.data.currency }, actor, at);
      const state = paid === net ? 'paid' : paid === 0 ? 'issued' : 'partial';
      const updated = await db.execute({ sql: 'UPDATE records SET state=?,data=?,version=version+1,updated=? WHERE id=? AND version=?', args: [state, json({ ...invoice.data, paid, refunded, net }), at, invoice.id, invoice.version] });
      if (updated.rowsAffected !== 1) throw conflict('Invoice changed.');
      const ledger = await posting(db, refund.id, [{ account: 'returns', debit: amount }, { account: payment.data.method === 'cash' ? 'cash' : 'bank', credit: amount }], actor, at);
      result = { refund, invoice: { id: invoice.id, state, paid, refunded, net, version: invoice.version + 1 }, posting: ledger };
    } else if (action === 'purchase.pay') {
      const purchase = await get(db, text(input.purchase, 160), 'purchase');
      const amount = integer(input.amount, 'Payment amount', 1);
      const method = text(input.method, 40); if (!method) throw badRequest('Payment method is required.');
      const account = text(input.account, 80) || 'main';
      const reference = text(input.reference, 160);
      const currentPaid = Number(purchase.data.paid || 0);
      const total = Number(purchase.data.total || 0);
      if (currentPaid + amount > total && total > 0) throw conflict('Payment exceeds purchase order total.');
      const nextPaid = currentPaid + amount;
      const payment = await insert(db, 'payment', `Purchase payment ${purchase.id}`, 'recorded', {
        purchase: purchase.id, amount, method, account, reference: reference || null, currency: purchase.data.currency,
      }, actor, at);
      const updated = await db.execute({ sql: 'UPDATE records SET data=?,version=version+1,updated=? WHERE id=? AND version=?', args: [json({ ...purchase.data, paid: nextPaid }), at, purchase.id, purchase.version] });
      if (updated.rowsAffected !== 1) throw conflict('Purchase order changed.');
      const ledger = await posting(db, payment.id, [{ account: 'payable', debit: amount }, { account: method === 'cash' ? 'cash' : 'bank', credit: amount }], actor, at);
      result = { payment, purchase: { id: purchase.id, state: purchase.state, paid: nextPaid, version: purchase.version + 1 }, posting: ledger };
    } else if (action === 'expense.record') {
      const payee = text(input.payee); const category = text(input.category); const amount = integer(input.amount, 'Expense amount', 1);
      if (!payee || !category) throw badRequest('Payee and expense category are required.');
      const code = currency(input.currency || 'INR');
      const note = text(input.note, 500);
      let expenseLines: Data[] = [];
      if (input.lines) {
        if (typeof input.lines === 'string') {
          try { expenseLines = JSON.parse(input.lines); } catch { throw badRequest('Expense lines must be JSON.'); }
        } else if (Array.isArray(input.lines)) expenseLines = input.lines.map(object);
      }
      const expense = await insert(db, 'expense', `Expense ${payee}`, 'recorded', {
        payee, category, amount, currency: code, note: note || null, lines: expenseLines,
      }, actor, at);
      const ledger = await posting(db, expense.id, [{ account: 'expense', debit: amount }, { account: 'cash', credit: amount }], actor, at);
      result = { expense, posting: ledger };
    } else if (action === 'expense.reverse') {
      const expense = await get(db, text(input.expense, 160), 'expense');
      if (expense.state !== 'recorded') throw conflict('Only recorded expenses can be reversed.');
      const reason = text(input.reason, 500); if (!reason) throw badRequest('Reversal reason is required.');
      const amount = Number(expense.data.amount || 0);
      const updated = await db.execute({ sql: "UPDATE records SET state='reversed',data=?,version=version+1,updated=? WHERE id=? AND version=?", args: [json({ ...expense.data, reason, reversed: at }), at, expense.id, expense.version] });
      if (updated.rowsAffected !== 1) throw conflict('Expense changed.');
      const ledger = await posting(db, `rev_${expense.id}`, [{ account: 'cash', debit: amount }, { account: 'expense', credit: amount }], actor, at);
      result = { expense: { id: expense.id, state: 'reversed', version: expense.version + 1 }, posting: ledger };
    } else if (action === 'sale.write') {
      // The counter sale: one tap writes order + invoice + payment + stock +
      // posting in one commit. Invoice is the sale in gst mode; stock is
      // consumed, never reserved, because the goods just left the counter.
      const requested = lines(input.lines); const method = text(input.method, 20).toLowerCase() || 'cash';
      if (!['cash', 'upi', 'card'].includes(method)) throw badRequest('Payment method must be cash, upi or card.');
      const reference = text(input.reference, 160);
      if (method !== 'cash' && !reference) throw badRequest('A payment reference is required for a noncash method.');
      const tendered = input.tendered === undefined || input.tendered === '' ? null : integer(Number(input.tendered), 'Tendered cash');
      const place = location(input.location); const channel = text(input.channel, 40) || 'counter';
      const priced: Data[] = []; let total = 0; let subtotal = 0; let taxes = 0; let code = '';
      for (const line of requested) {
        const variant = await get(db, line.variant, 'variant');
        if (variant.state !== 'active') throw conflict('The variant is archived.');
        const item = await get(db, String(variant.data.item), 'item');
        if (item.state !== 'active') throw conflict('The item is archived.');
        const priceRows = await db.execute({ sql: "SELECT * FROM records WHERE type='price' AND state='active' AND json_extract(data,'$.variant')=? AND json_extract(data,'$.channel') IN ('default',?) AND json_extract(data,'$.starts')<=? AND (json_extract(data,'$.ends') IS NULL OR json_extract(data,'$.ends')>?) AND archived IS NULL ORDER BY json_extract(data,'$.starts') DESC,updated DESC LIMIT 1", args: [variant.id, channel, at, at] });
        if (!priceRows.rows[0]) throw conflict(`No active price exists for ${variant.title}.`);
        const price = decode(priceRows.rows[0]); const current = await stock(db, variant.id, place, at, actor);
        const onhand = Number(current.data.onhand); const reserved = Number(current.data.reserved);
        if (onhand - reserved < line.quantity) throw conflict(`${variant.title} has insufficient available stock.`);
        await setStock(db, current, onhand - line.quantity, reserved, at);
        await insert(db, 'movement', 'Counter sale', 'posted', { variant: variant.id, location: place, quantity: -line.quantity, balance: onhand - line.quantity, channel }, actor, at);
        const amount = Number(price.data.amount); const lineCurrency = String(price.data.currency);
        if (code && code !== lineCurrency) throw conflict('A sale cannot mix currencies.');
        code = lineCurrency;
        const gross = money(amount * line.quantity, 'Sale line'); const tax = money(Math.round(gross * Number(item.data.tax || 0) / 10000), 'Sale tax');
        subtotal = money(subtotal + gross, 'Sale subtotal'); taxes = money(taxes + tax, 'Sale tax'); total = money(total + gross + tax, 'Sale total');
        priced.push({ variant: variant.id, item: item.id, title: variant.title, quantity: line.quantity, price: amount, tax, total: gross + tax, pricing: price.id });
      }
      if (tendered !== null && method === 'cash' && tendered < total) throw badRequest('Tendered cash is less than the total.');
      const customer = text(input.customer, 160) || null; if (customer) await get(db, customer);
      const order = await insert(db, 'order', `Sale ${new Date(at).toISOString()}`, 'fulfilled', { customer, lines: priced, subtotal, tax: taxes, total, currency: code, channel, location: place }, actor, at);
      const invoice = await insert(db, 'invoice', `Invoice ${order.id}`, 'paid', { order: order.id, customer, lines: priced, subtotal, tax: taxes, total, net: total, paid: total, refunded: 0, currency: code, due: null }, actor, at);
      const payment = await insert(db, 'payment', `Payment ${invoice.id}`, 'recorded', { invoice: invoice.id, amount: total, method, provider: method, reference: reference || null, currency: code, sale: order.id }, actor, at);
      const ledger = await posting(db, payment.id, [{ account: method === 'cash' ? 'cash' : 'bank', debit: total }, { account: 'revenue', credit: subtotal }, { account: 'tax', credit: taxes }], actor, at);
      result = { sale: { orderId: order.id, invoiceId: invoice.id, paymentId: payment.id, subtotal, tax: taxes, total, currency: code, change: tendered !== null && method === 'cash' ? tendered - total : 0 }, order, invoice, payment, posting: ledger };
    } else if (action === 'register.open') {
      const opening = integer(Number(input.opening ?? 0), 'Opening float');
      const open = await db.execute({ sql: "SELECT id FROM records WHERE type='register' AND state='open' AND archived IS NULL LIMIT 1" });
      if (open.rows.length) throw conflict('A register is already open. Count and close it first.');
      const register = await insert(db, 'register', `Register ${new Date(at).toISOString()}`, 'open', { opening, opened: at, counted: null, variance: null, currency: 'INR' }, actor, at);
      result = { register };
    } else if (action === 'register.count') {
      const register = await get(db, text(input.register, 160), 'register');
      if (register.state !== 'open') throw conflict('The register is not open.');
      const counted = integer(Number(input.counted), 'Cash counted');
      const expected = await expectedRegisterCash(db, register, at);
      const variance = counted - expected;
      const updated = await db.execute({ sql: 'UPDATE records SET data=?,version=version+1,updated=? WHERE id=? AND version=?', args: [json({ ...register.data, counted, expected, variance }), at, register.id, register.version] });
      if (updated.rowsAffected !== 1) throw conflict('Register changed. Reload and try again.');
      result = { register: { id: register.id, state: 'open', counted, expected, variance, version: register.version + 1 } };
    } else if (action === 'register.close') {
      const register = await get(db, text(input.register, 160), 'register');
      if (register.state !== 'open') throw conflict('The register is not open.');
      const counted = input.counted === undefined || input.counted === '' ? Number(register.data.counted ?? 0) : integer(Number(input.counted), 'Cash counted');
      const expected = await expectedRegisterCash(db, register, at);
      const variance = counted - expected;
      const updated = await db.execute({ sql: 'UPDATE records SET state=?,data=?,version=version+1,updated=? WHERE id=? AND version=?', args: ['closed', json({ ...register.data, counted, expected, variance, closed: at }), at, register.id, register.version] });
      if (updated.rowsAffected !== 1) throw conflict('Register changed. Reload and try again.');
      let ledger = null;
      if (variance !== 0) ledger = await posting(db, `reg_${register.id}`, [{ account: 'cash', debit: Math.max(variance, 0) }, { account: 'overshort', debit: Math.max(-variance, 0) }, { account: 'cash', credit: Math.max(-variance, 0) }, { account: 'overshort', credit: Math.max(variance, 0) }].filter((line) => Number(line.debit || 0) + Number(line.credit || 0) > 0), actor, at);
      result = { register: { id: register.id, state: 'closed', counted, expected, variance, version: register.version + 1 }, ...(ledger ? { posting: ledger } : {}) };
    } else throw badRequest('Unsupported commerce action.');

    await db.execute(eventStatement({ action, actor, key, hash, result }));
    await db.commit();
    return result;
  } catch (cause) {
    await db.rollback().catch(() => undefined);
    throw cause;
  } finally { db.close(); }
}
