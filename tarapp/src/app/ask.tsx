// Ask: the personal agent, fullscreen, one long conversation.
// words -> plan -> one confirm -> skill -> card.

import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { ask as askTAR, confirmSkill } from '@/lib/tar';

interface Turn { who: 'you' | 'tar'; text: string; draft?: { title: string; words: string; trigger: Record<string, unknown>; steps: { action: string; input: Record<string, unknown>; auto?: boolean }[]; shape: string } }

export default function AskScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { current, refreshSlice } = useWorkspace();
  const [turns, setTurns] = useState<Turn[]>([{ who: 'tar', text: 'Tell me what should happen. I propose plans from your tools only.' }]);
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
      const outcome = await askTAR(current.slug, text);
      if (outcome.skill) {
        setTurns((previous) => [...previous, { who: 'tar', text: `I remember this: ${outcome.skill!.title}. Tap its card on the Canvas.` }]);
      } else if (outcome.draft) {
        const plan = outcome.draft.steps.map((step, index) => `${index + 1}. ${step.action}${step.auto ? ' (auto)' : ''}`).join('\n');
        setTurns((previous) => [...previous, { who: 'tar', text: `PLAN ${outcome.draft!.title}\n${plan}\nConfirm once and it runs free forever.`, draft: outcome.draft! }]);
      }
    } catch {
      setTurns((previous) => [...previous, { who: 'tar', text: 'That did not reach the workspace. Try again.' }]);
    } finally { setBusy(false); }
  };

  const confirm = async (draft: NonNullable<Turn['draft']>) => {
    if (!current) return;
    setBusy(true);
    try {
      await confirmSkill(current.slug, draft as unknown as Record<string, unknown>);
      setTurns((previous) => [...previous, { who: 'tar', text: 'Saved as a skill. The card is on your Canvas.' }]);
      await refreshSlice();
      router.back();
    } catch {
      setTurns((previous) => [...previous, { who: 'tar', text: 'The confirm failed. Try again.' }]);
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} accessibilityLabel="Back"><Text style={{ color: theme.primary, fontSize: 15 }}>&lt; TAR</Text></TouchableOpacity>
      </View>
      <ScrollView ref={scroller} contentContainerStyle={[styles.talk, { paddingTop: 16 }]} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
        {turns.map((turn, index) => (
          <View key={index} style={turn.who === 'you' ? [styles.bubbleYou, { backgroundColor: theme.primary }] : [styles.bubbleTar, { borderColor: theme.border }]}>
            <Text style={turn.who === 'you' ? styles.youText : { color: theme.text }}>{turn.text}</Text>
            {turn.draft ? (
              <TouchableOpacity accessibilityRole="button" style={[styles.confirmTap, { backgroundColor: theme.primary }]} disabled={busy} onPress={() => void confirm(turn.draft!)}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
        {busy ? <Text style={{ color: theme.textSecondary, padding: 8 }}>thinking…</Text> : null}
      </ScrollView>
      <View style={[styles.composer, { paddingBottom: insets.bottom + 10, borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          placeholder="ask TAR anything…"
          placeholderTextColor={theme.textSecondary}
          value={words}
          onChangeText={setWords}
          onSubmitEditing={() => void send()}
          returnKeyType="send"
        />
        <TouchableOpacity accessibilityRole="button" style={[styles.send, { backgroundColor: theme.primary }]} onPress={() => void send()} disabled={busy} accessibilityLabel="Send">
          <Text style={{ color: '#fff', fontWeight: '700' }}>send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  talk: { paddingHorizontal: 16, gap: 10, paddingBottom: 16 },
  bubbleYou: { alignSelf: 'flex-end', borderRadius: 16, borderBottomRightRadius: 4, padding: 12, maxWidth: '80%' },
  youText: { color: '#fff' },
  bubbleTar: { alignSelf: 'flex-start', borderRadius: 16, borderBottomLeftRadius: 4, padding: 12, maxWidth: '86%', borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  confirmTap: { alignSelf: 'flex-end', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18 },
  composer: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  send: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
});
