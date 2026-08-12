-- MatriSure Kit stewardship — Fase K-2a, 2026-08-11: lets a Distributor/
-- Sub-distributor's own independent Aplicador be dispatched to physically
-- go apply a Treatment at a Customer's site ("servicio gestionado"),
-- distinct from a Customer's own self-application (which already works,
-- unaffected by this migration). See project memory
-- "matri-kit-stewardship-integration" for the full design discussion.
--
-- Real-world clarification that drove this (Juan, 2026-08-11): a
-- Distributor hires independent Aplicadores who travel and apply
-- treatments across different Customers. Manager decides who gets
-- dispatched to which Treatment (same "Manager assigns" pattern already
-- used for kit_units in Fase K-1) — not a self-claim/pool model.

-- Distinct from the existing `operator_id` (set retroactively at the
-- moment Applied actually happens, recording who did it) — this is set
-- BEFORE the work happens, by Manager, recording who's supposed to do it.
-- RLS already permits this without any policy change: treatments_update
-- (0022) already allows any subtree member to update a Treatment as long
-- as the new status isn't approved/rejected — assigning an applicator
-- never touches status, so it was already legal at the row-security layer;
-- what was missing was a column to hold the assignment and a role-gated
-- entry point (below) so only Manager can set it, not just anyone in the
-- subtree.
alter table treatments add column assigned_applicator_id uuid references profiles(id);
create index treatments_assigned_applicator_id_idx on treatments(assigned_applicator_id);

-- Deferred from Fase K-1a on purpose (see that migration's comment) — now
-- wiring real kit consumption, so the link back to which Treatment a kit
-- was used on is needed.
alter table kit_units add column used_treatment_id uuid references treatments(id);

-- ============================================================================
-- Manager dispatches a Treatment to one of their own org's Aplicadores.
-- ============================================================================
create or replace function assign_treatment_applicator(p_treatment_id uuid, p_applicator_profile_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_org_id uuid;
  v_treatment_org_id uuid;
  v_applicator_org_id uuid;
begin
  if not has_role(array['owner','approver']::business_role[]) then
    raise exception 'Solo el Manager puede asignar un Aplicador a un tratamiento.';
  end if;

  select org_id into v_caller_org_id from profiles where id = auth.uid();

  select org_id into v_treatment_org_id from treatments where id = p_treatment_id;
  if v_treatment_org_id is null or not is_in_subtree(v_treatment_org_id, v_caller_org_id) then
    raise exception 'Ese tratamiento no pertenece a tu organización ni a las que tenés debajo.';
  end if;

  select org_id into v_applicator_org_id from profiles where id = p_applicator_profile_id;
  if v_applicator_org_id is null or not is_in_subtree(v_applicator_org_id, v_caller_org_id) then
    raise exception 'Ese Aplicador no pertenece a tu organización ni a las que tenés debajo.';
  end if;
  if not exists (select 1 from user_roles where profile_id = p_applicator_profile_id and role = 'operator') then
    raise exception 'Esa persona no tiene el rol de Aplicador.';
  end if;

  update treatments set assigned_applicator_id = p_applicator_profile_id where id = p_treatment_id;
end;
$$;

-- ============================================================================
-- The Aplicador marks the specific kit they used, at MatriSure verification
-- time — closes the K-1 chain-of-custody loop (registered → released →
-- assigned → used).
-- ============================================================================
create or replace function use_kit_unit(p_unit_id uuid, p_treatment_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from kit_units
  where id = p_unit_id and assigned_to_profile_id = auth.uid() and status = 'assigned';

  if v_org_id is null then
    raise exception 'Ese kit no está asignado a vos, o ya fue usado.';
  end if;

  update kit_units
  set status = 'used', used_at = now(), used_treatment_id = p_treatment_id
  where id = p_unit_id;

  insert into kit_unit_movements (kit_unit_id, action, from_org_id, to_org_id, moved_by, notes)
  values (p_unit_id, 'used', v_org_id, v_org_id, auth.uid(), 'Usado en tratamiento ' || p_treatment_id);
end;
$$;
