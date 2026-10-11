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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { harness, SITES_URL } from '@/lib/harness';
import type { HeaderStyle, HeroPattern, Section, SiteDocument, SiteSnapshot } from '@/lib/site-schema';

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

export interface ReferoDesignSystem {
  key: string;
  name: string;
  desc: string;
  swatches: string[];
}

export const REFERO_SYSTEMS: readonly ReferoDesignSystem[] = [
  {
    key: 'dark-luxury',
    name: 'Rich and premium',
    desc: 'Dark writing on cream, deep brown buttons, gold detail. Good for silk, jewellery and watches.',
    swatches: ['#3b281d', '#e07122', '#000000', '#f7f4f1'],
  },
  {
    key: 'neon-pop',
    name: 'Bright and fun',
    desc: 'Bold colours and big round buttons. Good for snacks, drinks and young clothing.',
    swatches: ['#5b00ed', '#3f0791', '#dad9ff', '#ffffff'],
  },
  {
    key: 'harvest-editorial',
    name: 'Warm and simple',
    desc: 'Soft cream, copper colours, easy to read. Good for bakeries, farms, crafts and salons.',
    swatches: ['#ab5700', '#e5dccd', '#e8e359', '#7997ff'],
  },
] as const;

export interface HeroOptionItem {
  key: HeroPattern;
  name: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}
export const HERO_OPTIONS: readonly HeroOptionItem[] = [
  {
    key: 'centered_atmospheric',
    name: 'Big photo, name in the middle',
    desc: 'One full photo with your shop name and button in the centre.',
    icon: 'cloud-outline',
  },
  {
    key: 'split',
    name: 'Photo beside your name',
    desc: 'Shop name on the left, one good photo on the right.',
    icon: 'browsers-outline',
  },
  {
    key: 'commerce',
    name: 'One item first',
    desc: 'A featured item with its price and a direct order button.',
    icon: 'pricetag-outline',
  },
  {
    key: 'typography',
    name: 'Only your shop name',
    desc: 'Large name and one line about the shop. No photo needed.',
    icon: 'text-outline',
  },
  {
    key: 'bg_image',
    name: 'Photo behind the words',
    desc: 'A full photo behind your shop name.',
    icon: 'image-outline',
  },
  {
    key: 'fullbleed',
    name: 'Photo across the top',
    desc: 'Wide photo stretching from edge to edge.',
    icon: 'scan-outline',
  },
  {
    key: 'minimal',
    name: 'Small and tidy',
    desc: 'Name, one line about the shop, and quick links to your items.',
    icon: 'remove-outline',
  },
];

export interface HeaderOptionItem {
  key: HeaderStyle;
  name: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const HEADER_OPTIONS: readonly HeaderOptionItem[] = [
  {
    key: 'split',
    name: 'Photo beside name',
    desc: 'Logo on the left with navigation beside it.',
    icon: 'grid-outline',
  },
  {
    key: 'floating_pill',
    name: 'Round menu button',
    desc: 'Your shop mark in a rounded badge with a menu button.',
    icon: 'tablet-landscape-outline',
  },
  {
    key: 'minimal',
    name: 'Name left, menu right',
    desc: 'Plain bar: shop name on the left, links on the right.',
    icon: 'menu-outline',
  },
  {
    key: 'fullbleed',
    name: 'Menu over the photo',
    desc: 'Links sit on top of the photo at the very top of the page.',
    icon: 'reorder-two-outline',
  },
];

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

  // Modals
  const [designModalOpen, setDesignModalOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);

  // Inputs
  const [noticeText, setNoticeText] = useState('');

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

  const activeNotice: string | null = useMemo(() => {
    const noticeSec = sections.find((s) => s.purpose === 'notice');
    if (!noticeSec) return null;
    const textNode = noticeSec.nodes?.find((n) => n.kind === 'text');
    return textNode?.props?.text ? String(textNode.props.text) : null;
  }, [sections]);

  const sectionMeta = useCallback((purpose: string) => {
    switch (purpose) {
      case 'navigation':
      case 'nav':
        return { title: 'Menu bar', icon: 'menu-outline' as const };
      case 'header':
      case 'hero':
        return { title: 'Top of the page', icon: 'sparkles-outline' as const };
      case 'notice':
        return { title: 'Offer or notice line', icon: 'megaphone-outline' as const };
      case 'spotlight':
        return { title: 'Festival offer', icon: 'gift-outline' as const };
      case 'catalog':
        return { title: 'Items for sale', icon: 'grid-outline' as const };
      case 'menu':
        return { title: 'Food and menu', icon: 'restaurant-outline' as const };
      case 'services':
        return { title: 'Services and booking', icon: 'calendar-outline' as const };
      case 'story':
        return { title: 'About your shop', icon: 'book-outline' as const };
      case 'trust':
        return { title: 'Trust badges', icon: 'shield-checkmark-outline' as const };
      case 'contact':
        return { title: 'WhatsApp and contact', icon: 'logo-whatsapp' as const };
      case 'footer':
        return { title: 'Bottom of the page', icon: 'browsers-outline' as const };
      default:
        return { title: purpose.charAt(0).toUpperCase() + purpose.slice(1), icon: 'layers-outline' as const };
    }
  }, []);

  const displaySections = useMemo(() => {
    if (!sections.length) {
      const defaultKind = site?.blueprint?.kind || site?.category || 'goods';
      const mainSection = defaultKind === 'services' ? 'services' : defaultKind === 'food' ? 'menu' : 'catalog';
      return [
        { id: 'nav', purpose: 'navigation', layout: { kind: 'stack' }, nodes: [] },
        { id: 'hero', purpose: 'hero', layout: { kind: 'stack' }, nodes: [] },
        { id: 'notice', purpose: 'notice', layout: { kind: 'stack' }, nodes: [] },
        { id: mainSection, purpose: mainSection, layout: { kind: 'stack' }, nodes: [] },
        { id: 'footer', purpose: 'footer', layout: { kind: 'stack' }, nodes: [] },
      ] as Section[];
    }
    const hasNav = sections.some((s) => (s.purpose === 'navigation' || s.purpose === 'nav' || s.id === 'nav') && s.id !== 'hero');
    const hasNotice = sections.some((s) => s.purpose === 'notice');
    const hasFooter = sections.some((s) => s.purpose === 'footer' || s.id === 'footer');
    const hasCatalog = sections.some((s) => s.purpose === 'catalog' || s.purpose === 'collection' || s.purpose === 'menu' || s.purpose === 'services' || s.id === 'catalog');
    const defaultKind = site?.blueprint?.kind || site?.category || 'goods';
    const mainCatalogSection = defaultKind === 'services' ? 'services' : defaultKind === 'food' ? 'menu' : 'catalog';

    const result: Section[] = [];
    if (!hasNav) {
      result.push({ id: 'nav', purpose: 'navigation', layout: { kind: 'stack' }, nodes: [] });
    }
    for (const sec of sections) {
      if (sec.purpose === 'contact' || sec.id === 'contact') {
        continue;
      }
      result.push(sec);
      if (sec.purpose === 'header' || sec.purpose === 'hero') {
        if (!hasNotice) {
          result.push({ id: 'notice', purpose: 'notice', layout: { kind: 'stack' }, nodes: [] });
        }
      }
    }
    if (!hasCatalog && !result.some((s) => s.purpose === mainCatalogSection)) {
      result.push({ id: mainCatalogSection, purpose: mainCatalogSection, layout: { kind: 'grid', columns: 3 }, nodes: [] });
    }
    if (!hasFooter) {
      result.push({ id: 'footer', purpose: 'footer', layout: { kind: 'stack' }, nodes: [] });
    }
    return result;
  }, [sections, site?.blueprint?.kind, site?.category]);

  // Load site snapshot
  const loadSite = useCallback(async () => {
    if (!slug) return;
    try {
      const snap = await harness.site.get(slug);
      if (mountedRef.current && snap?.site?.data) {
        siteSnapshotCache.set(slug, snap);
        void SecureStore.setItemAsync(siteStorageKey(slug), JSON.stringify(snap)).catch(() => undefined);
        setSnapshot(snap);
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
  }, [slug]);

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

  // Look picks stay local until Publish applies them, so choosing costs no calls
  const handleSelectDesign = useCallback((styleKey: string) => {
    setSelectedStyle(styleKey);
  }, []);

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

  // Publish / Republish
  const publishSite = useCallback(async () => {
    if (!slug || busy) return;
    setBusy(true);
    setBusyMessage('Getting your store ready...');
    try {
      setBusyMessage('Checking your store details...');
      const freshSnap = await harness.site.get(slug).catch(() => null);
      let activeSiteId = freshSnap?.site?.id || siteId;
      if (!activeSiteId) throw new Error('Store was not found.');

      const desiredStyle = selectedStyle || freshSnap?.site?.data?.blueprint?.style || currentStyleKey;

      const needsUpdate = desiredStyle && freshSnap?.site?.data?.blueprint?.style !== desiredStyle;

      if (needsUpdate) {
        setBusyMessage('Applying your chosen look...');
        const genRes = await harness.site.generate(slug, {
          style: desiredStyle,
        } as Record<string, unknown>);
        activeSiteId = genRes.siteId || activeSiteId;
      }

      setBusyMessage('Building your store pages...');
      const compiled = await harness.site.compile(slug, activeSiteId);

      setBusyMessage('Making your store live...');
      let published;
      try {
        published = await harness.site.publish(slug, activeSiteId, compiled.releaseId, compiled.hash);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('stale') || msg.includes('does not match') || msg.includes('Compile and review')) {
          setBusyMessage('Recompiling fresh candidate...');
          const freshAgain = await harness.site.get(slug).catch(() => null);
          const retryId = freshAgain?.site?.id || activeSiteId;
          const recompiled = await harness.site.compile(slug, retryId);
          published = await harness.site.publish(slug, retryId, recompiled.releaseId, recompiled.hash);
        } else {
          throw err;
        }
      }

      if (mountedRef.current) {
        const livePublicUrl = published.publicUrl || published.liveUrl || (slug ? `${SITES_URL}/${slug}` : '');
        setSnapshot((prev) => {
          if (!prev) return null;
          const nextSnap: SiteSnapshot = {
            ...prev,
            publicationState: 'active',
            publicUrl: livePublicUrl,
            liveRelease: published.releaseId,
            site: prev.site ? { ...prev.site, state: 'live' } : null,
          };
          siteSnapshotCache.set(slug, nextSnap);
          void SecureStore.setItemAsync(siteStorageKey(slug), JSON.stringify(nextSnap)).catch(() => undefined);
          return nextSnap;
        });
        void loadSite();
      }
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

  // Active Design System resolution from the 3 Refero .md files
  const currentStyleKey = selectedStyle ?? site?.blueprint?.style ?? 'dark-luxury';
  const activeSystem =
    REFERO_SYSTEMS.find(
      (s) =>
        s.key === currentStyleKey ||
        s.name.toLowerCase() === currentStyleKey?.toLowerCase() ||
        (currentStyleKey === 'mollie' && s.key === 'dark-luxury') ||
        (currentStyleKey === 'magic-spoon' && s.key === 'neon-pop') ||
        (currentStyleKey?.startsWith('arte') && s.key === 'harvest-editorial'),
    ) || REFERO_SYSTEMS[0];

  // Active Header Style Option (decided by Jev in blueprint)
  const currentHeaderKey: HeaderStyle = site?.blueprint?.headerStyle ?? (site?.blueprint?.heroPattern === 'centered_atmospheric' ? 'floating_pill' : 'minimal');
  const activeHeaderOption =
    HEADER_OPTIONS.find((h) => h.key === currentHeaderKey) || HEADER_OPTIONS[0];

  // Active Hero Design Option (decided by Jev in blueprint)
  const currentHeroKey: HeroPattern = site?.blueprint?.heroPattern ?? 'split';
  const activeHeroOption =
    HERO_OPTIONS.find((h) => h.key === currentHeroKey) || HERO_OPTIONS[0];

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
                {busy ? 'Publishing...' : 'Publish'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

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
                      {activeSystem.swatches.map((color, i) => (
                        <View key={color + i} style={[styles.miniSwatchDot, { backgroundColor: color }]} />
                      ))}
                    </View>
                    <Text style={styles.designStyleName} numberOfLines={1}>{activeSystem.name}</Text>
                  </View>
                </View>
                <Text style={styles.designDescText}>{activeSystem.desc}</Text>
                <Text style={styles.designApplyText}>Tap Publish and your store will show this look.</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* 2. SECTIONS LIST */}
            <View style={styles.sectionsContainer}>
              <Text style={styles.sectionLabel}>WHAT CUSTOMERS SEE</Text>
              <View style={styles.sectionsList}>
                {displaySections.map((sec, idx) => {
                  const isLast = idx === displaySections.length - 1;
                  const isNotice = sec.purpose === 'notice';
                  if (isNotice) {
                    return (
                      <TouchableOpacity
                        key={sec.id || `notice-${idx}`}
                        style={[
                          styles.sectionRow,
                          activeNotice ? styles.sectionRowActiveNotice : null,
                          isLast ? styles.sectionRowLast : null,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setNoticeText(activeNotice || '');
                          setNoticeModalOpen(true);
                        }}
                      >
                        <View style={styles.sectionRowLeft}>
                          <Ionicons
                            name="megaphone-outline"
                            size={18}
                            color={activeNotice ? '#b45309' : '#0f172a'}
                          />
                          <Text
                            style={[
                              styles.sectionRowTitle,
                              activeNotice ? styles.sectionRowActiveNoticeText : null,
                            ]}
                            numberOfLines={1}
                          >
                            {activeNotice ? `"${activeNotice}"` : 'Offer or notice line'}
                          </Text>
                        </View>
                        <Text style={styles.plusActionText}>{activeNotice ? 'Edit' : '+'}</Text>
                      </TouchableOpacity>
                    );
                  }

                  const isHeader = (sec.purpose === 'navigation' || sec.purpose === 'nav' || sec.id === 'nav') && sec.id !== 'hero';
                  if (isHeader) {
                    return (
                      <View
                        key={sec.id || `header-${idx}`}
                        style={[styles.sectionRow, isLast ? styles.sectionRowLast : null]}
                      >
                        <View style={styles.sectionRowLeft}>
                          <Ionicons name="menu-outline" size={18} color="#0f172a" />
                          <View>
                            <Text style={styles.sectionRowTitle}>Menu bar</Text>
                            <Text style={styles.sectionRowOption}>{activeHeaderOption.name}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  }

                  const isHero = sec.purpose === 'hero' || sec.id === 'hero' || (sec.purpose === 'header' && sec.id !== 'nav');
                  if (isHero) {
                    return (
                      <View
                        key={sec.id || `hero-${idx}`}
                        style={[styles.sectionRow, isLast ? styles.sectionRowLast : null]}
                      >
                        <View style={styles.sectionRowLeft}>
                          <Ionicons name="image-outline" size={18} color="#0f172a" />
                          <View>
                            <Text style={styles.sectionRowTitle}>Top of the page</Text>
                            <Text style={styles.sectionRowOption}>{activeHeroOption.name}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  }

                  const isFooter = sec.purpose === 'footer' || sec.id === 'site-footer' || sec.id === 'footer';
                  if (isFooter) {
                    return (
                      <View
                        key={sec.id || `footer-${idx}`}
                        style={[styles.sectionRow, isLast ? styles.sectionRowLast : null]}
                      >
                        <View style={styles.sectionRowLeft}>
                          <Ionicons name="browsers-outline" size={18} color="#0f172a" />
                          <View>
                            <Text style={styles.sectionRowTitle}>Bottom of the page</Text>
                            <Text style={styles.sectionRowOption}>
                              'Storefront Footer'
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  }

                  const meta = sectionMeta(sec.purpose);
                  const isContact = sec.purpose === 'contact';
                  return (
                    <View
                      key={sec.id || `${sec.purpose}-${idx}`}
                      style={[styles.sectionRow, isLast ? styles.sectionRowLast : null]}
                    >
                      <View style={styles.sectionRowLeft}>
                        <Ionicons
                          name={meta.icon}
                          size={18}
                          color={isContact ? '#16a34a' : '#0f172a'}
                        />
                        <Text style={styles.sectionRowTitle}>{meta.title}</Text>
                      </View>
                    </View>
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
                {REFERO_SYSTEMS.map((sys) => {
                  const isSelected = sys.key === currentStyleKey;
                  return (
                    <TouchableOpacity
                      key={sys.key}
                      style={[styles.systemCard, isSelected && styles.systemCardActive]}
                      onPress={() => handleSelectDesign(sys.key)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.systemCardTop}>
                        <Text style={[styles.systemTitle, isSelected && styles.systemTitleActive]}>
                          {sys.name}
                        </Text>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={isSelected ? '#0284c7' : '#cbd5e1'}
                        />
                      </View>

                      {/* Swatches Bar */}
                      <View style={styles.swatchesRow}>
                        {sys.swatches.map((swatch, idx) => (
                          <View key={swatch + idx} style={[styles.swatchCircle, { backgroundColor: swatch }]} />
                        ))}
                      </View>

                      <Text style={styles.systemDesc}>{sys.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
});
