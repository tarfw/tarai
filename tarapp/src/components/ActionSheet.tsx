// ActionSheet: one form, many configs. Fields come from the registry; the
// submit is an intent with its idempotency key. Flat data list: a small
// eyebrow label on the left, the value on the right, hairlines between rows;
// selects are chips, money is typed in rupees with the rupee alongside, tax in
// percent, photos are picked and uploaded. Focus turns the value accent;
// required fields gate Save; optional ones sit under ONE MORE eyebrow.
//
// For a new item: name first, Jev drafts category, unit and tax into rows the
// member has not touched. Anything they wrote is never overwritten.

import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/use-theme';
import { enqueue } from '@/lib/queue';
import { draftItem, uploadMedia } from '@/lib/tar';

export interface FieldConfig { key: string; label: string; kind: string; required?: boolean; hidden?: boolean; core?: boolean; icon?: string; defaultValue?: string; options?: string[] }

// registry defaults for money/percent arrive in stored units (paise / basis points)
const displayDefault = (field: FieldConfig): string => {
  const raw = field.defaultValue ?? '';
  if (!raw) return '';
  if (field.kind === 'money' || field.kind === 'percent') return String(Number(raw) / 100);
  return raw;
};

const validate = (field: FieldConfig, value: string): string | null => {
  const raw = value.trim();
  if (field.required && !raw) return 'Required';
  if (!raw) return null;
  if (field.kind === 'money' && !/^\d+(\.\d{1,2})?$/.test(raw)) return 'Rupees, up to 2 decimals';
  if (field.kind === 'percent' && (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) > 100)) return '0–100';
  if (field.kind === 'number' && !/^\d+$/.test(raw)) return 'Whole number';
  if (field.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return 'Invalid email';
  return null;
};

const submitValue = (field: FieldConfig, raw: string): unknown => {
  if (field.kind === 'money' || field.kind === 'percent') return Math.round(Number(raw) * 100);
  if (field.kind === 'number') return Number(raw);
  return raw;
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function ActionSheet({
  visible, onClose, ws, action, title, fields, onQueued,
}: {
  visible: boolean; onClose: () => void; ws: string; action: string; title: string;
  fields: FieldConfig[]; onQueued?: (label: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const shown = useMemo(() => fields.filter((field) => !field.hidden), [fields]);
  const core = useMemo(() => shown.filter((field) => field.core || field.required), [shown]);
  const more = useMemo(() => shown.filter((field) => !core.includes(field)), [shown, core]);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(shown.map((field) => [field.key, displayDefault(field)])));
  const [uploading, setUploading] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [aiFilled, setAiFilled] = useState<Record<string, boolean>>({});
  const aiRequested = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const errors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const field of shown) {
      const problem = validate(field, values[field.key] ?? '');
      if (problem) map[field.key] = problem;
    }
    return map;
  }, [shown, values]);
  const canSave = Object.keys(errors).length === 0 && !uploading;
  // a pristine form stays quiet; problems surface on the first Save attempt,
  // then clear live as each row is fixed
  const shownErrors = submitted ? errors : {};

  const set = (key: string, text: string) => {
    setValues((previous) => ({ ...previous, [key]: text }));
    setTouched((previous) => ({ ...previous, [key]: true }));
    setAiFilled((previous) => (previous[key] ? { ...previous, [key]: false } : previous));
    if (key === 'name') {
      if (draftTimer.current) clearTimeout(draftTimer.current);
      if (text.trim().length >= 3) draftTimer.current = setTimeout(() => void maybeDraft(text), 700);
    }
  };

  // once the name is on the page, Jev drafts category, unit and tax into the
  // rows the member has not touched; anything they wrote is never overwritten
  const maybeDraft = async (name: string) => {
    const trimmed = name.trim();
    if (aiRequested.current || trimmed.length < 3) return;
    aiRequested.current = true;
    const draft = await draftItem(ws, trimmed);
    const next: Record<string, string> = {};
    const filled: Record<string, boolean> = {};
    const draftCategory = typeof draft.category === 'string' ? draft.category : '';
    const draftUnit = typeof draft.unit === 'string' ? draft.unit : '';
    if (draftCategory && !touched['category']) { next['category'] = draftCategory; filled['category'] = true; }
    if (draftUnit && !touched['unit']) { next['unit'] = draftUnit; filled['unit'] = true; }
    if (typeof draft.tax === 'number' && !touched['tax']) { next['tax'] = String(draft.tax); filled['tax'] = true; }
    if (Object.keys(next).length) {
      setValues((previous) => ({ ...previous, ...next }));
      setAiFilled((previous) => ({ ...previous, ...filled }));
    }
  };

  const pickPhoto = async (field: FieldConfig, viaCamera: boolean) => {
    setUploading(field.key);
    try {
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true, exif: false };
      const result = viaCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.base64) return;
      const url = await uploadMedia(ws, asset.mimeType ?? 'image/jpeg', asset.base64);
      set(field.key, url);
    } catch (error) {
      Alert.alert('Photo upload failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    if (uploading) return;
    if (!canSave) {
      setSubmitted(true);
      return;
    }
    const input: Record<string, unknown> = {};
    for (const field of shown) {
      const raw = (values[field.key] ?? '').trim();
      if (!raw) continue;
      input[field.key] = submitValue(field, raw);
    }
    await enqueue({ ws, action, input, label: title, key: `tap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    onQueued?.(title);
    onClose();
  };

  const renderField = (field: FieldConfig) => {
    const value = values[field.key] ?? '';
    const error = shownErrors[field.key];
    const active = focused === field.key;
    const stacked = field.kind === 'select' || field.kind === 'photo' || field.kind === 'textarea';
    // Jev writes quietly: the eyebrow turns blue; tapping it asks again.
    const filled = Boolean(aiFilled[field.key]);
    const labelText = (
      <Text style={[styles.label, { color: error ? '#B42318' : active || filled ? theme.primary : theme.textSecondary }]} numberOfLines={1}>{field.label.toUpperCase()}</Text>
    );
    const label = filled ? (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Ask Jev for ${field.label}`} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => { aiRequested.current = false; void maybeDraft(values['name'] ?? ''); }}>
        {labelText}
      </TouchableOpacity>
    ) : labelText;

    let control: React.ReactNode;
    if (field.kind === 'select' && field.options?.length) {
      control = (
        <View style={styles.chips}>
          {field.options.map((option) => {
            const selected = value === option;
            return (
              <TouchableOpacity
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => set(field.key, option)}
                style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.backgroundElement }]}
              >
                <Text style={[styles.chipText, { color: selected ? '#fff' : theme.text }]}>{titleCase(option)}</Text>
              </TouchableOpacity>
            );
          })}
          {value && !field.options.includes(value) ? (
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: true }} style={[styles.chip, { backgroundColor: theme.primary }]} onPress={() => set(field.key, '')}>
              <Text style={[styles.chipText, { color: '#fff' }]}>{titleCase(value)}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    } else if (field.kind === 'money' || field.kind === 'percent') {
      const affix = field.kind === 'money' ? '₹' : '%';
      const affixFirst = field.kind === 'money';
      control = (
        <View style={styles.valueRow}>
          {affixFirst ? <Text style={[styles.affix, { color: active ? theme.primary : theme.textSecondary }]}>{affix}</Text> : null}
          <TextInput
            style={[styles.moneyInput, { color: error ? '#B42318' : theme.text }]}
            value={value}
            onChangeText={(text) => set(field.key, text)}
            onFocus={() => setFocused(field.key)}
            onBlur={() => setFocused(null)}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={theme.textMuted}
          />
          {!affixFirst ? <Text style={[styles.affix, { color: active ? theme.primary : theme.textSecondary }]}>{affix}</Text> : null}
        </View>
      );
    } else if (field.kind === 'photo') {
      control = (
        <View style={styles.photoRow}>
          {value ? <Image source={{ uri: value }} style={styles.photoThumb} /> : null}
          {uploading === field.key ? (
            <ActivityIndicator style={styles.photoProgress} />
          ) : (
            <View style={styles.photoActions}>
              <TouchableOpacity accessibilityRole="button" style={[styles.photoButton, { backgroundColor: theme.backgroundElement }]} onPress={() => void pickPhoto(field, true)}>
                <Ionicons name="camera-outline" size={16} color={theme.primary} />
                <Text style={[styles.photoButtonText, { color: theme.primary }]}>{value ? 'Retake' : 'Camera'}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={[styles.photoButton, { backgroundColor: theme.backgroundElement }]} onPress={() => void pickPhoto(field, false)}>
                <Ionicons name="images-outline" size={16} color={theme.primary} />
                <Text style={[styles.photoButtonText, { color: theme.primary }]}>Gallery</Text>
              </TouchableOpacity>
              {value ? (
                <TouchableOpacity accessibilityRole="button" style={[styles.photoButton, { backgroundColor: theme.backgroundElement }]} onPress={() => set(field.key, '')}>
                  <Ionicons name="trash-outline" size={16} color="#B42318" />
                  <Text style={[styles.photoButtonText, { color: '#B42318' }]}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      );
    } else {
      control = (
        <View style={styles.valueRow}>
          <TextInput
            style={[styles.input, { color: error ? '#B42318' : theme.text }, field.kind === 'textarea' ? styles.inputTall : null]}
            value={value}
            onChangeText={(text) => set(field.key, text)}
            onFocus={() => setFocused(field.key)}
            onBlur={() => { setFocused(null); if (field.key === 'name') { if (draftTimer.current) clearTimeout(draftTimer.current); void maybeDraft(value); } }}
            keyboardType={field.kind === 'number' ? 'number-pad' : 'default'}
            autoCapitalize={field.kind === 'email' ? 'none' : 'sentences'}
            autoCorrect={false}
            multiline={field.kind === 'textarea'}
            placeholder={field.required ? 'Required' : 'Optional'}
            placeholderTextColor={theme.textMuted}
          />
        </View>
      );
    }

    return (
      <View key={field.key} style={[styles.row, { borderBottomColor: theme.border }]}>
        <View style={stacked ? styles.stackTop : styles.lineTop}>
          {stacked ? label : <View style={styles.labelCell}>{label}</View>}
          <View style={[styles.valueCell, stacked ? styles.valueCellStacked : null]}>{control}</View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
          <View style={styles.side}>
            <TouchableOpacity accessibilityRole="button" onPress={onClose} accessibilityLabel="Cancel">
              <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
          <View style={styles.side} />
        </View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View>{core.map(renderField)}</View>
          {more.length ? (
            <>
              <Text style={[styles.section, { color: theme.textSecondary }]}>MORE DETAILS</Text>
              <View>{more.map(renderField)}</View>
            </>
          ) : null}
        </ScrollView>
        <View style={[styles.actions, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border }]}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.ok, { backgroundColor: canSave ? theme.primary : theme.backgroundSelected }]}
            onPress={() => void submit()}
            disabled={Boolean(uploading)}
          >
            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: canSave ? '#fff' : theme.textSecondary, fontSize: 16, fontWeight: '800' }}>Save</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  side: { minWidth: 70, alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center', letterSpacing: -0.2 },
  form: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 24, marginBottom: 2 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth },
  lineTop: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingVertical: 8 },
  stackTop: { paddingTop: 12 },
  labelCell: { width: 104, alignItems: 'flex-start' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  valueCell: { flex: 1 },
  valueCellStacked: { paddingTop: 8 },
  valueRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  inputTall: { minHeight: 80, textAlignVertical: 'top' },
  moneyInput: { flex: 1, fontSize: 19, fontWeight: '700', paddingVertical: 8, letterSpacing: -0.3 },
  affix: { fontSize: 15, fontWeight: '600', marginRight: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 4, height: 34, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '600' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  photoButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 4, height: 34, paddingHorizontal: 10 },
  photoButtonText: { fontSize: 13, fontWeight: '600' },
  photoThumb: { width: 56, height: 56, borderRadius: 4 },
  photoProgress: { marginHorizontal: 8 },
  error: { color: '#B42318', fontSize: 12, paddingBottom: 8 },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12 },
  ok: { borderRadius: 4, height: 52, alignItems: 'center', justifyContent: 'center' },
});
