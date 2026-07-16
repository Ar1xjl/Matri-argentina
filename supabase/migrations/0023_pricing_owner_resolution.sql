-- Fase H: fixes a real bug found while scoping Sub-distributor-owned pricing
-- (permission matrix, 2026-07-15/16). volume_brackets/pricing_product/
-- pricing_service_fee/pricing_generator SELECT RLS is bidirectional
-- (migration 0003) — a Customer sees pricing rows from EVERY ancestor at
-- once, and a Distributor sees rows from every descendant Sub-distributor
-- that's configured its own. `getProductPrice()`/`resolveBracket()`
-- (orgPricing.js) just did `.find()` on whatever order the rows came back
-- in — no "nearest wins" rule, so which price actually applied was
-- undefined whenever more than one org in the chain had pricing configured.
--
-- Fix: resolve ONE "pricing owner" org per target — walking from the target
-- itself upward via parent_id, stopping at the first org that has its own
-- volume_brackets row — and filter the fetched pricing arrays down to just
-- that owner before any lookup happens. This one function correctly covers
-- every caller: a Distributor computing its own numbers (starts at itself,
-- finds its own brackets immediately, never looks at a descendant
-- Sub-distributor's), a Customer with no Sub-distributor pricing override
-- (walks past itself and its immediate parent straight to the Distributor
-- that actually has brackets), and a Customer under a Sub-distributor that
-- HAS set its own list (stops there, per Rule 14's "only a Sub-distributor
-- may inherit its parent's pricing" — the default is inheritance, but its
-- own configured list always wins once it exists).
create or replace function resolve_pricing_owner(p_target_org uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := p_target_org;
begin
  loop
    if v_org is null then
      return null;
    end if;
    if exists (select 1 from volume_brackets where org_id = v_org) then
      return v_org;
    end if;
    select parent_id into v_org from organizations where id = v_org;
  end loop;
end;
$$;
grant execute on function resolve_pricing_owner(uuid) to authenticated;
