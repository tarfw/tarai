// ToolList: one route, twelve tools. Rows + the number + the one tap.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { toolRows } from '@/lib/tar';

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

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} accessibilityLabel="Back"><Text style={{ color: theme.primary, fontSize: 15 }}>&lt; Canvas</Text></TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>{String(toolId ?? '').toUpperCase()}</Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <TextInput
          style={[styles.search, { borderColor: theme.border, color: theme.text }]}
          placeholder="Search"
          placeholderTextColor={theme.textSecondary}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => void load()}
          returnKeyType="search"
        />
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
        ListEmptyComponent={!loading ? <Text style={{ color: theme.textSecondary, textAlign: 'center', paddingTop: 40 }}>Nothing here yet.</Text> : null}
      />
    </View>
  );
}

function summaryOf(row: Row): string {
  const data = row.data ?? {};
  if (typeof data.total === 'number') return `Rs. ${(data.total / 100).toFixed(0)}`;
  if (typeof data.amount === 'number') return `Rs. ${(data.amount / 100).toFixed(0)}`;
  if (typeof data.onhand === 'number') return `${data.onhand}`;
  if (typeof data.price === 'number') return `Rs. ${(data.price / 100).toFixed(0)}`;
  return '';
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  search: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, gap: 12 },
});
