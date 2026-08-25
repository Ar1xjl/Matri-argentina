-- Self-service Customer organization deletion (2026-08-25) — a
-- Distributor/Sub-distributor/Global's own Owner/Aprobador can permanently
-- delete a Customer org (and everything that belongs to it: treatments,
-- cold rooms, season plans, its own users/logins, etc.) from the
-- CRM — Clientes screen (Organizations.jsx), instead of needing a one-off
-- SQL script run by hand.
--
-- Deliberately scoped to Customer org_type only for this first version —
-- deleting a Distributor/Sub-distributor would cascade through everything
-- nested below it (other Sub-distributors, Customers, their own users) and
-- needs its own, more careful recursive design if that's ever actually
-- needed. Not built here.
--
-- Mirrors, almost verbatim, the manual cleanup script run by hand
-- 2026-08-25 to wipe test Customer orgs before real launch (see project
-- memory "prelaunch_data_cleanup") — same table list and ordering, same
-- disable/enable of trg_prevent_last_owner_delete (the org itself is being
-- removed, so it's expected/fine for its owner count to hit zero), same
-- deletion via auth.users rather than profiles (so nobody re-materializes
-- into pending_user_signups, and every Supabase-internal auth table
-- cascades cleanly). Wrapped as a callable, safe, repeatable RPC.
create or replace function delete_customer_organization(p_org_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_org_id uuid;
  v_org_type text;
begin
  if not has_role(array['owner','approver']::business_role[]) then
    raise exception 'Solo un Manager (Owner/Aprobador) puede eliminar una organización.';
  end if;

  select org_id into v_caller_org_id from profiles where id = auth.uid();

  select org_type into v_org_type from organizations where id = p_org_id;
  if v_org_type is null then
    raise exception 'Esa organización no existe.';
  end if;
  if v_org_type <> 'customer' then
    raise exception 'Solo se pueden eliminar organizaciones tipo Cliente.';
  end if;
  if not is_in_subtree(p_org_id, v_caller_org_id) then
    raise exception 'Esa organización no pertenece a tu organización ni a las que tenés debajo.';
  end if;

  -- The org itself is about to be removed, so it's fine (expected) for its
  -- owner count to hit zero along the way — this trigger doesn't know that
  -- and would otherwise block the whole thing. Transactional: rolls back
  -- automatically with everything else if any step below raises.
  alter table user_roles disable trigger trg_prevent_last_owner_delete;

  -- 1) Dependents of this Customer's own Treatments
  delete from matrisure_verifications where treatment_id in (select id from treatments where org_id = p_org_id);
  delete from firmness_evaluations where treatment_id in (select id from treatments where org_id = p_org_id);
  delete from treatment_dispatch_checklists where treatment_id in (select id from treatments where org_id = p_org_id);
  update kit_units set used_treatment_id = null where used_treatment_id in (select id from treatments where org_id = p_org_id);

  -- 2) Treatments (must go before season_plan_lines — treatments.plan_line_id references it)
  delete from treatments where org_id = p_org_id;

  -- 3) Season Plans + Distributor-authored drafts (both cascade automatically to their own lines)
  delete from season_plans where org_id = p_org_id;
  delete from season_plan_drafts where customer_org_id = p_org_id;

  -- 4) Cold rooms (now safe — nothing left references them)
  delete from cold_rooms where org_id = p_org_id;

  -- 5) Everything else that can reference this org directly
  delete from customer_pricing_overrides where customer_org_id = p_org_id;
  delete from user_invites where org_id = p_org_id;
  delete from organization_access_requests where resulting_org_id = p_org_id;
  delete from generator_dispatches where dispatched_to_org_id = p_org_id;
  delete from generators where org_id = p_org_id;
  delete from documents where org_id = p_org_id;
  delete from volume_brackets where org_id = p_org_id;
  delete from pricing_product where org_id = p_org_id;
  delete from pricing_service_fee where org_id = p_org_id;
  delete from pricing_generator where org_id = p_org_id;

  -- 6) Users/logins — via auth.users (cascades profiles/user_roles cleanly,
  -- and every Supabase-internal auth table with it), not via profiles
  -- directly (which would re-materialize them into pending_user_signups).
  delete from auth.users where id in (select id from profiles where org_id = p_org_id);

  -- 7) The organization itself
  delete from organizations where id = p_org_id;

  alter table user_roles enable trigger trg_prevent_last_owner_delete;
end;
$$;
