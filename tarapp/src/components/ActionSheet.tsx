// ActionSheet: one form, many configs. Fields come from the registry; the
// submit is an intent with its idempotency key.

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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <ScrollView contentContainerStyle={styles.form}>
            {shown.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{field.label}{field.required ? '' : ''}</Text>
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
          <View style={styles.actions}>
            <TouchableOpacity accessibilityRole="button" style={styles.cancel} onPress={onClose}><Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={[styles.ok, { backgroundColor: theme.primary }]} onPress={() => void submit()}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 18, maxHeight: '80%' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  form: { gap: 12 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 },
  cancel: { padding: 12 },
  ok: { borderRadius: 999, paddingVertical: 12, paddingHorizontal: 28 },
});
