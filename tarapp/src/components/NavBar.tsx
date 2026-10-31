// The one nav bar: back on the left, title centered, an optional single
// action on the right (the section's +). Every pushed screen uses this.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';

export function NavBar({ title, onBack, backLabel = 'Back', trailing }: { title: string; onBack: () => void; backLabel?: string; trailing?: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
      <View style={styles.side}>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} accessibilityLabel="Back" hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}>
          <Text style={[styles.back, { color: theme.primary }]}>{backLabel}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      <View style={[styles.side, styles.trailing]}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  side: { minWidth: 78, alignItems: 'flex-start' },
  trailing: { alignItems: 'flex-end' },
  back: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center', letterSpacing: -0.2 },
});
