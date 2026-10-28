// Terms consent, once per account. Local only: the version lives on the
// device, so a reinstall asks again and a new account starts clean.

import * as SecureStore from 'expo-secure-store';

export const TERMS_VERSION = '2026-10-28';

let memory: Record<string, string> = {};

export async function acceptedTerms(userId: string): Promise<boolean> {
  if (memory[userId] === TERMS_VERSION) return true;
  try {
    return (await SecureStore.getItemAsync(`tar_terms_${userId}`)) === TERMS_VERSION;
  } catch {
    return memory[userId] === TERMS_VERSION;
  }
}

export async function acceptTerms(userId: string): Promise<void> {
  memory[userId] = TERMS_VERSION;
  try {
    await SecureStore.setItemAsync(`tar_terms_${userId}`, TERMS_VERSION);
  } catch { /* the in-memory flag still covers this session */ }
}
