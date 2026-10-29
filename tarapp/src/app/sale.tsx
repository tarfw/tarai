// The Sale route: pos (and invoice in gst mode). Cart, method, one confirm.
// The tap is an intent: sale.write commits order + invoice + payment + stock.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { NavBar } from '@/components/NavBar';
import { toolRows } from '@/lib/tar';
import { SearchField } from '@/components/SearchField';
import { enqueue } from '@/lib/queue';

interface Item { id: string; title: string; price: number; variantId: string | null }
type Method = 'cash' | 'upi' | 'card';

export default function SaleScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { current } = useWorkspace();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<Method>('cash');
  const [tendered, setTendered] = useState('');
  const [reference, setReference] = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!current) return;
    const mine = ++seq.current;
    setLoading(true);
    try {
      const result = await toolRows(current.slug, 'catalog', q);
      const rows = result.rows as { id: string; title: string; data: Record<string, unknown> }[];
      if (mine === seq.current) setItems(rows.map((row) => ({ id: row.id, title: row.title, price: Number(row.data.price ?? 0), variantId: typeof row.data.variantId === 'string' ? row.data.variantId : null })));
    } catch { /* stale is fine */ }
    finally { if (mine === seq.current) setLoading(false); }
  }, [current, q]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const lines = useMemo(() => Object.entries(cart).filter(([, quantity]) => quantity > 0), [cart]);
  const total = useMemo(() => items.filter((item) => cart[item.id]).reduce((sum, item) => sum + item.price * cart[item.id], 0), [items, cart]);
  // tendered is typed in rupees like every other money field; stored paise
  const tenderedPaise = /^\d+(\.\d{1,2})?$/.test(tendered.trim()) ? Math.round(Number(tendered) * 100) : 0;
  const change = Math.max(0, tenderedPaise - total);

  const add = (id: string, delta: number) => setCart((previous) => {
    const quantity = Math.max(0, (previous[id] ?? 0) + delta);
    return { ...previous, [id]: quantity };
  });

  const checkout = async () => {
    if (!current || !lines.length) return;
    await enqueue({
      ws: current.slug,
      action: 'sale.write',
      label: `Sale Rs. ${(total / 100).toFixed(0)}`,
      key: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      input: {
        lines: lines.map(([id, quantity]) => {
          const item = items.find((entry) => entry.id === id)!;
          return { variant: item.variantId ?? item.id, quantity };
        }),
        method,
        ...(method === 'cash' && tenderedPaise ? { tendered: tenderedPaise } : {}),
        ...(method !== 'cash' && reference ? { reference } : {}),
      },
    });
    setCart({}); setTendered(''); setReference('');
    router.back();
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <NavBar title="Counter Sale" onBack={() => router.back()} />
      <SearchField flush value={q} onChangeText={setQ} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 8 }}>
        {loading && !items.length ? <ActivityIndicator color={theme.primary} style={{ paddingTop: 30 }} /> : null}
        {!loading && !items.length ? <Text style={{ color: theme.textSecondary, textAlign: 'center', paddingTop: 30 }}>Add items in Products and Prices first.</Text> : null}
        {items.map((item) => (
          <TouchableOpacity key={item.id} accessibilityRole="button" style={[styles.itemRow, { backgroundColor: theme.backgroundElement }]} onPress={() => add(item.id, 1)}>
            <View style={{ flexShrink: 1, gap: 2 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Rs. {(item.price / 100).toFixed(2)}</Text>
            </View>
            {cart[item.id] ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove one ${item.title}`} style={[styles.step, { backgroundColor: theme.background }]} onPress={() => add(item.id, -1)}>
                  <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '600' }}>−</Text>
                </TouchableOpacity>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>{cart[item.id]}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add one ${item.title}`} style={[styles.step, { backgroundColor: theme.background }]} onPress={() => add(item.id, 1)}>
                  <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '600' }}>+</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={[styles.pay, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border }]}>
        <View style={styles.payRow}>
          <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>CART ({lines.length})</Text>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>Rs. {(total / 100).toFixed(2)}</Text>
        </View>
        <View style={[styles.methods, { gap: 8 }]}>
          {(['cash', 'upi', 'card'] as Method[]).map((entry) => (
            <TouchableOpacity key={entry} accessibilityRole="button" style={[styles.method, { backgroundColor: method === entry ? theme.primary : theme.backgroundElement }]} onPress={() => setMethod(entry)}>
              <Text style={{ color: method === entry ? '#fff' : theme.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>{entry}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {method === 'cash' ? (
          <View>
            <TextInput style={[styles.ref, { backgroundColor: theme.backgroundElement, color: theme.text }]} placeholder="Cash received" placeholderTextColor={theme.textSecondary} keyboardType="decimal-pad" value={tendered} onChangeText={setTendered} />
            {change > 0 ? <Text style={{ color: theme.textSecondary, fontSize: 12, paddingTop: 4 }}>Change Rs. {(change / 100).toFixed(2)}</Text> : null}
          </View>
        ) : null}
        {method !== 'cash' ? (
          <TextInput style={[styles.ref, { backgroundColor: theme.backgroundElement, color: theme.text }]} placeholder="Provider reference" placeholderTextColor={theme.textSecondary} autoCapitalize="none" value={reference} onChangeText={setReference} />
        ) : null}
        <TouchableOpacity accessibilityRole="button" style={[styles.complete, { backgroundColor: lines.length ? theme.primary : theme.backgroundSelected }]} disabled={!lines.length} onPress={() => void checkout()}>
          <Text style={{ color: lines.length ? '#fff' : theme.textSecondary, fontWeight: '800' }}>Complete Sale — Rs. {(total / 100).toFixed(2)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  itemRow: { borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 56 },
  step: { width: 30, height: 30, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  pay: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  methods: { flexDirection: 'row' },
  method: { flex: 1, borderRadius: 4, paddingVertical: 10, alignItems: 'center' },
  ref: { borderRadius: 4, paddingHorizontal: 14, height: 46, fontSize: 15 },
  complete: { borderRadius: 4, height: 52, alignItems: 'center', justifyContent: 'center' },
});
