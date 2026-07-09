// Shared dosing/pouch math — used by Calculator, Treatments list, and Dashboard.
// Extracted 2026-07-07 so the pouch breakdown can be recomputed anywhere
// from (product, dose, room volume) instead of being stored on the Treatment.

export const POUCHES   = [100, 50, 20, 10]
export const DOSE_BASE = 0.067

export function greedyCeiling(g) {
  let rem = g, r = []
  for (const s of POUCHES) { const q = Math.floor(rem/s); r.push({size:s, qty:q}); rem -= q*s }
  if (rem > 0.001) r[r.length-1].qty += 1
  return r
}

export function comboGrams(c) { return c.reduce((s,p) => s + p.size*p.qty, 0) }
export function comboLabel(c) { return c.filter(p=>p.qty>0).map(p=>`${p.qty}×${p.size}g`).join(' + ') || '—' }
export function actualPpb(g, vol) { return (g / (vol * DOSE_BASE)) * 1000 }

// Tablets: only "grande" tracked for now (2026-07-11) — 1 tablet is rated
// for 1000 ppb across 5 m³. "Chica" is paused: tablets ship in non-splittable
// envelopes of 10/15/50 (see Inventory), so a finer half-tablet unit isn't
// worth the complexity yet. Whole-tablet rounding is the dosing granularity;
// which envelope size to open is a separate, manual Inventory decision —
// leftover loose tablets from an opened envelope carry over to the next
// Treatment, so per-treatment cost is never inflated by envelope rounding.
export function tabletCombo(targetDosePpb, volumeM3) {
  if (!volumeM3) return { count: 0, ppb: 0 }
  const unitsNeeded = (volumeM3 / 5) * (targetDosePpb / 1000) // tablet-equivalents
  const count = Math.ceil(unitsNeeded)
  const ppb = (count / (volumeM3 / 5)) * 1000
  return { count, ppb }
}

// Powder: pouch breakdown label from target dose + room volume.
// Tablets: tablet count, scaled to the target dose.
export function pouchBreakdownLabel(product, targetDosePpb, volumeM3) {
  if (!volumeM3) return '—'
  if (product === 'tablets') {
    const { count } = tabletCombo(targetDosePpb, volumeM3)
    return count > 0 ? `${count}×tableta` : '—'
  }
  const grams = volumeM3 * DOSE_BASE * (targetDosePpb / 1000)
  return comboLabel(greedyCeiling(grams))
}
