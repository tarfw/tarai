// The way in: one sentence, one plan. Groq names it, Jev deals the cards,
// the plan is read-only. Flat by design.

import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { useThemeMode } from '@/hooks/use-theme-context';
import { useWorkspace } from '@/state/Workspace';
import { createWorkspace, me, planOnboarding, TarError, type OnboardingPlan } from '@/lib/tar';

type Stage = 'describe' | 'plan';

const NATURE_LABEL: Record<OnboardingPlan['nature'], string> = {
  food: 'Food and drink',
  shop: 'Shop',
  service: 'Service',
  general: 'General',
};

function fallbackName(words: string): string {
  const first = words.split(/[.\n]/)[0].replace(/\s+/g, ' ').trim();
  const short = first.length > 48 ? first.slice(0, 48).replace(/\s+\S*$/, '') : first;
  return short || 'My workspace';
}

export function Onboarding() {
  const theme = useTheme();
  const { resolvedScheme } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { refreshMe, select } = useWorkspace();
  const [stage, setStage] = useState<Stage>('describe');
  const [words, setWords] = useState('');
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [name, setName] = useState('');
  const [work, setWork] = useState<string[]>([]);
  const [personal, setPersonal] = useState<string[]>([]);
  const [busy, setBusy] = useState<'plan' | 'create' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameFocused, setNameFocused] = useState(false);

  const dark = resolvedScheme === 'dark';
  const ink = theme.text;
  const paper = dark ? theme.background : '#F6F5F2';
  const fieldBackground = dark ? theme.backgroundElement : '#FFFFFF';
  const hairline = dark ? theme.border : '#DCDBD7';
  const step = stage === 'describe' ? 1 : 2;
  const canContinue = words.trim().length >= 3 && busy === null;

  const makePlan = async () => {
    const text = words.trim();
    if (!text || busy !== null) return;
    setBusy('plan');
    setError(null);
    try {
      const result = await planOnboarding(text, '');
      setPlan(result);
      setName(result.name);
      setWork(result.work.length ? result.work : ['task']);
      setPersonal(result.personal.length ? result.personal : ['task']);
      setStage('plan');
    } catch (cause) {
      setError(cause instanceof TarError ? cause.message : 'Could not build a plan. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (busy !== null) return;
    setBusy('create');
    setError(null);
    try {
      const finalName = name.trim() || plan?.name || fallbackName(words);
      const selection = plan ? { cards: work, personalCards: personal, nature: plan.nature } : undefined;
      const created = await createWorkspace(finalName, words.trim(), selection);
      await refreshMe();
      let slug = created.workspace?.slug ?? '';
      if (!slug) {
        try {
          const fresh = await me();
          slug = fresh.workspaces.find((item) => item.mode === 'work')?.slug ?? '';
        } catch { /* the workspace list refreshes on the next open */ }
      }
      if (slug) select(slug);
    } catch (cause) {
      setError(cause instanceof TarError ? cause.message : 'Could not create the workspace. Try again.');
      setBusy(null);
    }
  };

  const titles = new Map(plan?.catalog.map((card) => [card.id, card.title]) ?? []);
  const chipTitle = (id: string) => titles.get(id) ?? id;

  return (
    <View style={{ flex: 1, backgroundColor: paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 18, paddingHorizontal: 24 }]}>
          {stage === 'plan' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              onPress={() => { setError(null); setStage('describe'); }}
              style={styles.back}
            >
              <Ionicons name="arrow-back" size={19} color={ink} />
            </Pressable>
          ) : <View style={styles.back} />}
          <View style={styles.progress}>
            {[1, 2].map((item) => (
              <View
                key={item}
                style={[styles.segment, { backgroundColor: item === step ? ink : dark ? theme.backgroundSelected : '#E3E2DF' }]}
              />
            ))}
          </View>
          <View style={styles.back} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {stage === 'describe' ? (
            <View>
              <Text style={[styles.title, { color: ink }]}>What do{'\n'}you do?</Text>
              <Text style={[styles.lede, { color: theme.textSecondary }]}>One line. We handle the rest.</Text>
              <TextInput
                style={[styles.field, { borderColor: hairline, backgroundColor: fieldBackground, color: ink }]}
                placeholder="A studio, shop or service — what you sell and who buys it."
                placeholderTextColor={theme.textMuted}
                value={words}
                onChangeText={setWords}
                multiline
                autoFocus
                maxLength={600}
                textAlignVertical="top"
                accessibilityLabel="Describe what you do"
              />
              {error ? (
                <View>
                  <Text style={styles.error}>{error}</Text>
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void create()}>
                    <Text style={[styles.retry, { color: theme.textSecondary }]}>Create without a plan</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {stage === 'plan' && plan ? (
            <View>
              <Text style={[styles.title, { color: ink }]}>Your{'\n'}workspace</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                maxLength={40}
                accessibilityLabel="Workspace name"
                style={[styles.planName, { color: ink, borderBottomColor: nameFocused ? ink : 'transparent' }]}
              />
              <Text style={[styles.summary, { color: theme.textSecondary }]}>{plan.summary}</Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {NATURE_LABEL[plan.nature]} · {Math.round(plan.confidence * 100)}%
              </Text>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Business</Text>
              <View style={styles.cardChips}>
                {work.map((id) => (
                  <View key={id} style={[styles.cardChip, { borderColor: hairline }]}>
                    <Text style={[styles.cardChipText, { color: ink }]}>{chipTitle(id)}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Personal</Text>
              <View style={styles.cardChips}>
                {personal.map((id) => (
                  <View key={id} style={[styles.cardChip, { borderColor: hairline }]}>
                    <Text style={[styles.cardChipText, { color: ink }]}>{chipTitle(id)}</Text>
                  </View>
                ))}
              </View>

              {error ? (
                <View>
                  <Text style={styles.error}>{error}</Text>
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void create()}>
                    <Text style={[styles.retry, { color: theme.textSecondary }]}>Try again</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null || (stage === 'describe' && !canContinue)}
            onPress={() => { if (stage === 'describe') void makePlan(); else void create(); }}
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: stage === 'describe' && !canContinue ? (dark ? theme.backgroundSelected : '#D6D5D1') : ink,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            {busy !== null ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <Text style={[styles.primaryText, { color: stage === 'describe' && !canContinue ? theme.textMuted : theme.background }]}>
                {stage === 'describe' ? 'Next' : 'Create workspace'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 },
  back: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginLeft: -4 },
  progress: { flexDirection: 'row', gap: 6 },
  segment: { width: 64, height: 3, borderRadius: 2 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 56 },
  title: { fontSize: 42, lineHeight: 44, fontWeight: '800', letterSpacing: -1.6 },
  lede: { fontSize: 15, lineHeight: 22, fontWeight: '500', marginTop: 14, maxWidth: 330 },
  field: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 118,
    marginTop: 34,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
  },
  planName: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
  },
  summary: { fontSize: 15, lineHeight: 22, fontWeight: '500', marginTop: 10 },
  meta: { fontSize: 12.5, fontWeight: '600', marginTop: 10 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', marginTop: 26, marginBottom: 9 },
  cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  cardChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  cardChipText: { fontSize: 13, fontWeight: '500' },
  error: { marginTop: 14, fontSize: 13, lineHeight: 18, fontWeight: '500', color: '#B42318' },
  retry: { marginTop: 10, fontSize: 13.5, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  primary: { minWidth: 132, height: 52, borderRadius: 2, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
});
