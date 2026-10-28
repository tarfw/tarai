// The card rule: title, one number, one tap, right-aligned. At most one
// pending line. No chips, no second number, no url, no status. The card is
// the button; the tap is a quiet label — the canvas spends its one blue on
// the Ask FAB.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { CardView } from '@/lib/tar';

export function Card({ card, onTap }: { card: CardView; onTap: (card: CardView) => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.title}, ${card.number ?? ''}, ${card.tap.label}`}
      onPress={() => onTap(card)}
      style={({ pressed }) => [styles.card, { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : theme.background }]}
    >
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.textSecondary }]}>{card.title.toUpperCase()}</Text>
      </View>
      {card.pendingLine ? <Text style={[styles.pending, { color: theme.textSecondary }]}>{card.pendingLine}</Text> : null}
      <View style={styles.row}>
        <Text style={[styles.number, { color: theme.text }]} numberOfLines={1}>{card.number ?? '—'}</Text>
        <Text style={[styles.tapLabel, { color: theme.textSecondary }]} numberOfLines={1}>{card.tap.label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  pending: { fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  number: { fontSize: 24, fontWeight: '700', flexShrink: 1 },
  tapLabel: { fontSize: 13, fontWeight: '600', flexShrink: 0 },
});
