-- MaTri Portal — initial schema
-- Mirrors DOMAIN_MODEL.md. Every table/constraint below is traceable to a
-- Business Rule or entity section in that document — see inline references.

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ============================================================================
-- ORGANIZATIONS  (DOMAIN_MODEL.md → Organization, Organizational Model)
-- ============================================================================

create table organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  org_type       text not null check (org_type in ('global','distributor','subdistributor','customer')),
  parent_id      uuid references organizations(id),
  country        text,                              -- ISO code, null only for global
  currency       text,                               -- ISO 4217, set at distributor level (Rule 14)
  fx_rate_to_usd numeric,                             -- manual, distributor-level (Rule 15)
  language       text not null default 'es',          -- Rule 16
  status         text not null default 'pending' check (status in ('pending','active')), -- Rule 13
  created_at     timestamptz not null default now(),
  constraint organizations_global_has_no_parent
    check ((org_type = 'global') = (parent_id is null))
);

-- Exactly one Global root (Rule 1)
create unique index one_global_org on organizations ((org_type)) where org_type = 'global';
create index organizations_parent_id_idx on organizations(parent_id);

-- ============================================================================
-- PROFILES & BUSINESS ROLES  (DOMAIN_MODEL.md → User)
-- ============================================================================

-- One row per Supabase Auth user. A profile belongs to exactly one Organization (Rule 17).
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  org_id     uuid not null references organizations(id),
  full_name  text,
  created_at timestamptz not null default now()
);
create index profiles_org_id_idx on profiles(org_id);

create type business_role as enum ('owner','approver','planner','operator','viewer');

-- A profile can hold multiple Business Roles within its own Organization.
create table user_roles (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  role       business_role not null,
  unique (profile_id, role)
);
create index user_roles_profile_id_idx on user_roles(profile_id);

-- Rule 18: every Organization must always have at least one Owner.
create or replace function prevent_removing_last_owner()
returns trigger
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

create trigger trg_prevent_last_owner_delete
  before delete on user_roles
  for each row execute function prevent_removing_last_owner();

-- ============================================================================
-- COLD ROOMS  (DOMAIN_MODEL.md → Cold Room)
-- ============================================================================

create table cold_rooms (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id),
  name          text not null,
  volume_m3     numeric not null,
  location      text,
  primary_crop  text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index cold_rooms_org_id_idx on cold_rooms(org_id);

-- ============================================================================
-- GENERATORS  (DOMAIN_MODEL.md → Generator)
-- ============================================================================

create table generators (
  id                 uuid primary key default gen_random_uuid(),
  unit_code          text not null unique,           -- e.g. GEN-007
  serial_number      text,
  org_id             uuid not null references organizations(id), -- current owner (Rule 29)
  status             text not null default 'available'
                       check (status in ('available','dispatched','on_rent','returned','in_service','repaired','out_of_service')),
  purchase_date      date,
  total_hours_used   numeric not null default 0,
  last_service_date  date,
  notes              text
);
create index generators_org_id_idx on generators(org_id);

-- A dispatch covers a rental PERIOD, not a single Treatment (Rule 30).
create table generator_dispatches (
  id                              uuid primary key default gen_random_uuid(),
  generator_id                    uuid not null references generators(id),
  dispatched_to_org_id            uuid not null references organizations(id),
  dispatched_at                   timestamptz,
  returned_at                     timestamptz,
  checklist_battery_charged       boolean not null default false,
  checklist_seals_intact          boolean not null default false,
  checklist_test_run_completed    boolean not null default false,
  checklist_service_interval_ok   boolean not null default false,
  -- Rule 31: pre-dispatch checklist is a blocking gate.
  constraint generator_dispatch_requires_full_checklist check (
    dispatched_at is null or (
      checklist_battery_charged and checklist_seals_intact
      and checklist_test_run_completed and checklist_service_interval_ok
    )
  )
);
create index generator_dispatches_generator_id_idx on generator_dispatches(generator_id);

-- ============================================================================
-- PRICING  (DOMAIN_MODEL.md → Pricing)
-- Configured per Organization, never inherited from FreshInset Global (Rule 14).
-- ============================================================================

create table volume_brackets (
  id       uuid primary key default gen_random_uuid(),
  org_id   uuid not null references organizations(id),
  code     text not null,          -- 'xs' | 'sm' | 'md' | 'lg' by convention, adjustable per org
  min_m3   numeric not null,
  max_m3   numeric,                -- null = unbounded (the "lg" bracket)
  unique (org_id, code)
);

create table pricing_product (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references organizations(id),
  sku       text not null,          -- 'MatriPowder' | 'MatriTablets' | future SKUs (Pricing → New SKUs)
  bracket   text not null,
  price     numeric not null,       -- in the org's own currency
  unique (org_id, sku, bracket)
);

create table pricing_service_fee (
  id       uuid primary key default gen_random_uuid(),
  org_id   uuid not null references organizations(id),
  bracket  text not null,
  price    numeric not null,
  unique (org_id, bracket)
);

create table pricing_generator (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id),
  bracket        text not null,
  purchase_price numeric not null,
  rental_price   numeric not null,   -- per day
  unique (org_id, bracket)
);

-- ============================================================================
-- SEASON PLAN  (DOMAIN_MODEL.md → Season Plan) — added 2026-07-03
-- Always non-binding (Rule 22).
-- ============================================================================

create table season_plans (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id),   -- Customer
  season_label text not null,                                -- e.g. "Temporada 2026"
  created_by   uuid references profiles(id),
  notes        text,
  created_at   timestamptz not null default now()
);
create index season_plans_org_id_idx on season_plans(org_id);

create table season_plan_lines (
  id                 uuid primary key default gen_random_uuid(),
  season_plan_id     uuid not null references season_plans(id) on delete cascade,
  cold_room_id       uuid not null references cold_rooms(id),
  planned_date       date,
  planned_dose_ppb   numeric,
  product_preference text not null default 'undecided'
                       check (product_preference in ('powder','tablets','undecided')),
  indicative_cost    numeric,        -- computed client-side/live, stored as last-known estimate
  notes              text,
  status             text not null default 'planned' check (status in ('planned','converted'))
);
create index season_plan_lines_plan_id_idx on season_plan_lines(season_plan_id);

-- ============================================================================
-- TREATMENTS  (DOMAIN_MODEL.md → Treatment) — replaces "Pedido/Order"
-- ============================================================================

create table treatments (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations(id),          -- Customer (Rule 2)
  cold_room_id          uuid not null references cold_rooms(id),
  plan_line_id          uuid references season_plan_lines(id),               -- lineage back to Season Plan, if converted

  status                text not null default 'draft'
                          check (status in ('draft','submitted','approved','applied','completed','rejected','cancelled')),

  product               text not null check (product in ('powder','tablets')),
  target_dose_ppb       numeric not null,
  dose_source           text not null check (dose_source in ('manual','doseright')),  -- Rule 4

  -- Pricing snapshot (Rules 7, 14, 15) — captured at Approved, frozen forever.
  price_local           numeric,
  price_currency        text,
  price_usd             numeric,
  fx_rate_snapshot       numeric,
  service_fee_local     numeric,
  approved_by           uuid references profiles(id),
  approved_at           timestamptz,

  -- Rejection (Rule 20)
  rejection_reason      text,

  -- Application (Applied state)
  generator_id          uuid references generators(id),        -- Rule 10: required only when product = 'powder'
  operator_id           uuid references profiles(id),
  applied_at            timestamptz,
  application_start_time timestamptz,
  application_end_time   timestamptz,

  created_by            uuid references profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint treatment_generator_only_for_powder
    check (product = 'powder' or generator_id is null)
);
create index treatments_org_id_idx on treatments(org_id);
create index treatments_cold_room_id_idx on treatments(cold_room_id);
create index treatments_status_idx on treatments(status);

-- ============================================================================
-- MATRISURE VERIFICATION  (DOMAIN_MODEL.md → MatriSure Verification)
-- ============================================================================

create table matrisure_verifications (
  id                    uuid primary key default gen_random_uuid(),
  treatment_id          uuid not null unique references treatments(id),   -- 1:1 with Treatment
  photo_url             text not null,
  captured_at           timestamptz not null default now(),
  result                text not null default 'pending_review'
                          check (result in ('confirmed','not_reached','pending_review')),
  reviewed_by           uuid references profiles(id),                     -- Customer's own Approver, or Distributor/Sub-distributor Approver (Rule 32)
  reviewed_at           timestamptz,
  assistance_requested  boolean not null default false,
  notes                 text
);
create index matrisure_verifications_treatment_id_idx on matrisure_verifications(treatment_id);

-- ============================================================================
-- DOCUMENTATION  (DOMAIN_MODEL.md → Documentation)
-- ============================================================================

create table documents (
  id             uuid primary key default gen_random_uuid(),
  scope          text not null check (scope in ('global','organization')),
  org_id         uuid references organizations(id),     -- null when scope = 'global'
  doc_type       text not null,   -- 'label' | 'sds' | 'generator_manual' | 'application_instructions'
                                  -- | 'matrisure_guide' | 'regulatory' (Rule 26)
                                  -- | 'scientific_kb' | 'doseright_evidence' (global only)
  title          text not null,
  file_url       text not null,
  version        int not null default 1,
  language       text,
  changelog_note text,
  uploaded_by    uuid references profiles(id),
  created_at     timestamptz not null default now(),
  constraint documents_scope_org_consistency
    check ((scope = 'global') = (org_id is null))
);
create index documents_org_id_idx on documents(org_id);
