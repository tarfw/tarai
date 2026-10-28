// The last /v1/me on disk. Canvas opens on the saved workspace before the
// network answers; stale is fine, refreshMe corrects it.

import { File, Paths } from 'expo-file-system';
import type { TarWorkspace } from './tar';

const file = () => new File(Paths.cache, 'workspaces.json');

export async function saveWorkspaces(workspaces: TarWorkspace[]): Promise<void> {
  await file().write(JSON.stringify({ savedAt: Date.now(), workspaces }), { encoding: 'utf8' });
}

export async function cachedWorkspaces(): Promise<TarWorkspace[] | null> {
  const target = file();
  if (!target.exists) return null;
  try {
    return (JSON.parse(await target.text()) as { workspaces: TarWorkspace[] }).workspaces ?? null;
  } catch { return null; }
}
