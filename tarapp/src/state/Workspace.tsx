// One user, many workspaces. The switch is the list: a badge per row, one
// tap. No auto-switch, no merged inbox, no join.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { me, signOutSession, TarError, type Slice, type TarWorkspace } from '@/lib/tar';
import { cachedSlice, saveSlice } from '@/lib/slicecache';

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
      setCurrentSlug((previous) => {
        const saved = previous ?? null;
        if (saved && result.workspaces.some((ws) => ws.slug === saved)) return saved;
        const fallback = result.workspaces.find((ws) => ws.mode === 'work') ?? result.workspaces[0];
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
      const fresh = await (async () => {
        const direct = await import('@/lib/tar').then((tar) => tar.slice(currentSlug, undefined));
        return direct;
      })();
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
      await refreshMe();
      setLoading(false);
    })();
  }, [refreshMe]);

  useEffect(() => {
    if (!currentSlug) return;
    void (async () => {
      const cached = await cachedSlice(currentSlug);
      setSliceData(cached ? cached.slice : null);
      setStale(Boolean(cached));
      await refreshSlice();
    })();
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
