import type { Client, Transaction } from '@libsql/client/web';
import { badRequest, conflict, forbidden, notFound } from '../errors.ts';
import type { AccessContext } from '../types.ts';
import { hasWorkRole, isCook } from '../access.ts';
import { eventStatement, findReplay } from '../gateway/commit.ts';

type DB = Pick<Client, 'execute'>;
type Data = Record<string, unknown>;
export interface PosRecord { id: string; type: string; title: string; state: string; data: Data; version: number; createdAt: number }
const object = (value: unknown): Data => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const text = (value: unknown, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const decode = (row: Data): PosRecord => ({ id: String(row.id), type: String(row.type || 'pos.order'), title: String(row.title), state: String(row.state), data: object(JSON.parse(String(row.data))), version: Number(row.version), createdAt: Number(row.created) });
export function integer(value: unknown, label: string, min = 0, max = 100_000_000): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw badRequest(label + ' is invalid.');
  return value;
}
async function get(db: DB, id: string, type: string) {
  const result = await db.execute({ sql: 'SELECT * FROM records WHERE id=? AND type=? AND archived IS NULL', args: [id, type] });
  return result.rows[0] ? decode(result.rows[0]) : null;
}
async function getOrder(db: DB, id: string) {
  const result = await db.execute({ sql: "SELECT * FROM records WHERE id=? AND type IN ('pos.order', 'order') AND archived IS NULL", args: [id] });
  return result.rows[0] ? decode(result.rows[0]) : null;
}
async function list(db: DB, type: string, search = '', offset = 0) {
  const result = await db.execute({ sql: "SELECT * FROM records WHERE type=? AND archived IS NULL AND (title LIKE ? OR id LIKE ? OR json_extract(data,'$.barcode')=? OR json_extract(data,'$.customerId')=? OR json_extract(data,'$.phone') LIKE ?) ORDER BY updated DESC,id LIMIT 100 OFFSET ?", args: [type, '%' + search + '%', '%' + search + '%', search, search, '%' + search + '%', offset] });
  return result.rows.map(decode);
}
async function put(db: DB, type: string, title: string, data: Data, actor: string, id = 'pos_' + crypto.randomUUID(), state = 'active') {
  const at = Date.now();
  await db.execute({ sql: "INSERT INTO records(id,type,title,state,data,owner,version,created,updated) VALUES(?,?,?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,state=excluded.state,data=excluded.data,version=records.version+1,updated=excluded.updated",
    args: [id, type, title, state, JSON.stringify(data), actor, at, at] });
  return (await get(db, id, type))!;
}
async function register(db: DB) {
  const rows = await db.execute("SELECT * FROM records WHERE type='pos.register' AND state='open' AND archived IS NULL LIMIT 1");
  return rows.rows[0] ? decode(rows.rows[0]) : null;
}
async function balance(db: DB, session: PosRecord) {
  const result = await db.execute({ sql: "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) AS amount FROM records WHERE type='pos.payment' AND json_extract(data,'$.method')='cash' AND json_extract(data,'$.registerId')=?", args: [session.id] });
  return Number(session.data.opening) + Number(result.rows[0].amount);
}
export async function posSummary(db: DB) {
  const settings = await get(db, 'pos.settings', 'pos.settings');
  const timezone = String(settings?.data.timezone || 'Asia/Kolkata');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const result = await db.execute({ sql: "SELECT COALESCE(SUM(json_extract(data,'$.amount')),0) AS sales FROM records WHERE type IN ('pos.payment','payment') AND json_extract(data,'$.businessDate')=?", args: [today] });
  const orders = await db.execute({ sql: "SELECT COUNT(*) AS count FROM records WHERE type IN ('pos.order','order') AND json_extract(data,'$.businessDate')=?", args: [today] });
  const stock = await db.execute("SELECT COUNT(*) AS count FROM records WHERE type='pos.product' AND archived IS NULL AND json_extract(data,'$.stock')<=json_extract(data,'$.lowStock')");
  return { sales: Number(result.rows[0].sales), orders: Number(orders.rows[0].count), lowStock: Number(stock.rows[0].count), currency: String(settings?.data.currency || 'INR'), businessDate: today };
}
export async function readPos(db: DB, context: AccessContext, section: string, search = '', offset = 0) {
  if (isCook(context.member) || !(context.member.role === 'owner' || context.member.role === 'admin'
    || (context.member.role === 'member' && (hasWorkRole(context.member, 'cashier') || hasWorkRole(context.member, 'manager'))))) throw forbidden();
  if (section === 'products' || section === 'orders' || section === 'customers') {
    const types = { products: 'pos.product', orders: 'pos.order', customers: 'pos.customer' };
    return { items: await list(db, types[section], search.slice(0, 100), offset), nextOffset: offset + 100 };
  }
  let settings = await get(db, 'pos.settings', 'pos.settings');
  if (!settings) {
    const storeName = context.workspace.name || 'Store';
    settings = await put(db, 'pos.settings', storeName, { currency: 'INR', timezone: 'Asia/Kolkata', location: '', receiptFooter: 'Thank you for shopping with us.' }, context.identity.id, 'pos.settings');
  }
  const session = await register(db);
  return { settings, register: session ? { ...session, expected: await balance(db, session) } : null,
    summary: await posSummary(db), canManage: context.member.role === 'owner' || context.member.role === 'admin', paymentMethods: ['cash', 'upi', 'card'] };
}

export async function readPosInbox(db: DB) {
  const result = await db.execute({ sql: "SELECT * FROM records WHERE ((type='pos.order' AND json_extract(data,'$.submitted')=1) OR (type='order' AND (json_extract(data,'$.submitted') IS NULL OR json_extract(data,'$.submitted')=1))) AND state IN ('open','paid') AND archived IS NULL ORDER BY updated DESC,id" });
  return { orders: result.rows.map(decode).filter((order) => order.state === 'open' || order.data.approval === 'pending'
    || ((order.data.approval === 'accepted' || order.type === 'order') && !order.data.handedOffAt)
    || (order.data.orderType === 'delivery' && order.data.delivery !== 'delivered')
    || (['dine-in', 'takeaway', 'counter'].includes(String(order.data.orderType || (order.type === 'order' ? 'counter' : ''))) && Array.isArray(order.data.lines)
      && order.data.lines.some((line) => object(line).status !== 'ready'))
    || (Boolean(order.data.customerEmail) && !order.data.rating)) };
}

async function movement(db: DB, product: PosRecord, delta: number, reason: string, actor: string, reference?: string) {
  const stock = integer(Number(product.data.stock) + delta, 'Stock');
  await put(db, 'pos.product', product.title, { ...product.data, stock }, actor, product.id);
  await put(db, 'pos.movement', reason, { productId: product.id, delta, balance: stock, reference: reference || null }, actor);
}
async function posting(db: DB, reference: string, lines: Data[], actor: string) {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || debit !== credit) throw badRequest('Unbalanced POS posting.');
  return put(db, 'posting', `Posting ${reference}`, { reference, lines, debit, credit }, actor, undefined, 'posted');
}
export async function executePos(client: Client, context: AccessContext, actionId: string, input: Data, key: string, hash: string): Promise<Data> {
  const tx = await client.transaction('write');
  try {
    // Recheck under the write lock: concurrent retries must never sell twice.
    const replay = await findReplay(tx, key, hash);
    if (replay) { await tx.commit(); return replay.result as Data; }
    const result = await mutate(tx, context, actionId, input);
    await tx.execute(eventStatement({ action: actionId, actor: context.identity.id, key, hash, result }));
    await tx.commit();
    return result;
  } catch (error) { await tx.rollback().catch(() => undefined); throw error; }
  finally { tx.close(); }
}

async function mutate(db: Transaction, context: AccessContext, action: string, input: Data): Promise<Data> {
  const actor = context.identity.id;
  if (action === 'pos.open') return { opened: true };
  if (action === 'pos.setup') {
    const name = text(input.name);
    const currency = text(input.currency);
    const timezone = text(input.timezone);
    if (!name || !['INR', 'USD', 'EUR', 'GBP'].includes(currency)) throw badRequest('Store name and supported currency are required.');
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { throw badRequest('Choose a valid timezone.'); }
    const current = await get(db, 'pos.settings', 'pos.settings');
    if (current && current.data.currency !== currency) {
      const products = await db.execute("SELECT id FROM records WHERE type IN ('pos.product','pos.order') LIMIT 1");
      if (products.rows.length) throw conflict('Currency cannot change after products or sales exist.');
    }
    return { settings: await put(db, 'pos.settings', name, { currency, timezone, location: text(input.location), receiptFooter: text(input.receiptFooter) }, actor, 'pos.settings') };
  }
  let settings = await get(db, 'pos.settings', 'pos.settings');
  if (!settings) {
    const storeName = context.workspace.name || 'Store';
    settings = await put(db, 'pos.settings', storeName, { currency: 'INR', timezone: 'Asia/Kolkata', location: '', receiptFooter: 'Thank you for shopping with us.' }, actor, 'pos.settings');
  }
  if (action === 'pos.product.save') {
    const title = text(input.title);
    if (!title) throw badRequest('Product name is required.');
    const id = text(input.id);
    const current = id ? await get(db, id, 'pos.product') : null;
    if (id && !current) throw notFound('Product not found.');
    if (current && input.version !== current.version) throw conflict('Product changed. Reload before saving.');
    const barcode = text(input.barcode);
    const sku = text(input.sku);
    if (barcode || sku) {
      const duplicates = await db.execute({ sql: "SELECT id,json_extract(data,'$.barcode') AS barcode,json_extract(data,'$.sku') AS sku FROM records WHERE type='pos.product' AND ((?!='' AND json_extract(data,'$.barcode')=?) OR (?!='' AND json_extract(data,'$.sku')=?)) AND id!=? AND archived IS NULL", args: [barcode, barcode, sku, sku, id] });
      if (duplicates.rows.length) throw conflict(barcode && duplicates.rows[0].barcode === barcode ? 'Barcode already belongs to another product.' : 'SKU already belongs to another product.');
    }
    const stock = current ? Number(current.data.stock) : integer(input.stock, 'Opening stock');
    const imageUrl = text(input.imageUrl);
    if (imageUrl && !imageUrl.startsWith('https://')) throw badRequest('Product image must use an HTTPS URL.');
    const data = { ...current?.data, price: integer(input.price, 'Price'), cost: integer(input.cost ?? 0, 'Cost price'), taxBps: integer(input.taxBps, 'Tax rate', 0, 10000), stock,
      lowStock: integer(input.lowStock ?? 5, 'Low stock threshold'), sku, barcode, category: text(input.category), brand: text(input.brand),
      variant: text(input.variant), unit: text(input.unit), supplier: text(input.supplier), shortDescription: text(input.shortDescription, 500), imageUrl };
    const product = await put(db, 'pos.product', title, data, actor, id || undefined);
    if (!current && stock) await put(db, 'pos.movement', 'Opening stock', { productId: product.id, delta: stock, balance: stock }, actor);
    return { product };
  }
  if (action === 'pos.stock.adjust') {
    const product = await get(db, text(input.productId), 'pos.product');
    if (!product) throw notFound('Product not found.');
    if (input.version !== product.version) throw conflict('Stock changed. Reload before adjusting.');
    const delta = integer(input.delta, 'Stock change', -100000, 100000);
    if (!delta || !text(input.reason)) throw badRequest('Enter a stock change and reason.');
    await movement(db, product, delta, text(input.reason), actor);
    return { product: await get(db, product.id, 'pos.product') };
  }
  if (action === 'pos.customer.save') {
    if (!text(input.title)) throw badRequest('Customer name is required.');
    const email = text(input.email, 254).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Customer email is invalid.');
    const id = text(input.id);
    const current = id ? await get(db, id, 'pos.customer') : null;
    if (id && !current) throw notFound('Customer not found.');
    if (current && current.version !== input.version) throw conflict('Customer changed. Reload before saving.');
    return { customer: await put(db, 'pos.customer', text(input.title), { email, phone: text(input.phone) }, actor, id || undefined) };
  }
  if (action === 'pos.register.open') {
    if (await register(db)) throw conflict('A register is already open.');
    return { register: await put(db, 'pos.register', settings.title, { opening: integer(input.opening, 'Opening cash'), openedBy: actor, currency: settings.data.currency }, actor, undefined, 'open') };
  }
  if (action === 'pos.order.save') {
    const orderId = text(input.orderId);
    const clientDraftKey = text(input.draftKey);
    let current = orderId ? await getOrder(db, orderId) : null;
    if (!current && clientDraftKey) {
      const existing = await db.execute({ sql: "SELECT * FROM records WHERE type IN ('pos.order', 'order') AND owner=? AND json_extract(data,'$.draftKey')=? AND archived IS NULL LIMIT 1", args: [actor, clientDraftKey] });
      current = existing.rows[0] ? decode(existing.rows[0]) : null;
    }
    if (orderId && (!current || current.state !== 'open')) throw conflict('This order is no longer open.');
    if (current && current.state !== 'open') throw conflict('This order is no longer open.');
    if (current && orderId && current.version !== input.version) throw conflict('Order changed. Reload Now.');
    const cart = Array.isArray(input.items) ? input.items.map(object) : [];
    if (!cart.length || cart.length > 100) throw badRequest('Add between 1 and 100 products.');
    if (new Set(cart.map((line) => line.productId)).size !== cart.length) throw badRequest('Combine duplicate products into one line.');
    const discountBps = integer(input.discountBps ?? 0, 'Discount', 0, 10000);
    const lines: Data[] = [];
    let subtotal = 0, discount = 0, tax = 0;
    for (const line of cart) {
      const product = await get(db, text(line.productId), 'pos.product');
      if (!product) throw notFound('Product no longer available.');
      if (line.version !== product.version) throw conflict(product.title + ' changed. Reload the cart.');
      const quantity = integer(line.quantity, 'Quantity', 1, 10000);
      if (quantity > Number(product.data.stock)) throw conflict('Not enough stock for ' + product.title + '.');
      const gross = integer(Number(product.data.price) * quantity, 'Line total');
      const lineDiscount = Math.round(gross * discountBps / 10000);
      const lineTax = Math.round((gross - lineDiscount) * (Number(product.data.taxBps) || 0) / 10000);
      subtotal += gross; discount += lineDiscount; tax += lineTax;
      const prior = Array.isArray(current?.data.lines) ? current.data.lines.map(object).find((item) => String(item.productId || item.variant) === product.id) : null;
      lines.push({ productId: product.id, title: product.title, quantity, price: product.data.price, discount: lineDiscount, tax: lineTax, total: gross - lineDiscount + lineTax, status: text(prior?.status, 40) || 'pending' });
    }
    const customerId = text(input.customerId) || text(current?.data.customerId);
    const customer = customerId ? await get(db, customerId, 'pos.customer') : null;
    if (customerId && !customer) throw notFound('Customer not found.');
    if (current?.data.submitted === true && current.data.customerId !== (customerId || null)) throw conflict('Customer cannot change after an order is submitted.');
    const customerEmail = current?.data.submitted === true ? text(current.data.customerEmail, 254).toLowerCase() || null
      : text(customer?.data.email, 254).toLowerCase() || null;
    const requestedType = text(input.orderType) || text(current?.data.orderType);
    const orderType = ['counter', 'dine-in', 'takeaway', 'delivery'].includes(requestedType) ? requestedType : 'counter';
    const table = text(input.table, 80) || current?.data.table || null;
    const destination = orderType === 'delivery' ? text(input.destination, 500) || text(current?.data.destination, 500) : '';
    const submitted = current?.data.submitted === true || input.submitted !== false;
    if (submitted && orderType === 'delivery' && !destination) throw badRequest('A delivery destination is required.');
    const previousLines = Array.isArray(current?.data.lines) ? current.data.lines.map(object) : [];
    const changed = Boolean(current) && (previousLines.length !== lines.length || previousLines.some((line, index) =>
      (line.productId || line.variant) !== (lines[index].productId || lines[index].variant) || line.quantity !== lines[index].quantity || line.price !== lines[index].price || line.total !== lines[index].total)
      || current?.data.customerId !== (customerId || null) || current?.data.orderType !== orderType || current?.data.table !== table
      || current?.data.destination !== destination || current?.data.discountBps !== discountBps);
    if (changed && current && (current.data.delivery === 'reached' || current.data.delivery === 'collected' || current.data.delivery === 'delivered'
      || previousLines.some((line) => line.status === 'preparing' || line.status === 'ready'))) {
      throw conflict('This order is already in progress. Create a new order for changes.');
    }
    const approval = !submitted ? 'draft' : orderType === 'counter' || orderType === 'takeaway' ? 'accepted'
      : !changed && current?.data.approval === 'accepted' ? 'accepted' : 'pending';
    if (changed) for (const line of lines) line.status = 'pending';
    const delivery = orderType === 'delivery' ? !changed && typeof current?.data.delivery === 'string' ? current.data.delivery : 'unassigned' : null;
    const total = integer(subtotal - discount + tax, 'Sale total');
    const order = await put(db, current?.type || 'pos.order', 'Open order', { ...current?.data, draftKey: clientDraftKey || current?.data.draftKey || null, lines, subtotal, discount, discountBps, tax, total, currency: settings.data.currency,
      paymentStatus: 'unpaid', customerId: customerId || null, customerName: customer?.title || null, customerEmail, table, destination, orderType, submitted, approval, delivery,
      courier: changed ? null : current?.data.courier || null,
      storeName: settings.title, location: settings.data.location }, actor, current?.id, 'open');
    return { order };
  }
  if (action === 'pos.order.item.update') {
    const order = await getOrder(db, text(input.orderId));
    if (!order || !['open', 'paid'].includes(order.state)) throw notFound('Active order not found.');
    if (order.version !== input.version) throw conflict('Order changed. Reload Now.');
    const approval = String(order.data.approval || (order.type === 'order' ? 'accepted' : ''));
    if (order.type === 'pos.order' && (order.data.submitted !== true || approval !== 'accepted')) throw conflict('The order must be accepted before preparation.');
    const productId = text(input.productId);
    const next = text(input.status, 40);
    const transitions: Record<string, readonly string[]> = { pending: ['preparing'], preparing: ['ready'], ready: [] };
    const lines = Array.isArray(order.data.lines) ? order.data.lines.map(object) : [];
    const line = lines.find((item) => String(item.productId || item.variant) === productId);
    if (!line) throw notFound('Order item not found.');
    const current = text(line.status, 40) || 'pending';
    if (!transitions[current]?.includes(next)) throw conflict('That item cannot move to this status.');
    line.status = next;
    return { order: await put(db, order.type, order.title, { ...order.data, lines }, actor, order.id, order.state) };
  }
  if (action === 'pos.order.handoff') {
    const order = await getOrder(db, text(input.orderId));
    if (!order || !['open', 'paid'].includes(order.state)) throw notFound('Active order not found.');
    const approval = String(order.data.approval || (order.type === 'order' ? 'accepted' : ''));
    if (order.type === 'pos.order' && (order.data.submitted !== true || approval !== 'accepted')) throw notFound('Active order not found.');
    if (order.version !== input.version) throw conflict('Order changed. Reload Now.');
    if (order.data.handedOffAt) throw conflict('This order was already handed off.');
    if (order.data.orderType === 'delivery') throw conflict('Courier collection records delivery handoff.');
    const ready = Array.isArray(order.data.lines) && order.data.lines.length > 0 && order.data.lines.every((line) => object(line).status === 'ready');
    if (!ready) throw conflict('Every order line must be ready before handoff.');
    return { order: await put(db, order.type, order.title, { ...order.data, handedOffAt: Date.now(), handedOffBy: actor }, actor, order.id, order.state) };
  }
  if (action === 'pos.order.cancel') {
    const order = await getOrder(db, text(input.orderId));
    if (!order || order.state !== 'open') throw notFound('Open order not found.');
    if (order.version !== input.version) throw conflict('Order changed. Reload Now.');
    if (order.data.courier) throw conflict('A courier has claimed this order.');
    return { order: await put(db, order.type, order.title, { ...order.data, cancelledAt: Date.now() }, actor, order.id, 'cancelled') };
  }
  if (action === 'pos.order.accept' || action === 'pos.order.reject') {
    const order = await getOrder(db, text(input.orderId));
    if (!order || !['open', 'paid'].includes(order.state) || (order.type === 'pos.order' && order.data.submitted !== true)) throw notFound('Pending order not found.');
    if (order.version !== input.version) throw conflict('Order changed. Reload Now.');
    if (order.data.approval !== 'pending') throw conflict('This order has already been reviewed.');
    if (action === 'pos.order.reject') {
      if (order.state !== 'open') throw conflict('A paid order needs a reviewed refund.');
      const reason = text(input.reason, 500);
      if (!reason) throw badRequest('A rejection reason is required.');
      return { order: await put(db, order.type, order.title, { ...order.data, approval: 'rejected', reason, reviewer: actor, reviewed: Date.now() }, actor, order.id, 'cancelled') };
    }
    return { order: await put(db, order.type, order.title, { ...order.data, approval: 'accepted', reviewer: actor, reviewed: Date.now() }, actor, order.id, order.state) };
  }
  if (action === 'pos.order.reach' || action === 'pos.order.collect' || action === 'pos.order.deliver') {
    if (context.member.role !== 'member' || !hasWorkRole(context.member, 'courier')) throw forbidden();
    const order = await getOrder(db, text(input.orderId));
    if (!order || !['open', 'paid'].includes(order.state)) throw notFound('Available delivery order not found.');
    const approval = String(order.data.approval || (order.type === 'order' ? 'accepted' : ''));
    if (order.type === 'pos.order' && (order.data.submitted !== true || order.data.orderType !== 'delivery' || approval !== 'accepted')) throw notFound('Available delivery order not found.');
    if (order.version !== input.version) throw conflict('Order changed. Reload Now.');
    const stage = action.slice('pos.order.'.length);
    const previous = { reach: 'unassigned', collect: 'reached', deliver: 'collected' }[stage];
    if (order.data.delivery !== previous) throw conflict('This delivery is at a different stage.');
    if (stage === 'reach' ? order.data.courier : order.data.courier !== actor) throw forbidden();
    if (stage === 'collect' && (order.state !== 'paid' || !Array.isArray(order.data.lines)
      || order.data.lines.some((line) => object(line).status !== 'ready'))) {
      throw conflict('Payment and preparation must finish before collection.');
    }
    return { order: await put(db, order.type, order.title, { ...order.data, delivery: stage === 'reach' ? 'reached' : stage === 'collect' ? 'collected' : 'delivered',
      courier: stage === 'reach' ? actor : order.data.courier,
      ...(stage === 'collect' ? { handedOffAt: Date.now(), handedOffBy: actor } : {}), [stage]: Date.now() }, actor, order.id, order.state) };
  }
  if (action === 'pos.order.receive' || action === 'pos.order.rate') {
    if (context.member.role !== 'member' || !hasWorkRole(context.member, 'customer')) throw forbidden();
    const order = await getOrder(db, text(input.orderId));
    if (!order || (order.type === 'pos.order' && order.data.submitted !== true) || order.state !== 'paid') throw notFound('Paid customer order not found.');
    if (order.version !== input.version) throw conflict('Order changed. Reload Now.');
    if (!order.data.customerEmail || String(order.data.customerEmail).trim().toLowerCase() !== context.identity.email.trim().toLowerCase()) throw forbidden();
    const ready = Array.isArray(order.data.lines) && order.data.lines.length > 0 && order.data.lines.every((line) => object(line).status === 'ready');
    if (action === 'pos.order.receive') {
      if (order.data.receivedAt) throw conflict('This order was already received.');
      if (order.data.orderType === 'delivery' ? order.data.delivery !== 'delivered' : !ready || !order.data.handedOffAt) throw conflict('This order is not ready to receive.');
      return { order: await put(db, order.type, order.title, { ...order.data, receivedAt: Date.now(), receivedBy: actor }, actor, order.id, order.state) };
    }
    if (!order.data.receivedAt || order.data.receivedBy !== actor) throw conflict('Confirm receipt before rating this order.');
    if (order.data.rating) throw conflict('This order was already rated.');
    const rating = integer(input.rating, 'Rating', 1, 5);
    const comment = text(input.comment, 500);
    return { order: await put(db, order.type, order.title, { ...order.data, rating, comment, ratedAt: Date.now() }, actor, order.id, order.state) };
  }
  const session = await register(db);
  if (!session) throw badRequest('Open the register first.');
  if (action === 'pos.register.count') {
    if (input.registerId !== session.id) throw conflict('Register changed. Reload before counting.');
    const counted = integer(input.counted, 'Counted cash');
    return { register: await put(db, 'pos.register', session.title, { ...session.data, counted }, actor, session.id, session.state) };
  }
  if (action === 'pos.register.close') {
    if (input.registerId !== session.id) throw conflict('Register changed. Reload before closing.');
    const expected = await balance(db, session);
    const counted = integer(input.counted ?? session.data.counted, 'Counted cash');
    return { register: await put(db, 'pos.register', session.title, { ...session.data, expected, counted, difference: counted - expected, closedBy: actor, closedAt: Date.now() }, actor, session.id, 'closed') };
  }
  const businessDate = new Intl.DateTimeFormat('en-CA', { timeZone: String(settings.data.timezone), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (action === 'pos.checkout') {
    if (input.method !== 'cash' && input.method !== 'upi' && input.method !== 'card') throw badRequest('Choose Cash, UPI or Card.');
    const reference = text(input.reference);
    if (input.method === 'upi' || input.method === 'card') {
      if (!reference || input.received !== true) throw badRequest(`Confirm ${input.method.toUpperCase()} receipt and enter its transaction reference.`);
      const duplicate = await db.execute({ sql: "SELECT id FROM records WHERE type='pos.payment' AND json_extract(data,'$.reference')=?", args: [reference] });
      if (duplicate.rows.length) throw conflict(`This ${input.method.toUpperCase()} reference is already recorded.`);
    }
    const draftId = text(input.orderId);
    const draft = draftId ? await getOrder(db, draftId) : null;
    if (draftId && (!draft || draft.state !== 'open')) throw conflict('This order is no longer awaiting payment.');
    const cart = Array.isArray(input.items) ? input.items.map(object) : [];
    if (!cart.length || cart.length > 100) throw badRequest('Add between 1 and 100 products.');
    if (new Set(cart.map((line) => line.productId)).size !== cart.length) throw badRequest('Combine duplicate products into one line.');
    const discountBps = integer(input.discountBps ?? 0, 'Discount', 0, 10000);
    if (draft) {
      const savedLines = Array.isArray(draft.data.lines) ? draft.data.lines.map(object) : [];
      const sameCart = savedLines.length === cart.length && savedLines.every((line) => cart.some((item) => String(item.productId) === String(line.productId) && Number(item.quantity) === Number(line.quantity)));
      if (!sameCart || discountBps !== Number(draft.data.discountBps || 0)) throw conflict('Order changed. Return to Now and save the updated cart.');
    }
    const lines: Data[] = [];
    let subtotal = 0, discount = 0, tax = 0;
    for (const line of cart) {
      const product = await get(db, text(line.productId), 'pos.product');
      if (!product) throw notFound('Product no longer available.');
      if (line.version !== product.version) throw conflict(product.title + ' changed. Reload the cart.');
      const quantity = integer(line.quantity, 'Quantity', 1, 10000);
      if (quantity > Number(product.data.stock)) throw conflict('Not enough stock for ' + product.title + '.');
      const gross = integer(Number(product.data.price) * quantity, 'Line total');
      const lineDiscount = Math.round(gross * discountBps / 10000);
      const lineTax = Math.round((gross - lineDiscount) * (Number(product.data.taxBps) || 0) / 10000);
      subtotal += gross; discount += lineDiscount; tax += lineTax;
      const saved = Array.isArray(draft?.data.lines) ? draft.data.lines.map(object).find((item) => item.productId === product.id) : undefined;
      lines.push({ productId: product.id, title: product.title, quantity, price: product.data.price, discount: lineDiscount, tax: lineTax, total: gross - lineDiscount + lineTax, status: text(saved?.status, 40) || 'pending' });
    }
    const total = integer(subtotal - discount + tax, 'Sale total');
    if (input.expectedTotal !== total) throw conflict('Total changed. Review the cart.');
    const tendered = input.method === 'upi' ? total : integer(input.tendered, 'Cash received');
    if (tendered < total) throw badRequest('Cash received is below the total.');
    const customerId = draft ? text(draft.data.customerId) : text(input.customerId);
    const customer = customerId ? await get(db, customerId, 'pos.customer') : null;
    if (customerId && !customer) throw notFound('Customer not found.');
    const order = await put(db, draft?.type || 'pos.order', 'Sale', { ...draft?.data, lines, subtotal, discount, tax, total, currency: settings.data.currency, businessDate,
      method: input.method, reference, verification: input.method === 'upi' ? 'cashier_confirmed' : 'cash', tendered, change: tendered - total, customerId: customerId || null, customerName: customer?.title || null,
      paymentStatus: 'paid', registerId: session.id, storeName: settings.title, location: settings.data.location, receiptFooter: settings.data.receiptFooter }, actor, draft?.id, 'paid');
    for (const line of lines) await movement(db, (await get(db, String(line.productId), 'pos.product'))!, -Number(line.quantity), 'Sale', actor, order.id);
    await put(db, 'pos.payment', 'Sale payment', { orderId: order.id, amount: total, method: input.method, reference: reference || null, registerId: session.id, businessDate }, actor);
    const ledger = await posting(db, order.id, [{ account: input.method === 'cash' ? 'cash' : 'bank', debit: total },
      { account: 'revenue', credit: subtotal - discount }, { account: 'tax', credit: tax }], actor);
    return { order, posting: ledger };
  }
  if (action === 'pos.refund') {
    const order = await getOrder(db, text(input.orderId));
    if (!order) throw notFound('Sale not found.');
    if (order.state !== 'paid' && order.state !== 'partially_refunded') throw conflict('Sale has already been returned.');
    if (!text(input.reason)) throw badRequest('Return reason is required.');
    if (input.returned !== true) throw badRequest('Confirm the payment was returned to the customer.');
    if (order.data.method === 'upi') {
      if (!text(input.reference)) throw badRequest('Enter the UPI refund reference.');
      const duplicate = await db.execute({ sql: "SELECT id FROM records WHERE type='pos.payment' AND json_extract(data,'$.reference')=?", args: [text(input.reference)] });
      if (duplicate.rows.length) throw conflict('This UPI reference is already recorded.');
    }
    const lines = order.data.lines as Data[];
    const returned = object(order.data.returnedQuantities);
    const quantities = input.quantities === undefined ? Object.fromEntries(lines.map((line) => [String(line.productId), Number(line.quantity) - Number(returned[String(line.productId)] || 0)])) : object(input.quantities);
    if (Object.keys(quantities).some((id) => !lines.some((line) => line.productId === id))) throw badRequest('Unknown return item.');
    let refundTotal = 0;
    let refundTax = 0;
    const changes: { line: Data; quantity: number }[] = [];
    for (const line of lines) {
      const id = String(line.productId);
      const before = Number(returned[id] || 0);
      const quantity = integer(quantities[id] ?? 0, 'Return quantity', 0, Number(line.quantity) - before);
      refundTotal += Math.round(Number(line.total) * (before + quantity) / Number(line.quantity)) - Math.round(Number(line.total) * before / Number(line.quantity));
      refundTax += Math.round(Number(line.tax || 0) * (before + quantity) / Number(line.quantity)) - Math.round(Number(line.tax || 0) * before / Number(line.quantity));
      returned[id] = before + quantity;
      if (quantity) changes.push({ line, quantity });
    }
    if (!changes.length) throw badRequest('Choose at least one item to return.');
    if (input.restock === true) {
      for (const { line, quantity } of changes) {
        const product = await get(db, String(line.productId), 'pos.product');
        if (!product) throw conflict('A product is unavailable for restocking.');
        await movement(db, product, quantity, 'Return', actor, order.id);
      }
    }
    const fullyReturned = lines.every((line) => returned[String(line.productId)] === line.quantity);
    const updated = await put(db, order.type, order.title, { ...order.data, returnedQuantities: returned, refundedTotal: Number(order.data.refundedTotal || 0) + refundTotal, refundReason: text(input.reason), refundedAt: Date.now(), restocked: input.restock === true }, actor, order.id, fullyReturned ? 'refunded' : 'partially_refunded');
    await put(db, 'pos.payment', 'Refund', { orderId: order.id, amount: -refundTotal, method: order.data.method, reference: text(input.reference) || null, quantities, registerId: session.id, businessDate }, actor);
    const ledger = await posting(db, updated.id, [{ account: 'returns', debit: refundTotal - refundTax }, { account: 'tax', debit: refundTax },
      { account: order.data.method === 'cash' ? 'cash' : 'bank', credit: refundTotal }], actor);
    return { order: updated, posting: ledger };
  }
  throw badRequest('Unsupported POS action.');
}
