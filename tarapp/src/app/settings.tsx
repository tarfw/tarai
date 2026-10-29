import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TarLogo } from '@/components/TarLogo';
import { useTheme } from '@/hooks/use-theme';
import { useThemeMode } from '@/hooks/use-theme-context';
import { getCurrentUser, signOutGoogle, type UserProfile } from '@/lib/auth';
import { useAgentName } from '@/lib/agent';

export default function SettingsScreen() {
  const router = useRouter(); const theme = useTheme(); const insets = useSafeAreaInsets();
  const agentName = useAgentName();
  const { themeMode, setThemeMode } = useThemeMode(); const [user, setUser] = useState<UserProfile | null>(null);
  useEffect(() => { void getCurrentUser().then(setUser); }, []);
  const signOut = async () => {
    await signOutGoogle(); router.replace('/auth');
  };
  return <View style={[styles.page, { backgroundColor: theme.background }]}>
    <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.icon}><Ionicons name="chevron-back" size={24} color={theme.primary} /></TouchableOpacity>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
    </View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>APPEARANCE</Text>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')} style={styles.row}>
          <View style={styles.rowLabel}><Ionicons name={themeMode === 'light' ? 'sunny-outline' : 'moon-outline'} size={18} color={theme.primary} /><Text style={[styles.rowText, { color: theme.text }]}>Theme</Text></View>
          <Text style={[styles.value, { color: theme.textSecondary }]}>{themeMode === 'light' ? 'Light' : 'Dark'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.label, { color: theme.textSecondary }]}>PERSONAL AGENT</Text>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.row}>
          <View style={styles.rowLabel}><Ionicons name="sparkles-outline" size={18} color={theme.primary} /><Text style={[styles.rowText, { color: theme.text }]}>Agent name</Text></View>
          <Text style={[styles.value, { color: theme.textSecondary }]}>{agentName}</Text>
        </View>
      </View>
      {user ? <>
        <Text style={[styles.label, { color: theme.textSecondary }]}>ACCOUNT</Text>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.identity}><Text style={[styles.rowText, { color: theme.text }]}>{user.name || 'User'}</Text><Text style={[styles.value, { color: theme.textSecondary }]}>{user.email}</Text></View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <TouchableOpacity accessibilityRole="button" onPress={() => { void signOut(); }} style={styles.row}><View style={styles.rowLabel}><Ionicons name="log-out-outline" size={18} color="#B42318" /><Text style={[styles.rowText, { color: '#B42318' }]}>Sign out</Text></View></TouchableOpacity>
        </View>
      </> : null}
      <View style={styles.footer}><TarLogo size={34} color={theme.primary} /><Text style={[styles.value, { color: theme.textSecondary }]}>tar · 1.0.0</Text></View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  label: { marginTop: 22, marginBottom: 8, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  card: { borderRadius: 4, overflow: 'hidden' },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontSize: 15, fontWeight: '600' },
  value: { fontSize: 13 },
  identity: { minHeight: 64, justifyContent: 'center', gap: 2, paddingHorizontal: 16 },
  divider: { height: StyleSheet.hairlineWidth },
  footer: { alignItems: 'center', gap: 8, paddingTop: 32 },
});
