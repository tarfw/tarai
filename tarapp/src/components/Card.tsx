// The card rule: two fixed lines. Header = what + when, figure alone below so it
// always starts at the same x and never pushes the words. One tap, one number.
// No chips, no second number, no url, no status, no verb label — every card
// opens its section, and creating happens inside that section's +. The canvas
// spends its one blue on the Ask bar.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { CardView } from '@/lib/tar';

export function Card({ card, onTap }: { card: CardView; onTap: (card: CardView) => void }) {
  const theme = useTheme();
  const header = [card.title, card.pendingLine].filter(Boolean).join(' ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={card.number ? `${header}, ${card.number}` : header}
      onPress={() => onTap(card)}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}
    >
      {/* the header carries both words so the figure can own the left edge alone */}
      <View style={styles.headRow}>
        <Text style={[styles.title, { color: theme.textSecondary }]} numberOfLines={1}>{card.title.toUpperCase()}</Text>
        {card.pendingLine ? (
          <Text style={[styles.qualifier, { color: theme.textMuted }]} numberOfLines={1}>{card.pendingLine.toUpperCase()}</Text>
        ) : null}
      </View>
      {card.number ? <Text style={[styles.number, { color: theme.text }]} numberOfLines={1}>{card.number}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 4, minHeight: 84, paddingHorizontal: 18, paddingVertical: 14, gap: 8, justifyContent: 'space-between' },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 1, flexShrink: 1 },
  qualifier: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  number: { fontSize: 24, fontWeight: '700' },
});
