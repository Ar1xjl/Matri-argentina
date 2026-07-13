-- After extensive live debugging (see 0017/0018), org_insert's RLS WITH
-- CHECK consistently rejected inserts even for the trivial, non-recursive
-- case (parent_id = current_org_id()) — while a BEFORE INSERT trigger,
-- using the exact same functions against the exact same live
-- auth.uid()/current_org_id()/parent_id values, repeatedly and correctly
-- evaluated the check as passing. Never pinned down the precise internal
-- reason RLS specifically misbehaves for this table/policy — ruled out
-- stale data, function ownership/security-definer flags, missing grants,
-- extra policies/triggers, a stale session, and is_in_subtree's own
-- recursion. Workaround: enforce the identical rule (Rule 13 — an
-- Organization can only be created within your own subtree) via a trigger
-- instead of RLS, since that's the mechanism proven to work correctly here.
drop policy if exists org_insert on organizations;
create policy org_insert on organizations
  for insert with check (parent_id is not null);

create or replace function enforce_org_insert_subtree() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not (new.parent_id = current_org_id() or is_in_subtree(new.parent_id, current_org_id())) then
    raise exception 'No podés crear una Organización fuera de tu propio árbol.';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_org_insert_subtree
  before insert on organizations
  for each row execute function enforce_org_insert_subtree();
