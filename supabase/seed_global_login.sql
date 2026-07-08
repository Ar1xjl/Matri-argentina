-- Adds a FreshInset Global-level login for testing Organization
-- creation/activation (only Global can flip an Organization from
-- 'pending' to 'active' — see Rule 13 / Organizations.jsx).
--
-- Run ONCE, via the Supabase Dashboard SQL Editor, AFTER creating a real
-- Auth user for it: Dashboard → Authentication → Users → Add user, with
-- email juanllauro+global@gmail.com (Gmail "+" alias — same inbox,
-- different login for Supabase). Reuses the existing FreshInset Global
-- Organization created by seed.sql — does not create a new one.

do $$
declare
  v_global_id uuid;
  v_user_id   uuid;
begin
  select id into v_global_id from organizations where org_type = 'global';
  if v_global_id is null then
    raise exception 'FreshInset Global organization not found — run seed.sql first';
  end if;

  select id into v_user_id from auth.users where email = 'juanllauro+global@gmail.com';
  if v_user_id is null then
    raise exception 'No auth user found with that email — create one first via Dashboard > Authentication > Users > Add user';
  end if;

  insert into profiles (id, org_id, full_name) values (v_user_id, v_global_id, 'FreshInset Global (test)');
  insert into user_roles (profile_id, role) values
    (v_user_id, 'owner'), (v_user_id, 'approver');
end $$;
