-- MatriSure kit lot/batch tracking, requested by Juan 2026-07-31: the QA
-- directive "if inventory surpasses 30 days of aging, product must be
-- destroyed and new cards ordered" needs a receipt date per batch, which
-- inventory_items (0005_inventory.sql) doesn't have — it's only an aggregate
-- quantity counter per SKU+variant+org, no concept of when stock arrived.
--
-- This table is additive alongside inventory_items, not a replacement: it
-- doesn't touch decrement_inventory()/the automatic per-Treatment stock
-- decrement, which keeps working exactly as before (aggregate, no FIFO by
-- lot — that precision wasn't asked for and isn't needed for the aging
-- alert/destroy-audit-trail this table exists for). Receiving a lot here
-- also bumps inventory_items.quantity by the same amount so the two stay in
-- sync; destroying a lot subtracts its remaining quantity back out.

create table matrisure_kit_lots (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id), -- Distributor holding the stock
  sku              text not null check (sku in ('MatriPowder','MatriTablets')),
  variant          text not null,
  lot_number       text not null, -- the "Lot/Batch No." printed on the MatriSure card, e.g. "2026.07.31"
  quantity         integer not null check (quantity >= 0),
  received_at      date not null default current_date,
  status           text not null default 'active' check (status in ('active','destroyed')),
  destroyed_at     timestamptz,
  destroyed_by     uuid references profiles(id),
  destroyed_reason text,
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now(),

  constraint matrisure_kit_lot_destroyed_fields check (
    status = 'active' or (destroyed_at is not null)
  )
);
create index matrisure_kit_lots_org_id_idx on matrisure_kit_lots(org_id);

alter table matrisure_kit_lots enable row level security;

-- Same subtree pattern as inventory_items — an Organization (and anything
-- above it) can see and manage its own lots; Customers are never in a
-- Distributor's subtree ancestry, so this stays invisible to them too.
create policy matrisure_kit_lots_all on matrisure_kit_lots for all
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));
