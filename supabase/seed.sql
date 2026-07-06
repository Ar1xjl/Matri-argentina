-- MaTri Portal — demo seed data
--
-- Run this ONCE, via the Supabase Dashboard SQL Editor, AFTER creating a real
-- Auth user for yourself: Dashboard → Authentication → Users → Add user
-- (use juanllauro@gmail.com, set any password). This script finds that user
-- by email and wires up a minimal but real org tree so the app has data to
-- show: FreshInset Global → Wassington (Argentina, USD) → Kleppe S.A.,
-- with 4 Cold Rooms and Wassington's pricing tables (mirrors the values in
-- src/data/pricing.js so nothing changes visually).
--
-- Not idempotent — running it twice creates duplicates. It's meant to run once.

do $$
declare
  v_global_id     uuid;
  v_wassington_id uuid;
  v_kleppe_id     uuid;
  v_user_id       uuid;
begin
  select id into v_user_id from auth.users where email = 'juanllauro@gmail.com';
  if v_user_id is null then
    raise exception 'No auth user found with that email — create one first via Dashboard > Authentication > Users > Add user';
  end if;

  -- Organizations
  insert into organizations (name, org_type, parent_id, country, status)
    values ('FreshInset Global', 'global', null, null, 'active')
    returning id into v_global_id;

  insert into organizations (name, org_type, parent_id, country, currency, fx_rate_to_usd, status)
    values ('Wassington', 'distributor', v_global_id, 'AR', 'USD', 1, 'active')
    returning id into v_wassington_id;

  insert into organizations (name, org_type, parent_id, country, status)
    values ('Kleppe S.A.', 'customer', v_wassington_id, 'AR', 'active')
    returning id into v_kleppe_id;

  -- Your login is seeded as Kleppe's Owner (holds every role, for demo convenience)
  insert into profiles (id, org_id, full_name) values (v_user_id, v_kleppe_id, 'Juan Llauro');
  insert into user_roles (profile_id, role) values
    (v_user_id, 'owner'), (v_user_id, 'approver'), (v_user_id, 'planner'), (v_user_id, 'operator');

  -- Cold Rooms (matches today's mock ROOMS in Calculator.jsx)
  insert into cold_rooms (org_id, name, volume_m3) values
    (v_kleppe_id, 'Cámara Norte 1', 500),
    (v_kleppe_id, 'Cámara Norte 2', 620),
    (v_kleppe_id, 'Cámara Sur 3',   360),
    (v_kleppe_id, 'Frigorífico A',  240);

  -- Volume brackets for Wassington (mirrors BRACKETS in src/data/pricing.js)
  insert into volume_brackets (org_id, code, min_m3, max_m3) values
    (v_wassington_id, 'xs', 0,    600),
    (v_wassington_id, 'sm', 600,  1200),
    (v_wassington_id, 'md', 1200, 1800),
    (v_wassington_id, 'lg', 1800, null);

  -- Product pricing (mirrors PRODUCT_PRICES.T1 — Kleppe's tier in the old model)
  insert into pricing_product (org_id, sku, bracket, price) values
    (v_wassington_id, 'MatriPowder',  'xs', 0.75),
    (v_wassington_id, 'MatriPowder',  'sm', 0.70),
    (v_wassington_id, 'MatriPowder',  'md', 0.65),
    (v_wassington_id, 'MatriPowder',  'lg', 0.60),
    (v_wassington_id, 'MatriTablets', 'xs', 0.80),
    (v_wassington_id, 'MatriTablets', 'sm', 0.75),
    (v_wassington_id, 'MatriTablets', 'md', 0.70),
    (v_wassington_id, 'MatriTablets', 'lg', 0.65);

  -- Application service fee (mirrors SERVICE_FEES.T1)
  insert into pricing_service_fee (org_id, bracket, price) values
    (v_wassington_id, 'xs', 120),
    (v_wassington_id, 'sm', 150),
    (v_wassington_id, 'md', 180),
    (v_wassington_id, 'lg', 200);

  -- Generator pricing (mirrors GENERATOR_PRICES purchase/rental T1)
  insert into pricing_generator (org_id, bracket, purchase_price, rental_price) values
    (v_wassington_id, 'xs', 800, 40),
    (v_wassington_id, 'sm', 800, 40),
    (v_wassington_id, 'md', 750, 38),
    (v_wassington_id, 'lg', 700, 35);
end $$;
