// Ask: the personal agent, fullscreen, one long conversation.
// words -> (a card, a question, or a plan) -> one confirm. The core cards are
// matched by name first; a job no card covers comes back as a plan or a plain
// question. Flat like the rest: a hairline header, 4px turns, an opaque bar.

import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { confirmCard, planCard, TarError, type PlanTurn } from '@/lib/tar';
import { TarAvatar } from '@/components/TarAvatar';
import { AGENT_NAME } from '@/lib/agent';

// The chat-app mic: a rounded capsule sitting in a U-shaped stand with a short
// stem. Ionicons only has a flat base line, so this is drawn from three Views —
// a bordered capsule and three borders with rounded bottom corners for the arc.
// No icon package, no svg, scales off `size` alone.
function MicIcon({ size = 22, color }: { size?: number; color: string }) {
  const stroke = Math.max(1.2, size * 0.068);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          top: size * 0.1,
          left: (size - size * 0.28) / 2,
          width: size * 0.28,
          height: size * 0.4,
          borderRadius: size * 0.14,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.4,
          left: (size - size * 0.58) / 2,
          width: size * 0.58,
          height: size * 0.34,
          borderLeftWidth: stroke,
          borderRightWidth: stroke,
          borderBottomWidth: stroke,
          borderColor: color,
          borderBottomLeftRadius: size * 0.29,
          borderBottomRightRadius: size * 0.29,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.72,
          left: (size - stroke) / 2,
          width: stroke,
          height: size * 0.12,
          borderRadius: stroke / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

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
      const plan = await planCard(current.slug, text, history) as any;
      if (plan.kind === 'card') {
        setTurns((previous) => [...previous, { who: 'tar', text: `PLAN\n${plan.changes.join('\n')}\nConfirm once and the card is on Home.`, confirm: { kind: 'card', add: plan.add, remove: plan.remove } }]);
        return;
      }
      if (plan.kind === 'skill') {
        const lines = plan.draft.preview?.length ? plan.draft.preview : plan.draft.steps.map((step: { action: string }) => step.action);
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
  // one slot, two states: mic while empty, arrow once there are words. Voice is
  // not wired yet, so the mic only says so and never touches a draft.
  const micOnly = !words.trim();
  const pressSlot = () => {
    if (micOnly) {
      Alert.alert('Voice', 'Voice input is coming. Type for now.');
      return;
    }
    void send();
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      {/* the agent alone: mascot + its name, small, left edge. No back text. */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TarAvatar size={24} bgColor={theme.primary} eyeColor="#fff" />
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{AGENT_NAME.toLowerCase()}</Text>
      </View>
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

      <KeyboardStickyView style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: theme.background }]}>
        {/* one surface holds the words and the one action, the way a chat app
            does: no gap between them, the button sits inside the bar */}
        <View style={[styles.composer, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Ask anything"
            placeholderTextColor={theme.textSecondary}
            value={words}
            onChangeText={setWords}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
          />
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.send, { backgroundColor: canSend ? theme.primary : 'transparent' }]}
            onPress={pressSlot}
            disabled={!canSend && busy}
            accessibilityLabel={micOnly ? 'Voice input' : 'Send'}
          >
            {/* mic reads as a real control, not a disabled hint: full-strength
                ink at chat-app weight, the way ChatGPT and Gemini draw it */}
            {micOnly ? (
              <MicIcon size={22} color={theme.text} />
            ) : (
              <Ionicons name="arrow-up" size={20} color={canSend ? '#fff' : theme.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },

  talk: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  turnYou: { alignSelf: 'flex-end', borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12, maxWidth: '80%', gap: 6 },
  turnTar: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12, maxWidth: '88%', gap: 8 },
  youText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  tarText: { fontSize: 15, lineHeight: 21 },
  plan: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  confirmTap: { alignSelf: 'flex-start', borderRadius: 4, height: 44, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderRadius: 4, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, minHeight: 40, maxHeight: 120, fontSize: 15, paddingTop: 10, paddingBottom: 10 },
  send: { width: 40, height: 40, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});
