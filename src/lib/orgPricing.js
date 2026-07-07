// Shared pricing lookup — used by Calculator and Season Plan so indicative
// costs are computed the same way in both places.
import { supabase } from './supabaseClient'

// RLS returns whatever ancestor Distributor's pricing tables are visible —
// see SYSTEM_ARCHITECTURE.md's pricing-visibility note. No org filter needed.
export async function fetchOrgPricing() {
  const [{ data: brackets }, { data: product }, { data: serviceFee }] = await Promise.all([
    supabase.from('volume_brackets').select('*'),
    supabase.from('pricing_product').select('*'),
    supabase.from('pricing_service_fee').select('*'),
  ])
  return { brackets: brackets || [], product: product || [], serviceFee: serviceFee || [] }
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
