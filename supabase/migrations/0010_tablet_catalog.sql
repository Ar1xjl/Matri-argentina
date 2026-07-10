-- Fase E — SKU catalog, MatriTablets (2026-07-12). Brings back the "chica"
-- tablet (paused 2026-07-11) now that there's a place to hang its envelope
-- packaging on: grande (1000 ppb / 5 m³) and chica (1000 ppb / 2.5 m³) are
-- each sold in their own non-splittable envelope sizes, editable per
-- Distributor — same idea as pouch_catalog for MatriPowder, but this one is
-- a pure Inventory/purchasing concept and never feeds dosing math (see
-- dosing.js's tabletCombo), so it doesn't need pouch_catalog's bidirectional
-- Customer-visibility — same subtree-only access as inventory_items itself.

create table tablet_catalog (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id), -- Distributor
  tablet_size     text not null check (tablet_size in ('grande','chica')),
  envelope_count  integer not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (org_id, tablet_size, envelope_count)
);
create index tablet_catalog_org_id_idx on tablet_catalog(org_id);

alter table tablet_catalog enable row level security;

create policy tablet_catalog_all on tablet_catalog for all
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

-- Juan's call (2026-07-12): block deleting an envelope size that still has
-- stock tracked under it (inventory_items.variant = 'sobre_{count}_{size}'),
-- rather than silently losing that data — same spirit as cold_rooms being
-- FK-protected from deletion while Treatments still reference it.
create or replace function prevent_deleting_tablet_size_with_stock()
returns trigger
language plpgsql
as $$
declare
  v_variant  text;
  v_quantity numeric;
begin
  v_variant := 'sobre_' || old.envelope_count || '_' || old.tablet_size;
  select quantity into v_quantity from inventory_items
    where org_id = old.org_id and sku = 'MatriTablets' and variant = v_variant;
  if v_quantity is not null and v_quantity <> 0 then
    raise exception 'No se puede eliminar: todavía hay stock cargado bajo este tamaño de sobre (%)', v_variant;
  end if;
  return old;
end;
$$;

create trigger trg_prevent_deleting_tablet_size_with_stock
  before delete on tablet_catalog
  for each row execute function prevent_deleting_tablet_size_with_stock();

-- Backfill Wassington's existing 10/15/50 sizes for "grande" (the only size
-- tracked before this change) so nothing breaks on cutover.
do $$
declare
  v_wassington_id uuid;
begin
  select id into v_wassington_id from organizations where name = 'Wassington';
  if v_wassington_id is not null then
    insert into tablet_catalog (org_id, tablet_size, envelope_count) values
      (v_wassington_id, 'grande', 10), (v_wassington_id, 'grande', 15), (v_wassington_id, 'grande', 50)
    on conflict (org_id, tablet_size, envelope_count) do nothing;
  end if;
end $$;
