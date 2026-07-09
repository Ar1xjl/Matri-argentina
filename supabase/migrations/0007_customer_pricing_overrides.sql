-- Fase E — Gestión de Precios (2026-07-11): a negotiated price per Customer,
-- set by whichever Organization is above them in the tree (their Distributor
-- or Sub-distributor) — no new "account rep" concept needed, the org tree
-- already expresses "who this customer is assigned to".
--
-- Two independent mechanisms per SKU/fee, resolved in this order at the
-- point of use (see src/lib/orgPricing.js):
--   1. A fixed override price (large strategic clients — flat $/m³, replaces
--      the whole volume-bracket table).
--   2. A % discount off the standard list price (mid-size clients).
--   3. Otherwise, standard list price — unchanged (small/high-risk clients).
--
-- minimum_commitment_m3 is purely informational: the app only ever shows
-- committed-vs-actual, it never auto-reverts or blocks a price. That
-- decision always stays a human one.

create table customer_pricing_overrides (
  id                        uuid primary key default gen_random_uuid(),
  customer_org_id           uuid not null references organizations(id) unique,
  powder_price_override     numeric,              -- $/m³, null = no fixed override
  tablets_price_override    numeric,               -- $/m³, null = no fixed override
  service_fee_override      numeric,               -- flat amount, 0 = bonificado/gratis
  powder_discount_pct       numeric not null default 0,
  tablets_discount_pct      numeric not null default 0,
  service_fee_discount_pct  numeric not null default 0,
  minimum_commitment_m3     numeric,
  notes                     text,
  updated_by                uuid references profiles(id),
  updated_at                timestamptz not null default now()
);
create index customer_pricing_overrides_customer_org_id_idx on customer_pricing_overrides(customer_org_id);

alter table customer_pricing_overrides enable row level security;

-- The Customer can see their own row (so their Calculator/Season Plan can
-- resolve their own price); any ancestor Organization can see it too
-- (needed to manage it, or just to know it exists).
create policy customer_pricing_overrides_select on customer_pricing_overrides
  for select using (is_in_subtree(customer_org_id, current_org_id()));

-- Only an ancestor Organization's Owner/Approver can set or change it — a
-- Customer must never be able to negotiate their own price (excluded via
-- customer_org_id <> current_org_id(), since is_in_subtree() alone also
-- trivially matches the Customer's own org).
create policy customer_pricing_overrides_insert on customer_pricing_overrides
  for insert with check (
    customer_org_id <> current_org_id()
    and is_in_subtree(customer_org_id, current_org_id())
    and has_role(array['owner','approver']::business_role[])
  );

create policy customer_pricing_overrides_update on customer_pricing_overrides
  for update using (
    customer_org_id <> current_org_id()
    and is_in_subtree(customer_org_id, current_org_id())
    and has_role(array['owner','approver']::business_role[])
  )
  with check (
    customer_org_id <> current_org_id()
    and is_in_subtree(customer_org_id, current_org_id())
    and has_role(array['owner','approver']::business_role[])
  );
