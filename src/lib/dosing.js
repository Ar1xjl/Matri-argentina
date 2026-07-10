// Shared dosing/pouch math — used by Calculator, Treatments list, and Dashboard.
// Extracted 2026-07-07 so the pouch breakdown can be recomputed anywhere
// from (product, dose, room volume) instead of being stored on the Treatment.

// Default/fallback only — real usage should fetch a Distributor's own
// catalog via src/lib/orgPricing.js's fetchPouchCatalog() (Fase E, editable
// SKU catalog, 2026-07-12). Kept as a default param so display-only call
// sites that haven't been updated to pass a real catalog yet don't crash.
export const POUCHES   = [100, 50, 20, 10]
export const DOSE_BASE = 0.067

export function greedyCeiling(g, pouchSizes = POUCHES) {
  let rem = g, r = []
  for (const s of pouchSizes) { const q = Math.floor(rem/s); r.push({size:s, qty:q}); rem -= q*s }
  if (rem > 0.001) r[r.length-1].qty += 1
  return r
}

// Powder "adjusted" alternative — floor instead of ceiling, so it never
// exceeds the target dose (may fall short instead).
export function greedyFloor(g, pouchSizes = POUCHES) {
  let rem = g, r = []
  for (const s of pouchSizes) { const q = Math.floor(rem/s); r.push({size:s, qty:q}); rem -= q*s }
  return r
}

export function comboGrams(c) { return c.reduce((s,p) => s + p.size*p.qty, 0) }
export function comboLabel(c) { return c.filter(p=>p.qty>0).map(p=>`${p.qty}×${p.size}g`).join(' + ') || '—' }
export function actualPpb(g, vol) { return (g / (vol * DOSE_BASE)) * 1000 }

// Tablets: two sizes (restored 2026-07-12 — "chica" was paused 2026-07-11,
// Juan brought it back once the envelope catalog existed to hang it off).
// Grande delivers 1000 ppb across 5 m³; chica delivers the same 1000 ppb
// but across only 2.5 m³ — i.e. chica is worth half a grande in dose terms.
// Envelope pack sizes (see tablet_catalog) are a pure Inventory/purchasing
// concern and never affect this math — a Treatment just needs N individual
// tablets, same principle as Powder's pouch sizes vs. its dosing math.
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
// Tablets: grande/chica breakdown, scaled to the target dose.
export function pouchBreakdownLabel(product, targetDosePpb, volumeM3, pouchSizes = POUCHES) {
  if (!volumeM3) return '—'
  if (product === 'tablets') {
    const { large, small } = tabletCombo(targetDosePpb, volumeM3)
    return [large && `${large}×grande`, small && `${small}×chica`].filter(Boolean).join(' + ') || '—'
  }
  const grams = volumeM3 * DOSE_BASE * (targetDosePpb / 1000)
  return comboLabel(greedyCeiling(grams, pouchSizes))
}

// Display helper for an actual Treatment record (DOMAIN_MODEL.md Rule 37):
// once approved, a MatriPowder Treatment's sachet breakdown is frozen on
// `pouch_breakdown` — show that instead of recomputing from today's
// catalog, which may have changed since. Only Submitted (not yet approved)
// Treatments fall back to a live indicative recompute.
export function pouchBreakdownDisplay(treatment) {
  if (treatment.product === 'tablets') {
    return pouchBreakdownLabel('tablets', treatment.target_dose_ppb, treatment.cold_rooms?.volume_m3)
  }
  if (treatment.pouch_breakdown) {
    return comboLabel(treatment.pouch_breakdown)
  }
  return pouchBreakdownLabel('powder', treatment.target_dose_ppb, treatment.cold_rooms?.volume_m3)
}
