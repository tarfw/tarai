// ToolList: one route, twelve tools. Flat rows: title, one line, the number.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { NavBar } from '@/components/NavBar';
import { SearchField } from '@/components/SearchField';
import { hire, importImage, toolRows } from '@/lib/tar';
import { enqueue } from '@/lib/queue';
import * as ImagePicker from 'expo-image-picker';

interface Row { id: string; type: string; title: string; state: string; data: Record<string, unknown>; version: number; updatedAt: number }

const TOOL_TITLES: Record<string, string> = {
  catalog: 'Products and prices', stock: 'Inventory', purchase: 'Purchase orders', expense: 'Expenses',
  contact: 'Customers', member: 'Team', site: 'Storefront', task: 'Tasks', channel: 'Messages',
  invoice: 'Invoices', payment: 'Payments', order: 'Orders', settings: 'Settings',
};

export default function ToolListScreen() {
  const { toolId } = useLocalSearchParams<{ toolId: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { current } = useWorkspace();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<{ name: string; price: string | null; doubt: boolean }[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [growWords, setGrowWords] = useState('');
  const [growEmail, setGrowEmail] = useState('');
  const [growing, setGrowing] = useState(false);
  const seq = useRef(0);
  const title = TOOL_TITLES[String(toolId ?? '')] ?? String(toolId ?? '');

  const load = useCallback(async () => {
    if (!current || !toolId) return;
    const mine = ++seq.current;
    setLoading(true);
    try {
      const result = await toolRows(current.slug, toolId, q);
      if (mine === seq.current) setRows(result.rows as Row[]);
    } catch { /* rows stay; stale is fine */ }
    finally { if (mine === seq.current) setLoading(false); }
  }, [current, toolId, q]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const importPhoto = async () => {
    if (!current) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6 });
    if (picked.canceled || !picked.assets[0]?.base64) return;
    setImporting(true);
    try {
      const result = await importImage(current.slug, picked.assets[0].base64);
      setDraft(result.rows ?? []);
    } catch { setDraft([]); }
    finally { setImporting(false); }
  };

  const invite = async () => {
    if (!current || !growEmail.trim() || !growWords.trim()) return;
    setGrowing(true);
    try {
      const verdict = await hire(current.slug, growWords);
      const role = 'member';
      const workRole = verdict.role === 'general' ? 'general' : verdict.role;
      const access = verdict.tools.includes('*') ? undefined : verdict.tools;
      const { inviteMember } = await import('@/lib/members');
      await inviteMember(current.slug, { email: growEmail.trim(), role, workRole, brief: growWords, ...(access ? { access } : {}) });
      setGrowEmail(''); setGrowWords('');
      void load();
    } finally { setGrowing(false); }
  };

  const postDraft = async () => {
    if (!current || !draft) return;
    const good = draft.filter((row) => !row.doubt && row.name);
    for (const row of good) {
      await enqueue({
        ws: current.slug, action: 'catalog.item.save', label: `Import ${row.name}`,
        key: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        input: { name: row.name, price: parsePrice(row.price) },
      });
    }
    setDraft(null);
    void load();
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <Modal visible={draft !== null} animationType="slide" transparent onRequestClose={() => setDraft(null)}>
        <View style={importStyles.backdrop}>
          <View style={[importStyles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={importStyles.head}>
              <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>DRAFT ROWS · {(draft ?? []).length}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={() => setDraft(null)}><Ionicons name="close" size={22} color={theme.textSecondary} /></TouchableOpacity>
            </View>
            <FlatList
              data={draft ?? []}
              keyExtractor={(_, index) => String(index)}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => (
                <View style={[importStyles.row, { borderColor: theme.border }]}>
                  <Text style={{ color: theme.text, flex: 1, fontSize: 15 }} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ color: item.doubt ? '#B42318' : theme.textSecondary, fontSize: 13 }}>{item.price ?? 'Rs. ??'}{item.doubt ? ' · doubt' : ''}</Text>
                </View>
              )}
            />
            <View style={importStyles.actions}>
              <TouchableOpacity accessibilityRole="button" onPress={() => setDraft(null)} style={{ paddingVertical: 10 }}><Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Discard</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={[importStyles.post, { backgroundColor: (draft ?? []).some((row) => !row.doubt && row.name) ? theme.primary : theme.backgroundSelected }]} disabled={!(draft ?? []).some((row) => !row.doubt && row.name)} onPress={() => void postDraft()}>
                <Text style={{ color: (draft ?? []).some((row) => !row.doubt && row.name) ? '#fff' : theme.textSecondary, fontWeight: '700' }}>Add these items</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <NavBar title={title} onBack={() => router.back()} />
      <SearchField flush value={q} onChangeText={setQ} />
      {toolId === 'catalog' ? (
        <TouchableOpacity accessibilityRole="button" style={[styles.importRow, { borderBottomColor: theme.border }]} onPress={() => void importPhoto()} disabled={importing} accessibilityLabel="Import a price list photo">
          <Ionicons name="images-outline" size={18} color={theme.primary} />
          <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '600' }}>{importing ? 'Reading the photo…' : 'Import a price list photo'}</Text>
        </TouchableOpacity>
      ) : null}
      {loading && rows.length === 0 ? <ActivityIndicator style={{ paddingTop: 40 }} color={theme.primary} /> : null}
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: insets.bottom + 32 }}
        renderItem={({ item }) => (
          <TouchableOpacity accessibilityRole="button" style={[styles.row, { backgroundColor: theme.backgroundElement }]} onPress={() => router.push(`/record/${encodeURIComponent(item.id)}?from=${encodeURIComponent(String(toolId ?? ''))}`)}>
            <View style={{ flexShrink: 1, gap: 2 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{item.state}</Text>
            </View>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{summaryOf(item)}</Text>
          </TouchableOpacity>
        )}
        ListHeaderComponent={toolId === 'member' ? (
          <View style={{ gap: 8, paddingBottom: 16 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, paddingTop: 4 }}>HIRE</Text>
            <TextInput style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]} placeholder="Email" placeholderTextColor={theme.textSecondary} value={growEmail} onChangeText={setGrowEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]} placeholder="What will this person do?" placeholderTextColor={theme.textSecondary} value={growWords} onChangeText={setGrowWords} />
            <TouchableOpacity accessibilityRole="button" style={[styles.invite, { backgroundColor: growEmail && growWords && !growing ? theme.primary : theme.backgroundSelected }]} disabled={!growEmail || !growWords || growing} onPress={() => void invite()}>
              <Text style={{ color: growEmail && growWords && !growing ? '#fff' : theme.textSecondary, fontWeight: '700' }}>{growing ? 'Inviting…' : 'Invite'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        ListEmptyComponent={!loading ? <Text style={{ color: theme.textSecondary, textAlign: 'center', paddingTop: 40 }}>Nothing here yet.</Text> : null}
      />
    </View>
  );
}

function parsePrice(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^0-9.]/g, '');
  if (!digits) return undefined;
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? Math.round(value * 100) : undefined;
}

function summaryOf(row: Row): string {
  const data = row.data ?? {};
  if (typeof data.total === 'number') return `Rs. ${(data.total / 100).toFixed(0)}`;
  if (typeof data.amount === 'number') return `Rs. ${(data.amount / 100).toFixed(0)}`;
  if (typeof data.onhand === 'number') return `${data.onhand}`;
  if (typeof data.price === 'number') return `Rs. ${(data.price / 100).toFixed(0)}`;
  return '';
}

const importStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingHorizontal: 16, paddingTop: 16, maxHeight: '75%' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14 },
  post: { borderRadius: 4, paddingVertical: 12, paddingHorizontal: 20 },
});

const styles = StyleSheet.create({
  page: { flex: 1 },
  importRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { borderRadius: 4, paddingHorizontal: 14, height: 46, fontSize: 15 },
  invite: { borderRadius: 4, height: 46, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
});
