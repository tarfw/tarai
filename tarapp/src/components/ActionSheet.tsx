// ActionSheet: one form, many configs. Fields come from the registry; the
// submit is an intent with its idempotency key. Full screen, sale-style:
// header with a back, the form, one Save bar at the bottom.

import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { enqueue } from '@/lib/queue';

export interface FieldConfig { key: string; label: string; kind: string; required?: boolean; hidden?: boolean; defaultValue?: string }

export function ActionSheet({
  visible, onClose, ws, action, title, fields, onQueued,
}: {
  visible: boolean; onClose: () => void; ws: string; action: string; title: string;
  fields: FieldConfig[]; onQueued?: (label: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const shown = useMemo(() => fields.filter((field) => !field.hidden), [fields]);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.filter((field) => !field.hidden).map((field) => [field.key, field.defaultValue ?? ''])));

  const submit = async () => {
    const input: Record<string, unknown> = {};
    for (const field of shown) {
      const raw = (values[field.key] ?? '').trim();
      if (!raw) continue;
      input[field.key] = field.kind === 'number' ? Number(raw) : raw;
    }
    await enqueue({ ws, action, input, label: title, key: `tap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    onQueued?.(title);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
          <View style={styles.side}>
            <TouchableOpacity accessibilityRole="button" onPress={onClose} accessibilityLabel="Cancel">
              <Text style={{ color: theme.primary, fontSize: 17 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
          <View style={styles.side} />
        </View>
        <ScrollView contentContainerStyle={styles.form}>
          {shown.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{field.label}</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                value={values[field.key] ?? ''}
                onChangeText={(text) => setValues((previous) => ({ ...previous, [field.key]: text }))}
                keyboardType={field.kind === 'number' ? 'numeric' : 'default'}
                autoCapitalize="none"
              />
            </View>
          ))}
        </ScrollView>
        <View style={[styles.actions, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border }]}>
          <TouchableOpacity accessibilityRole="button" style={[styles.ok, { backgroundColor: theme.primary }]} onPress={() => void submit()}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  side: { minWidth: 70, alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },
  form: { padding: 16, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12 },
  ok: { borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
});
