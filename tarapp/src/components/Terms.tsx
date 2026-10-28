// The front door: what Tar is and what you agree to. Read once, then the
// workspace asks its one question. Flat by design, no halos.

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useThemeMode } from '@/hooks/use-theme-context';

// The tar mark, drawn from the same 7×7 grid as the app icon.
const MARK = ['XX...XX', '.XXXXX.', 'XXXXXXX', 'XX.X.XX', 'XXXXXXX', 'XXXXXXX', 'X..X..X', '...X...'];

const TERMS = [
  'Tar keeps your day on one canvas: personal lists, shop items, orders, bills and payments. Open it, see what is next, tap once.',
  'Your data stays yours. We store what you enter and never sell it. Delete a workspace and it is gone.',
  'Use it honestly: real goods, lawful sales, no spam or harmful listings. What you record is your responsibility.',
  'By continuing, you agree to these terms and to our privacy practices.',
];

function Mark({ size, color }: { size: number; color: string }) {
  const cell = size / 7;
  return (
    <View style={{ width: size, height: (size / 7) * 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {MARK.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row', height: cell }}>
          {[...row].map((value, x) => (
            <View key={x} style={{ width: cell, height: cell, backgroundColor: value === 'X' ? color : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function Terms({ onAccept }: { onAccept: () => Promise<void> }) {
  const theme = useTheme();
  const { resolvedScheme } = useThemeMode();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const dark = resolvedScheme === 'dark';
  const ink = theme.text;
  const paper = dark ? theme.background : '#F6F5F2';
  const hairline = dark ? theme.border : '#DCDBD7';

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    await onAccept();
  };

  return (
    <View style={{ flex: 1, backgroundColor: paper }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 34, paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Mark size={56} color={dark ? '#9C8BE6' : '#392878'} />
        <Text style={[styles.eyebrow, { color: theme.textSecondary }]}>WELCOME TO TAR</Text>
        <Text style={[styles.title, { color: ink }]}>Your everyday,{'\n'}one canvas</Text>
        <Text style={[styles.subtitle, { color: ink }]}>Personal, shop, site and orders.</Text>

        <View style={styles.body}>
          {TERMS.map((line) => (
            <Text key={line} style={[styles.paragraph, { color: theme.textSecondary }]}>{line}</Text>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14, borderTopColor: hairline }]}>
        <Text style={[styles.ready, { color: theme.textSecondary }]}>Ready to begin?</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agree and continue"
          disabled={busy}
          onPress={() => void accept()}
          style={({ pressed }) => [styles.primary, { backgroundColor: ink, opacity: pressed ? 0.82 : 1 }]}
        >
          {busy ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <Text style={[styles.primaryText, { color: theme.background }]}>Agree and continue</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 24 },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 1.6, marginTop: 30 },
  title: { fontSize: 46, lineHeight: 48, fontWeight: '800', letterSpacing: -1.8, marginTop: 14 },
  subtitle: { fontSize: 22, lineHeight: 28, fontWeight: '500', letterSpacing: -0.4, marginTop: 12 },
  body: { marginTop: 30 },
  paragraph: { fontSize: 15, lineHeight: 23, fontWeight: '400', marginBottom: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  ready: { flex: 1, fontSize: 14, fontWeight: '500' },
  primary: { minWidth: 168, height: 52, borderRadius: 2, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
});
