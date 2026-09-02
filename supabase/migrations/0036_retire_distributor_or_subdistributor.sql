-- Retire a Distributor or Sub-distributor (2026-08-26) — unlike
-- delete_customer_organization() (0035), a Customer's Treatments/Cold Rooms
-- don't survive; here the whole point is that the ORG's own Customers (and,
-- for a Distributor, any Sub-distributors it has) DO survive — they get
-- reassigned to a chosen target org, not deleted. Juan's real scenario: a
-- Distributor/Sub-distributor is closing down or being restructured, its
-- customer relationships shouldn't just vanish.
--
-- Scoping decisions (Juan, 2026-08-26):
--   - Retiring a Sub-distributor: target must be its own parent Distributor,
--     or a sibling Sub-distributor under that same Distributor — reassigns
--     its direct Customers there.
--   - Retiring a Distributor: target must be a different existing
--     Distributor — reassigns its direct Customers AND any Sub-distributors
--     it has (with THEIR Customers coming along automatically, since
--     they're not reparented themselves).
--   - The org's own staff (profiles/auth.users) are deleted, not migrated —
--     avoids silently mixing two orgs' access/roles without a human
--     deciding to re-invite each one explicitly.
--   - Physical assets (kit_units, generators) move to the target org — a
--     real kit/generator doesn't stop existing just because its custodian
--     org does.
--   - The org's own configuration (pricing, inventory, pouch/tablet
--     catalog, MatriSure kit lots) is deleted, not merged — the target org
--     already has its own configuration, and auto-merging two independent
--     setups risks unique-constraint collisions or silently wrong numbers
--     no one asked to combine.
--
-- Since the Customers (and their Treatments/Season Plans/MatriSure
-- verifications/etc.) survive this operation, any of THEIR rows that
-- happen to reference one of the retiring org's own staff (approved_by,
-- operator_id, reviewed_by, etc.) must be nulled out before that staff's
-- profiles are deleted — unlike delete_customer_organization(), where
-- everything referencing the deleted profiles was also being deleted in
-- the same operation. Every such column was confirmed nullable except
-- user_invites.created_by (not null) and generator_dispatches.
-- dispatched_to_org_id (not null) — those rows are deleted instead.
create or replace function retire_organization(p_org_id uuid, p_target_org_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_org_id uuid;
  v_org_type      text;
  v_parent_id     uuid;
  v_target_type   text;
  v_target_parent uuid;
  v_profile_ids   uuid[];
begin
  if not has_role(array['owner','approver']::business_role[]) then
    raise exception 'Solo un Manager (Owner/Aprobador) puede eliminar una organización.';
  end if;

  select org_id into v_caller_org_id from profiles where id = auth.uid();

  select org_type, parent_id into v_org_type, v_parent_id from organizations where id = p_org_id;
  if v_org_type is null then
    raise exception 'Esa organización no existe.';
  end if;
  if v_org_type not in ('distributor', 'subdistributor') then
    raise exception 'Esta función es solo para Distribuidores y Sub-distribuidores (para Clientes usá delete_customer_organization).';
  end if;
  if not is_in_subtree(p_org_id, v_caller_org_id) then
    raise exception 'Esa organización no pertenece a tu organización ni a las que tenés debajo.';
  end if;

  if p_target_org_id is null or p_target_org_id = p_org_id then
    raise exception 'Elegí una organización destino distinta.';
  end if;
  if is_in_subtree(p_target_org_id, p_org_id) then
    raise exception 'La organización destino no puede ser la misma que se elimina, ni estar debajo de ella en el árbol.';
  end if;

  select org_type, parent_id into v_target_type, v_target_parent from organizations where id = p_target_org_id;
  if v_target_type is null then
    raise exception 'La organización destino no existe.';
  end if;

  if v_org_type = 'subdistributor' then
    -- Valid target: its own parent Distributor, or a sibling Sub-distributor
    -- under that same Distributor.
    if not (
      (v_target_type = 'distributor' and p_target_org_id = v_parent_id)
      or (v_target_type = 'subdistributor' and v_target_parent = v_parent_id)
    ) then
      raise exception 'El destino tiene que ser el Distribuidor del que depende, u otro Sub-distribuidor del mismo Distribuidor.';
    end if;
  else -- distributor
    if v_target_type <> 'distributor' then
      raise exception 'El destino tiene que ser otro Distribuidor.';
    end if;
  end if;

  select array_agg(id) into v_profile_ids from profiles where org_id = p_org_id;
  if v_profile_ids is null then v_profile_ids := array[]::uuid[]; end if;

  -- Null out every reference from a SURVIVING row (belongs to a Customer
  -- being reassigned, not deleted) to one of this org's own staff.
  update season_plans               set created_by = null            where created_by = any(v_profile_ids);
  update treatments                 set approved_by = null           where approved_by = any(v_profile_ids);
  update treatments                 set operator_id = null           where operator_id = any(v_profile_ids);
  update treatments                 set created_by = null            where created_by = any(v_profile_ids);
  update treatments                 set assigned_applicator_id = null where assigned_applicator_id = any(v_profile_ids);
  update matrisure_verifications    set reviewed_by = null           where reviewed_by = any(v_profile_ids);
  update documents                  set uploaded_by = null           where uploaded_by = any(v_profile_ids);
  update organization_access_requests set reviewed_by = null         where reviewed_by = any(v_profile_ids);
  update firmness_evaluations        set created_by = null           where created_by = any(v_profile_ids);
  update treatment_dispatch_checklists set completed_by = null       where completed_by = any(v_profile_ids);
  update kit_units                  set assigned_to_profile_id = null where assigned_to_profile_id = any(v_profile_ids);
  update kit_units                  set destroyed_by = null          where destroyed_by = any(v_profile_ids);
  update kit_units                  set created_by = null            where created_by = any(v_profile_ids);
  update kit_unit_movements         set moved_by = null              where moved_by = any(v_profile_ids);
  update season_plan_drafts         set created_by = null            where created_by = any(v_profile_ids);
  update season_plan_drafts         set shared_by = null             where shared_by = any(v_profile_ids);
  update customer_pricing_overrides set updated_by = null            where updated_by = any(v_profile_ids);

  -- Null out org references (kit_unit_movements is a kept audit log;
  -- organization_access_requests is a kept historical record) pointing at
  -- this org, since it's about to be deleted.
  update kit_unit_movements set from_org_id = null where from_org_id = p_org_id;
  update kit_unit_movements set to_org_id   = null where to_org_id   = p_org_id;
  update organization_access_requests set resulting_org_id = null where resulting_org_id = p_org_id;

  -- Rows that can't be nulled (NOT NULL columns) and aren't worth keeping:
  -- pending invite links, and dispatch-history rows naming this org.
  delete from user_invites where org_id = p_org_id or created_by = any(v_profile_ids);
  delete from generator_dispatches where dispatched_to_org_id = p_org_id;

  -- This org's own configuration — deleted, not merged into the target's.
  delete from volume_brackets      where org_id = p_org_id;
  delete from pricing_product      where org_id = p_org_id;
  delete from pricing_service_fee  where org_id = p_org_id;
  delete from pricing_generator    where org_id = p_org_id;
  delete from pouch_catalog        where org_id = p_org_id;
  delete from tablet_catalog       where org_id = p_org_id;
  delete from inventory_items      where org_id = p_org_id;
  delete from matrisure_kit_lots   where org_id = p_org_id;
  delete from documents            where org_id = p_org_id;

  -- Physical assets move to the target org.
  update kit_units  set org_id = p_target_org_id where org_id = p_org_id;
  update generators set org_id = p_target_org_id where org_id = p_org_id;

  -- Reparent every direct child (Customers, and for a Distributor any
  -- Sub-distributors too) to the target — this one statement is what
  -- carries a Sub-distributor's own Customers along automatically when a
  -- Distributor is retired, with no separate recursive step needed.
  update organizations set parent_id = p_target_org_id where parent_id = p_org_id;

  -- This org's own staff, then the org itself. Same as
  -- delete_customer_organization(): the org disappearing is exactly why its
  -- owner count is allowed to hit zero here.
  alter table user_roles disable trigger trg_prevent_last_owner_delete;
  delete from auth.users where id = any(v_profile_ids);
  delete from organizations where id = p_org_id;
  alter table user_roles enable trigger trg_prevent_last_owner_delete;
end;
$$;
