// Shared pricing lookup — used by Calculator and Season Plan so indicative
// costs are computed the same way in both places.
import { supabase } from './supabaseClient'

// volume_brackets/pricing_* SELECT RLS is bidirectional (migration 0003) — a
// Customer sees pricing from every ancestor at once, and a Distributor sees
// pricing from every descendant Sub-distributor that's configured its own.
// Fetching with no org filter and taking whatever `.find()` returns first
// used to be undefined behavior whenever more than one org in the chain had
// pricing configured (Fase H, 2026-07-16). `resolve_pricing_owner()` picks
// ONE owner org — the nearest one at-or-above `targetOrgId` that actually
// has brackets configured — and everything below filters down to just that
// owner, so callers still get a single, self-consistent pricing set exactly
// like before this fix, just no longer ambiguous when several exist.
export async function fetchOrgPricing(targetOrgId = null) {
  const [{ data: brackets }, { data: product }, { data: serviceFee }, { data: generator }, ownerResult] = await Promise.all([
    supabase.from('volume_brackets').select('*'),
    supabase.from('pricing_product').select('*'),
    supabase.from('pricing_service_fee').select('*'),
    supabase.from('pricing_generator').select('*'),
    targetOrgId ? supabase.rpc('resolve_pricing_owner', { p_target_org: targetOrgId }) : Promise.resolve({ data: null }),
  ])
  const owner = ownerResult.data
  const toOwner = (rows) => owner ? (rows || []).filter(r => r.org_id === owner) : (rows || [])
  return {
    brackets: toOwner(brackets),
    product: toOwner(product),
    serviceFee: toOwner(serviceFee),
    generator: toOwner(generator),
  }
}

// Resolves the pricing-owner org for several target orgs at once (e.g. the
// Season Plan rollup, which prices many different Customers in one screen)
// — one RPC round-trip per distinct org, in parallel, returned as a Map for
// synchronous lookup afterward.
export async function fetchPricingOwnersForOrgs(orgIds) {
  const uniqueIds = [...new Set(orgIds.filter(Boolean))]
  const results = await Promise.all(
    uniqueIds.map(id => supabase.rpc('resolve_pricing_owner', { p_target_org: id }))
  )
  return new Map(uniqueIds.map((id, i) => [id, results[i].data]))
}

// Given the raw (unfiltered, multi-org) pricing arrays and a single resolved
// owner org id, narrows down to just that owner's rows — used by screens
// pricing several different Customers at once (each against its own owner),
// where fetchOrgPricing() itself is called with no targetOrgId to get the
// full raw dataset up front.
export function pricingForOwner(allPricing, ownerOrgId) {
  const toOwner = (rows) => ownerOrgId ? rows.filter(r => r.org_id === ownerOrgId) : rows
  return {
    brackets: toOwner(allPricing.brackets),
    product: toOwner(allPricing.product),
    serviceFee: toOwner(allPricing.serviceFee),
    generator: toOwner(allPricing.generator),
  }
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

// ── Pouch catalog (Fase E — editable SKU catalog, 2026-07-12) ──────────────
// Bidirectional visibility, same as pricing: a Customer reads its
// Distributor's catalog, but only the Distributor can edit it. Returns
// plain sizes sorted descending, ready to hand straight to greedyCeiling().
export async function fetchPouchCatalog() {
  const { data } = await supabase.from('pouch_catalog').select('*').eq('active', true).order('size_g', { ascending: false })
  return (data || []).map(r => r.size_g)
}
