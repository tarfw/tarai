// The write queue: taps wait here in order when the phone is offline, replay
// with their idempotency keys when it isn't, and the badge tells the truth.

import { File, Paths } from 'expo-file-system';
import { intent, TarError } from './tar';

export interface QueueItem {
  readonly key: string;
  readonly ws: string;
  readonly action: string;
  readonly input: Record<string, unknown>;
  readonly label: string;
  confirmed?: boolean;
  state: 'pending' | 'confirm';
  error?: string;
  addedAt: number;
}

type Listener = () => void;

const file = () => new File(Paths.cache, 'tar-queue.json');
let items: QueueItem[] = [];
let loaded = false;
let flushing = false;
const listeners = new Set<Listener>();

function emit() { for (const listener of listeners) listener(); }

async function persist() {
  // write() overwrites; delete() throws when the file doesn't exist yet
  await file().write(JSON.stringify(items), { encoding: 'utf8' });
}

async function load() {
  if (loaded) return;
  loaded = true;
  const target = file();
  if (target.exists) {
    try { items = JSON.parse(await target.text()) as QueueItem[]; } catch { items = []; }
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function snapshot(): Promise<QueueItem[]> {
  await load();
  return [...items];
}

export async function pendingCount(): Promise<number> {
  await load();
  return items.filter((item) => item.state === 'pending').length;
}

export async function confirmRequest(): Promise<QueueItem | null> {
  await load();
  return items.find((item) => item.state === 'confirm') ?? null;
}

export async function enqueue(item: Omit<QueueItem, 'state' | 'addedAt'>): Promise<void> {
  await load();
  items = [...items, { ...item, state: item.confirmed === true ? 'pending' : 'pending', addedAt: Date.now() }];
  await persist();
  emit();
  void flush();
}

/** The member pressed Confirm on a parked item: it resumes at the front. */
export async function resolveConfirm(key: string, confirmed: boolean): Promise<void> {
  await load();
  const target = items.find((item) => item.key === key);
  if (!target) return;
  if (confirmed) {
    target.confirmed = true;
    target.state = 'pending';
  } else {
    items = items.filter((item) => item.key !== key);
  }
  await persist();
  emit();
  void flush();
}

/** Replay in order. The first offline item parks the queue behind it. */
export async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    await load();
    while (items.length) {
      const item = items.find((entry) => entry.state === 'pending');
      if (!item) break;
      try {
        const outcome = await intent(item.ws, item.action, item.input, item.key, item.confirmed === true);
        if (outcome.gate) {
          // money or customer: the one confirm. Park it, surface it, stop.
          item.state = 'confirm';
          await persist();
          emit();
          break;
        }
        items = items.filter((entry) => entry.key !== item.key);
        await persist();
        emit();
      } catch (cause) {
        if (cause instanceof TarError && cause.status >= 400 && cause.status < 500 && cause.status !== 429) {
          // a refusal is an answer: drop it, remember why
          items = items.filter((entry) => entry.key !== item.key);
          await persist();
          emit();
          break;
        }
        break; // offline or the server is down: the queue waits
      }
    }
  } finally { flushing = false; }
}
