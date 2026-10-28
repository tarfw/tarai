// Chat: the channel shape — one tool, adapters inside. WhatsApp is the
// manual adapter: open wa.me, then the exchange logs through channel.log.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { NavBar } from '@/components/NavBar';
import { toolRows } from '@/lib/tar';
import { enqueue } from '@/lib/queue';

interface Contact { id: string; title: string; data: { phone?: string } }
interface Message { id: string; title: string; data: { channel?: string; phone?: string | null; text?: string; direction?: string; at?: number }; updatedAt: number }

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { current, refreshSlice } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [draftPhone, setDraftPhone] = useState('');

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    try {
      const [people, log] = await Promise.all([toolRows(current.slug, 'contact'), toolRows(current.slug, 'channel')]);
      setContacts((people.rows as Contact[]).filter((row) => typeof row.data.phone === 'string' && row.data.phone));
      setMessages(log.rows as Message[]);
    } catch { /* stale is fine */ }
    finally { setLoading(false); }
  }, [current]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const send = async (phone: string, text: string) => {
    if (!current || !text.trim() || !phone) return;
    const clean = phone.replace(/[^+0-9]/g, '');
    await enqueue({
      ws: current.slug, action: 'channel.log', label: `Chat ${phone}`,
      key: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      input: { channel: 'whatsapp', phone: clean, text: text.trim(), direction: 'out' },
    });
    await Linking.openURL(`https://wa.me/${clean.replace('+', '')}?text=${encodeURIComponent(text)}`).catch(() => undefined);
    setDraft('');
    void load();
    void refreshSlice();
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <NavBar title="MESSAGES" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}>
        {loading && !messages.length ? <ActivityIndicator color={theme.primary} /> : null}
        <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>RECENT</Text>
        {messages.slice(0, 12).map((message) => (
          <View key={message.id} style={[styles.msg, { borderColor: theme.border }]}>
            <Text style={{ color: theme.text }} numberOfLines={2}>{message.data.text ?? message.title}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{message.data.direction === 'in' ? 'in' : 'out'} · {message.data.phone ?? ''}</Text>
          </View>
        ))}
        {!loading && !messages.length ? <Text style={{ color: theme.textSecondary }}>No chats logged yet.</Text> : null}
        <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1, paddingTop: 8 }}>OPEN WHATSAPP</Text>
        {contacts.map((contact) => (
          <TouchableOpacity key={contact.id} accessibilityRole="button" style={[styles.contact, { borderColor: theme.border }]} onPress={() => setDraftPhone(contact.data.phone ?? '')}>
            <Text style={{ color: theme.text, fontWeight: '600' }}>{contact.title}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{contact.data.phone}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ gap: 8, paddingTop: 8 }}>
          <TextInput style={[styles.input, { borderColor: theme.border, color: theme.text }]} placeholder="Phone (+91…)" placeholderTextColor={theme.textSecondary} value={draftPhone} onChangeText={setDraftPhone} keyboardType="phone-pad" />
          <TextInput style={[styles.input, { borderColor: theme.border, color: theme.text }]} placeholder="Message" placeholderTextColor={theme.textSecondary} value={draft} onChangeText={setDraft} multiline />
          <TouchableOpacity accessibilityRole="button" style={[styles.send, { backgroundColor: draft && draftPhone ? theme.primary : theme.border }]} disabled={!draft || !draftPhone} onPress={() => void send(draftPhone, draft)}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Send on WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  msg: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 4 },
  contact: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  send: { borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
});
