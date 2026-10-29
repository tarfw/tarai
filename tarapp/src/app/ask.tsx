// Ask: the personal agent, fullscreen, one long conversation.
// words -> plan -> one confirm -> card (a change to the stack, or a new skill).

import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { ask as askTAR, confirmCard, confirmSkill, planCard } from '@/lib/tar';

type Draft = { title: string; words: string; trigger: Record<string, unknown>; steps: { action: string; input: Record<string, unknown>; auto?: boolean }[]; shape: string };
type Confirmable =
  | { kind: 'card'; add: string[]; remove: string[] }
  | { kind: 'draft'; draft: Draft; via: 'card' | 'skill' };
interface Turn { who: 'you' | 'tar'; text: string; confirm?: Confirmable }

export default function AskScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { current, refreshSlice } = useWorkspace();
  const [turns, setTurns] = useState<Turn[]>([{ who: 'tar', text: 'Tell me what should happen: a card to add, or work to run.' }]);
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const send = async () => {
    const text = words.trim();
    if (!text || !current || busy) return;
    setWords('');
    setTurns((previous) => [...previous, { who: 'you', text }]);
    setBusy(true);
    try {
      // Cards are the owner's stack: Ask plans the change first, one confirm applies it.
      if (current.role === 'owner' || current.role === 'admin') {
        const plan = await planCard(current.slug, text);
        if (plan.kind === 'card') {
          setTurns((previous) => [...previous, { who: 'tar', text: `PLAN\n${plan.changes.join('\n')}\nConfirm once and the card is on Home.`, confirm: { kind: 'card', add: plan.add, remove: plan.remove } }]);
          return;
        }
        if (plan.kind === 'skill') {
          setTurns((previous) => [...previous, { who: 'tar', text: `PLAN\nCustom card · ${plan.draft.title}\nConfirm once and the card is on Home.`, confirm: { kind: 'draft', draft: plan.draft, via: 'card' } }]);
          return;
        }
      }
      const outcome = await askTAR(current.slug, text);
      if (outcome.skill) {
        setTurns((previous) => [...previous, { who: 'tar', text: `I remember this: ${outcome.skill!.title}. Tap its card on Home.` }]);
      } else if (outcome.draft) {
        const plan = outcome.draft.steps.map((step, index) => `${index + 1}. ${step.action}${step.auto ? ' (auto)' : ''}`).join('\n');
        setTurns((previous) => [...previous, { who: 'tar', text: `PLAN ${outcome.draft!.title}\n${plan}\nConfirm once and it runs free forever.`, confirm: { kind: 'draft', draft: outcome.draft!, via: 'skill' } }]);
      } else {
        setTurns((previous) => [...previous, { who: 'tar', text: 'I have no plan for that yet.' }]);
      }
    } catch {
      setTurns((previous) => [...previous, { who: 'tar', text: 'That did not reach the workspace. Try again.' }]);
    } finally { setBusy(false); }
  };

  const confirm = async (outcome: Confirmable) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      if (outcome.kind === 'card') await confirmCard(current.slug, { add: outcome.add, remove: outcome.remove });
      else if (outcome.via === 'card') await confirmCard(current.slug, { draft: outcome.draft });
      else await confirmSkill(current.slug, outcome.draft as unknown as Record<string, unknown>);
      setTurns((previous) => [...previous, { who: 'tar', text: 'Done. It is on Home.' }]);
      await refreshSlice();
      router.back();
    } catch {
      setTurns((previous) => [...previous, { who: 'tar', text: 'The confirm failed. Try again.' }]);
    } finally { setBusy(false); }
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <ScrollView
        ref={scroller}
        contentContainerStyle={[styles.talk, { paddingTop: insets.top + 82, paddingBottom: insets.bottom + 112 }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
      >
        {turns.map((turn, index) => (
          <View key={index} style={turn.who === 'you' ? [styles.bubbleYou, { backgroundColor: theme.primary }] : [styles.bubbleTar, { backgroundColor: theme.backgroundElement }]}>
            <Text style={turn.who === 'you' ? styles.youText : { color: theme.text }}>{turn.text}</Text>
            {turn.confirm ? (
              <TouchableOpacity accessibilityRole="button" style={[styles.confirmTap, { backgroundColor: theme.primary }]} disabled={busy} onPress={() => void confirm(turn.confirm!)}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
        {busy ? <Text style={{ color: theme.textSecondary, padding: 8 }}>thinking…</Text> : null}
      </ScrollView>

      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 10 }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" style={[styles.circle, { backgroundColor: theme.backgroundElement }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.pillText, { color: theme.text }]} numberOfLines={1}>{current?.mode === 'personal' ? 'Personal' : current?.name ?? 'Ask TAR'}</Text>
        </View>
        <View style={styles.circle} />
      </View>

      <KeyboardStickyView style={[styles.composerWrap, { paddingBottom: insets.bottom + 10 }]}>
        <View style={[styles.composer, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Message TAR"
            placeholderTextColor={theme.textSecondary}
            value={words}
            onChangeText={setWords}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
          />
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.send, { backgroundColor: words.trim() && !busy ? theme.primary : theme.border }]}
            onPress={() => void send()}
            disabled={busy || !words.trim()}
            accessibilityLabel="Send"
          >
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  talk: { paddingHorizontal: 16, gap: 10 },
  bubbleYou: { alignSelf: 'flex-end', borderRadius: 18, padding: 12, maxWidth: '80%' },
  youText: { color: '#fff' },
  bubbleTar: { alignSelf: 'flex-start', borderRadius: 18, padding: 12, maxWidth: '86%', gap: 10 },
  confirmTap: { alignSelf: 'flex-end', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18 },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 22, height: 44, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', maxWidth: '62%' },
  pillText: { fontSize: 15, fontWeight: '700' },
  composerWrap: { position: 'absolute', left: 12, right: 12, bottom: 0 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderRadius: 26, paddingLeft: 18, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontSize: 16, maxHeight: 120, paddingTop: 10, paddingBottom: 10 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
