/**
 * Colour maths shared by the design library build and the runtime audit.
 * Kept free of other site modules so build scripts can import it without pulling in the catalog.
 */

export function hexRgb(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function luminance(value: string): number | null {
  const rgb = hexRgb(value);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const scaled = channel / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [high, low] = la >= lb ? [la, lb] : [lb, la];
  return (high + 0.05) / (low + 0.05);
}

export function isHex(value: string): boolean {
  return hexRgb(value) !== null;
}

export function isGradient(value: string): boolean {
  return /gradient\s*\(/i.test(value);
}

function toHex(channels: number[]): string {
  return `#${channels.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')).join('')}`;
}

/** Blend two hex colours; `t` is the weight of `b`. */
export function mix(a: string, b: string, t: number): string {
  const from = hexRgb(a);
  const to = hexRgb(b);
  if (!from || !to) return a;
  return toHex([0, 1, 2].map((index) => from[index] + (to[index] - from[index]) * t));
}

/**
 * Nudge `value` toward black or white until it clears `minimum` against `background`.
 * Returns the input untouched when it already passes; floors are how the build keeps a
 * source palette readable without rewriting the reference file.
 */
export function ensureContrast(value: string, background: string, minimum: number): string {
  const current = contrast(value, background);
  if (current === null || current >= minimum) return value;
  const target = (luminance(background) ?? 0) >= 0.4 ? '#000000' : '#ffffff';
  for (let step = 1; step <= 24; step++) {
    const candidate = mix(value, target, step / 24);
    if ((contrast(candidate, background) ?? 0) >= minimum) return candidate;
  }
  return value;
}

/** Button label colour that reads on `accent`, preferring light on dark. */
export function labelOn(accent: string): string {
  const white = contrast('#ffffff', accent) ?? 0;
  const black = contrast('#000000', accent) ?? 0;
  return white >= black ? '#ffffff' : '#000000';
}
