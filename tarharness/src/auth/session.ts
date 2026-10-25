// One door, one credential: the TAR session. The phone never holds a
// database token or a provider token beyond the first exchange.

import { SignJWT, jwtVerify } from 'jose';
import type { Identity } from '../types.ts';

const ISSUER = 'tarharness';
const AUDIENCE = 'tar-session';
const SESSION_DAYS = 30;

export interface SessionEnv {
  readonly TAR_SESSION_SECRET?: string;
}

function key(env: SessionEnv): Uint8Array {
  const secret = env.TAR_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('TAR_SESSION_SECRET is not configured (min 32 chars).');
  return new TextEncoder().encode(secret);
}

export async function mintSession(env: SessionEnv, identity: Identity): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60_000;
  const token = await new SignJWT({ email: identity.email, name: identity.name ?? '' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(identity.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(key(env));
  return { token, expiresAt };
}

/** Verifies a TAR session token. Returns null when it is not a valid session. */
export async function verifySession(env: SessionEnv, authorization: string | null): Promise<Identity | null> {
  const value = authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!value) return null;
  try {
    const { payload } = await jwtVerify(value, key(env), { issuer: ISSUER, audience: AUDIENCE });
    if (!payload.sub) return null;
    return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : '', name: typeof payload.name === 'string' ? payload.name : null };
  } catch {
    return null;
  }
}
