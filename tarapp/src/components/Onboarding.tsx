// The way in: three cases, one confirm, one surface. Before the first card,
// this IS the app. CREATE a sentence. JOIN an invite. The pick follows birth.

import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { createWorkspace, me, TarError } from '@/lib/tar';

export function Onboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshMe, select } = useWorkspace();
  const [stage, setStage] = useState<'first' | 'plan'>('first');
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const text = words.trim();
    if (!text) return;
    setBusy(true); setError(null);
    try {
      // one sentence -> birth: Jev names the nature, code deals the cards
      const name = text.split(/[.,\n]/)[0].trim().slice(0, 60) || 'My Workspace';
      await createWorkspace(name, text);
      await refreshMe();
      const fresh = await me();
      select(fresh.workspaces.filter((ws) => ws.mode === 'work')[0]?.slug ?? '');
    } catch (cause) {
      setError(cause instanceof TarError ? cause.message : 'Birth failed. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.background, paddingTop: insets.top + 60 }]}>
      <Text style={[styles.logo, { color: theme.text }]}>TAR</Text>
      {stage === 'first' ? (
        <>
          <Text style={[styles.prompt, { color: theme.text }]}>tell TAR about your business in one line</Text>
          <TouchableOpacity accessibilityRole="button" style={[styles.door, { borderColor: theme.primary }]} onPress={() => setStage('plan')}>
            <Text style={{ color: theme.primary, fontWeight: '700' }}>I will describe it</Text>
          </TouchableOpacity>
          <View style={[styles.door, { borderColor: theme.border }]}>
            <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>I have an invite</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, paddingTop: 4, textAlign: 'center' }}>sign in with the invited email and the workspace is waiting</Text>
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.prompt, { color: theme.text }]}>one sentence</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            placeholder="tea shop. snacks to go. just me."
            placeholderTextColor={theme.textSecondary}
            value={words}
            onChangeText={setWords}
            multiline
            autoFocus
          />
          {error ? <Text style={{ color: '#B42318', fontSize: 13 }}>{error}</Text> : null}
          <TouchableOpacity accessibilityRole="button" style={[styles.go, { backgroundColor: words.trim() ? theme.primary : theme.border }]} disabled={!words.trim() || busy} onPress={() => void create()}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Create</Text>}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => setStage('first')}><Text style={{ color: theme.textSecondary, padding: 12 }}>back</Text></TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', paddingHorizontal: 28, gap: 18 },
  logo: { fontSize: 34, fontWeight: '900' },
  prompt: { fontSize: 16, textAlign: 'center' },
  door: { borderWidth: 1, borderRadius: 14, padding: 16, width: '100%', alignItems: 'center', gap: 4 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, width: '100%', minHeight: 90, fontSize: 15, textAlignVertical: 'top' },
  go: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 44 },
});
