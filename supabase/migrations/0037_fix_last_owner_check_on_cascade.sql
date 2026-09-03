-- Real bug found live 2026-09-03: prevent_removing_last_owner() looks up
-- the profile's org via `select org_id from profiles where id = old.profile_id`
-- — correct when a role is removed directly from user_roles (the profiles
-- row still exists at that point), but ALWAYS wrong when user_roles is
-- deleted via CASCADE from a profiles delete (Users.jsx's "Quitar acceso",
-- or any direct `delete from profiles`, both of which go through
-- `profiles.id references auth.users... ` no — profiles itself, and
-- user_roles.profile_id references profiles(id) on delete cascade). By the
-- time this trigger fires mid-cascade, the profiles row is already gone (or
-- at least invisible to a fresh query within the same command), so the
-- lookup returns NULL, `remaining_owners` is computed as 0 unconditionally,
-- and the exception fires — regardless of how many other Owners the org
-- actually has. Confirmed live: Wassington had 4 Owners (afsasso, diegofrisch,
-- juanllauro+wassington, juanllauro+paitmp), and removing any single one of
-- them still hit "Cannot remove the last Owner."
--
-- Fix: do the real check in a new BEFORE DELETE trigger on `profiles`
-- itself — OLD.org_id is directly available there (no lookup needed) and
-- it fires before any cascade starts, so it always sees accurate data. The
-- existing user_roles-level trigger becomes a no-op whenever it can't find
-- the owning profile — that means this exact deletion already went through
-- the new profiles-level check.
create or replace function prevent_removing_last_owner() returns trigger
language plpgsql
as $$
declare
  target_org uuid;
  remaining_owners int;
begin
  if old.role <> 'owner' then
    return old;
  end if;
  select org_id into target_org from profiles where id = old.profile_id;
  if target_org is null then
    -- Owning profile is already gone — this delete is cascading from a
    -- profiles delete, already vetted by
    -- prevent_removing_last_owner_on_profile_delete() below.
    return old;
  end if;
  select count(*) into remaining_owners
    from user_roles ur
    join profiles p on p.id = ur.profile_id
   where p.org_id = target_org and ur.role = 'owner' and ur.id <> old.id;
  if remaining_owners = 0 then
    raise exception 'Cannot remove the last Owner of an Organization';
  end if;
  return old;
end;
$$;

create or replace function prevent_removing_last_owner_on_profile_delete() returns trigger
language plpgsql
as $$
declare
  remaining_owners int;
begin
  if not exists (select 1 from user_roles where profile_id = old.id and role = 'owner') then
    return old;
  end if;
  select count(*) into remaining_owners
    from user_roles ur
    join profiles p on p.id = ur.profile_id
   where p.org_id = old.org_id and ur.role = 'owner' and p.id <> old.id;
  if remaining_owners = 0 then
    raise exception 'Cannot remove the last Owner of an Organization';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_last_owner_delete_on_profile on profiles;
create trigger trg_prevent_last_owner_delete_on_profile
  before delete on profiles
  for each row execute function prevent_removing_last_owner_on_profile_delete();

-- Both full-org-wipe RPCs built earlier this same day intentionally let an
-- org's owner count hit zero mid-transaction (the org itself is being
-- removed) by disabling the user_roles-level trigger — they now also need
-- to disable this new profiles-level one for the same reason.
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

  alter table user_roles disable trigger trg_prevent_last_owner_delete;
  alter table profiles disable trigger trg_prevent_last_owner_delete_on_profile;

  delete from matrisure_verifications where treatment_id in (select id from treatments where org_id = p_org_id);
  delete from firmness_evaluations where treatment_id in (select id from treatments where org_id = p_org_id);
  delete from treatment_dispatch_checklists where treatment_id in (select id from treatments where org_id = p_org_id);
  update kit_units set used_treatment_id = null where used_treatment_id in (select id from treatments where org_id = p_org_id);

  delete from treatments where org_id = p_org_id;
  delete from season_plans where org_id = p_org_id;
  delete from season_plan_drafts where customer_org_id = p_org_id;
  delete from cold_rooms where org_id = p_org_id;

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

  delete from auth.users where id in (select id from profiles where org_id = p_org_id);

  delete from organizations where id = p_org_id;

  alter table user_roles enable trigger trg_prevent_last_owner_delete;
  alter table profiles enable trigger trg_prevent_last_owner_delete_on_profile;
end;
$$;

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
    if not (
      (v_target_type = 'distributor' and p_target_org_id = v_parent_id)
      or (v_target_type = 'subdistributor' and v_target_parent = v_parent_id)
    ) then
      raise exception 'El destino tiene que ser el Distribuidor del que depende, u otro Sub-distribuidor del mismo Distribuidor.';
    end if;
  else
    if v_target_type <> 'distributor' then
      raise exception 'El destino tiene que ser otro Distribuidor.';
    end if;
  end if;

  select array_agg(id) into v_profile_ids from profiles where org_id = p_org_id;
  if v_profile_ids is null then v_profile_ids := array[]::uuid[]; end if;

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

  update kit_unit_movements set from_org_id = null where from_org_id = p_org_id;
  update kit_unit_movements set to_org_id   = null where to_org_id   = p_org_id;
  update organization_access_requests set resulting_org_id = null where resulting_org_id = p_org_id;

  delete from user_invites where org_id = p_org_id or created_by = any(v_profile_ids);
  delete from generator_dispatches where dispatched_to_org_id = p_org_id;

  delete from volume_brackets      where org_id = p_org_id;
  delete from pricing_product      where org_id = p_org_id;
  delete from pricing_service_fee  where org_id = p_org_id;
  delete from pricing_generator    where org_id = p_org_id;
  delete from pouch_catalog        where org_id = p_org_id;
  delete from tablet_catalog       where org_id = p_org_id;
  delete from inventory_items      where org_id = p_org_id;
  delete from matrisure_kit_lots   where org_id = p_org_id;
  delete from documents            where org_id = p_org_id;

  update kit_units  set org_id = p_target_org_id where org_id = p_org_id;
  update generators set org_id = p_target_org_id where org_id = p_org_id;

  update organizations set parent_id = p_target_org_id where parent_id = p_org_id;

  alter table user_roles disable trigger trg_prevent_last_owner_delete;
  alter table profiles disable trigger trg_prevent_last_owner_delete_on_profile;
  delete from auth.users where id = any(v_profile_ids);
  delete from organizations where id = p_org_id;
  alter table user_roles enable trigger trg_prevent_last_owner_delete;
  alter table profiles enable trigger trg_prevent_last_owner_delete_on_profile;
end;
$$;
