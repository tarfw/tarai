// Ask: the personal agent, fullscreen, one long conversation.
// words -> (a card, a question, or a plan) -> one confirm. The core cards are
// matched by name first; a job no card covers comes back as a plan or a plain
// question. Flat like the rest: a hairline header, 4px turns, an opaque bar.

import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { confirmCard, planCard, TarError, type PlanTurn } from '@/lib/tar';
import { NavBar } from '@/components/NavBar';

type Draft = { title: string; words: string; trigger: Record<string, unknown>; steps: { action: string; input: Record<string, unknown>; auto?: boolean }[]; shape: string; preview?: string[] };
type Confirmable =
  | { kind: 'card'; add: string[]; remove: string[] }
  | { kind: 'draft'; draft: Draft };
interface Turn { who: 'you' | 'tar'; text: string; confirm?: Confirmable }

export default function AskScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { current, refreshSlice } = useWorkspace();
  const [turns, setTurns] = useState<Turn[]>([{ who: 'tar', text: 'Name the card to add, or describe a job and I will plan it.' }]);
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const send = async () => {
    const text = words.trim();
    if (!text || !current || busy) return;
    setWords('');
    // the conversation so far lets TAR finish a thought another turn later
    const history: PlanTurn[] = turns.slice(-6).map((turn) => ({ who: turn.who, text: turn.text }));
    setTurns((previous) => [...previous, { who: 'you', text }]);
    setBusy(true);
    try {
      if (current.role !== 'owner' && current.role !== 'admin') {
        setTurns((previous) => [...previous, { who: 'tar', text: 'The owner keeps the cards. Ask them to add it.' }]);
        return;
      }
      const plan = await planCard(current.slug, text, history);
      if (plan.kind === 'card') {
        setTurns((previous) => [...previous, { who: 'tar', text: `PLAN\n${plan.changes.join('\n')}\nConfirm once and the card is on Home.`, confirm: { kind: 'card', add: plan.add, remove: plan.remove } }]);
        return;
      }
      if (plan.kind === 'skill') {
        const lines = plan.draft.preview?.length ? plan.draft.preview : plan.draft.steps.map((step) => step.action);
        setTurns((previous) => [...previous, { who: 'tar', text: `PLAN ${plan.draft.title}\n${lines.join('\n')}\nConfirm once and the card is on Home.`, confirm: { kind: 'draft', draft: plan.draft } }]);
        return;
      }
      if (plan.kind === 'known') {
        setTurns((previous) => [...previous, { who: 'tar', text: plan.message }]);
        return;
      }
      if (plan.kind === 'question') {
        setTurns((previous) => [...previous, { who: 'tar', text: plan.text }]);
        return;
      }
      setTurns((previous) => [...previous, { who: 'tar', text: plan.reason ?? 'I cannot plan that yet. Try naming the work in a few more words.' }]);
    } catch (cause) {
      // the worker's own words when it refused, never a dead end
      const refusal = cause instanceof TarError && cause.status < 500 && cause.message.trim() ? cause.message : '';
      setTurns((previous) => [...previous, { who: 'tar', text: refusal || 'That did not reach the workspace. Try again.' }]);
    } finally { setBusy(false); }
  };

  const confirm = async (outcome: Confirmable) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      if (outcome.kind === 'card') await confirmCard(current.slug, { add: outcome.add, remove: outcome.remove });
      else await confirmCard(current.slug, { draft: outcome.draft });
      setTurns((previous) => [...previous, { who: 'tar', text: 'Done. It is on Home.' }]);
      await refreshSlice();
      router.back();
    } catch {
      setTurns((previous) => [...previous, { who: 'tar', text: 'The confirm failed. Try again.' }]);
    } finally { setBusy(false); }
  };

  const canSend = Boolean(words.trim()) && !busy;

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <NavBar title={current?.mode === 'personal' ? 'Personal' : current?.name ?? 'Ask TAR'} onBack={() => router.back()} />
      <ScrollView
        ref={scroller}
        contentContainerStyle={[styles.talk, { paddingBottom: insets.bottom + 96 }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
      >
        {turns.map((turn, index) => {
          const [head, ...rest] = turn.text.split('\n');
          const planned = head === 'PLAN' || head.startsWith('PLAN ');
          const body = planned ? [head.replace(/^PLAN ?/, ''), ...rest].filter(Boolean).join('\n') : turn.text;
          return (
            <View key={index} style={turn.who === 'you' ? [styles.turnYou, { backgroundColor: theme.primary }] : [styles.turnTar, { backgroundColor: theme.backgroundElement }]}>
              {planned ? <Text style={[styles.plan, { color: turn.who === 'you' ? 'rgba(255,255,255,0.75)' : theme.primary }]}>PLAN</Text> : null}
              <Text style={turn.who === 'you' ? styles.youText : [styles.tarText, { color: theme.text }]}>{body}</Text>
              {turn.confirm ? (
                <TouchableOpacity accessibilityRole="button" style={[styles.confirmTap, { backgroundColor: theme.primary }]} disabled={busy} onPress={() => void confirm(turn.confirm!)}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Confirm</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
        {busy ? <Text style={{ color: theme.textSecondary, fontSize: 13, paddingHorizontal: 4 }}>thinking…</Text> : null}
      </ScrollView>

      <KeyboardStickyView style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border, backgroundColor: theme.background }]}>
        <View style={styles.composer}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
            placeholder="Message TAR"
            placeholderTextColor={theme.textSecondary}
            value={words}
            onChangeText={setWords}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
          />
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.send, { backgroundColor: canSend ? theme.primary : theme.backgroundSelected }]}
            onPress={() => void send()}
            disabled={!canSend}
            accessibilityLabel="Send"
          >
            <Ionicons name="arrow-up" size={20} color={canSend ? '#fff' : theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  talk: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  turnYou: { alignSelf: 'flex-end', borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12, maxWidth: '80%', gap: 6 },
  turnTar: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12, maxWidth: '88%', gap: 8 },
  youText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  tarText: { fontSize: 15, lineHeight: 21 },
  plan: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  confirmTap: { alignSelf: 'flex-start', borderRadius: 4, height: 44, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderRadius: 4, paddingHorizontal: 14, minHeight: 48, maxHeight: 120, fontSize: 15, paddingTop: 12, paddingBottom: 12 },
  send: { width: 48, height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});
