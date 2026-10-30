// clamp.ts — trims merchant text so layouts never break (paraiv2 §7 last row).
// Lengths are the ones the sections are designed around.

export const clamp = (value: unknown, max: number): string =>
  (typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim().slice(0, max).trim();

export const tagline = (value: unknown): string => clamp(value, 24);
export const about = (value: unknown): string => clamp(value, 160);
export const title = (value: unknown): string => clamp(value, 60);
export const line = (value: unknown): string => clamp(value, 120);
