-- Juan hit a reproducible bug: creating a new Organization directly under
-- his own Organization (parent_id = his own org id — e.g. Wassington
-- creating a Customer) always failed with "new row violates row-level
-- security policy for table organizations", even though every manual check
-- of is_in_subtree()/current_org_id() (including a debug trigger that
-- captured the exact live request's auth.uid()/current_org_id()/parent_id
-- and re-ran is_in_subtree with those exact values) consistently showed the
-- check should evaluate to true.
--
-- Everything else was ruled out empirically: profile/org data was correct,
-- the JWT/session was valid, current_org_id()/is_in_subtree() are properly
-- SECURITY DEFINER owned by postgres, no extra policies or triggers existed
-- on organizations, and the live policy text matched migration 0002 exactly.
-- The one untested variable: is_in_subtree is `language sql`, and it queries
-- the SAME table (organizations) it's used to gate an INSERT policy on —
-- converting it to `language plpgsql` is a purely mechanical change (same
-- walk-up-the-parent-chain logic, same self-inclusive base case) that avoids
-- whatever SQL-function planner treatment might be involved, without
-- changing behavior for the dozens of other places this function is used.
create or replace function is_in_subtree(target_org uuid, root_org uuid) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_current uuid := target_org;
begin
  loop
    if v_current = root_org then
      return true;
    end if;
    select parent_id into v_current from organizations where id = v_current;
    if v_current is null then
      return false;
    end if;
  end loop;
end;
$$;
