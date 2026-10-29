// RecordDetail: one record, any tool. Read + status; the fourth shape.
// Flat facts: an eyebrow label, the value, one hairline-free tile each.

import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { NavBar } from '@/components/NavBar';
import { record } from '@/lib/tar';

export default function RecordDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { current } = useWorkspace();
  const [item, setItem] = useState<{ id: string; type: string; title: string; state: string; data: Record<string, unknown>; version: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current || !id) return;
    void (async () => {
      try {
        const result = await record(current.slug, String(id));
        setItem(result.record as typeof item);
      } catch { /* not found stays empty */ }
      finally { setLoading(false); }
    })();
  }, [current, id]);

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <NavBar title={item ? item.title : 'Record'} onBack={() => router.back()} backLabel={from ? titleOf(String(from)) : 'Back'} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {loading ? <ActivityIndicator color={theme.primary} style={{ paddingTop: 24 }} /> : null}
        {!loading && !item ? <Text style={{ color: theme.textSecondary, textAlign: 'center', paddingTop: 40 }}>This record is gone.</Text> : null}
        {item ? (
          <>
            <View style={[styles.fact, { backgroundColor: theme.backgroundElement }]}><Text style={[styles.eyebrow, { color: theme.textSecondary }]}>TYPE</Text><Text style={[styles.value, { color: theme.text }]}>{item.type}</Text></View>
            <View style={[styles.fact, { backgroundColor: theme.backgroundElement }]}><Text style={[styles.eyebrow, { color: theme.textSecondary }]}>STATUS</Text><Text style={[styles.value, { color: theme.text }]}>{item.state}</Text></View>
            <View style={[styles.fact, { backgroundColor: theme.backgroundElement }]}><Text style={[styles.eyebrow, { color: theme.textSecondary }]}>VERSION</Text><Text style={[styles.value, { color: theme.text }]}>{item.version}</Text></View>
            <Text style={[styles.eyebrow, { color: theme.textSecondary, paddingTop: 16, paddingBottom: 2 }]}>FACTS</Text>
            {Object.entries(item.data ?? {}).slice(0, 24).map(([key, value]) => (
              <View key={key} style={[styles.fact, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.eyebrow, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>{key.toUpperCase()}</Text>
                <Text style={[styles.value, { color: theme.text, flex: 2, textAlign: 'right' }]}>{summarize(value)}</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function titleOf(from: string): string {
  const known: Record<string, string> = { catalog: 'Products', stock: 'Inventory', purchase: 'POs', expense: 'Expenses', contact: 'Customers', member: 'Team', task: 'Tasks', channel: 'Messages' };
  return known[from] ?? from.charAt(0).toUpperCase() + from.slice(1);
}

function summarize(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 120);
  return String(value);
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  fact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 13, minHeight: 48 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  value: { fontSize: 15, fontWeight: '500' },
});
