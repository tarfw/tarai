// The one nav bar: back on the left, title centered, right stays open.
// Every pushed screen uses this; modals keep plain Cancel per iOS.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';

export function NavBar({ title, onBack, backLabel = 'Home' }: { title: string; onBack: () => void; backLabel?: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
      <View style={styles.side}>
        <TouchableOpacity accessibilityRole="button" onPress={onBack} accessibilityLabel="Back" hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}>
          <Text style={{ color: theme.primary, fontSize: 17 }}>{backLabel}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  side: { minWidth: 78, alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },
});
