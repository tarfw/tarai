// RecordDetail: one record, any tool. Read + status; the fourth shape.

import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { record } from '@/lib/tar';

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} accessibilityLabel="Back"><Text style={{ color: theme.primary, fontSize: 15 }}>&lt; Canvas</Text></TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{item ? item.title : 'Record'}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {loading ? <ActivityIndicator color={theme.primary} /> : null}
        {!loading && !item ? <Text style={{ color: theme.textSecondary, textAlign: 'center', paddingTop: 40 }}>This record is gone.</Text> : null}
        {item ? (
          <>
            <View style={[styles.fact, { borderColor: theme.border }]}><Text style={{ color: theme.textSecondary }}>TYPE</Text><Text style={{ color: theme.text }}>{item.type}</Text></View>
            <View style={[styles.fact, { borderColor: theme.border }]}><Text style={{ color: theme.textSecondary }}>STATUS</Text><Text style={{ color: theme.text }}>{item.state}</Text></View>
            <View style={[styles.fact, { borderColor: theme.border }]}><Text style={{ color: theme.textSecondary }}>VERSION</Text><Text style={{ color: theme.text }}>{item.version}</Text></View>
            <Text style={{ color: theme.textSecondary, paddingTop: 8 }}>FACTS</Text>
            {Object.entries(item.data ?? {}).slice(0, 24).map(([key, value]) => (
              <View key={key} style={[styles.fact, { borderColor: theme.border }]}>
                <Text style={{ color: theme.textSecondary, flex: 1 }}>{key}</Text>
                <Text style={{ color: theme.text, flex: 2 }}>{summarize(value)}</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function summarize(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 120);
  return String(value);
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
});
