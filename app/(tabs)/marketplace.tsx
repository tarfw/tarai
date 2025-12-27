import { View, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function Marketplace() {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ ...typography.title, color: colors.textPrimary }}>Marketplace (Deprecated)</Text>
    </View>
  );
}
