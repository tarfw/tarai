// Chat: the channel shape. The channel tool ships with its adapters in Tile 4;
// until then the door opens on the manual wa.me handoff.

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { current } = useWorkspace();

  return (
    <View style={[styles.page, { backgroundColor: theme.background, paddingTop: insets.top + 8 }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} accessibilityLabel="Back"><Text style={{ color: theme.primary, fontSize: 15 }}>&lt; Canvas</Text></TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>MESSAGES</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>Channel adapters land next.</Text>
        <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>Manual WhatsApp handoff is ready — chats log to the Messages card once the adapter is in.</Text>
        <TouchableOpacity accessibilityRole="button" style={[styles.wa, { backgroundColor: theme.primary }]} onPress={() => void Linking.openURL('https://wa.me/')}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Open WhatsApp</Text>
        </TouchableOpacity>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{current?.name ?? ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontWeight: '800' },
  wa: { borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24 },
});
