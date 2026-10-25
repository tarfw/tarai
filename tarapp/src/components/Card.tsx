// The card rule: title, one number, one tap, right-aligned. At most one
// pending line. No chips, no second number, no url, no status.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import type { CardView } from '@/lib/tar';

export function Card({ card, onTap }: { card: CardView; onTap: (card: CardView) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.textSecondary }]}>{card.title.toUpperCase()}</Text>
      </View>
      {card.pendingLine ? <Text style={[styles.pending, { color: theme.textSecondary }]}>{card.pendingLine}</Text> : null}
      <View style={styles.row}>
        <Text style={[styles.number, { color: theme.text }]} numberOfLines={1}>{card.number ?? '—'}</Text>
        {card.tap.action ? (
          <TouchableOpacity accessibilityRole="button" style={[styles.tap, { backgroundColor: theme.primary }]} onPress={() => onTap(card)}>
            <Text style={styles.tapLabel}>{card.tap.label}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity accessibilityRole="button" style={[styles.tap, { backgroundColor: theme.primary }]} onPress={() => onTap(card)}>
            <Text style={styles.tapLabel}>{card.tap.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  pending: { fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  number: { fontSize: 24, fontWeight: '700', flexShrink: 1 },
  tap: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 },
  tapLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
