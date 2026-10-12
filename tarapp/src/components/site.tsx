import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { harness, SITES_URL } from '@/lib/harness';
import type {
  DesignLibrary,
  DesignOption,
  PatchOperation,
  Section,
  SectionKind,
  SiteDocument,
  SiteSnapshot,
} from '@/lib/site-schema';

export interface SiteScreenProps {
  visible: boolean;
  onClose: () => void;
  workspaceName: string;
  subdomain: string;
  scope: string;
  workspaceDescription?: string;
}

export interface ToastInfo {
  text: string;
  revision?: number;
}

const siteSnapshotCache = new Map<string, SiteSnapshot>();
const siteStorageKey = (slug: string) => `tar_site_snap_${slug}`;

/** What a section is called in shop words; the owner never sees a layout name. */
const SECTION_LABELS: Record<SectionKind, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  header: { title: 'Menu bar', icon: 'menu-outline' },
  announcement: { title: 'Offer or notice line', icon: 'megaphone-outline' },
  hero: { title: 'Top of the page', icon: 'sparkles-outline' },
  spotlight: { title: 'Festival offer', icon: 'gift-outline' },
  catalog: { title: 'Items for sale', icon: 'grid-outline' },
  menu: { title: 'Food and menu', icon: 'restaurant-outline' },
  booking: { title: 'Services and booking', icon: 'calendar-outline' },
  story: { title: 'About your shop', icon: 'book-outline' },
  trust: { title: 'Trust badges', icon: 'shield-checkmark-outline' },
  faq: { title: 'Questions customers ask', icon: 'help-circle-outline' },
  policy: { title: 'Shop rules', icon: 'document-text-outline' },
  location: { title: 'Where to find you', icon: 'location-outline' },
  contact: { title: 'WhatsApp and contact', icon: 'logo-whatsapp' },
  footer: { title: 'Bottom of the page', icon: 'browsers-outline' },
};

const SECTION_KIND_LIST = Object.keys(SECTION_LABELS) as SectionKind[];

/** Stored documents from before the section names settled may still carry an old purpose. */
const LEGACY_KIND: Record<string, SectionKind> = {
  navigation: 'header',
  notice: 'announcement',
  collection: 'catalog',
  services: 'booking',
  promo: 'spotlight',
  introduction: 'hero',
  action: 'contact',
};

function kindOf(section: Section): SectionKind | null {
  const named = (section.id || '').toLowerCase();
  if ((SECTION_KIND_LIST as string[]).includes(named)) return named as SectionKind;
  const purpose = (section.purpose || '').toLowerCase();
  if ((SECTION_KIND_LIST as string[]).includes(purpose)) return purpose as SectionKind;
  const legacy = LEGACY_KIND[purpose];
  return legacy || null;
}

/** A setting key is one small word; the owner reads it as a sentence. */
function settingLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export default function SiteScreen({
  visible,
  onClose,
  workspaceName,
  subdomain,
  scope,
}: SiteScreenProps) {
  const insets = useSafeAreaInsets();
  const slug = useMemo(
    () =>
      scope.replace(/^w:/, '').trim() ||
      subdomain.toLowerCase().replace(/[^a-z0-9]+/g, '-') ||
      workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    [scope, subdomain, workspaceName],
  );
  const mountedRef = useRef(true);

  // Cached initial state
  const initialCached = slug ? siteSnapshotCache.get(slug) || null : null;

  // Site Document & Server State
  const [snapshot, setSnapshot] = useState<SiteSnapshot | null>(initialCached);
  const [initialLoading, setInitialLoading] = useState<boolean>(!initialCached);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string>('');
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const [library, setLibrary] = useState<DesignLibrary | null>(null);

  // Modals
  const [designModalOpen, setDesignModalOpen] = useState(false);
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [openKind, setOpenKind] = useState<SectionKind | null>(null);

  // Inputs
  const [noticeText, setNoticeText] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});

  const site: SiteDocument | null = snapshot?.site?.data ?? null;
  const siteId = snapshot?.site?.id ?? '';
  const isLive = snapshot?.publicationState === 'active' || snapshot?.site?.state === 'live';
  const defaultSiteUrl = slug ? `${SITES_URL}/${slug}` : null;
  const publicUrl = snapshot?.publicUrl || defaultSiteUrl;
  const displayDomain = publicUrl ? publicUrl.replace(/^https?:\/\//, '') : (slug ? `tar-sites.tar-54d.workers.dev/${slug}` : '');

  const sections: Section[] = useMemo(() => {
    if (!site?.pages?.length) return [];
    const homePage = site.pages.find((p) => p.id === 'home' || p.path === '/') || site.pages[0];
    return homePage.sections || [];
  }, [site]);

  // The page as it is stored: only the sections the site actually has.
  const shown = useMemo(() => {
    const seen = new Set<SectionKind>();
    const rows: { kind: SectionKind; section: Section }[] = [];
    for (const sec of sections) {
      const kind = kindOf(sec);
      if (!kind || seen.has(kind)) continue;
      seen.add(kind);
      rows.push({ kind, section: sec });
    }
    return rows;
  }, [sections]);

  const activeNotice: string | null = useMemo(() => {
    const noticeSec = shown.find((entry) => entry.kind === 'announcement')?.section;
    if (!noticeSec) return null;
    const textNode = noticeSec.nodes?.find((n) => n.kind === 'text');
    return textNode?.props?.text ? String(textNode.props.text) : null;
  }, [shown]);

  // What the store could show: what its models require, plus the extras it may switch on.
  const required = useMemo(() => library?.sections.required || [], [library]);
  const optional = useMemo(() => library?.sections.optional || [], [library]);
  const hiddenKinds = useMemo(() => new Set<SectionKind>(site?.blueprint?.overrides?.hidden || []), [site?.blueprint?.overrides?.hidden]);

  // Every section the owner may switch on is offered, whether or not it is built yet: the
  // choice is remembered as an override, so the store fills it when it has the content.
  const rows = useMemo(() => {
    const present = new Map<SectionKind, Section | null>();
    for (const entry of shown) present.set(entry.kind, entry.section);
    for (const kind of [...required, ...optional]) if (!present.has(kind)) present.set(kind, null);
    const list: { kind: SectionKind; section: Section | null; at: number }[] = [];
    for (const [kind, section] of present) {
      if (section === null && hiddenKinds.has(kind)) continue;
      const at = section ? sections.indexOf(section) : SECTION_KIND_LIST.indexOf(kind);
      list.push({ kind, section, at });
    }
    return list.sort((left, right) => left.at - right.at);
  }, [shown, required, optional, hiddenKinds, sections]);

  const layoutOf = useCallback((kind: SectionKind): { id: string; pattern: string } | null => {
    const section = shown.find((entry) => entry.kind === kind)?.section;
    const id = section?.recipe?.id || site?.blueprint?.overrides?.recipes?.[kind]
      || site?.blueprint?.recipes?.[kind] || library?.defaults?.[kind];
    if (!id) return null;
    const option = (library?.recipes?.[kind] || []).find((entry) => entry.id === id);
    return { id, pattern: option?.pattern || id };
  }, [shown, site?.blueprint?.overrides?.recipes, site?.blueprint?.recipes, library]);

  const settingsOf = useCallback((kind: SectionKind): Record<string, boolean | string> => {
    const section = shown.find((entry) => entry.kind === kind)?.section;
    return { ...(section?.recipe?.settings || {}), ...(site?.blueprint?.overrides?.settings?.[kind] || {}) };
  }, [shown, site?.blueprint?.overrides?.settings]);

  // The design library is server-owned: the app reads names and colours, never .md files.
  const loadDesigns = useCallback(async (id: string) => {
    if (!slug) return;
    try {
      const next = await harness.site.designs(slug, id ? { siteId: id } : {});
      if (mountedRef.current && next?.designs?.length) setLibrary(next);
    } catch {
      // Keep the last library; the store itself is unaffected.
    }
  }, [slug]);

  // Load site snapshot
  const loadSite = useCallback(async () => {
    if (!slug) return;
    try {
      const snap = await harness.site.get(slug);
      if (mountedRef.current && snap?.site?.data) {
        siteSnapshotCache.set(slug, snap);
        void SecureStore.setItemAsync(siteStorageKey(slug), JSON.stringify(snap)).catch(() => undefined);
        setSnapshot(snap);
        // The picker ships with the store it belongs to, so one fetch keeps both honest.
        await loadDesigns(snap.site.id);
      }
    } catch {
      // Retain existing snapshot
    } finally {
      if (mountedRef.current) {
        setInitialLoading(false);
        setBusy(false);
        setBusyMessage('');
      }
    }
  }, [slug, loadDesigns]);

  useEffect(() => {
    mountedRef.current = true;
    if (visible && slug) {
      void loadSite();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [visible, slug, loadSite]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Open in browser (cache-busted query param prevents stale mobile browser cache)
  const openInBrowser = useCallback(() => {
    const base = publicUrl || (slug ? `${SITES_URL}/${slug}` : null);
    if (!base) return;
    const target = `${base}${base.includes('?') ? '&' : '?'}t=${Date.now()}`;
    void Linking.openURL(target).catch(() => {
      Alert.alert('Cannot open link', `Could not open ${target} in browser.`);
    });
  }, [publicUrl, slug]);

  // A merchant choice is stored as an override, so it survives every later rebuild (parai §8).
  const applyChange = useCallback(async (operations: PatchOperation[], progress: string, done: string) => {
    if (!slug || !siteId || !site || busy) return;
    setBusy(true);
    setBusyMessage(progress);
    try {
      const res = await harness.site.edit(slug, siteId, site.revision, operations, 'Merchant choice');
      if (mountedRef.current) {
        setSnapshot((prev) => {
          if (!prev) return prev;
          const nextSnap: SiteSnapshot = {
            ...prev,
            site: { id: siteId, version: res.version, state: prev.site?.state || 'draft', data: res.site },
            html: res.html || prev.html,
          };
          siteSnapshotCache.set(slug, nextSnap);
          void SecureStore.setItemAsync(siteStorageKey(slug), JSON.stringify(nextSnap)).catch(() => undefined);
          return nextSnap;
        });
        setToast({ text: done, revision: res.revision });
      }
    } catch (err) {
      if (mountedRef.current) {
        Alert.alert('Could not save', err instanceof Error ? err.message : 'Could not save your change.');
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setBusyMessage('');
      }
    }
  }, [slug, siteId, site, busy]);

  // Switching look costs no model call and rewrites no words: it changes the stored choice.
  const handleSelectDesign = useCallback((styleKey: string) => {
    setDesignModalOpen(false);
    void applyChange(
      [{ op: 'set_override', kind: 'design', value: styleKey }],
      'Applying your look...',
      'Look saved. Tap Publish to show it.',
    );
  }, [applyChange]);

  const handleSelectLayout = useCallback((kind: SectionKind, recipeId: string) => {
    void applyChange(
      [{ op: 'set_override', kind: 'recipe', target: kind, value: recipeId }],
      'Changing how that section looks...',
      'Layout saved.',
    );
  }, [applyChange]);

  const handleChangeSetting = useCallback((kind: SectionKind, key: string, value: boolean | string) => {
    void applyChange(
      [{ op: 'set_override', kind: 'settings', target: kind, value: { [key]: value } }],
      'Saving...',
      'Saved.',
    );
  }, [applyChange]);

  const handleToggleSection = useCallback((kind: SectionKind, on: boolean) => {
    void applyChange(
      [{ op: 'set_override', kind: on ? 'show' : 'hide', target: kind }],
      on ? 'Adding that part...' : 'Taking that part away...',
      on ? 'Added. Tap Publish to show it.' : 'Taken away.',
    );
  }, [applyChange]);

  const handleToggleOrdering = useCallback((on: boolean) => {
    void applyChange(
      [{ op: 'set_policy', value: { publicOrdering: on } }],
      on ? 'Turning online orders on...' : 'Turning online orders off...',
      on ? 'Online orders turned on. Tap Publish to update your live store.' : 'Online orders turned off.',
    );
  }, [applyChange]);

  // Set or clear notice banner
  const handleSaveNotice = useCallback(async () => {
    if (!slug || !siteId || busy) return;
    setBusy(true);
    setBusyMessage('Updating store notice...');
    try {
      const res = await harness.site.noticeSet(slug, siteId, noticeText.trim());
      if (mountedRef.current) {
        setSnapshot((prev) => {
          if (!prev) return null;
          const nextSnap: SiteSnapshot = {
            ...prev,
            site: { id: siteId, version: res.version, state: res.state || prev.site?.state || 'draft', data: res.site },
            html: res.preview?.html || prev.html,
          };
          siteSnapshotCache.set(slug, nextSnap);
          void SecureStore.setItemAsync(siteStorageKey(slug), JSON.stringify(nextSnap)).catch(() => undefined);
          return nextSnap;
        });
        setToast({ text: noticeText.trim() ? 'Notice set' : 'Notice cleared' });
        setNoticeModalOpen(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        Alert.alert('Notice update failed', err instanceof Error ? err.message : 'Could not set notice.');
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setBusyMessage('');
      }
    }
  }, [slug, siteId, busy, noticeText]);

  // Undo last change
  const undoLastChange = useCallback(async () => {
    if (!slug || !siteId || busy) return;
    setBusy(true);
    setBusyMessage('Undoing change...');
    try {
      const res = await harness.site.undo(slug, siteId);
      if (mountedRef.current) {
        setSnapshot((prev) => {
          if (!prev) return null;
          const nextSnap: SiteSnapshot = {
            ...prev,
            site: { id: siteId, version: res.version, state: prev.site?.state || 'draft', data: res.site },
            html: res.html || prev.html,
          };
          siteSnapshotCache.set(slug, nextSnap);
          void SecureStore.setItemAsync(siteStorageKey(slug), JSON.stringify(nextSnap)).catch(() => undefined);
          return nextSnap;
        });
        setToast({ text: `Undone to revision ${res.revision}` });
      }
    } catch (err) {
      if (mountedRef.current) {
        Alert.alert('Undo failed', err instanceof Error ? err.message : 'Could not undo.');
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setBusyMessage('');
      }
    }
  }, [slug, siteId, busy]);

  // Publish / Republish: one call, three honest outcomes. The store rebuilds itself when the
  // merchant changed something it reads, then goes live or says what is still missing.
  const publishSite = useCallback(async () => {
    if (!slug || busy) return;
    setBusy(true);
    setBusyMessage('Building your store pages...');
    try {
      const outcome = await harness.site.publishLatest(slug, siteId || undefined);
      if (!mountedRef.current) return;
      if (outcome.published) {
        const livePublicUrl = outcome.publicUrl || outcome.liveUrl || (slug ? `${SITES_URL}/${slug}` : '');
        setSnapshot((prev) => {
          if (!prev) return null;
          const nextSnap: SiteSnapshot = {
            ...prev,
            publicationState: 'active',
            publicUrl: livePublicUrl,
            liveRelease: outcome.releaseId ?? prev.liveRelease,
            site: prev.site ? { ...prev.site, state: 'live' } : null,
          };
          siteSnapshotCache.set(slug, nextSnap);
          void SecureStore.setItemAsync(siteStorageKey(slug), JSON.stringify(nextSnap)).catch(() => undefined);
          return nextSnap;
        });
        setToast({ text: 'Your store is live.' });
        void loadSite();
        return;
      }
      const lines = [...(outcome.missing ?? []).map((need) => need.message), ...(outcome.blocking ?? [])];
      setToast({ text: outcome.regenerated ? 'Store rebuilt. Not live yet.' : 'Not live yet.' });
      Alert.alert(
        'Not ready to publish yet',
        lines.length ? lines.join('\n') : 'Your store is saved as a draft. Add a few details and tap Publish again.',
      );
      void loadSite();
    } catch (err) {
      if (mountedRef.current) {
        Alert.alert('Publish failed', err instanceof Error ? err.message : 'Could not publish site.');
      }
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setBusyMessage('');
      }
    }
  }, [slug, siteId, busy, loadSite]);

  // Start the store over
  const resetStore = useCallback(() => {
    Alert.alert(
      'Start the store over?',
      'Your store pages go back to a blank beginning. Your items, prices and photos are not touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start over',
          style: 'destructive',
          onPress: async () => {
            if (!slug || busy) return;
            setBusy(true);
            setBusyMessage('Starting the store over...');
            try {
              siteSnapshotCache.delete(slug);
              await SecureStore.deleteItemAsync(siteStorageKey(slug)).catch(() => undefined);
              await harness.site.reset(slug);
              if (mountedRef.current) {
                setToast({ text: 'Store started over. Tap Publish when it looks right.' });
                void loadSite();
              }
            } catch (err) {
              if (mountedRef.current) {
                Alert.alert('Reset failed', err instanceof Error ? err.message : 'Could not reset store.');
              }
            } finally {
              if (mountedRef.current) {
                setBusy(false);
                setBusyMessage('');
              }
            }
          },
        },
      ],
    );
  }, [slug, busy, loadSite]);

  const handleCopyLink = useCallback(async () => {
    const target = publicUrl || (slug ? `${SITES_URL}/${slug}` : '');
    if (!target) return;
    try {
      await Clipboard.setStringAsync(target);
      setToast({ text: 'Store link copied to clipboard!' });
    } catch {
      setToast({ text: target });
    }
  }, [publicUrl, slug]);

  // The look a store shows, resolved from the library the server shipped.
  const designs: DesignOption[] = library?.designs ?? [];
  const currentStyleKey = site?.design?.theme ?? library?.default ?? '';
  const activeSystem = designs.find((design) => design.id === currentStyleKey) ?? designs[0] ?? null;

  // The open section, read entirely from what the server shipped for that section type.
  const openEntry = openKind ? rows.find((entry) => entry.kind === openKind) || null : null;
  const openLayout = openKind ? layoutOf(openKind) : null;
  const openChoices = openKind ? library?.recipes?.[openKind] || [] : [];
  const openSettings = openKind && openLayout ? library?.settings?.[openKind]?.[openLayout.id] || {} : {};
  const openValues = openKind ? settingsOf(openKind) : {};
  const openNeeded = openKind ? required.includes(openKind) : false;
  const openShown = Boolean(openEntry?.section) && !(openKind && hiddenKinds.has(openKind));

  const closeSheet = () => {
    setOpenKind(null);
    setDraft({});
  };

  // A typed line is saved when the owner leaves the box; an empty box keeps the shop's own words.
  const commitText = (key: string): void => {
    if (!openKind) return;
    const slot = `${openKind}:${key}`;
    const next = (draft[slot] || '').trim();
    if (!next || next === String(openValues[key] ?? '')) return;
    void handleChangeSetting(openKind, key, next);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        {/* TOP NAVBAR */}
        <View style={styles.topNavBar}>
          <View style={styles.navLeft}>
            <TouchableOpacity
              style={styles.navBackBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Back to workspace"
            >
              <Ionicons name="chevron-back" size={24} color="#0f172a" />
            </TouchableOpacity>

            <View style={styles.navTitleWrap}>
              <Text style={styles.navTitle} numberOfLines={1}>
                {workspaceName || 'Online Store'}
              </Text>
              {displayDomain ? (
                <TouchableOpacity
                  onPress={handleCopyLink}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={styles.domainRow}
                >
                  <Text style={styles.navSubtitle} numberOfLines={1}>
                    {displayDomain}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.navActions}>
            {isLive ? (
              <TouchableOpacity
                style={styles.navLiveIcon}
                onPress={openInBrowser}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Open live store"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="open-outline" size={20} color="#0284c7" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.navTextBtn, busy && styles.navTextBtnBusy]}
              onPress={() => void publishSite()}
              disabled={busy}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Publish store"
            >
              <Text style={styles.navTextBtnLabel}>
                {busy ? 'Working...' : 'Publish'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* One line of progress so a tap always answers back. */}
        {busy && !!busyMessage ? (
          <View style={styles.statusBar}>
            <ActivityIndicator size="small" color="#0284c7" />
            <Text style={styles.statusText} numberOfLines={1}>
              {busyMessage}
            </Text>
          </View>
        ) : null}

        {/* MAIN SCROLL VIEW */}
        {initialLoading && !site ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#0f172a" />
            <Text style={styles.loadingText}>Connecting to store...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 24, 40) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. LOOK CARD (design token bundles, named in shop words only) */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>HOW YOUR STORE LOOKS</Text>
              </View>

              <TouchableOpacity
                style={styles.designCard}
                onPress={() => setDesignModalOpen(true)}
                activeOpacity={0.7}
              >
                <View style={styles.designCardHeader}>
                  <View style={styles.designStyleBadge}>
                    <View style={styles.swatchRowMini}>
                      {(activeSystem?.swatches ?? []).map((color, i) => (
                        <View key={color + i} style={[styles.miniSwatchDot, { backgroundColor: color }]} />
                      ))}
                    </View>
                    <Text style={styles.designStyleName} numberOfLines={1}>{activeSystem?.name ?? 'Choose a look'}</Text>
                  </View>
                </View>
                <Text style={styles.designDescText}>{activeSystem?.desc ?? 'Pick the look that fits your shop.'}</Text>
                <Text style={styles.designApplyText}>Pick another look and it saves at once. Tap Publish to show it.</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* 2. ONLINE ORDERS POLICY */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>ONLINE ORDERS</Text>
              </View>
              <View style={[styles.settingRow, { borderBottomWidth: 0, paddingVertical: 4 }]}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Accept orders on storefront</Text>
                  <Text style={styles.settingHint}>
                    Customers can build a cart and submit orders directly to your shop.
                  </Text>
                </View>
                <Switch
                  value={Boolean(site?.policy?.publicOrdering)}
                  disabled={busy}
                  onValueChange={handleToggleOrdering}
                />
              </View>
            </View>

            <View style={styles.divider} />

            {/* 3. SECTIONS LIST: each row is a part of the store the owner may switch on */}
            <View style={styles.sectionsContainer}>
              <Text style={styles.sectionLabel}>WHAT CUSTOMERS SEE</Text>
              <View style={styles.sectionsList}>
                {rows.map((entry, idx) => {
                  const label = SECTION_LABELS[entry.kind];
                  const isLast = idx === rows.length - 1;
                  const needed = required.includes(entry.kind);
                  const notice = entry.kind === 'announcement';
                  const layout = entry.section ? layoutOf(entry.kind) : null;
                  return (
                    <TouchableOpacity
                      key={entry.kind}
                      style={[
                        styles.sectionRow,
                        isLast ? styles.sectionRowLast : null,
                        notice && activeNotice ? styles.sectionRowActiveNotice : null,
                      ]}
                      activeOpacity={0.7}
                      disabled={busy}
                      onPress={() => {
                        if (notice) {
                          setNoticeText(activeNotice || '');
                          setNoticeModalOpen(true);
                          return;
                        }
                        setOpenKind(entry.kind);
                      }}
                    >
                      <View style={styles.sectionRowLeft}>
                        <Ionicons
                          name={label.icon}
                          size={18}
                          color={entry.kind === 'contact' ? '#16a34a' : '#0f172a'}
                        />
                        <View style={styles.sectionRowText}>
                          <Text
                            style={[styles.sectionRowTitle, notice && activeNotice ? styles.sectionRowActiveNoticeText : null]}
                            numberOfLines={1}
                          >
                            {notice && activeNotice ? `"${activeNotice}"` : label.title}
                          </Text>
                          <Text style={styles.sectionRowOption} numberOfLines={2}>
                            {!entry.section ? 'Not on your store yet' : layout ? layout.pattern : 'Your customers see this'}
                          </Text>
                        </View>
                      </View>
                      {needed ? (
                        <View style={styles.sectionRowRightPill}>
                          <Ionicons name="lock-closed-outline" size={12} color="#475569" />
                          <Text style={styles.sectionRowRightText}>Needed</Text>
                        </View>
                      ) : (
                        <Ionicons
                          name={entry.section ? 'chevron-forward' : 'add-circle-outline'}
                          size={18}
                          color="#94a3b8"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {site && site.revision > 1 ? (
              <TouchableOpacity
                onPress={() => void undoLastChange()}
                disabled={busy}
                style={styles.subtleLink}
                accessibilityRole="button"
                accessibilityLabel="Undo last change"
              >
                <Text style={styles.subtleLinkText}>Undo my last change</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={resetStore}
              disabled={busy}
              style={styles.subtleLink}
              accessibilityRole="button"
              accessibilityLabel="Start the store over"
            >
              <Text style={styles.subtleLinkText}>Start the store over</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* DESIGN SYSTEMS MODAL: Flat list of the 3 .md design systems from designmds */}
        <Modal
          visible={designModalOpen}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setDesignModalOpen(false)}
        >
          <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
            {/* Top Bar */}
            <View style={styles.topNavBar}>
              <View style={styles.navLeft}>
                <TouchableOpacity
                  style={styles.navBackBtn}
                  onPress={() => setDesignModalOpen(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={24} color="#0f172a" />
                </TouchableOpacity>
                <View style={styles.navTitleWrap}>
                  <Text style={styles.navTitle}>Choose how your store looks</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setDesignModalOpen(false)}
                style={styles.navTextBtn}
              >
                <Text style={styles.navTextBtnLabel}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Flat List */}
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: Math.max(insets.bottom + 24, 40) },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.designFlatList}>
                {designs.length === 0 ? (
                  <Text style={styles.systemDesc}>Loading looks...</Text>
                ) : null}
                {designs.map((design) => {
                  const isSelected = design.id === currentStyleKey;
                  return (
                    <TouchableOpacity
                      key={design.id}
                      style={[styles.systemCard, isSelected && styles.systemCardActive]}
                      onPress={() => handleSelectDesign(design.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.systemCardTop}>
                        <Text style={[styles.systemTitle, isSelected && styles.systemTitleActive]}>
                          {design.name}
                        </Text>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={isSelected ? '#0284c7' : '#cbd5e1'}
                        />
                      </View>

                      {/* Swatches Bar */}
                      <View style={styles.swatchesRow}>
                        {design.swatches.map((swatch, idx) => (
                          <View key={swatch + idx} style={[styles.swatchCircle, { backgroundColor: swatch }]} />
                        ))}
                      </View>

                      <Text style={styles.systemDesc}>{design.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </Modal>



        {/* SECTION SHEET: the shapes this part of the store can take, and the few choices they offer */}
        <Modal
          visible={openKind !== null}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={closeSheet}
        >
          <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
            <View style={styles.topNavBar}>
              <View style={styles.navLeft}>
                <TouchableOpacity
                  style={styles.navBackBtn}
                  onPress={closeSheet}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={24} color="#0f172a" />
                </TouchableOpacity>
                <View style={styles.navTitleWrap}>
                  <Text style={styles.navTitle}>{openKind ? SECTION_LABELS[openKind].title : ''}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeSheet} style={styles.navTextBtn}>
                <Text style={styles.navTextBtnLabel}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {openKind ? (
                <>
                  {openNeeded ? (
                    <Text style={styles.sheetHint}>Your store needs this part, so it stays on your page.</Text>
                  ) : (
                    <View style={styles.settingRow}>
                      <View style={styles.settingText}>
                        <Text style={styles.settingLabel}>Show this on your store</Text>
                        <Text style={styles.settingHint}>Your choice is remembered, even when we rebuild the store.</Text>
                      </View>
                      <Switch
                        value={openShown}
                        disabled={busy}
                        onValueChange={(next) => handleToggleSection(openKind, next)}
                      />
                    </View>
                  )}

                  {openShown && openChoices.length > 1 ? (
                    <>
                      <Text style={[styles.sectionLabel, styles.sheetGap]}>HOW IT IS ARRANGED</Text>
                      {openChoices.map((choice) => {
                        const selected = choice.id === openLayout?.id;
                        return (
                          <TouchableOpacity
                            key={choice.id}
                            style={[styles.systemCard, selected ? styles.systemCardActive : null]}
                            activeOpacity={0.7}
                            disabled={busy}
                            onPress={() => handleSelectLayout(openKind, choice.id)}
                          >
                            <View style={styles.systemCardTop}>
                              <Text style={[styles.systemTitle, selected ? styles.systemTitleActive : null]} numberOfLines={2}>
                                {choice.pattern}
                              </Text>
                              <Ionicons
                                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                                size={22}
                                color={selected ? '#0284c7' : '#cbd5e1'}
                              />
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  ) : null}

                  {openShown && Object.keys(openSettings).length ? (
                    <>
                      <Text style={[styles.sectionLabel, styles.sheetGap]}>SMALL CHOICES</Text>
                      {Object.entries(openSettings).map(([key, setting]) => {
                        const slot = `${openKind}:${key}`;
                        const value = draft[slot] !== undefined ? draft[slot] : String(openValues[key] ?? setting.default ?? '');
                        if (setting.type === 'boolean') {
                          const on = Boolean(openValues[key] ?? setting.default);
                          return (
                            <View key={key} style={styles.settingRow}>
                              <View style={styles.settingText}>
                                <Text style={styles.settingLabel}>{settingLabel(key)}</Text>
                              </View>
                              <Switch
                                value={on}
                                disabled={busy}
                                onValueChange={(next) => handleChangeSetting(openKind, key, next)}
                              />
                            </View>
                          );
                        }
                        if (setting.type === 'choice') {
                          return (
                            <View key={key} style={styles.settingBlock}>
                              <Text style={styles.settingLabel}>{settingLabel(key)}</Text>
                              <View style={styles.chipRow}>
                                {(setting.options || []).map((option) => {
                                  const selected = option === value;
                                  return (
                                    <TouchableOpacity
                                      key={option}
                                      style={[styles.chip, selected ? styles.chipActive : null]}
                                      activeOpacity={0.7}
                                      disabled={busy}
                                      onPress={() => handleChangeSetting(openKind, key, option)}
                                    >
                                      <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{option}</Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          );
                        }
                        return (
                          <View key={key} style={styles.settingBlock}>
                            <Text style={styles.settingLabel}>{settingLabel(key)}</Text>
                            <TextInput
                              style={styles.noticeTextInput}
                              value={value}
                              maxLength={setting.max || 60}
                              placeholder={String(setting.default ?? '')}
                              placeholderTextColor="#94a3b8"
                              editable={!busy}
                              onChangeText={(next) => setDraft((prev) => ({ ...prev, [slot]: next }))}
                              onBlur={() => commitText(key)}
                            />
                          </View>
                        );
                      })}
                    </>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          </View>
        </Modal>

        {/* NOTICE MODAL */}
        <Modal
          visible={noticeModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setNoticeModalOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBackdrop}
          >
            <View style={styles.noticeModalCard}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Offer or notice line</Text>
                <TouchableOpacity onPress={() => setNoticeModalOpen(false)}>
                  <Ionicons name="close" size={20} color="#0f172a" />
                </TouchableOpacity>
              </View>
              <Text style={styles.noticeModalHint}>
                A short line at the top of your store: today&apos;s offer, changed timings, or a delivery note.
              </Text>
              <TextInput
                style={styles.noticeTextInput}
                value={noticeText}
                onChangeText={setNoticeText}
                placeholder="e.g. Festival offer active: 10% off bridal silk sarees"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                editable={!busy}
              />
              <View style={styles.noticeModalActionsRow}>
                {activeNotice ? (
                  <TouchableOpacity
                    onPress={() => {
                      setNoticeText('');
                      void handleSaveNotice();
                    }}
                    disabled={busy}
                    style={styles.clearNoticeBtn}
                  >
                    <Text style={styles.clearNoticeBtnText}>Clear Banner</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => void handleSaveNotice()}
                  disabled={busy}
                  style={styles.saveNoticeBtn}
                >
                  <Text style={styles.saveNoticeBtnText}>Save Notice</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {toast ? (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText} numberOfLines={2}>
              {toast.text}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  navBackBtn: {
    padding: 2,
  },
  navTitleWrap: {
    flex: 1,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  domainRow: {
    marginTop: 2,
  },
  navSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navLiveIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  navTextBtn: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTextBtnBusy: {
    opacity: 0.4,
  },
  navTextBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007aff',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f9ff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0f2fe',
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    color: '#0369a1',
    fontWeight: '500',
  },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
  },
  toastText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  scrollArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  sectionBlock: {
    paddingVertical: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  editActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
  },
  plusActionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0284c7',
    paddingHorizontal: 4,
  },

  // Design Card on Main Screen
  designCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 6,
  },
  designCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  designStyleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  swatchRowMini: {
    flexDirection: 'row',
    gap: 3,
  },
  miniSwatchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  designStyleName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  designArchetype: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  fileBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fileBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  designDescText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  designApplyText: {
    marginTop: 6,
    fontSize: 12,
    color: '#0284c7',
    lineHeight: 16,
  },
  designBestForText: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '500',
  },

  // Sections
  sectionsContainer: {
    paddingVertical: 4,
    gap: 6,
  },
  sectionsList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    marginTop: 4,
  },
  sectionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  sectionRowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sectionRowTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
  },
  sectionRowOption: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  sectionRowRightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sectionRowRightText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  sectionRowActiveNotice: {
    backgroundColor: '#fffbeb',
    borderRadius: 6,
    paddingHorizontal: 6,
  },
  sectionRowActiveNoticeText: {
    color: '#b45309',
    fontWeight: '600',
  },
  subtleLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  subtleLinkText: {
    fontSize: 13,
    color: '#94a3b8',
  },

  // Design Systems Flat List Modal
  designNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  designNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 17,
  },
  designFlatList: {
    gap: 12,
    marginBottom: 20,
  },
  systemCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  systemCardActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f8fafc',
  },
  systemCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  systemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  systemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  systemTitleActive: {
    color: '#0284c7',
  },
  systemArchetypeBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  systemArchetypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  systemFileText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  swatchesRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  swatchCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  systemDesc: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },

  // Notice Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  noticeModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  noticeModalHint: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  noticeTextInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  noticeModalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  clearNoticeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearNoticeBtnText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  saveNoticeBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveNoticeBtnText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },

  // Section sheet
  sectionRowText: {
    flex: 1,
  },
  sheetGap: {
    marginTop: 20,
    marginBottom: 8,
  },
  sheetHint: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginTop: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  settingBlock: {
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  settingText: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  settingHint: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  chipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#0369a1',
    fontWeight: '700',
  },
});
