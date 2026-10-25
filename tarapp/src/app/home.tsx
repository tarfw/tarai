import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TarLogo } from '@/components/TarLogo';
import { useTheme } from '@/hooks/use-theme';

// Temporary door while the tarfw rebuild lands (Tiles 6-8 replace this with
// the Canvas). It only proves the session and offers the way out.
export default function Home() {
  const theme = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  return (
    <View style={[styles.page, { backgroundColor: theme.background, paddingTop: insets.top + 24 }]}>
      <TarLogo size={56} color={theme.primary} />
      <Text style={[styles.title, { color: theme.text }]}>TAR</Text>
      <Text style={[styles.note, { color: theme.textSecondary }]}>
        The new Canvas is being built. Sign out from Settings.
      </Text>
      <Text style={[styles.link, { color: theme.primary }]} onPress={() => router.push('/settings')}>Settings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', gap: 10 },
  title: { fontSize: 28, fontWeight: '800' },
  note: { fontSize: 13, paddingHorizontal: 32, textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '600', paddingTop: 18 },
});
