-- "Un solo Owner por organización" (2026-09-03, Juan) — hasta ahora Rule 18
-- solo exigía un MÍNIMO de un Owner; esto agrega el MÁXIMO. Sin una forma
-- atómica de cambiar quién es el Owner, esta regla estricta dejaría
-- imposible transferir la propiedad (agregar un segundo Owner temporalmente
-- violaría el máximo; sacar al único Owner actual violaría el mínimo) — por
-- eso viene junto con transfer_ownership(), que hace ambas cosas en un solo
-- paso, desactivando ambos triggers de "Owner" solo durante esa operación
-- puntual (mismo patrón ya usado en delete_customer_organization/
-- retire_organization para su propio paso de borrado de usuarios).

create or replace function prevent_second_owner() returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
  v_existing_owners int;
begin
  if new.role <> 'owner' then
    return new;
  end if;
  select org_id into v_org_id from profiles where id = new.profile_id;
  select count(*) into v_existing_owners
    from user_roles ur
    join profiles p on p.id = ur.profile_id
   where p.org_id = v_org_id and ur.role = 'owner';
  if v_existing_owners > 0 then
    raise exception 'Esta organización ya tiene un Owner — transferí la propiedad en vez de agregar un segundo.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_second_owner on user_roles;
create trigger trg_prevent_second_owner
  before insert on user_roles
  for each row execute function prevent_second_owner();

-- Atomically moves Owner from whoever currently has it at p_org_id to
-- p_new_owner_profile_id — the old Owner(s)' other roles, if any, are left
-- untouched (they just stop being Owner). Callable by any existing Owner
-- within their own subtree (same authority pattern as the rest of the app),
-- not only the org's own Owner, so an ancestor can fix a descendant's
-- ownership mess too.
create or replace function transfer_ownership(p_org_id uuid, p_new_owner_profile_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_org_id     uuid;
  v_new_owner_org_id  uuid;
begin
  if not has_role(array['owner']::business_role[]) then
    raise exception 'Solo un Owner puede transferir la propiedad.';
  end if;

  select org_id into v_caller_org_id from profiles where id = auth.uid();
  if not is_in_subtree(p_org_id, v_caller_org_id) then
    raise exception 'Esa organización no pertenece a tu organización ni a las que tenés debajo.';
  end if;

  select org_id into v_new_owner_org_id from profiles where id = p_new_owner_profile_id;
  if v_new_owner_org_id is null or v_new_owner_org_id <> p_org_id then
    raise exception 'Esa persona no pertenece a esta organización.';
  end if;

  alter table user_roles disable trigger trg_prevent_last_owner_delete;
  alter table user_roles disable trigger trg_prevent_second_owner;

  delete from user_roles
  where role = 'owner'
    and profile_id in (select id from profiles where org_id = p_org_id);

  insert into user_roles (profile_id, role)
  values (p_new_owner_profile_id, 'owner')
  on conflict (profile_id, role) do nothing;

  alter table user_roles enable trigger trg_prevent_last_owner_delete;
  alter table user_roles enable trigger trg_prevent_second_owner;
end;
$$;
