// Canvas: one screen, every member. The header ends in a hairline; the tray
// opens the flat inbox and fills when something waits; the name opens the flat
// workspaces sheet; the bottom bar is Ask. NEXT is the top row; urgent rows carry !.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/state/Workspace';
import { Card } from '@/components/Card';
import { confirmRequest, enqueue, pendingCount, resolveConfirm, subscribe } from '@/lib/queue';
import { advanceSkill, dropSkill, slice, startSkill, type CardView, type InboxRow, type RunView, type SkillView } from '@/lib/tar';
import { saveSlice } from '@/lib/slicecache';
import { registerPush } from '@/lib/push';
import { getCurrentUser } from '@/lib/auth';
import { Onboarding } from '@/components/Onboarding';
import { Terms } from '@/components/Terms';
import { acceptedTerms, acceptTerms } from '@/lib/terms';

export default function Canvas() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { current, slice: data, refreshSlice, workspaces, select, loading } = useWorkspace();
  const [sheet, setSheet] = useState<'none' | 'inbox' | 'many'>('none');
  const [confirm, setConfirm] = useState<{ key: string; label: string } | null>(null);
  const [queueBadge, setQueueBadge] = useState(0);
  // one look at the terms per account, before any workspace work
  const [gate, setGate] = useState<'checking' | 'terms' | 'ready'>('checking');

  useEffect(() => {
    let active = true;
    void getCurrentUser().then(async (user) => {
      if (!active) return;
      if (!user) { setGate('ready'); return; }
      setGate(await acceptedTerms(user.id) ? 'ready' : 'terms');
    });
    return () => { active = false; };
  }, []);

  const accept = useCallback(async () => {
    const user = await getCurrentUser();
    if (user) await acceptTerms(user.id);
    setGate('ready');
  }, []);

  useEffect(() => {
    const update = async () => setQueueBadge(await pendingCount());
    void update();
    return subscribe(() => void update());
  }, []);

  // the bell: register the device for push (idempotent, best-effort)
  useEffect(() => { void registerPush(); }, []);

  useEffect(() => {
    const check = async () => {
      const pending = await confirmRequest();
      setConfirm((previous) => pending && !previous ? { key: pending.key, label: pending.label } : previous);
    };
    void check();
    return subscribe(() => void check());
  }, []);

  // the 20s version check: if-none-match on the last move id; 304 costs nothing
  useEffect(() => {
    if (!current) return;
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const fresh = await slice(current.slug, data?.version ?? null);
        if (fresh && active) { await saveSlice(current.slug, fresh); await refreshSlice(); }
      } catch { /* the poll is the floor */ }
    };
    const interval = setInterval(() => void poll(), 20_000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void poll(); });
    return () => { active = false; clearInterval(interval); sub.remove(); };
  }, [current, data?.version, refreshSlice]);

  // a run parked for a person: one confirm resumes it; money still asks
  const [run, setRun] = useState<{ run: RunView; title: string } | null>(null);

  const runSkillCard = useCallback(async (skill: SkillView) => {
    if (!current) return;
    try {
      const started = await startSkill(current.slug, skill.id);
      if (started.status === 'waiting') setRun({ run: started, title: skill.title });
      else if (started.status === 'done') Alert.alert(skill.title, 'Done.');
      else if (started.status === 'failed') Alert.alert(skill.title, 'That card did not finish.');
    } catch (cause) {
      Alert.alert(skill.title, cause instanceof Error ? cause.message : 'That card did not run.');
    }
  }, [current]);

  const resumeRun = useCallback(async (confirmed: boolean) => {
    if (!run || !current) return;
    const held = run;
    setRun(null);
    if (!confirmed) return;
    try {
      const next = await advanceSkill(current.slug, held.run.id, true);
      if (next.status === 'waiting' && next.step === held.run.step) Alert.alert(held.title, 'This card needs details. Finish it in Ask.');
      else if (next.status === 'waiting') setRun({ run: next, title: held.title });
      else if (next.status === 'done') Alert.alert(held.title, 'Done.');
      else if (next.status === 'failed') Alert.alert(held.title, 'That card did not finish.');
    } catch (cause) {
      Alert.alert(held.title, cause instanceof Error ? cause.message : 'That card did not run.');
    }
  }, [run, current]);

  // one meaning per tap: every card opens its section. Creating lives inside
  // the section's own +, so the canvas stays titles and numbers.
  const openTap = useCallback(async (card: CardView) => {
    if (!current) return;
    if (card.tool.startsWith('skill:')) {
      const skill = data?.skills.find((entry) => entry.id === card.tool.slice(6));
      if (skill) await runSkillCard(skill);
      return;
    }
    if (card.shape === 'sale') { router.push('/sale'); return; }
    router.push(`/tool/${card.tool}`);
  }, [current, router, data, runSkillCard]);

  // a custom card is yours to keep or drop; the row stays behind, hidden
  const removeSkill = useCallback((skill: SkillView) => {
    if (!current) return;
    Alert.alert('Remove card?', skill.title, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await dropSkill(current.slug, skill.id);
            await refreshSlice();
          } catch {
            Alert.alert(skill.title, 'That card could not be removed.');
          }
        },
      },
    ]);
  }, [current, refreshSlice]);

  const inboxRows: InboxRow[] = useMemo(() => data?.inbox ?? [], [data]);
  const next = data?.next ?? null;
  const cards = useMemo(() => data?.cards ?? [], [data]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // a waiting row is an intent: run it (the queue keeps its confirm), or open
  // the section it belongs to. No row is dead text.
  const openInbox = useCallback(async (row: InboxRow) => {
    if (!current || rowBusy) return;
    setSheet('none');
    if (row.action) {
      setRowBusy(row.id);
      try {
        await enqueue({ ws: current.slug, action: row.action, label: row.title, key: `inbox-${row.id}-${Date.now()}`, input: row.input });
        setTimeout(() => void refreshSlice(), 900);
      } finally { setRowBusy(null); }
      return;
    }
    if (row.tool === 'channel') router.push('/chat');
    else router.push(`/tool/${row.tool}`);
  }, [current, rowBusy, refreshSlice, router]);

  const skillCards: CardView[] = useMemo(() => (data?.skills ?? []).map((skill) => ({
    tool: `skill:${skill.id}`,
    title: skill.title,
    reach: 'data',
    shape: 'skill',
    tap: { action: null, label: 'Run' },
    number: skill.trigger.type === 'schedule' ? skill.trigger.at ?? null : null,
    pendingLine: skill.trigger.type === 'schedule' ? 'every day' : skill.trigger.type === 'event' ? 'when something happens' : null,
  })), [data]);
  const roleLabel = current?.role && current.role !== 'owner' ? current.role.charAt(0).toUpperCase() + current.role.slice(1) : '';
  // terms come first, then onboarding, never behind the loading gap
  if (gate === 'checking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (gate === 'terms') return <Terms onAccept={accept} />;

  if (!current) {
    return loading ? (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator />
      </View>
    ) : (
      <Onboarding />
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
        <TouchableOpacity accessibilityRole="button" style={styles.heading} onPress={() => setSheet('many')} accessibilityLabel="Switch workspace">
          <Text style={[styles.wsName, { color: theme.text }]} numberOfLines={1}>{current.mode === 'personal' ? 'Personal' : current.name}</Text>
        </TouchableOpacity>
        {roleLabel ? <Text style={[styles.roleText, { color: theme.textSecondary }]}>{roleLabel}</Text> : null}
        <TouchableOpacity accessibilityRole="button" style={styles.badgeWrap} onPress={() => setSheet('inbox')} accessibilityLabel="Inbox">
          <Ionicons name={inboxRows.length > 0 ? 'file-tray-full-outline' : 'file-tray-outline'} size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.stack, { paddingBottom: insets.bottom + 96 }]}>
        {next ? (
          <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => void openInbox(next)} style={[styles.next, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.nextLabel, { color: next.urgent ? '#B42318' : theme.textSecondary }]}>{next.urgent ? '! NEXT' : 'NEXT'}</Text>
            <Text style={[styles.nextTitle, { color: theme.text }]} numberOfLines={2}>{next.title}</Text>
          </TouchableOpacity>
        ) : null}
        {cards.map((card) => <Card key={card.tool} card={card} onTap={(tapped) => void openTap(tapped)} />)}
        {skillCards.length ? (
          // custom cards are the console list: full-bleed white rows parted by
          // hairlines, no outer border, so they read apart from the dealt stack.
          <View style={[styles.skillGroup, { borderTopColor: theme.border }]}>
            {skillCards.map((card) => (
              <Pressable
                key={card.tool}
                accessibilityRole="button"
                accessibilityLabel={card.title}
                accessibilityHint="Hold to remove this card"
                onPress={() => void openTap(card)}
                onLongPress={() => {
                  const skill = data?.skills.find((entry) => `skill:${entry.id}` === card.tool);
                  if (skill) removeSkill(skill);
                }}
                delayLongPress={400}
                style={({ pressed }) => [
                  styles.skillRow,
                  { backgroundColor: theme.background, borderBottomColor: theme.border },
                  pressed ? { backgroundColor: theme.backgroundSelected } : null,
                ]}
              >
                <Text style={[styles.skillTitle, { color: theme.text }]} numberOfLines={1}>{card.title}</Text>
                {card.number || card.pendingLine ? (
                  <Text style={[styles.skillMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {[card.number, card.pendingLine].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.askFooter, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity accessibilityRole="button" style={[styles.askBar, { backgroundColor: theme.primary }]} onPress={() => router.push('/ask')} accessibilityLabel="Ask TAR">
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.askBarText}>Ask TAR</Text>
          {queueBadge > 0 ? (
            <View style={styles.askBarBadge}>
              <Text style={[styles.askBarBadgeText, { color: theme.primary }]}>{queueBadge > 9 ? '9+' : queueBadge}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <Sheet title="Inbox" gap visible={sheet === 'inbox'} onClose={() => setSheet('none')}>
        {inboxRows.length === 0 ? <Text style={[styles.empty, { color: theme.textSecondary }]}>Nothing waiting.</Text> : null}
        {inboxRows.map((row) => (
          <TouchableOpacity
            key={row.id}
            accessibilityRole="button"
            activeOpacity={0.7}
            disabled={rowBusy === row.id}
            onPress={() => void openInbox(row)}
            style={[styles.inboxRow, { backgroundColor: theme.backgroundElement }]}
          >
            <View style={styles.inboxDotWrap}>
              {row.urgent ? <View style={styles.inboxDot} /> : null}
            </View>
            <Text style={[styles.inboxText, { color: theme.text }]} numberOfLines={2}>{row.title}</Text>
          </TouchableOpacity>
        ))}
      </Sheet>

      <Sheet title="Workspaces" gap visible={sheet === 'many'} onClose={() => setSheet('none')}>
        {workspaces.map((ws) => {
          const active = ws.slug === current.slug;
          return (
            <TouchableOpacity
              key={ws.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.wsRow, { backgroundColor: active ? theme.primary : theme.backgroundElement }]}
              onPress={() => { select(ws.slug); setSheet('none'); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.wsRowName, { color: active ? '#fff' : theme.text }]} numberOfLines={1}>{ws.mode === 'personal' ? 'Personal' : ws.name}</Text>
                <Text style={[styles.wsRowMeta, { color: active ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]} numberOfLines={1}>{ws.role}{ws.badge ? ` · ${ws.badge}` : ''}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </Sheet>

      {run ? <RunCard title={run.title} onResolve={(confirmed) => void resumeRun(confirmed)} /> : null}

      {confirm ? (
        <ConfirmCard label={confirm.label} onResolve={async (yes) => { await resolveConfirm(confirm.key, yes); setConfirm(null); void refreshSlice(); }} />
      ) : null}

    </View>
  );
}

function Sheet({ title, visible, gap, onClose, children }: { title: string; visible: boolean; gap?: boolean; onClose: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheetStyles.backdrop}>
        {/* the dimmed area above the drawer is the way out: a tap closes it */}
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }} />
        <View style={[sheetStyles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={[sheetStyles.grabber, { backgroundColor: theme.border }]} />
          <View style={sheetStyles.head}>
            <Text style={[sheetStyles.title, { color: theme.text }]}>{title}</Text>
          </View>
          <ScrollView contentContainerStyle={gap ? { gap: 8, paddingBottom: 4 } : undefined}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// A parked run asks once, then continues. Money and customers never skip it.
function RunCard({ title, onResolve }: { title: string; onResolve: (confirmed: boolean) => void }) {
  const theme = useTheme();
  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => onResolve(false)}>
      <View style={[sheetStyles.backdrop, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={[sheetStyles.confirm, { backgroundColor: theme.background }]}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>This card asks before it continues.</Text>
          <Text style={{ color: theme.textSecondary, paddingTop: 6 }}>{title} needs one confirm.</Text>
          <View style={{ flexDirection: 'row', gap: 12, paddingTop: 18, justifyContent: 'flex-end' }}>
            <TouchableOpacity accessibilityRole="button" onPress={() => onResolve(false)} style={{ padding: 10 }}><Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Not now</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => onResolve(true)} style={{ backgroundColor: theme.primary, borderRadius: 4, paddingVertical: 10, paddingHorizontal: 22 }}><Text style={{ color: '#fff', fontWeight: '700' }}>Confirm</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ConfirmCard({ label, onResolve }: { label: string; onResolve: (confirmed: boolean) => void }) {
  const theme = useTheme();
  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => onResolve(false)}>
      <View style={[sheetStyles.backdrop, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={[sheetStyles.confirm, { backgroundColor: theme.background }]}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Moves money or a customer.</Text>
          <Text style={{ color: theme.textSecondary, paddingTop: 6 }}>{label} needs your confirm.</Text>
          <View style={{ flexDirection: 'row', gap: 12, paddingTop: 18, justifyContent: 'flex-end' }}>
            <TouchableOpacity accessibilityRole="button" onPress={() => onResolve(false)} style={{ padding: 10 }}><Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Not now</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => onResolve(true)} style={{ backgroundColor: theme.primary, borderRadius: 4, paddingVertical: 10, paddingHorizontal: 22 }}><Text style={{ color: '#fff', fontWeight: '700' }}>Confirm</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  badgeWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1 },
  wsName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  roleText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  stack: { padding: 16, gap: 12 },
  next: { borderRadius: 4, minHeight: 108, paddingHorizontal: 18, paddingVertical: 16, gap: 6, justifyContent: 'space-between' },
  nextLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  nextTitle: { fontSize: 16, fontWeight: '600' },
  skillGroup: { marginHorizontal: -16, borderTopWidth: StyleSheet.hairlineWidth },
  skillRow: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 16, gap: 4, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  skillTitle: { fontSize: 16, fontWeight: '500' },
  skillMeta: { fontSize: 15 },
  askFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  askBar: { height: 52, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  askBarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  askBarBadge: { marginLeft: 'auto', minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  askBarBadgeText: { fontSize: 11, fontWeight: '800' },
  inboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 4, paddingHorizontal: 14, minHeight: 52, paddingVertical: 12 },
  inboxDotWrap: { width: 8, alignItems: 'center' },
  inboxDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B42318' },
  inboxText: { flex: 1, fontSize: 15, lineHeight: 21 },
  empty: { paddingVertical: 24, textAlign: 'center' },
  wsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 4 },
  wsRowName: { fontSize: 16, fontWeight: '700' },
  wsRowMeta: { fontSize: 12, paddingTop: 2, textTransform: 'capitalize' },
});

const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingHorizontal: 16, paddingTop: 10, maxHeight: '62%' },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  confirm: { borderRadius: 4, padding: 20, width: '86%' },
});
