// Shared correlative-sequence generator — first built for Generators.jsx
// (bulk registration of GEN-001..GEN-010 style batches), reused by
// KitsGlobal.jsx for kit tracking numbers. Given a base value with a
// trailing number, generates the correlative run, keeping the prefix/suffix
// and the number's zero-padded width.
export function generateSequence(base, count) {
  const match = base.match(/^(.*?)(\d+)(\D*)$/)
  if (!match) return Array.from({ length: count }, (_, i) => (count > 1 ? `${base}-${i + 1}` : base))
  const [, prefix, digits, suffix] = match
  const width = digits.length
  const start = parseInt(digits, 10)
  return Array.from({ length: count }, (_, i) => `${prefix}${String(start + i).padStart(width, '0')}${suffix}`)
}
