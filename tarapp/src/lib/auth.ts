// Identity, Phase 1: a device-local profile. Google sign-in returns with the
// Access+safety build-out; every screen already works without it.

import * as SecureStore from "expo-secure-store";

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  photo: string | null;
  idToken: string | null;
}

const LOCAL_USER_KEY = "tar_local_user";

export async function getCurrentUser(): Promise<UserProfile> {
  const raw = await SecureStore.getItemAsync(LOCAL_USER_KEY);
  if (raw) return JSON.parse(raw) as UserProfile;
  const local: UserProfile = { id: "local", name: "Owner", email: "local@tar.app", photo: null, idToken: null };
  await SecureStore.setItemAsync(LOCAL_USER_KEY, JSON.stringify(local));
  return local;
}

/** Clears the local profile + session; onboarding starts fresh. */
export async function signOutGoogle(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCAL_USER_KEY);
  const { signOutSession } = await import("./tar");
  await signOutSession();
}

/** Kept for compatibility; the local identity needs no token. */
export async function getValidIdToken(): Promise<string | null> {
  return null;
}

export async function trySilentSignIn(): Promise<UserProfile | null> {
  return getCurrentUser();
}

export async function signInWithGoogle(): Promise<UserProfile> {
  return getCurrentUser();
}

export async function invalidateGoogleToken(): Promise<void> {}
