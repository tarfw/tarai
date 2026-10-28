// ActionSheet: one form, many configs. Fields come from the registry; the
// submit is an intent with its idempotency key. Rendered as a flat data list,
// backlog-style: label column on the left, value on the right, hairlines
// between rows, a small accent section header. Money is typed in rupees, tax
// in percent, selects are plain text options, photos are picked and uploaded.
// Focus turns the row accent; required fields gate Save; optional ones fold
// under More details.

import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/use-theme';
import { enqueue } from '@/lib/queue';
import { draftItem, uploadMedia } from '@/lib/tar';

export interface FieldConfig { key: string; label: string; kind: string; required?: boolean; hidden?: boolean; core?: boolean; icon?: string; defaultValue?: string; options?: string[] }

const GROUP_NAMES = ['Essentials', 'Details'];

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
  const [tab, setTab] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [aiFilled, setAiFilled] = useState<Record<string, boolean>>({});
  const aiRequested = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // tabbed groups instead of an expander: core fields first, the rest behind a second segment
  const groups = useMemo(() => (more.length ? [core, more] : [shown]), [core, more, shown]);

  const errors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const field of shown) {
      const problem = validate(field, values[field.key] ?? '');
      if (problem) map[field.key] = problem;
    }
    return map;
  }, [shown, values]);
  const canSave = Object.keys(errors).length === 0;
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
    console.warn('draft-item', trimmed, JSON.stringify(draft));
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
      // land the user on the tab that holds the first problem
      const first = shown.findIndex((field) => errors[field.key]);
      if (first >= 0 && groups.length > 1) setTab(first < groups[0].length ? 0 : 1);
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
    const accent = error ? '#B42318' : active ? theme.primary : theme.textMuted;
    const label = (
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: accent }, field.required && styles.labelRequired]}>{field.label}</Text>
        {aiFilled[field.key] ? <Ionicons name="sparkles" size={11} color={theme.primary} /> : null}
      </View>
    );
    let control: React.ReactNode;
    if (field.kind === 'money' || field.kind === 'percent') {
      const affix = field.kind === 'money' ? '₹' : '%';
      const affixFirst = field.kind === 'money';
      control = (
        <View style={styles.valueRow}>
          {affixFirst ? <Text style={[styles.affix, { color: active ? theme.primary : theme.textMuted }]}>{affix}</Text> : null}
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={value}
            onChangeText={(text) => set(field.key, text)}
            onFocus={() => setFocused(field.key)}
            onBlur={() => setFocused(null)}
            keyboardType="decimal-pad"
            placeholder="0.00"            placeholderTextColor={theme.textMuted}
          />
          {!affixFirst ? <Text style={[styles.affix, { color: active ? theme.primary : theme.textMuted }]}>{affix}</Text> : null}
        </View>
      );
    } else if (field.kind === 'photo') {
      control = (
        <View style={styles.valueRow}>
          {value ? <Image source={{ uri: value }} style={styles.photoThumb} /> : null}
          {uploading === field.key ? (
            <ActivityIndicator style={styles.photoProgress} />
          ) : (
            <View style={styles.optionWrap}>
              <TouchableOpacity accessibilityRole="button" style={styles.option} onPress={() => void pickPhoto(field, true)}>
                <Ionicons name="camera-outline" size={15} color={theme.primary} />
                <Text style={[styles.optionText, styles.optionSelected, { color: theme.primary }]}>{value ? 'Retake' : 'Camera'}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.option} onPress={() => void pickPhoto(field, false)}>
                <Ionicons name="images-outline" size={15} color={theme.primary} />
                <Text style={[styles.optionText, styles.optionSelected, { color: theme.primary }]}>Gallery</Text>
              </TouchableOpacity>
              {value ? (
                <TouchableOpacity accessibilityRole="button" style={styles.option} onPress={() => set(field.key, '')}>
                  <Ionicons name="trash-outline" size={15} color="#B42318" />
                  <Text style={[styles.optionText, styles.optionSelected, { color: '#B42318' }]}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      );
    } else {
      control = (
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.inputGrow, { color: theme.text }, field.kind === 'textarea' ? styles.inputTall : null]}
            value={value}
            onChangeText={(text) => set(field.key, text)}
            onFocus={() => setFocused(field.key)}
            onBlur={() => { setFocused(null); if (field.key === 'name') { if (draftTimer.current) clearTimeout(draftTimer.current); void maybeDraft(value); } }}
            keyboardType={field.kind === 'number' ? 'number-pad' : 'default'}
            autoCapitalize={field.kind === 'email' ? 'none' : 'sentences'}
            autoCorrect={false}
            multiline={field.kind === 'textarea'}
          />
          {field.key === 'name' ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fill with AI" style={styles.aiButton} onPress={() => { aiRequested.current = false; void maybeDraft(value); }}>
              <Ionicons name="sparkles" size={17} color={theme.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }
    return (
      <View key={field.key} style={[styles.row, { borderBottomColor: theme.border }]}>
        <View style={styles.labelCell}>{label}</View>
        <View style={styles.valueCell}>{control}</View>
      </View>
    );
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
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {groups.length > 1 ? (
            <View style={styles.tabRow}>
              {groups.map((group, index) => (
                <TouchableOpacity
                  key={index}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tab === index }}
                  style={styles.tab}
                  onPress={() => setTab(index)}
                >
                  <Text style={[styles.tabText, { color: tab === index ? theme.primary : theme.textMuted }, tab === index ? styles.tabTextOn : null]}>{GROUP_NAMES[index] ?? `Set ${index + 1}`}</Text>
                  <View style={[styles.tabUnderline, tab === index ? { backgroundColor: theme.primary } : null]} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <View style={[styles.list, { borderColor: theme.border }]}>
            {(groups[tab] ?? []).map(renderField)}
          </View>
        </ScrollView>
        <View style={[styles.actions, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border }]}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.ok, { backgroundColor: theme.primary, opacity: uploading ? 0.4 : 1 }]}
            onPress={() => void submit()}
            disabled={Boolean(uploading)}
          >
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
  form: { paddingHorizontal: 20, paddingBottom: 24 },
  tabRow: { flexDirection: 'row', gap: 26, marginTop: 10 },
  tab: { paddingVertical: 8 },
  tabText: { fontSize: 13, fontWeight: '400' },
  tabTextOn: { fontWeight: '700' },
  tabUnderline: { height: 2, marginTop: 5, borderRadius: 1 },
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 50, paddingVertical: 6 },
  labelCell: { width: 108, alignItems: 'flex-start' },
  labelWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 13, fontWeight: '400' },
  labelRequired: { fontWeight: '600' },
  valueCell: { flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  inputGrow: { flex: 1 },
  inputTall: { minHeight: 72, textAlignVertical: 'top' },
  affix: { fontSize: 15, fontWeight: '600', marginRight: 8 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', paddingVertical: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  optionText: { fontSize: 13 },
  optionSelected: { fontWeight: '700' },
  photoThumb: { width: 44, height: 44, borderRadius: 4, marginRight: 10 },
  photoProgress: { marginHorizontal: 8 },
  aiButton: { paddingLeft: 10, paddingVertical: 6 },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12 },
  ok: { borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
});
