-- Adds a Wassington-level login for testing Panel Wassington / approvals.
--
-- Run ONCE, via the Supabase Dashboard SQL Editor, AFTER creating a real
-- Auth user for it: Dashboard → Authentication → Users → Add user, with
-- email juanllauro+wassington@gmail.com (Gmail "+" alias — same inbox,
-- different login for Supabase). Reuses the existing Wassington
-- Organization created by seed.sql — does not create a new one.

do $$
declare
  v_wassington_id uuid;
  v_user_id       uuid;
begin
  select id into v_wassington_id from organizations where name = 'Wassington';
  if v_wassington_id is null then
    raise exception 'Wassington organization not found — run seed.sql first';
  end if;

  select id into v_user_id from auth.users where email = 'juanllauro+wassington@gmail.com';
  if v_user_id is null then
    raise exception 'No auth user found with that email — create one first via Dashboard > Authentication > Users > Add user';
  end if;

  insert into profiles (id, org_id, full_name) values (v_user_id, v_wassington_id, 'Wassington (test)');
  insert into user_roles (profile_id, role) values
    (v_user_id, 'owner'), (v_user_id, 'approver');
end $$;
