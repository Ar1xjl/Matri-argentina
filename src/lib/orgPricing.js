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

// ── Customer Pricing Override (DOMAIN_MODEL.md Rule 36) ────────────────────
// A negotiated price is resolved per SKU/fee: fixed override wins, else a %
// discount off list, else standard list price. Never auto-enforced beyond
// that — minimum_commitment_m3 is informational only, handled in the UI.

// This Customer's own override — filtered explicitly by org id (not left to
// RLS alone) since a Distributor caller would otherwise see every one of
// its Customers' rows, not just one.
export async function fetchCustomerOverride(customerOrgId) {
  if (!customerOrgId) return null
  const { data } = await supabase.from('customer_pricing_overrides').select('*').eq('customer_org_id', customerOrgId).maybeSingle()
  return data
}

// Every override visible to the caller (a Distributor/Sub-distributor sees
// all of its descendant Customers') — for screens that price multiple
// Customers at once, e.g. the Season Plan rollup.
export async function fetchAllCustomerOverrides() {
  const { data } = await supabase.from('customer_pricing_overrides').select('*')
  return data || []
}

function applyOverride(standardPrice, override, fixedKey, pctKey) {
  if (!override) return standardPrice
  if (override[fixedKey] != null) return override[fixedKey]
  const pct = override[pctKey] || 0
  return pct > 0 ? standardPrice * (1 - pct / 100) : standardPrice
}

export function resolveProductPrice(pricing, sku, vol, override) {
  const standard = getProductPrice(pricing, sku, vol)
  const fixedKey = sku === 'MatriPowder' ? 'powder_price_override' : 'tablets_price_override'
  const pctKey   = sku === 'MatriPowder' ? 'powder_discount_pct'   : 'tablets_discount_pct'
  return applyOverride(standard, override, fixedKey, pctKey)
}

export function resolveServiceFee(pricing, vol, override) {
  const standard = getServiceFee(pricing, vol)
  return applyOverride(standard, override, 'service_fee_override', 'service_fee_discount_pct')
}
