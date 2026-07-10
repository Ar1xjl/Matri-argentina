-- Fase E — Catálogo de SKU editable (2026-07-12), first cut: MatriPowder
-- pouch sizes only (this is the one that actually feeds the dosing/cost
-- math — MatriTablets envelope sizes stay fixed for now, they only affect
-- Inventory purchasing units, not dosing).
--
-- Scoped per Distributor/país (Juan's call 2026-07-12) — a shared, single
-- global catalog is the long-term ideal but out of scope for this cut.
--
-- Same bidirectional visibility as pricing tables (0003): a Customer must
-- be able to READ its Distributor's catalog to compute its own dose
-- breakdown, but only the Distributor itself can edit it.

create table pouch_catalog (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id), -- Distributor
  size_g      numeric not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (org_id, size_g)
);
create index pouch_catalog_org_id_idx on pouch_catalog(org_id);

alter table pouch_catalog enable row level security;

create policy pouch_catalog_select on pouch_catalog
  for select using (
    is_in_subtree(org_id, current_org_id()) or is_in_subtree(current_org_id(), org_id)
  );
create policy pouch_catalog_insert on pouch_catalog
  for insert with check (is_in_subtree(org_id, current_org_id()));
create policy pouch_catalog_update on pouch_catalog
  for update using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));
create policy pouch_catalog_delete on pouch_catalog
  for delete using (is_in_subtree(org_id, current_org_id()));

-- Backfill Wassington's existing sizes (previously the hardcoded POUCHES
-- constant in src/lib/dosing.js) so nothing breaks on cutover.
do $$
declare
  v_wassington_id uuid;
begin
  select id into v_wassington_id from organizations where name = 'Wassington';
  if v_wassington_id is not null then
    insert into pouch_catalog (org_id, size_g) values
      (v_wassington_id, 100), (v_wassington_id, 50), (v_wassington_id, 20), (v_wassington_id, 10)
    on conflict (org_id, size_g) do nothing;
  end if;
end $$;
