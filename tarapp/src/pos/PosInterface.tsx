import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { ActionInterfaceProps } from '@/action-interfaces/types';
import { createOperationKey, harness, HarnessRequestError } from '@/lib/harness';
import { posJournal, type PendingPosAction } from './journal';
import PosForm, { type PosFormSpec } from './PosForm';
import { clearPosProductSession, getPosSession, savePosSession } from './session';
import { cartTotals, minorUnits, money, type CartLine, type PosOverview, type PosRecord, type SaleLine } from './types';

type Section = 'sell' | 'orders' | 'stock' | 'customers';
const sections: { key: Section; label: string }[] = [
  { key: 'sell', label: 'Sell' }, { key: 'orders', label: 'Orders & returns' },
  { key: 'stock', label: 'Stock' }, { key: 'customers', label: 'Customers' },
];

export default function PosInterface(props: ActionInterfaceProps) {
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= 760;
  const initialOrderId = typeof props.initialInput?.orderId === 'string' ? props.initialInput.orderId : '';
  const savedSession = getPosSession(props.scope);
  const hasSavedProducts = savedSession?.products !== undefined;
  const [section, setSection] = useState<Section>('sell');
  const [history, setHistory] = useState<{ section: Section; search: string; cartOpen: boolean }[]>([]);
  const [overview, setOverview] = useState<PosOverview | null>(() => savedSession?.overview || null);
  const [items, setItems] = useState<PosRecord[]>(() => hasSavedProducts ? savedSession?.products || [] : []);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(!hasSavedProducts);
  const [sellProductsLoaded, setSellProductsLoaded] = useState(hasSavedProducts);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<PosFormSpec | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [discount, setDiscount] = useState('0');
  const [customer, setCustomer] = useState<PosRecord | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [showCustomerInput, setShowCustomerInput] = useState(false);
  const [editingQty, setEditingQty] = useState<{ id: string; title: string; current: number; max: number } | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [order, setOrder] = useState<PosRecord | null>(null);
  const [draftOrderId, setDraftOrderId] = useState(initialOrderId);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftLoading, setDraftLoading] = useState(Boolean(initialOrderId));
  const [hasMore, setHasMore] = useState(false);
  const [pending, setPending] = useState<PendingPosAction | null>(null);
  const [journalReady, setJournalReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const journal = useRef<Awaited<ReturnType<typeof posJournal>> | null>(null);
  const draftRef = useRef<{ id: string; version: number } | null>(null);
  const draftSignature = useRef('');
  const draftKey = useRef(initialOrderId || createOperationKey('pos.draft'));
  const currency = overview?.summary.currency || 'INR';
  const discountBps = Math.round(Number(discount || 0) * 100);
  const totals = cartTotals(cart, Number.isFinite(discountBps) ? discountBps : 0);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const bottomSafePadding = insets.bottom > 0 ? insets.bottom + 12 : 20;

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of items) {
      const cat = String(item.data.category || '').trim();
      if (cat) cats.add(cat);
    }
    return ['All', ...Array.from(cats)];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'All') return items;
    return items.filter((item) => String(item.data.category || '').trim() === selectedCategory);
  }, [items, selectedCategory]);

  const reloadOverview = useCallback(async () => {
    const next = await harness.pos<PosOverview>(props.scope, 'overview');
    setOverview(next); return next;
  }, [props.scope]);
  useEffect(() => {
    let alive = true;
    void posJournal(props.scope).then((value) => {
      if (alive) { journal.current = value; setPending(value.read()); setJournalReady(true); }
    }).catch((cause: Error) => { if (alive) setError(cause.message); });
    void harness.pos<PosOverview>(props.scope, 'overview').then((value) => { if (alive) setOverview(value); }).catch((cause: Error) => { if (alive) setError(cause.message); });
    return () => { alive = false; };
  }, [props.scope]);
  useEffect(() => {
    if (!initialOrderId) return;
    let alive = true;
    void (async () => {
      const response = await harness.pos<{ items: PosRecord[] }>(props.scope, 'orders', initialOrderId);
      const draft = response.items.find((item) => item.id === initialOrderId);
      if (!draft || draft.state !== 'open') throw new Error('This order is no longer awaiting payment.');
      const lines = Array.isArray(draft.data.lines) ? draft.data.lines as SaleLine[] : [];
      const products = await Promise.all(lines.map((line) => harness.pos<{ items: PosRecord[] }>(props.scope, 'products', line.productId)));
      const cartLines = lines.map((line, index) => {
        const product = products[index].items.find((item) => item.id === line.productId);
        if (!product) throw new Error(line.title + ' is no longer available.');
        return { product, quantity: line.quantity };
      });
      if (alive) { draftRef.current = { id: draft.id, version: draft.version }; setCart(cartLines); setDiscount(String(Number(draft.data.discountBps || 0) / 100)); setDraftOrderId(draft.id); setCartOpen(true); }
    })().catch((cause: Error) => { if (alive) setError(cause.message); }).finally(() => { if (alive) setDraftLoading(false); });
    return () => { alive = false; };
  }, [initialOrderId, props.scope]);
  useEffect(() => {
    const current = getPosSession(props.scope);
    savePosSession(props.scope, {
      overview: overview || undefined,
      products: section === 'sell' && !search && sellProductsLoaded ? items : current?.products,
      cart,
      discount,
      customer,
    });
  }, [cart, customer, discount, items, overview, props.scope, search, section, sellProductsLoaded]);
  useEffect(() => {
    let alive = true;
    const current = ++requestId.current;
    const timer = setTimeout(() => {
      const cachedProducts = section === 'sell' && !search ? getPosSession(props.scope)?.products : undefined;
      if (cachedProducts === undefined) setLoading(true);
      setError('');
      const resource = section === 'sell' || section === 'stock' ? 'products' : section;
      void harness.pos<{ items: PosRecord[] }>(props.scope, resource, search).then((result) => {
        if (alive && current === requestId.current) {
          setItems(result.items); setHasMore(result.items.length === 100);
          if (section === 'sell' && !search) {
            setSellProductsLoaded(true);
            const existing = getPosSession(props.scope);
            if (existing) savePosSession(props.scope, { ...existing, products: result.items });
          }
        }
      }).catch((cause: Error) => { if (alive && current === requestId.current) setError(cause.message); }).finally(() => { if (alive && current === requestId.current) setLoading(false); });
    }, 180);
    return () => { alive = false; clearTimeout(timer); };
  }, [section, search, props.scope, revision]);
  useEffect(() => {
    if (!cart.length) {
      const draft = draftRef.current;
      if (draft && !draftSaving) {
        draftRef.current = null; draftSignature.current = ''; setDraftOrderId('');
        void harness.executeAction(props.scope, 'pos.order.cancel', { orderId: draft.id, version: draft.version }, createOperationKey('pos.order.cancel')).catch((cause: Error) => console.warn('Draft cancel notice:', cause.message));
      }
      return;
    }
    if (!overview?.settings || draftLoading || form || draftSaving) return;
    const signature = JSON.stringify({ items: cart.map((line) => [line.product.id, line.product.version, line.quantity]), discountBps, customerId: customer?.id || '' });
    if (signature === draftSignature.current) return;
    const timer = setTimeout(() => {
      setDraftSaving(true);
      void harness.executeAction<{ order: PosRecord }>(props.scope, 'pos.order.save', {
        items: cart.map((line) => ({ productId: line.product.id, version: line.product.version, quantity: line.quantity })), discountBps, customerId: customer?.id || '', orderId: draftRef.current?.id, version: draftRef.current?.version, draftKey: draftKey.current,
        submitted: false,
      }, createOperationKey('pos.order.save')).then((result) => {
        draftRef.current = { id: result.order.id, version: result.order.version };
        draftSignature.current = signature;
        setDraftOrderId(result.order.id);
        setError('');
      }).catch((cause: Error) => {
        console.warn('Draft auto-save notice:', cause.message);
      }).finally(() => setDraftSaving(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [cart, customer?.id, discountBps, draftLoading, draftSaving, form, overview?.settings, props.scope]);
  const refresh = async () => { await reloadOverview(); setRevision((value) => value + 1); };
  const more = async () => {
    if (loading || !hasMore) return;
    const current = requestId.current;
    setLoading(true);
    try {
      const result = await harness.pos<{ items: PosRecord[] }>(props.scope, section === 'sell' || section === 'stock' ? 'products' : section, search, items.length);
      if (current === requestId.current) { setItems((previous) => [...previous, ...result.items]); setHasMore(result.items.length === 100); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load more.'); }
    finally { setLoading(false); }
  };
  // Persist before sending, so a lost response or app restart cannot create a duplicate payment.
  const execute = async (action: string, input: Record<string, unknown>) => {
    if (!journalReady || !journal.current) throw new Error('Payment recovery is not ready. Reopen POS.');
    const previous = journal.current.read();
    if (previous && JSON.stringify({ action, input }) !== JSON.stringify({ action: previous.action, input: previous.input })) throw new Error('Resolve the pending operation before starting another.');
    const operation = previous || { action, input, key: createOperationKey(action) };
    journal.current.write(operation); setPending(operation);
    try {
      const result = await harness.executeAction(props.scope, action, input, operation.key);
      journal.current.write(null); setPending(null);
      return result;
    } catch (cause) {
      if (cause instanceof HarnessRequestError && (cause.status === 400 || cause.status === 409 || cause.status === 404)) { journal.current.write(null); setPending(null); }
      throw cause;
    }
  };
  const refreshAfterSave = async () => { clearPosProductSession(props.scope); setSellProductsLoaded(false); try { await refresh(); } catch { setError('Saved. Refresh to load the latest records.'); } };
  const saveAction = async (action: string, input: Record<string, unknown>) => { await execute(action, input); await refreshAfterSave(); };
  const recover = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const result = await execute(pending.action, pending.input);
      if (result.order) { setOrder(result.order as PosRecord); setCart([]); setCustomer(null); setDiscount('0'); }
      await refreshAfterSave();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not recover operation.'); }
    finally { setBusy(false); }
  };
  const chooseSection = (next: Section) => {
    setHistory((previous) => [...previous, { section, search, cartOpen }]);
    setSearch(''); setSection(next); setCartOpen(false); setOrder(null);
  };
  const back = () => {
    if (order) { setOrder(null); return; }
    if (cartOpen && !wide) { setCartOpen(false); return; }
    const previous = history.at(-1);
    if (previous) {
      setHistory((value) => value.slice(0, -1));
      setSection(previous.section); setSearch(previous.search); setCartOpen(previous.cartOpen);
      return;
    }
    if (draftOrderId) props.onSuccess({});
    else if (cart.length) Alert.alert('Leave this sale?', 'The current cart will be discarded.', [{ text: 'Keep selling', style: 'cancel' }, { text: 'Leave', onPress: () => props.onSuccess({}) }]);
    else props.onSuccess({});
  };
  const selectCustomer = (selected: PosRecord) => {
    setCustomer(selected);
    const index = history.map((entry) => entry.section).lastIndexOf('sell');
    if (index >= 0) {
      const previous = history[index];
      setHistory((value) => value.slice(0, index));
      setSection('sell'); setSearch(previous.search); setCartOpen(previous.cartOpen); setOrder(null);
    } else chooseSection('sell');
  };
  const add = (product: PosRecord) => {
    const existing = cart.find((line) => line.product.id === product.id);
    if ((existing?.quantity || 0) >= Number(product.data.stock)) {
      Alert.alert('Out of stock', 'Add or receive stock from the Stock flow before selling this product.');
      return;
    }
    setCart((previous) => existing ? previous.map((line) => line.product.id === product.id ? { product, quantity: line.quantity + 1 } : line) : [...previous, { product, quantity: 1 }]);
  };
  const changeQuantity = (id: string, delta: number) => setCart((previous) => previous.map((line) => line.product.id === id ? { ...line, quantity: Math.min(Number(line.product.data.stock), line.quantity + delta) } : line).filter((line) => line.quantity > 0));
  const setExactQuantity = (id: string, next: number) => {
    if (next <= 0) {
      setCart((previous) => previous.filter((line) => line.product.id !== id));
      return;
    }
    setCart((previous) => previous.map((line) => {
      if (line.product.id !== id) return line;
      const max = Number(line.product.data.stock);
      if (next > max) Alert.alert('Stock limit', `Only ${max} in stock.`);
      return { ...line, quantity: Math.min(max, next) };
    }).filter((line) => line.quantity > 0));
  };
  const confirmQtyEdit = () => {
    if (!editingQty) return;
    const parsed = parseInt(qtyInput.trim(), 10);
    if (isNaN(parsed) || parsed <= 0) {
      changeQuantity(editingQty.id, -editingQty.current);
    } else {
      setExactQuantity(editingQty.id, parsed);
    }
    setEditingQty(null);
  };
  const setup = () => setForm({ title: 'Manage POS', submit: 'Save store', fields: [
    { key: 'name', label: 'Store name', value: overview?.settings?.title },
    { key: 'location', label: 'Location', value: String(overview?.settings?.data.location || '') },
    { key: 'currency', label: 'Currency', value: currency },
    { key: 'timezone', label: 'Timezone', value: String(overview?.settings?.data.timezone || 'Asia/Kolkata') },
    { key: 'receiptFooter', label: 'Receipt footer', value: String(overview?.settings?.data.receiptFooter || 'Thank you for shopping with us.') },
  ], save: (values) => saveAction('pos.setup', values) });
  const productForm = (product?: PosRecord) => {
    void (async () => {
      const stored = product?.data.contentKey ? (await harness.posProductContent(props.scope, product.id)).content : {};
      const value = (key: string) => typeof stored[key] === 'string' ? String(stored[key]) : '';
      let savedProduct = product;
      setForm({ title: product ? 'Edit product' : 'Add product', product: true, submit: 'Save product', fields: [
        { key: 'title', label: 'Product name', value: product?.title },
        { key: 'price', label: 'Price', numeric: true, value: String(Number(product?.data.price || 0) / 100) },
        ...(!product ? [{ key: 'stock', label: 'Stock', numeric: true, value: '0' }] : []),
        { key: 'imageUrl', label: 'Image', value: String(product?.data.imageUrl || ''), image: true },
        { key: 'shortDescription', label: 'Summary', value: String(product?.data.shortDescription || ''), advanced: true },
        { key: 'sku', label: 'SKU', value: String(product?.data.sku || ''), advanced: true },
        { key: 'barcode', label: 'Barcode', value: String(product?.data.barcode || ''), advanced: true },
        { key: 'category', label: 'Category', value: String(product?.data.category || ''), advanced: true },
        { key: 'brand', label: 'Brand', value: String(product?.data.brand || ''), advanced: true },
        { key: 'variant', label: 'Variant', value: String(product?.data.variant || ''), advanced: true },
        { key: 'unit', label: 'Unit', value: String(product?.data.unit || ''), advanced: true },
        { key: 'cost', label: 'Cost', numeric: true, value: String(Number(product?.data.cost || 0) / 100), advanced: true },
        { key: 'tax', label: 'Tax', numeric: true, value: String(Number(product?.data.taxBps || 0) / 100), advanced: true },
        { key: 'supplier', label: 'Supplier', value: String(product?.data.supplier || ''), advanced: true },
        { key: 'lowStock', label: 'Reorder', numeric: true, value: String(product?.data.lowStock ?? 5), advanced: true },
        { key: 'sourceUrl', label: 'Source', value: value('sourceUrl'), advanced: true },
        { key: 'longDescription', label: 'Description', value: value('longDescription'), multiline: true, advanced: true },
        { key: 'specifications', label: 'Specs', value: value('specifications'), multiline: true, advanced: true },
        { key: 'sourceNotes', label: 'Notes', value: value('sourceNotes'), multiline: true, advanced: true },
      ], save: async (values) => {
        const result = await execute('pos.product.save', { ...values, id: savedProduct?.id, version: savedProduct?.version, price: minorUnits(values.price), cost: minorUnits(values.cost || '0'), taxBps: minorUnits(values.tax || '0'), stock: Number(values.stock || 0), lowStock: Number(values.lowStock || 0) });
        savedProduct = result.product as PosRecord;
        const hasContent = Boolean(savedProduct.data.contentKey || values.sourceUrl || values.longDescription || values.specifications || values.sourceNotes);
        if (hasContent) await execute('pos.product.content.save', { productId: savedProduct.id, version: savedProduct.version, sourceUrl: values.sourceUrl, longDescription: values.longDescription, specifications: values.specifications, sourceNotes: values.sourceNotes });
        await refreshAfterSave();
      } });
    })().catch((cause: Error) => setError(cause.message));
  };
  const customerForm = (existing?: PosRecord) => setForm({ title: existing ? 'Edit customer' : 'Add customer', submit: 'Save customer', fields: [
    { key: 'title', label: 'Name', value: existing?.title }, { key: 'phone', label: 'Phone', value: String(existing?.data.phone || '') }, { key: 'email', label: 'Email', value: String(existing?.data.email || '') },
  ], save: (values) => saveAction('pos.customer.save', { ...values, id: existing?.id, version: existing?.version }) });
  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of cart) {
      map[line.product.id] = (map[line.product.id] || 0) + line.quantity;
    }
    return map;
  }, [cart]);

  const registerForm = () => {
    const session = overview?.register;
    setForm({ title: session ? 'Close register' : 'Open register', submit: session ? 'Close register' : 'Open register', fields: [
      { key: 'amount', label: session ? 'Cash counted' : 'Opening cash', numeric: true, value: '0', hint: session ? 'Expected cash: ' + money(session.expected, currency) : 'Cash in the drawer before sales.' },
    ], save: (values) => saveAction(session ? 'pos.register.close' : 'pos.register.open', session ? { counted: minorUnits(values.amount), registerId: session.id } : { opening: minorUnits(values.amount) }) });
  };
  const saveForNow = () => {
    if (!cart.length) return;
    if (!Number.isSafeInteger(discountBps) || discountBps < 0 || discountBps > 10000) { Alert.alert('Invalid discount', 'Enter a percentage from 0 to 100.'); return; }
    setForm({ title: 'Order details', submit: 'Save order', fields: [
      { key: 'orderType', label: 'Order type', value: 'counter' },
      { key: 'table', label: 'Table' },
      { key: 'destination', label: 'Delivery address' },
    ], save: async (values) => {
      const result = await execute('pos.order.save', { items: cart.map((line) => ({ productId: line.product.id, version: line.product.version, quantity: line.quantity })), discountBps, customerId: customer?.id, orderId: draftRef.current?.id, version: draftRef.current?.version, draftKey: draftKey.current, orderType: values.orderType, table: values.table, destination: values.destination, submitted: true });
      const saved = result.order as PosRecord;
      draftRef.current = { id: saved.id, version: saved.version }; draftSignature.current = JSON.stringify({ items: cart.map((line) => [line.product.id, line.product.version, line.quantity]), discountBps, customerId: customer?.id || '' }); setDraftOrderId(saved.id);
    } });
  };
  const checkout = (method: 'cash' | 'upi' | 'card') => {
    if (!cart.length) return;
    if (!overview?.register) {
      Alert.alert('Open register', 'Open the register before taking a payment.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Open register', onPress: registerForm }]);
      return;
    }
    if (!Number.isSafeInteger(discountBps) || discountBps < 0 || discountBps > 10000) { Alert.alert('Invalid discount', 'Enter a percentage from 0 to 100.'); return; }
    setForm({
      title: method === 'cash' ? 'Cash payment' : method === 'upi' ? 'UPI payment' : 'Card payment',
      submit: method === 'cash' ? 'Confirm cash received' : method === 'upi' ? 'Confirm UPI received' : 'Confirm card received',
      fields: method === 'cash'
        ? [{ key: 'tendered', label: 'Cash received', numeric: true, value: String(totals.total / 100) }]
        : method === 'upi'
        ? [{ key: 'reference', label: 'UPI reference ID' }]
        : [{ key: 'reference', label: 'Card transaction ID' }],
      save: async (values) => {
        const result = await execute('pos.checkout', {
          items: cart.map((line) => ({ productId: line.product.id, version: line.product.version, quantity: line.quantity })),
          method,
          discountBps,
          expectedTotal: totals.total,
          tendered: method === 'cash' ? minorUnits(values.tendered) : totals.total,
          reference: values.reference || '',
          received: method !== 'cash',
          customerId: customer?.id,
          customerPhone: customerPhone.trim() || undefined,
          orderId: draftOrderId || undefined,
        });
        setOrder(result.order as PosRecord); setCart([]); setCustomer(null); setDiscount('0'); setCartOpen(false); setDraftOrderId(''); draftRef.current = null; draftSignature.current = '';
        await refreshAfterSave();
      },
    });
  };
  const refund = (sale: PosRecord) => setForm({ title: 'Return sale', submit: 'Confirm payment returned', fields: [
    ...(sale.data.lines as SaleLine[]).map((line) => ({ key: line.productId, label: line.title + ' · quantity to return', numeric: true, value: String(line.quantity - Number((sale.data.returnedQuantities as Record<string, number> | undefined)?.[line.productId] || 0)) })),
    { key: 'reason', label: 'Return reason', hint: 'Choose quantities above. Return the corresponding payment to the customer before confirming.' },
    { key: 'restock', label: 'Restock items? yes / no', value: 'yes' },
    ...(sale.data.method === 'upi' ? [{ key: 'reference', label: 'UPI refund reference' }] : []),
  ], summary: (values) => {
    let amount = 0;
    for (const line of sale.data.lines as SaleLine[]) {
      const before = Number((sale.data.returnedQuantities as Record<string, number> | undefined)?.[line.productId] || 0);
      const quantity = Number(values[line.productId]);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity + before > line.quantity) return 'Enter valid return quantities.';
      amount += Math.round(line.total * (before + quantity) / line.quantity) - Math.round(line.total * before / line.quantity);
    }
    return 'Return ' + money(amount, String(sale.data.currency));
  }, save: async (values) => {
    if (!['yes', 'no'].includes(values.restock.toLowerCase())) throw new Error('Enter yes or no for restocking.');
    const quantities = Object.fromEntries((sale.data.lines as SaleLine[]).map((line) => [line.productId, Number(values[line.productId])]));
    const result = await execute('pos.refund', { orderId: sale.id, quantities, reason: values.reason, restock: values.restock.toLowerCase() === 'yes', returned: true, reference: values.reference });
    setOrder(result.order as PosRecord); await refreshAfterSave();
  } });
  const resumeOrder = async (selected: PosRecord) => {
    setBusy(true);
    setError('');
    try {
      const lines = Array.isArray(selected.data.lines) ? selected.data.lines as SaleLine[] : [];
      const products = await Promise.all(lines.map((line) => harness.pos<{ items: PosRecord[] }>(props.scope, 'products', line.productId)));
      const next = lines.map((line, index) => {
        const product = products[index].items.find((item) => item.id === line.productId);
        if (!product) throw new Error(line.title + ' is no longer available.');
        return { product, quantity: line.quantity };
      });
      const customerId = typeof selected.data.customerId === 'string' ? selected.data.customerId : '';
      const customers = customerId ? await harness.pos<{ items: PosRecord[] }>(props.scope, 'customers', customerId) : null;
      draftRef.current = { id: selected.id, version: selected.version };
      draftSignature.current = JSON.stringify({ items: next.map((line) => [line.product.id, line.product.version, line.quantity]),
        discountBps: Number(selected.data.discountBps || 0), customerId });
      setDraftOrderId(selected.id); setCart(next); setCustomer(customers?.items.find((item) => item.id === customerId) || null);
      setDiscount(String(Number(selected.data.discountBps || 0) / 100)); setSection('sell'); setOrder(null); setCartOpen(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open the order.'); }
    finally { setBusy(false); }
  };
  const acceptOrder = async (selected: PosRecord) => {
    setBusy(true);
    try {
      const result = await execute('pos.order.accept', { orderId: selected.id, version: selected.version });
      setOrder(result.order as PosRecord); await refreshAfterSave();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not accept the order.'); }
    finally { setBusy(false); }
  };
  const rejectOrder = (selected: PosRecord) => setForm({ title: 'Reject order', submit: 'Reject order', fields: [
    { key: 'reason', label: 'Reason' },
  ], save: async (values) => {
    const result = await execute('pos.order.reject', { orderId: selected.id, version: selected.version, reason: values.reason });
    setOrder(result.order as PosRecord); await refreshAfterSave();
  } });
  const shareReceipt = async (sale: PosRecord) => {
    const lines = sale.data.lines as SaleLine[];
    const code = String(sale.data.currency);
    await Share.share({ message: [
      String(sale.data.storeName), String(sale.data.location || ''), 'Receipt ' + sale.id, new Date(sale.createdAt).toLocaleString(),
      ...lines.map((line) => line.quantity + ' × ' + line.title + '  ' + money(line.total, code)),
      'Discount: ' + money(Number(sale.data.discount), code), 'Tax: ' + money(Number(sale.data.tax), code),
      'Total: ' + money(Number(sale.data.total), code), String(sale.data.method).toUpperCase() + ' · ' + sale.state,
      String(sale.data.receiptFooter || ''),
    ].join('\n') });
  };

  const cartView = (
    <View style={[styles.cart, wide && styles.cartWide]}>
      {wide ? (
        <View style={styles.panelHeading}>
          <Text style={styles.heading}>Current Sale ({count} {count === 1 ? 'item' : 'items'})</Text>
          {count > 0 ? (
            <View style={styles.headerCartActions}>
              <TouchableOpacity hitSlop={8} onPress={saveForNow} style={styles.headerActionBtn}>
                <Text style={styles.saveLaterText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity hitSlop={8} onPress={() => { setCart([]); setDiscount('0'); setCustomer(null); setCustomerPhone(''); }} style={styles.headerActionBtn}>
                <Text style={styles.clearCartText}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.customerRow}>
        {customer || customerPhone ? (
          <View style={styles.customerActivePill}>
            <TouchableOpacity
              style={styles.customerActivePillTouch}
              onPress={() => setShowCustomerInput(true)}
            >
              <Ionicons name="person-circle" size={18} color="#006AFF" />
              <Text style={styles.customerActiveText} numberOfLines={1}>
                {customer?.title || customerPhone}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity hitSlop={8} onPress={() => { setCustomer(null); setCustomerPhone(''); }}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addCustomerBtn}
            onPress={() => setShowCustomerInput(true)}
          >
            <Ionicons name="person-add-outline" size={16} color="#64748B" />
            <Text style={styles.addCustomerBtnText}>Add customer</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.cartLines} contentContainerStyle={styles.cartLinesContent}>
        {cart.map((line) => {
          const unitPrice = Number(line.product.data.price) || 0;
          const lineGross = unitPrice * line.quantity;
          return (
            <View key={line.product.id} style={styles.line}>
              <View style={styles.productAvatar}>
                <Text style={styles.productAvatarText}>{(line.product.title || 'P').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.lineTitle}>{line.product.title}</Text>
                <Text style={styles.lineSub}>
                  {money(unitPrice, currency)}
                  {line.quantity > 1 ? ` · ${money(lineGross, currency)}` : ''}
                </Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  accessibilityLabel={line.quantity === 1 ? 'Remove ' + line.product.title : 'Remove one ' + line.product.title}
                  style={styles.stepperBtn}
                  onPress={() => changeQuantity(line.product.id, -1)}
                >
                  <Ionicons name={line.quantity === 1 ? 'trash-outline' : 'remove'} size={16} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={'Edit quantity for ' + line.product.title}
                  style={styles.stepperQtyTouch}
                  onPress={() => {
                    setEditingQty({ id: line.product.id, title: line.product.title, current: line.quantity, max: Number(line.product.data.stock) });
                    setQtyInput(String(line.quantity));
                  }}
                >
                  <Text style={styles.stepperQty}>{line.quantity}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={'Add one ' + line.product.title}
                  style={styles.stepperBtn}
                  onPress={() => changeQuantity(line.product.id, 1)}
                >
                  <Ionicons name="add" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        {!cart.length ? (
          <View style={styles.emptyCartBox}>
            <Ionicons name="cart-outline" size={44} color="#CBD5E1" />
            <Text style={styles.empty}>Cart is empty</Text>
          </View>
        ) : null}
      </ScrollView>

      {cart.length > 0 ? (
        <View style={[styles.totals, { paddingBottom: bottomSafePadding }]}>
          <View style={styles.summaryBox}>
            {(discountBps > 0 || totals.tax > 0) ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{money(totals.subtotal, currency)}</Text>
              </View>
            ) : null}

            {discountBps > 0 ? (
              <View style={styles.summaryRow}>
                <TouchableOpacity
                  style={styles.discountBadgeRow}
                  onPress={() => setShowDiscountInput(true)}
                >
                  <Ionicons name="pricetag" size={13} color="#64748B" />
                  <Text style={styles.discountLabel}>Discount ({discount}%)</Text>
                  <Ionicons name="pencil" size={11} color="#94A3B8" />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.discountValue}>−{money(totals.discount, currency)}</Text>
                  <TouchableOpacity hitSlop={8} onPress={() => setDiscount('0')}>
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addDiscountLink} onPress={() => setShowDiscountInput(true)}>
                <Ionicons name="pricetag-outline" size={14} color="#64748B" />
                <Text style={styles.addDiscountLinkText}>Add discount</Text>
              </TouchableOpacity>
            )}

            {totals.tax > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>{money(totals.tax, currency)}</Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.totalDueRow}>
              <Text style={styles.totalDueLabel}>TOTAL DUE</Text>
              <Text style={styles.totalDueValue}>{money(totals.total, currency)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.chargeBtn}
            activeOpacity={0.85}
            onPress={() => setShowPaymentSheet(true)}
          >
            <Text style={styles.chargeBtnText}>Charge {money(totals.total, currency)}</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return <Modal visible={props.visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={back}>
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Back" style={styles.touch} onPress={back}><Ionicons name="chevron-back" size={24} color="#1C2430" /></TouchableOpacity>
        <Text numberOfLines={1} style={styles.headerTitle}>{cartOpen && !wide ? 'Current Sale' : (overview?.settings?.title || props.contextTitle || 'Point of sale')}</Text>
        {cartOpen && !wide && count > 0 ? (
          <View style={styles.headerCartActions}>
            <TouchableOpacity hitSlop={8} onPress={saveForNow} style={styles.headerActionBtn}>
              <Text style={styles.saveLaterText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity hitSlop={8} onPress={() => { setCart([]); setDiscount('0'); setCustomer(null); setCustomerPhone(''); }} style={styles.headerActionBtn}>
              <Text style={styles.clearCartText}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.drawerBadge} onPress={registerForm}>
            <Ionicons name={overview?.register ? 'cash' : 'lock-closed-outline'} size={14} color={overview?.register ? '#16A34A' : '#64748B'} />
            <Text style={[styles.drawerBadgeText, overview?.register ? styles.drawerBadgeActive : null]}>
              {overview?.register ? `Drawer: ${money(overview.register.expected, currency)}` : 'Open drawer'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')} hitSlop={8}>
            <Ionicons name="close" size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      ) : null}
      {pending && !form ? <View style={styles.recovery}><Text style={styles.body}>An operation needs confirmation.</Text><Button title={busy ? 'Checking…' : 'Resolve pending operation'} disabled={busy} onPress={() => void recover()} /></View> : null}
      {!overview ? <View style={styles.center}><ActivityIndicator size="small" color="#3157A8" /></View> : order ? <ScrollView contentContainerStyle={[styles.receipt, { paddingBottom: bottomSafePadding + 20 }]}>
        <Ionicons name={order.state === 'refunded' || order.state === 'cancelled' ? 'return-down-back-outline' : 'checkmark-circle'} size={38} color={order.state === 'cancelled' ? '#b42318' : '#008060'} />
        <Text style={styles.receiptTitle}>{order.state === 'open' ? 'Open order' : order.state === 'cancelled' ? 'Order cancelled' : order.state === 'refunded' ? 'Sale returned' : order.state === 'partially_refunded' ? 'Partially returned' : 'Payment recorded'}</Text>
        <Text style={styles.muted}>{order.id.slice(-8).toUpperCase()} · {new Date(order.createdAt).toLocaleString()}</Text>
        {order.state === 'open' ? <Text style={styles.muted}>Review: {String(order.data.approval || 'pending')}{order.data.orderType === 'delivery' ? ' · Delivery: ' + String(order.data.delivery || 'unassigned') : ''}</Text> : null}
        {order.data.table ? <Text style={styles.muted}>Table {String(order.data.table)}</Text> : null}
        {order.data.destination ? <Text style={styles.muted}>Deliver to {String(order.data.destination)}</Text> : null}
        {(Array.isArray(order.data.lines) ? order.data.lines as SaleLine[] : []).map((line) => <Total key={line.productId} label={line.quantity + ' × ' + line.title} value={money(line.total, String(order.data.currency))} />)}
        <Total label="Total" value={money(Number(order.data.total), String(order.data.currency))} bold />
        {order.state !== 'open' && order.state !== 'cancelled' ? <><Total label="Change" value={money(Number(order.data.change || 0), String(order.data.currency))} /><Total label="Returned" value={money(Number(order.data.refundedTotal || 0), String(order.data.currency))} /><Text style={styles.muted}>{String(order.data.method).toUpperCase()}{order.data.customerName ? ' · ' + order.data.customerName : ''}</Text><Button title="Share receipt" onPress={() => { void shareReceipt(order).catch(() => Alert.alert('Could not share receipt')); }} /></> : null}
        {order.state === 'open' ? <><Button title="Continue order" disabled={busy} onPress={() => { void resumeOrder(order); }} />
          {overview.canManage && order.data.approval === 'pending' ? <><Button title="Accept order" disabled={busy} secondary onPress={() => { void acceptOrder(order); }} /><Button title="Reject order" disabled={busy} secondary onPress={() => rejectOrder(order)} /></> : null}</> : null}
        {overview.canManage && (order.state === 'paid' || order.state === 'partially_refunded') ? <Button title="Return sale" secondary onPress={() => refund(order)} /> : null}
        <Button title="Done" secondary onPress={() => { setOrder(null); setRevision((value) => value + 1); }} />
      </ScrollView> : <View style={styles.main}>
        {(section !== 'sell' || wide || !cartOpen) ? <View style={styles.catalog}>
          {section !== 'sell' ? <View style={styles.sectionHeading}><Text style={styles.heading}>{sections.find((item) => item.key === section)?.label}</Text>{section === 'customers' ? <TouchableOpacity style={styles.touch} onPress={() => customerForm()}><Ionicons name="add" size={24} /></TouchableOpacity> : null}</View> : null}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={17} color="#64748B" />
            <TextInput
              accessibilityLabel="Search"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#94A3B8"
              placeholder={section === 'sell' ? 'Search products…' : 'Search ' + section}
              style={styles.searchInput}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} style={styles.searchClear}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>
          {section === 'sell' && categories.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryList}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryPillText, selectedCategory === cat && styles.categoryPillTextActive]}>{cat === 'All' ? 'All Items' : cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          <FlatList key={section === 'sell' ? 'grid' : 'list'} data={section === 'sell' ? filteredItems : items} numColumns={section === 'sell' ? (wide ? 3 : 2) : 1} keyExtractor={(item) => item.id} contentContainerStyle={[styles.products, { paddingBottom: (count > 0 ? 84 : 24) + bottomSafePadding }]} ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.empty}>{loading ? 'Loading products…' : search ? 'No matching products.' : 'No products in catalog yet.'}</Text>{!loading && !search && overview.canManage && section === 'sell' ? <Button title="Add product" onPress={() => productForm()} /> : null}</View>} ListFooterComponent={hasMore ? <TouchableOpacity style={styles.loadMore} onPress={() => void more()}><Text>{loading ? 'Loading…' : 'Load more'}</Text></TouchableOpacity> : null} renderItem={({ item }) => {
            if (section === 'sell') {
              const inCartQty = cartQuantities[item.id] || 0;
              const isOutOfStock = Number(item.data.stock) < 1;
              const isLowStock = !isOutOfStock && Number(item.data.stock) <= Number(item.data.lowStock || 0);
              return (
                <TouchableOpacity
                  accessibilityLabel={item.title + (isOutOfStock ? ', out of stock' : '')}
                  style={[styles.productTile, inCartQty > 0 && styles.productTileInCart, isOutOfStock && styles.disabled]}
                  onPress={() => add(item)}
                >
                  <View style={styles.productTileTop}>
                    {item.data.imageUrl ? (
                      <Image source={{ uri: String(item.data.imageUrl) }} style={styles.productThumb} resizeMode="cover" />
                    ) : null}
                    <Text numberOfLines={2} style={styles.productName}>{item.title}</Text>
                    {inCartQty > 0 ? (
                      <View style={styles.productQtyBadge}>
                        <Text style={styles.productQtyBadgeText}>{inCartQty}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.productTileBottom}>
                    <Text style={styles.price}>{money(Number(item.data.price), currency)}</Text>
                    {isLowStock ? <Text style={styles.lowStockText}>Low ({String(item.data.stock)})</Text> : isOutOfStock ? <Text style={styles.outOfStockText}>Out of stock</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity style={styles.listRow} onPress={() => {
                if (section === 'orders') setOrder(item);
                else if (section === 'customers') Alert.alert(item.title, String(item.data.phone || item.data.email || ''), [{ text: 'Add to sale', onPress: () => { selectCustomer(item); } }, { text: 'Purchase history', onPress: () => { chooseSection('orders'); setSearch(item.id); } }, { text: 'Edit', onPress: () => customerForm(item) }]);
              }}><View style={styles.copy}><Text style={styles.body}>{section === 'orders' ? item.id.slice(-8).toUpperCase() : item.title}</Text><Text style={styles.muted}>{section === 'customers' ? String(item.data.phone || item.data.email || 'Select for this sale') : new Date(item.createdAt).toLocaleDateString() + ' · ' + item.state}</Text></View>{section === 'orders' ? <Text style={styles.price}>{money(Number(item.data.total), currency)}</Text> : null}<Ionicons name="chevron-forward" size={16} color="#8c9196" /></TouchableOpacity>
            );
          }} />
        </View> : null}
        {section === 'sell' && ((wide && count > 0) || cartOpen) ? cartView : null}
      </View>}
      {overview?.settings && !order && section === 'sell' && !wide && !cartOpen && count > 0 ? (
        <TouchableOpacity style={[styles.cartBar, { bottom: insets.bottom > 0 ? insets.bottom + 12 : 18 }]} onPress={() => setCartOpen(true)}>
          <View style={styles.cartBarLeft}>
            <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{count}</Text></View>
            <Text style={styles.cartBarTotal}>{money(totals.total, currency)}</Text>
          </View>
          <View style={styles.cartBarRight}>
            <Text style={styles.cartBarAction}>Review & Settle ›</Text>
          </View>
        </TouchableOpacity>
      ) : null}
      {form ? <PosForm form={form} onClose={() => setForm(null)} /> : null}
      <Modal visible={showPaymentSheet} transparent animationType="slide" onRequestClose={() => setShowPaymentSheet(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => setShowPaymentSheet(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.paymentSheet, { paddingBottom: bottomSafePadding + 12 }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetSub}>Total Amount</Text>
                <Text style={styles.sheetTotal}>{money(totals.total, currency)}</Text>
              </View>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setShowPaymentSheet(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.paymentMethodPrompt}>Select Payment Method</Text>

            <View style={styles.paymentCards}>
              <TouchableOpacity
                style={styles.paymentCard}
                onPress={() => { setShowPaymentSheet(false); checkout('upi'); }}
              >
                <View style={[styles.paymentCardIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="qr-code" size={22} color="#2563EB" />
                </View>
                <Text style={styles.paymentCardTitle}>UPI QR</Text>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.paymentCard}
                onPress={() => { setShowPaymentSheet(false); checkout('cash'); }}
              >
                <View style={[styles.paymentCardIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="cash" size={22} color="#16A34A" />
                </View>
                <Text style={styles.paymentCardTitle}>Cash</Text>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.paymentCard}
                onPress={() => { setShowPaymentSheet(false); checkout('card'); }}
              >
                <View style={[styles.paymentCardIcon, { backgroundColor: '#F8FAFC' }]}>
                  <Ionicons name="card" size={22} color="#475569" />
                </View>
                <Text style={styles.paymentCardTitle}>Card</Text>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <Modal visible={Boolean(editingQty)} transparent animationType="fade" onRequestClose={() => setEditingQty(null)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => setEditingQty(null)}>
          <View style={[styles.qtyModalSheet, { paddingBottom: bottomSafePadding + 16 }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetSub}>Quantity</Text>
                <Text numberOfLines={1} style={styles.qtyModalTitle}>{editingQty?.title}</Text>
              </View>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setEditingQty(null)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.qtyInputBox}>
              <TextInput
                autoFocus
                selectTextOnFocus
                keyboardType="number-pad"
                value={qtyInput}
                onChangeText={setQtyInput}
                style={styles.qtyLargeInput}
              />
            </View>

            <View style={styles.qtyPillRow}>
              {[1, 2, 5, 10].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={styles.qtyPresetPill}
                  onPress={() => setQtyInput(String(num))}
                >
                  <Text style={styles.qtyPresetPillText}>{num}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.qtyPresetPill}
                onPress={() => setQtyInput((prev) => String((parseInt(prev, 10) || 0) + 1))}
              >
                <Text style={styles.qtyPresetPillText}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qtyPresetPill}
                onPress={() => setQtyInput((prev) => String((parseInt(prev, 10) || 0) + 5))}
              >
                <Text style={styles.qtyPresetPillText}>+5</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qtyActionRow}>
              <TouchableOpacity
                style={styles.qtyRemoveBtn}
                onPress={() => {
                  if (editingQty) changeQuantity(editingQty.id, -editingQty.current);
                  setEditingQty(null);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
                <Text style={styles.qtyRemoveBtnText}>Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qtySetBtn}
                onPress={confirmQtyEdit}
              >
                <Text style={styles.qtySetBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showCustomerInput} transparent animationType="slide" onRequestClose={() => setShowCustomerInput(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => setShowCustomerInput(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { paddingBottom: bottomSafePadding + 16 }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetSub}>Sale Details</Text>
                <Text style={styles.sheetTitle}>Customer</Text>
              </View>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setShowCustomerInput(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetFieldLabel}>Mobile Number or Name</Text>
            <View style={styles.sheetInputRow}>
              <Ionicons name="call-outline" size={20} color="#64748B" />
              <TextInput
                autoFocus
                accessibilityLabel="Customer phone or name"
                style={styles.sheetLargeTextInput}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="Mobile number or name"
                placeholderTextColor="#94A3B8"
                keyboardType="default"
              />
              {customerPhone ? (
                <TouchableOpacity onPress={() => setCustomerPhone('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.sheetActionRow}>
              {customer || customerPhone ? (
                <TouchableOpacity
                  style={styles.sheetSecondaryBtn}
                  onPress={() => { setCustomer(null); setCustomerPhone(''); setShowCustomerInput(false); }}
                >
                  <Text style={styles.sheetSecondaryBtnText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.sheetPrimaryBtn}
                onPress={() => setShowCustomerInput(false)}
              >
                <Text style={styles.sheetPrimaryBtnText}>{customerPhone ? 'Attach to Sale' : 'Done'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showDiscountInput} transparent animationType="slide" onRequestClose={() => setShowDiscountInput(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={() => setShowDiscountInput(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { paddingBottom: bottomSafePadding + 16 }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetSub}>Sale Adjustment</Text>
                <Text style={styles.sheetTitle}>Discounts</Text>
              </View>
              <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setShowDiscountInput(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetFieldLabel}>Preset %</Text>
            <View style={styles.discountGrid}>
              {['5', '10', '15', '20'].map((pct) => {
                const isSelected = discount === pct;
                return (
                  <TouchableOpacity
                    key={pct}
                    style={[styles.discountGridBtn, isSelected && styles.discountGridBtnActive]}
                    onPress={() => setDiscount(pct)}
                  >
                    <Text style={[styles.discountGridBtnText, isSelected && styles.discountGridBtnTextActive]}>
                      {pct}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sheetFieldLabel}>Custom %</Text>
            <View style={styles.discountCustomBox}>
              <TextInput
                accessibilityLabel="Custom discount percentage"
                style={styles.discountLargeInput}
                value={discount === '0' ? '' : discount}
                placeholder="0"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                onChangeText={(val) => setDiscount(val || '0')}
              />
              <Text style={styles.discountPercentSign}>%</Text>
            </View>

            <View style={styles.sheetActionRow}>
              {discountBps > 0 ? (
                <TouchableOpacity
                  style={styles.sheetSecondaryBtn}
                  onPress={() => { setDiscount('0'); setShowDiscountInput(false); }}
                >
                  <Text style={styles.sheetSecondaryBtnText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.sheetPrimaryBtn}
                onPress={() => setShowDiscountInput(false)}
              >
                <Text style={styles.sheetPrimaryBtnText}>{discountBps > 0 ? `Apply ${discount}%` : 'Done'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  </Modal>;
}
function Total({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) { return <View style={styles.totalRow}><Text style={bold ? styles.heading : styles.muted}>{label}</Text><Text style={bold ? styles.heading : styles.body}>{value}</Text></View>; }
function Button({ title, onPress, disabled, secondary, flex }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; flex?: boolean }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, flex && styles.buttonFlex, secondary && styles.secondary, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 52, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E8ECF1', paddingHorizontal: 12 },
  touch: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1C2430', marginLeft: 6 },
  searchBar: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1C2430',
    height: 44,
    paddingVertical: 0,
  },
  searchClear: {
    padding: 2,
  },
  copy: { flex: 1 },
  drawerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E2E8F0' },
  drawerBadgeText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  drawerBadgeActive: { color: '#16A34A', fontWeight: '700' },
  main: { flex: 1, flexDirection: 'row' },
  catalog: { flex: 1 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 48 },
  heading: { fontSize: 16, fontWeight: '700', color: '#1C2430' },
  body: { fontSize: 14, color: '#1C2430' },
  muted: { fontSize: 12, color: '#697586', lineHeight: 18 },
  categoryScroll: { flexGrow: 0, paddingHorizontal: 10, marginTop: 8, marginBottom: 8 },
  categoryList: { gap: 6, alignItems: 'center', flexDirection: 'row' },
  categoryPill: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F1F5F9' },
  categoryPillActive: { backgroundColor: '#1C2430' },
  categoryPillText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  categoryPillTextActive: { color: '#FFFFFF', fontWeight: '700' },
  products: { paddingHorizontal: 8, paddingBottom: 80 },
  productTile: {
    flex: 1,
    margin: 4,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8ECF1',
    justifyContent: 'space-between',
    minHeight: 90,
    maxWidth: '48%',
  },
  productTileInCart: {
    borderColor: '#3157A8',
    backgroundColor: '#F7F9FD',
  },
  productTileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  productThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C2430',
    flex: 1,
    lineHeight: 19,
  },
  productQtyBadge: {
    backgroundColor: '#3157A8',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  productQtyBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  productTileBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C2430',
  },
  lowStockText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  outOfStockText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  listRow: { minHeight: 64, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E8ECF1' },
  cart: { flex: 1, backgroundColor: '#FFFFFF' },
  cartWide: { flex: 0, width: 360, borderLeftWidth: 1, borderColor: '#E8ECF1', backgroundColor: '#FFFFFF' },
  panelHeading: { height: 50, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E8ECF1', backgroundColor: '#FFFFFF' },
  customerRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E8ECF1', backgroundColor: '#FFFFFF' },
  addCustomerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  addCustomerBtnText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  customerActivePill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  customerActivePillTouch: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerActiveText: { fontSize: 13, fontWeight: '600', color: '#1C2430' },
  cartLines: { flex: 1, backgroundColor: '#FFFFFF' },
  cartLinesContent: { paddingVertical: 6 },
  line: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#F1F5F9' },
  productAvatar: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  productAvatarText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  lineTitle: { fontSize: 14, fontWeight: '600', color: '#1C2430', marginBottom: 2 },
  lineSub: { fontSize: 13, color: '#64748B' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepperBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  stepperQty: { minWidth: 24, textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#1C2430' },
  stepperQtyTouch: { minWidth: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  emptyCartBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  totals: { paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1, borderColor: '#E8ECF1', backgroundColor: '#FFFFFF' },
  summaryBox: { marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  summaryLabel: { fontSize: 13, color: '#64748B' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#1C2430' },
  discountBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discountLabel: { fontSize: 13, color: '#64748B' },
  discountValue: { fontSize: 13, fontWeight: '600', color: '#1C2430' },
  addDiscountLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  addDiscountLinkText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E8ECF1', marginVertical: 8 },
  totalDueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  totalDueLabel: { fontSize: 15, fontWeight: '700', color: '#1C2430', letterSpacing: 0.5 },
  totalDueValue: { fontSize: 22, fontWeight: '800', color: '#1C2430' },
  chargeBtn: { backgroundColor: '#006AFF', height: 52, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#006AFF', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  chargeBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  headerCartActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerActionBtn: { paddingVertical: 4 },
  saveLaterText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 18 },
  paymentSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E8ECF1' },
  sheetSub: { fontSize: 11, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#1C2430', marginTop: 2 },
  sheetTotal: { fontSize: 28, fontWeight: '800', color: '#1C2430', marginTop: 2 },
  sheetCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  sheetFieldLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 14, marginBottom: 8 },
  sheetInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 14, height: 52, backgroundColor: '#F8FAFC' },
  sheetLargeTextInput: { flex: 1, fontSize: 16, color: '#1C2430', fontWeight: '500' },
  sheetActionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  sheetPrimaryBtn: { flex: 1, backgroundColor: '#006AFF', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetPrimaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  sheetSecondaryBtn: { height: 50, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  sheetSecondaryBtnText: { color: '#64748B', fontSize: 15, fontWeight: '600' },
  discountGrid: { flexDirection: 'row', gap: 10, marginTop: 4 },
  discountGridBtn: { flex: 1, height: 52, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  discountGridBtnActive: { backgroundColor: '#EBF3FF', borderColor: '#006AFF' },
  discountGridBtnText: { fontSize: 17, fontWeight: '700', color: '#475569' },
  discountGridBtnTextActive: { color: '#006AFF' },
  discountCustomBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginVertical: 10 },
  discountLargeInput: { fontSize: 32, fontWeight: '800', color: '#1C2430', minWidth: 90, textAlign: 'center', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 },
  discountPercentSign: { fontSize: 28, fontWeight: '800', color: '#64748B' },
  paymentMethodPrompt: { fontSize: 13, fontWeight: '700', color: '#1C2430', marginTop: 14, marginBottom: 10 },
  paymentCards: { gap: 10 },
  paymentCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  paymentCardIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  paymentCardTitle: { fontSize: 15, fontWeight: '700', color: '#1C2430', flex: 1 },
  qtyModalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 16 },
  qtyModalTitle: { fontSize: 16, fontWeight: '700', color: '#1C2430', marginTop: 2 },
  qtyInputBox: { alignItems: 'center', justifyContent: 'center', marginVertical: 14 },
  qtyLargeInput: { fontSize: 36, fontWeight: '800', color: '#1C2430', minWidth: 100, textAlign: 'center', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 16 },
  qtyPillRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  qtyPresetPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9' },
  qtyPresetPillText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  qtyActionRow: { flexDirection: 'row', gap: 10 },
  qtyRemoveBtn: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  qtyRemoveBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
  qtySetBtn: { flex: 2, height: 48, borderRadius: 10, backgroundColor: '#006AFF', alignItems: 'center', justifyContent: 'center' },
  qtySetBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 6 },
  button: { backgroundColor: '#1C2430', minHeight: 46, paddingHorizontal: 18, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginVertical: 4 },
  buttonFlex: { flex: 1 },
  buttonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  secondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1' },
  secondaryText: { color: '#1C2430' },
  disabled: { opacity: 0.4 },
  clearCartText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  cartBar: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    height: 52,
    backgroundColor: '#1C2430',
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  cartBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartBadge: {
    backgroundColor: '#3157A8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cartBarTotal: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  cartBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartBarAction: {
    color: '#93C5FD',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyState: { alignItems: 'center', padding: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  empty: { paddingVertical: 24, paddingHorizontal: 16, textAlign: 'center', color: '#697586', fontSize: 13, lineHeight: 20 },
  receipt: { padding: 24, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  receiptTitle: { fontSize: 22, fontWeight: '700', color: '#1C2430' },
  error: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: { fontSize: 13, color: '#DC2626', flex: 1, marginRight: 8 },
  loadMore: { height: 44, alignItems: 'center', justifyContent: 'center' },
  recovery: { padding: 12, backgroundColor: '#FFFBEB' },
});
