-- Adds a Podlesh (sub-distributor) login for testing subtree-scoped
-- visibility — logging in as Podlesh should show only Podlesh's own
-- Customers, not Kleppe or any other Wassington-direct Customer.
--
-- Run ONCE, via the Supabase Dashboard SQL Editor, AFTER:
-- 1. Creating the "Podlesh" Organization itself — do this from the app,
--    logged in as Wassington, in Panel Wassington → CRM → "+ Nueva
--    organización" (tipo: Sub-distribuidor). It lands "Pendiente"; log in
--    as FreshInset Global and click "Activar" on it.
-- 2. Creating a real Auth user for this login: Dashboard → Authentication
--    → Users → Add user, with email juanllauro+podlesh@gmail.com (Gmail
--    "+" alias — same inbox, different login for Supabase).

do $$
declare
  v_podlesh_id uuid;
  v_user_id    uuid;
begin
  select id into v_podlesh_id from organizations where name = 'Podlesh SRL';
  if v_podlesh_id is null then
    raise exception 'Podlesh SRL organization not found — create it first from Panel Wassington > CRM > Nueva organización';
  end if;

  select id into v_user_id from auth.users where email = 'juanllauro+podlesh@gmail.com';
  if v_user_id is null then
    raise exception 'No auth user found with that email — create one first via Dashboard > Authentication > Users > Add user';
  end if;

  insert into profiles (id, org_id, full_name) values (v_user_id, v_podlesh_id, 'Podlesh (test)');
  insert into user_roles (profile_id, role) values
    (v_user_id, 'owner'), (v_user_id, 'approver');
end $$;
