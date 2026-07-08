-- Inventory (DOMAIN_MODEL.md → Inventory, Business Rule 34)
-- v1 scope: tracked only at Distributor level, per SKU variant (MatriPowder
-- pouch sizes / MatriTablets sizes), manual adjustment + automatic decrement
-- when a Treatment moves to Applied. Not visible to Customers.

create table inventory_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id),
  sku         text not null check (sku in ('MatriPowder','MatriTablets')),
  variant     text not null,             -- '100g'/'50g'/'20g'/'10g' for Powder; 'grande'/'chica' for Tablets
  quantity    integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (org_id, sku, variant)
);
create index inventory_items_org_id_idx on inventory_items(org_id);

alter table inventory_items enable row level security;

-- Same subtree pattern as cold_rooms/generators: an Organization (and
-- anything above it, e.g. FreshInset Global) can see and manually adjust its
-- own stock. Customers are never in a Distributor's subtree ancestry, so
-- this naturally keeps inventory invisible to them — no bidirectional
-- exception needed here, unlike Pricing.
create policy inventory_items_all on inventory_items for all
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

-- A Customer applying their own Treatment needs to decrement their ANCESTOR
-- Distributor's stock — the opposite direction from the policy above, which
-- only lets an Organization touch its own subtree. Rather than opening a
-- broad write policy in that direction (which would let any Customer write
-- arbitrary rows on their Distributor's inventory), expose only this single,
-- narrow, server-resolved operation.
create or replace function decrement_inventory(p_sku text, p_variant text, p_qty integer)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_distributor_id uuid;
begin
  with recursive ancestors as (
    select id, parent_id, org_type from organizations where id = current_org_id()
    union all
    select o.id, o.parent_id, o.org_type from organizations o join ancestors a on o.id = a.parent_id
  )
  select id into v_distributor_id from ancestors where org_type = 'distributor' limit 1;

  if v_distributor_id is null then
    return; -- caller has no Distributor ancestor (e.g. Global itself applying nothing) — nothing to decrement
  end if;

  insert into inventory_items (org_id, sku, variant, quantity)
  values (v_distributor_id, p_sku, p_variant, -p_qty)
  on conflict (org_id, sku, variant)
  do update set quantity = inventory_items.quantity - p_qty, updated_at = now();
end;
$$;

grant execute on function decrement_inventory(text, text, integer) to authenticated;
