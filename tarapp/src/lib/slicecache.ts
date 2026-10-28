// The last slice on disk. Stale offline is fine: the slice is disposable.

import { File, Paths } from 'expo-file-system';
import type { Slice } from './tar';

const file = (ws: string) => new File(Paths.cache, `slice-${ws}.json`);

export async function saveSlice(ws: string, slice: Slice): Promise<void> {
  const target = file(ws);
  // write() overwrites; delete() throws when the file doesn't exist yet
  await target.write(JSON.stringify({ savedAt: Date.now(), slice }), { encoding: 'utf8' });
}

export async function cachedSlice(ws: string): Promise<{ savedAt: number; slice: Slice } | null> {
  const target = file(ws);
  if (!target.exists) return null;
  try {
    return JSON.parse(await target.text()) as { savedAt: number; slice: Slice };
  } catch { return null; }
}
