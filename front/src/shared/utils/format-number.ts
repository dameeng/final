/** Display only: never use formatted values for thresholds or API writes. */
export function formatDecimal(value: unknown, fallback = '—'): string {
  if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : fallback
}
