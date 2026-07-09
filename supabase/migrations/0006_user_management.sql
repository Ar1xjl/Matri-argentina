-- User management (Group D, 2026-07-11): lets an Organization's Owner add an
-- already-self-registered user to their org (no service_role/Admin API
-- needed client-side — see DOMAIN_MODEL.md Rule 19, and Business Rule 34/35
-- neighbours for context on the "no custom backend" constraint this works
-- around).

-- ============================================================================
-- C5 — currency is a Distributor-only concept (Rule 14), enforced at the DB
-- now too, not just by the Organizations.jsx form.
-- ============================================================================
alter table organizations add constraint currency_only_for_distributor
  check (org_type = 'distributor' or (currency is null and fx_rate_to_usd is null));

-- ============================================================================
-- D5 — profiles didn't store email at all (only full_name); needed so the
-- Users screen can show who's who without re-querying auth.users per row.
-- ============================================================================
alter table profiles add column email text;

-- Backfill existing test logins (Kleppe/Wassington/Podlesh/Global) so they
-- show up nicely in the new Users screen too.
update profiles set email = u.email from auth.users u where profiles.id = u.id and profiles.email is null;

-- ============================================================================
-- D1 — narrow, safe lookup: the client can't query auth.users directly, but
-- needs to know "does this email already have an account" before assigning
-- it to an org. Returns only the id, never other auth.users columns.
-- ============================================================================
create or replace function find_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

grant execute on function find_user_id_by_email(text) to authenticated;

-- ============================================================================
-- D2 — tighten membership-management writes to Owners only (Rule 19: "self-
-- service by that Organization's Owner(s)"). Previously any member of an org
-- could add/remove other users and roles anywhere in their own subtree —
-- correct on the subtree axis, but missing the Owner-only axis.
-- ============================================================================
alter policy profiles_insert on profiles
  with check (is_in_subtree(org_id, current_org_id()) and has_role(array['owner']::business_role[]));

alter policy user_roles_insert on user_roles
  with check (is_in_subtree((select org_id from profiles where id = profile_id), current_org_id())
    and has_role(array['owner']::business_role[]));

alter policy user_roles_delete on user_roles
  using (is_in_subtree((select org_id from profiles where id = profile_id), current_org_id())
    and has_role(array['owner']::business_role[]));
