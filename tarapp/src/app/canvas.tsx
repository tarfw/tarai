// Canvas: one screen, every member. The header ends in a hairline; the
// circle badge opens the flat inbox; the avatar is You (the many list);
// the floating (+) is Ask. NEXT is the top row; urgent rows carry !.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { Card } from '@/components/Card';
import { ActionSheet, type FieldConfig } from '@/components/ActionSheet';
import { confirmRequest, pendingCount, resolveConfirm, subscribe } from '@/lib/queue';
import { actionCatalogs, setDeck, slice, type CardView, type InboxRow } from '@/lib/tar';
import { saveSlice } from '@/lib/slicecache';
import { registerPush } from '@/lib/push';
import { Onboarding } from '@/components/Onboarding';

const FALLBACK_FIELDS: Record<string, FieldConfig[]> = {
  'catalog.item.save': [{ key: 'name', label: 'Item name', kind: 'text', required: true }, { key: 'price', label: 'Price (paise)', kind: 'number' }, { key: 'stock', label: 'Initial stock', kind: 'number' }],
  'expense.record': [{ key: 'payee', label: 'Payee', kind: 'text', required: true }, { key: 'category', label: 'Category', kind: 'text', required: true }, { key: 'amount', label: 'Amount (paise)', kind: 'number', required: true }],
  'contact.create': [{ key: 'name', label: 'Name', kind: 'text', required: true }, { key: 'phone', label: 'Phone', kind: 'text' }],
  'task.create': [{ key: 'title', label: 'What needs doing?', kind: 'text', required: true }],
  'payment.record': [{ key: 'invoice', label: 'Invoice ID', kind: 'text', required: true }, { key: 'amount', label: 'Amount (paise)', kind: 'number', required: true }, { key: 'method', label: 'Method', kind: 'text', required: true }],
  'invoice.issue': [{ key: 'order', label: 'Order ID', kind: 'text', required: true }],
  'order.create': [{ key: 'lines', label: 'Lines as JSON', kind: 'text', required: true }],
  default: [],
};

const CORE_TOOLS: readonly { id: string; title: string }[] = [
  { id: 'pos', title: 'Counter Sales' },
  { id: 'order', title: 'Orders and Dispatch' },
  { id: 'invoice', title: 'Billing and GST' },
  { id: 'payment', title: 'Payments and UPI' },
  { id: 'register', title: 'Cash Drawer' },
  { id: 'catalog', title: 'Products and Prices' },
  { id: 'stock', title: 'Inventory and Warehouse' },
  { id: 'purchase', title: 'Supplier POs and GRN' },
  { id: 'expense', title: 'Daily Expenses' },
  { id: 'contact', title: 'Customers and Leads' },
  { id: 'member', title: 'Team and Shifts' },
  { id: 'site', title: 'Online Storefront' },
  { id: 'task', title: 'Manual Tasks' },
  { id: 'channel', title: 'Messages' },
];

export default function Canvas() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { current, slice: data, refreshSlice, workspaces, select } = useWorkspace();
  const [sheet, setSheet] = useState<'none' | 'inbox' | 'many' | 'deck'>('none');
  const [confirm, setConfirm] = useState<{ key: string; label: string } | null>(null);
  const [queueBadge, setQueueBadge] = useState(0);
  const [action, setAction] = useState<{ action: string; title: string; fields: FieldConfig[] } | null>(null);

  useEffect(() => {
    const update = async () => setQueueBadge(await pendingCount());
    void update();
    return subscribe(() => void update());
  }, []);

  // the bell: register the device for push (idempotent, best-effort)
  useEffect(() => { void registerPush(); }, []);

  useEffect(() => {
    const check = async () => {
      const pending = await confirmRequest();
      setConfirm((previous) => pending && !previous ? { key: pending.key, label: pending.label } : previous);
    };
    void check();
    return subscribe(() => void check());
  }, []);

  // the 20s version check: if-none-match on the last move id; 304 costs nothing
  useEffect(() => {
    if (!current) return;
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const fresh = await slice(current.slug, data?.version ?? null);
        if (fresh && active) { await saveSlice(current.slug, fresh); await refreshSlice(); }
      } catch { /* the poll is the floor */ }
    };
    const interval = setInterval(() => void poll(), 20_000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void poll(); });
    return () => { active = false; clearInterval(interval); sub.remove(); };
  }, [current, data?.version, refreshSlice]);

  const openTap = useCallback(async (card: CardView) => {
    if (!current) return;
    if (card.shape === 'sale') { router.push('/sale'); return; }
    if (card.tool === 'order' || card.tool === 'contact' || card.tool === 'member' || card.tool === 'stock' || card.tool === 'purchase' || card.tool === 'expense' || card.tool === 'invoice' || card.tool === 'payment' || card.tool === 'task') {
      router.push(`/tool/${card.tool}`);
      return;
    }
    if (!card.tap.action) { router.push(`/tool/${card.tool}`); return; }
    let fields: FieldConfig[] = FALLBACK_FIELDS[card.tap.action] ?? FALLBACK_FIELDS.default;
    try {
      const catalog = await actionCatalogs(current.slug);
      const registered = (catalog.actions as { id: string; fields: FieldConfig[] }[]).find((entry) => entry.id === card.tap.action);
      if (registered?.fields?.length) fields = registered.fields.filter((field) => !field.hidden);
    } catch { /* fallback fields stand */ }
    setAction({ action: card.tap.action!, title: card.tap.label, fields });
  }, [current, router]);

  const inboxRows: InboxRow[] = useMemo(() => data?.inbox ?? [], [data]);
  const next = data?.next ?? null;
  const cards = useMemo(() => data?.cards ?? [], [data]);
  const dealt = useMemo(() => new Set(cards.map((card) => card.tool)), [cards]);
  const roleLabel = current?.role ? current.role.charAt(0).toUpperCase() + current.role.slice(1) : '';

  if (!current) return <Onboarding />;

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
        <TouchableOpacity accessibilityRole="button" style={styles.badgeWrap} onPress={() => setSheet('inbox')}>
          <View style={[styles.badge, { backgroundColor: inboxRows.length ? theme.primary : theme.border }]}>
            <Text style={styles.badgeText}>{inboxRows.length || ''}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.heading}>
          <Text style={[styles.wsName, { color: theme.text }]} numberOfLines={1}>{current.mode === 'personal' ? 'Personal' : current.name}</Text>
          <Text style={[styles.role, { color: theme.textSecondary }]}>{roleLabel}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" style={[styles.avatar, { borderColor: theme.border }]} onPress={() => setSheet('many')}>
          <Text style={styles.avatarText}>{(current.name[0] ?? 'T').toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.stack, { paddingBottom: insets.bottom + 96 }]}>
        {next ? (
          <View style={[styles.next, { borderColor: theme.border }]}>
            <Text style={[styles.nextLabel, { color: next.urgent ? '#B42318' : theme.textSecondary }]}>{next.urgent ? '! NEXT' : 'NEXT'}</Text>
            <Text style={[styles.nextTitle, { color: theme.text }]} numberOfLines={2}>{next.title}</Text>
          </View>
        ) : null}
        {cards.map((card) => <Card key={card.tool} card={card} onTap={(tapped) => void openTap(tapped)} />)}
        <TouchableOpacity accessibilityRole="button" style={[styles.add, { borderColor: theme.border }]} onPress={() => setSheet('deck')}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>+ Add a Card</Text>
        </TouchableOpacity>
      </ScrollView>

      {queueBadge > 0 ? (
        <View style={[styles.queueBadge, { backgroundColor: theme.primary }]}><Text style={styles.queueText}>{queueBadge} waiting</Text></View>
      ) : null}

      <TouchableOpacity accessibilityRole="button" style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + 18 }]} onPress={() => router.push('/ask')} accessibilityLabel="Ask TAR">
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <Sheet title="Inbox" visible={sheet === 'inbox'} onClose={() => setSheet('none')}>
        {inboxRows.length === 0 ? <Text style={[styles.empty, { color: theme.textSecondary }]}>Nothing waiting.</Text> : null}
        {inboxRows.map((row) => (
          <View key={row.id} style={[styles.sheetRow, { borderBottomColor: theme.border }]}>
            <Text style={{ color: row.urgent ? '#B42318' : theme.textSecondary, fontWeight: '800' }}>{row.urgent ? '!' : '·'}</Text>
            <Text style={[styles.sheetRowText, { color: theme.text }]}>{row.title}</Text>
          </View>
        ))}
      </Sheet>

      <Sheet title="Workspaces" visible={sheet === 'many'} onClose={() => setSheet('none')}>
        {workspaces.map((ws) => (
          <TouchableOpacity key={ws.id} accessibilityRole="button" style={[styles.sheetRow, { borderBottomColor: theme.border }]} onPress={() => { select(ws.slug); setSheet('none'); }}>
            <Text style={[styles.sheetRowText, { color: theme.text, fontWeight: ws.slug === current.slug ? '700' : '400' }]}>{ws.mode === 'personal' ? 'Personal' : ws.name}</Text>
            <Text style={{ color: theme.textSecondary }}>{ws.role}{ws.badge ? ` · ${ws.badge}` : ''}</Text>
          </TouchableOpacity>
        ))}
      </Sheet>

      <DeckSheet visible={sheet === 'deck'} ws={current.slug} dealt={dealt} onClose={() => setSheet('none')} />

      {confirm ? (
        <ConfirmCard label={confirm.label} onResolve={async (yes) => { await resolveConfirm(confirm.key, yes); setConfirm(null); void refreshSlice(); }} />
      ) : null}

      {action ? (
        <ActionSheet
          visible
          onClose={() => setAction(null)}
          ws={current.slug}
          action={action.action}
          title={action.title}
          fields={action.fields}
          onQueued={() => void refreshSlice()}
        />
      ) : null}
    </View>
  );
}

function Sheet({ title, visible, onClose, children }: { title: string; visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheetStyles.backdrop}>
        <View style={[sheetStyles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={sheetStyles.head}>
            <Text style={[sheetStyles.title, { color: theme.text }]}>{title}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={onClose} accessibilityLabel="Close"><Ionicons name="close" size={22} color={theme.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DeckSheet({ visible, ws, dealt, onClose }: { visible: boolean; ws: string; dealt: Set<string>; onClose: () => void }) {
  const theme = useTheme();
  const [state, setState] = useState(dealt);
  const toggle = async (tool: string) => {
    const next = new Set(state);
    if (next.has(tool)) next.delete(tool); else next.add(tool);
    setState(next);
    try { await setDeck(ws, [...next]); } catch { /* the deck retries on next open */ }
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheetStyles.backdrop}>
        <View style={[sheetStyles.sheet, { backgroundColor: theme.background }]}>
          <View style={sheetStyles.head}>
            <Text style={[sheetStyles.title, { color: theme.text }]}>CARD CORE · 14</Text>
            <TouchableOpacity accessibilityRole="button" onPress={onClose} accessibilityLabel="Close"><Ionicons name="close" size={22} color={theme.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {CORE_TOOLS.map((tool) => (
              <TouchableOpacity key={tool.id} accessibilityRole="button" style={[sheetStyles.deckRow, { borderBottomColor: theme.border }]} onPress={() => void toggle(tool.id)} >
                <Text style={{ color: theme.text }}>{tool.title}</Text>
                <Text style={{ color: state.has(tool.id) ? theme.primary : theme.textSecondary }}>{state.has(tool.id) ? "on" : "off"}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ConfirmCard({ label, onResolve }: { label: string; onResolve: (confirmed: boolean) => void }) {
  const theme = useTheme();
  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => onResolve(false)}>
      <View style={[sheetStyles.backdrop, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={[sheetStyles.confirm, { backgroundColor: theme.background }]}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Moves money or a customer.</Text>
          <Text style={{ color: theme.textSecondary, paddingTop: 6 }}>{label} needs your confirm.</Text>
          <View style={{ flexDirection: 'row', gap: 12, paddingTop: 18, justifyContent: 'flex-end' }}>
            <TouchableOpacity accessibilityRole="button" onPress={() => onResolve(false)} style={{ padding: 10 }}><Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Not now</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => onResolve(true)} style={{ backgroundColor: theme.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 22 }}><Text style={{ color: '#fff', fontWeight: '700' }}>Confirm</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  badgeWrap: { width: 36, height: 36 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  heading: { flex: 1, gap: 1 },
  wsName: { fontSize: 16, fontWeight: '700' },
  role: { fontSize: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1F1A17', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarText: { color: '#fff', fontWeight: '700' },
  stack: { padding: 16, gap: 12 },
  next: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 6 },
  nextLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  nextTitle: { fontSize: 16, fontWeight: '600' },
  add: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 14, alignItems: 'center' },
  fab: { position: 'absolute', right: 18, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  queueBadge: { position: 'absolute', top: 76, right: 20, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  queueText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  sheetRow: { flexDirection: 'row', gap: 10, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'space-between' },
  sheetRowText: { fontSize: 15, flexShrink: 1 },
  empty: { paddingVertical: 20, textAlign: 'center' },
});

const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 16, maxHeight: '75%' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  deckRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  confirm: { borderRadius: 16, padding: 20, width: '86%' },
});
