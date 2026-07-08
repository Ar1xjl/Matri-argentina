// Shared pricing lookup — used by Calculator and Season Plan so indicative
// costs are computed the same way in both places.
import { supabase } from './supabaseClient'

// RLS returns whatever ancestor Distributor's pricing tables are visible —
// see SYSTEM_ARCHITECTURE.md's pricing-visibility note. No org filter needed.
export async function fetchOrgPricing() {
  const [{ data: brackets }, { data: product }, { data: serviceFee }, { data: generator }] = await Promise.all([
    supabase.from('volume_brackets').select('*'),
    supabase.from('pricing_product').select('*'),
    supabase.from('pricing_service_fee').select('*'),
    supabase.from('pricing_generator').select('*'),
  ])
  return { brackets: brackets || [], product: product || [], serviceFee: serviceFee || [], generator: generator || [] }
}

export function resolveBracket(brackets, vol) {
  return brackets.find(b => vol >= b.min_m3 && (b.max_m3 == null || vol < b.max_m3))?.code
}
export function getProductPrice(pricing, sku, vol) {
  const bracket = resolveBracket(pricing.brackets, vol)
  return pricing.product.find(p => p.sku === sku && p.bracket === bracket)?.price || 0
}
export function getServiceFee(pricing, vol) {
  const bracket = resolveBracket(pricing.brackets, vol)
  return pricing.serviceFee.find(f => f.bracket === bracket)?.price || 0
}
// Returns { purchase_price, rental_price } for the bracket matching vol.
export function getGeneratorPrice(pricing, vol) {
  const bracket = resolveBracket(pricing.brackets, vol)
  return pricing.generator.find(g => g.bracket === bracket) || { purchase_price: 0, rental_price: 0 }
}
