// One user, many workspaces. The switch is the list: a badge per row, one
// tap. No auto-switch, no merged inbox, no join.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { handle, me, slice, signOutSession, TarError, type Slice, type TarWorkspace } from '@/lib/tar';
import { cachedSlice, saveSlice } from '@/lib/slicecache';
import { cachedWorkspaces, saveWorkspaces } from '@/lib/wscache';

const CURRENT_KEY = 'tar_current_ws';

interface WorkspaceState {
  workspaces: TarWorkspace[];
  current: TarWorkspace | null;
  slice: Slice | null;
  sliceStale: boolean;
  loading: boolean;
  select: (slug: string) => void;
  refreshMe: () => Promise<void>;
  refreshSlice: () => Promise<void>;
}

const Context = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<TarWorkspace[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [sliceData, setSliceData] = useState<Slice | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const result = await me();
      setWorkspaces(result.workspaces);
      void saveWorkspaces(result.workspaces);
      setCurrentSlug((previous) => {
        const saved = previous ?? null;
        if (saved && result.workspaces.some((ws) => ws.slug === saved)) return saved;
        // A new account gets only Personal; onboarding creates the business
        // workspace, so never fall through to Personal on first open.
        const fallback = result.workspaces.find((ws) => ws.mode === 'work');
        void SecureStore.setItemAsync(CURRENT_KEY, fallback?.slug ?? '');
        return fallback?.slug ?? null;
      });
    } catch (cause) {
      if (cause instanceof TarError && cause.status === 401) {
        await signOutSession();
        setWorkspaces([]);
      }
    }
  }, []);

  const refreshSlice = useCallback(async () => {
    if (!currentSlug) return;
    try {
      const fresh = await slice(currentSlug, undefined);
      if (fresh) {
        setSliceData(fresh);
        setStale(false);
        await saveSlice(currentSlug, fresh);
      }
    } catch {
      setStale(true);
    }
  }, [currentSlug]);

  useEffect(() => {
    void (async () => {
      const saved = await SecureStore.getItemAsync(CURRENT_KEY);
      if (saved !== null && saved !== '') setCurrentSlug(saved);
      // hydrate from disk so current exists before the network answers;
      // without this canvas falls to Onboarding on every open
      const cached = await cachedWorkspaces();
      if (cached?.length) {
        setWorkspaces(cached);
        setCurrentSlug((previous) => {
          if (previous && cached.some((ws) => ws.slug === previous)) return previous;
          const fallback = cached.find((ws) => ws.mode === 'work');
          if (!fallback) return null;
          void SecureStore.setItemAsync(CURRENT_KEY, fallback.slug);
          return fallback.slug;
        });
      }
      await refreshMe();
      setLoading(false);
    })();
  }, [refreshMe]);

  useEffect(() => {
    if (!currentSlug) return;
    let active = true;
    let conn: any = null;
    void (async () => {
      const cached = await cachedSlice(currentSlug);
      if (active) {
        setSliceData(cached ? cached.slice : null);
        setStale(Boolean(cached));
      }
      await refreshSlice();
      // Official Rivet 3.0 realtime connection: subscribe to actor SQLite events
      try {
        const w = await handle(currentSlug);
        if (!active) return;
        conn = w.connect();
        const onEvent = () => { if (active) void refreshSlice(); };
        for (const ev of ['work_changed', 'stock_changed', 'ledger_changed', 'member_joined', 'automations_changed', 'automation_fired']) {
          conn.on(ev, onEvent);
        }
      } catch { /* offline fallback */ }
    })();
    return () => {
      active = false;
      try { conn?.dispose?.(); } catch {}
    };
  }, [currentSlug, refreshSlice]);

  const select = useCallback((slug: string) => {
    setCurrentSlug(slug);
    void SecureStore.setItemAsync(CURRENT_KEY, slug);
  }, []);

  const current = useMemo(() => workspaces.find((ws) => ws.slug === currentSlug) ?? null, [workspaces, currentSlug]);

  const value = useMemo<WorkspaceState>(() => ({
    workspaces, current, slice: sliceData, sliceStale: stale, loading,
    select, refreshMe, refreshSlice,
  }), [workspaces, current, sliceData, stale, loading, select, refreshMe, refreshSlice]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const value = useContext(Context);
  if (!value) throw new Error('useWorkspace needs the WorkspaceProvider');
  return value;
}
