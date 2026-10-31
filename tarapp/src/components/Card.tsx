// The card rule: title, one number, one tap. At most one pending line.
// No chips, no second number, no url, no status, no verb label — every card
// opens its section, and creating happens inside that section's +. The canvas
// spends its one blue on the Ask bar.

import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { CardView } from '@/lib/tar';

export function Card({ card, onTap }: { card: CardView; onTap: (card: CardView) => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={card.number ? `${card.title}, ${card.number}` : card.title}
      onPress={() => onTap(card)}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}
    >
      <Text style={[styles.title, { color: theme.textSecondary }]} numberOfLines={1}>{card.title.toUpperCase()}</Text>
      {card.pendingLine ? <Text style={[styles.pending, { color: theme.textSecondary }]} numberOfLines={1}>{card.pendingLine}</Text> : null}
      {card.number ? <Text style={[styles.number, { color: theme.text }]} numberOfLines={1}>{card.number}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 4, minHeight: 108, paddingHorizontal: 18, paddingVertical: 16, gap: 6, justifyContent: 'space-between' },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  pending: { fontSize: 13 },
  number: { fontSize: 24, fontWeight: '700' },
});
