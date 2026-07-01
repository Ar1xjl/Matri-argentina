// ── MaTri Argentina — Pricing engine ─────────────────────────────────────
// Single source of truth for all prices.
// Wassington / FreshInset admin edits these values in the Pricing panel.
// In production this will live in the database (Supabase).

// ── Volume brackets (shared across all tables) ────────────────────────────
export const BRACKETS = [
  { id: 'xs', label: '0 – 600 m³',     min: 0,    max: 600  },
  { id: 'sm', label: '600 – 1200 m³',  min: 600,  max: 1200 },
  { id: 'md', label: '1200 – 1800 m³', min: 1200, max: 1800 },
  { id: 'lg', label: '1800+ m³',       min: 1800, max: Infinity },
]

// ── Tiers ─────────────────────────────────────────────────────────────────
export const TIERS = ['T1', 'T2', 'T3']

// ── Helper: find bracket for a given volume ───────────────────────────────
export function getBracket(vol) {
  return BRACKETS.find(b => vol >= b.min && vol < b.max) || BRACKETS[BRACKETS.length - 1]
}

// ── Helper: get price from a table for tier + volume ─────────────────────
export function getPrice(table, tier, vol) {
  const bracket = getBracket(vol)
  return table[tier]?.[bracket.id] ?? 0
}

// ══════════════════════════════════════════════════════════════════════════
// TABLE 1 — Product price (USD / m³)
// One entry per SKU. Add new SKUs here without touching any other file.
// ══════════════════════════════════════════════════════════════════════════
export const PRODUCT_PRICES = {
  MatriPowder: {
    label: 'MatriPowder',
    unit: '$/m³',
    prices: {
      T1: { xs: 0.75, sm: 0.70, md: 0.65, lg: 0.60 },
      T2: { xs: 0.90, sm: 0.85, md: 0.80, lg: 0.75 },
      T3: { xs: 1.05, sm: 1.00, md: 0.95, lg: 0.90 },
    }
  },
  MatriTablets: {
    label: 'MatriTablets',
    unit: '$/m³',
    prices: {
      T1: { xs: 0.80, sm: 0.75, md: 0.70, lg: 0.65 },
      T2: { xs: 0.95, sm: 0.90, md: 0.85, lg: 0.80 },
      T3: { xs: 1.10, sm: 1.05, md: 1.00, lg: 0.95 },
    }
  },
}

// ══════════════════════════════════════════════════════════════════════════
// TABLE 2 — Application service fee (USD / room / treatment)
// Only applies to MatriPowder managed service.
// ══════════════════════════════════════════════════════════════════════════
export const SERVICE_FEES = {
  label: 'Servicio de aplicación',
  unit: '$/cámara',
  prices: {
    T1: { xs: 120, sm: 150, md: 180, lg: 200 },
    T2: { xs: 130, sm: 160, md: 190, lg: 210 },
    T3: { xs: 140, sm: 170, md: 200, lg: 220 },
  }
}

// ══════════════════════════════════════════════════════════════════════════
// TABLE 3 — Generator pricing (USD)
// Purchase price, daily rental, and bonus threshold (number of rooms
// above which Wassington may offer to subsidize the purchase).
// ══════════════════════════════════════════════════════════════════════════
export const GENERATOR_PRICES = {
  label: 'Generador MaTri',
  purchase: {
    T1: { xs: 800, sm: 800, md: 750, lg: 700 },
    T2: { xs: 850, sm: 850, md: 800, lg: 750 },
    T3: { xs: 900, sm: 900, md: 850, lg: 800 },
  },
  rental: {
    T1: { xs: 40, sm: 40, md: 38, lg: 35 },
    T2: { xs: 45, sm: 45, md: 42, lg: 40 },
    T3: { xs: 50, sm: 50, md: 47, lg: 45 },
  },
}
