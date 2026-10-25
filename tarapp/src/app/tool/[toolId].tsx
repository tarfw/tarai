// ToolList: one route, twelve tools. Rows + the number + the one tap.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { hire, importImage, toolRows } from '@/lib/tar';
import { enqueue } from '@/lib/queue';
import * as ImagePicker from 'expo-image-picker';

interface Row { id: string; type: string; title: string; state: string; data: Record<string, unknown>; version: number; updatedAt: number }

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

  const load = useCallback(async () => {
    if (!current || !toolId) return;
    setLoading(true);
    try {
      const result = await toolRows(current.slug, toolId, q);
      setRows(result.rows as Row[]);
    } catch { /* rows stay; stale is fine */ }
    finally { setLoading(false); }
  }, [current, toolId, q]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

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
          <View style={[importStyles.sheet, { backgroundColor: theme.background }]}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', paddingBottom: 10 }}>DRAFT ROWS</Text>
            <FlatList
              data={draft ?? []}
              keyExtractor={(_, index) => String(index)}
              renderItem={({ item }) => (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }}>
                  <Text style={{ color: theme.text, flex: 1 }}>{item.name}</Text>
                  <Text style={{ color: item.doubt ? '#B42318' : theme.textSecondary }}>{item.price ?? 'Rs. ??'} {item.doubt ? '· doubt' : ''}</Text>
                </View>
              )}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14 }}>
              <TouchableOpacity accessibilityRole="button" onPress={() => setDraft(null)}><Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Discard</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={{ backgroundColor: theme.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 22 }} onPress={() => void postDraft()}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Post the good rows</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} accessibilityLabel="Back"><Text style={{ color: theme.primary, fontSize: 15 }}>&lt; Canvas</Text></TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>{String(toolId ?? '').toUpperCase()}</Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            style={[styles.search, { borderColor: theme.border, color: theme.text, flex: 1 }]}
            placeholder="Search"
            placeholderTextColor={theme.textSecondary}
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => void load()}
            returnKeyType="search"
          />
          {toolId === 'catalog' ? (
            <TouchableOpacity accessibilityRole="button" style={[styles.photo, { borderColor: theme.border }]} onPress={() => void importPhoto()} disabled={importing} accessibilityLabel="Import a price list photo">
              <Text style={{ color: theme.primary, fontWeight: '700' }}>{importing ? '…' : 'photo'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {loading && rows.length === 0 ? <ActivityIndicator style={{ paddingTop: 40 }} color={theme.primary} /> : null}
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />}
        renderItem={({ item }) => (
          <TouchableOpacity accessibilityRole="button" style={styles.row} onPress={() => router.push(`/record/${encodeURIComponent(item.id)}`)}>
            <View style={{ flexShrink: 1, gap: 2 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }} numberOfLines={1}>{item.title}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.state}</Text>
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{summaryOf(item)}</Text>
          </TouchableOpacity>
        )}
        ListHeaderComponent={toolId === 'member' ? (
          <View style={{ gap: 8, paddingBottom: 16 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>HIRE</Text>
            <TextInput style={[styles.search, { borderColor: theme.border, color: theme.text }]} placeholder="email" placeholderTextColor={theme.textSecondary} value={growEmail} onChangeText={setGrowEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={[styles.search, { borderColor: theme.border, color: theme.text }]} placeholder="what will this person do?" placeholderTextColor={theme.textSecondary} value={growWords} onChangeText={setGrowWords} />
            <TouchableOpacity accessibilityRole="button" style={{ backgroundColor: growEmail && growWords && !growing ? theme.primary : theme.border, borderRadius: 999, paddingVertical: 10, alignItems: 'center' }} disabled={!growEmail || !growWords || growing} onPress={() => void invite()}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{growing ? '…' : 'Invite'}</Text>
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
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '75%' },
});

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  search: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14 },
  photo: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, gap: 12 },
});
