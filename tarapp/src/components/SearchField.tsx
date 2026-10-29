// SearchField: the one search pill. Filters live as you type; the × clears.
// flush: a full-width search strip on page white, closed by a hairline.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, TextInput, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function SearchField({ value, onChangeText, placeholder = 'Search', style, flush }: { value: string; onChangeText: (text: string) => void; placeholder?: string; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[flush ? [styles.flush, { backgroundColor: theme.background, borderBottomColor: theme.border }] : [styles.field, { borderColor: theme.border }], style]}>
      <Ionicons name="search" size={flush ? 18 : 16} color={theme.textMuted} />
      <TextInput
        style={[flush ? styles.flushInput : styles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value ? (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={flush ? 18 : 16} color={theme.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, height: 38 },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  flush: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  flushInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
});
