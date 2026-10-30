/** Money is stored as minor units (paise) everywhere; text is produced only at
 * the edge (a card number, an inbox line). Storing formatted strings in
 * `current` baked presentation into derived data, so it is not done. */
export function formatMoney(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const paise = Math.abs(minor % 100);
  const base = whole.toLocaleString('en-IN');
  return paise === 0 ? `Rs. ${base}` : `Rs. ${base}.${String(paise).padStart(2, '0')}`;
}
