// SearchField: the one search pill. Filters live as you type; the × clears.

import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, TextInput, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function SearchField({ value, onChangeText, placeholder = 'Search', style }: { value: string; onChangeText: (text: string) => void; placeholder?: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.field, { borderColor: theme.border }, style]}>
      <Ionicons name="search" size={16} color={theme.textMuted} />
      <TextInput
        style={[styles.input, { color: theme.text }]}
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
          <Ionicons name="close-circle" size={16} color={theme.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, height: 38 },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
});
