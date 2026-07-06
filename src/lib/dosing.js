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

// Tablets: 1 large tablet is rated for 1000 ppb across 5 m³ (a small tablet is
// half that payload, rated for 1000 ppb across 2.5 m³). Tablet count must scale
// with the target dose — fewer tablets in the same room yields a lower ppb
// concentration — the same way pouch grams scale with target dose for powder.
export function tabletCombo(targetDosePpb, volumeM3) {
  if (!volumeM3) return { large: 0, small: 0, ppb: 0 }
  const unitsNeeded = (volumeM3 / 5) * (targetDosePpb / 1000) // large-tablet-equivalents
  const large = Math.floor(unitsNeeded)
  const remUnits = unitsNeeded - large
  const small = remUnits > 0.0001 ? Math.ceil(remUnits / 0.5) : 0
  const achievedUnits = large + small * 0.5
  const ppb = (achievedUnits / (volumeM3 / 5)) * 1000
  return { large, small, ppb }
}

// Powder: pouch breakdown label from target dose + room volume.
// Tablets: large/small tablet breakdown, scaled to the target dose.
export function pouchBreakdownLabel(product, targetDosePpb, volumeM3) {
  if (!volumeM3) return '—'
  if (product === 'tablets') {
    const { large, small } = tabletCombo(targetDosePpb, volumeM3)
    return [large && `${large}×grande`, small && `${small}×chica`].filter(Boolean).join(' + ') || '—'
  }
  const grams = volumeM3 * DOSE_BASE * (targetDosePpb / 1000)
  return comboLabel(greedyCeiling(grams))
}
