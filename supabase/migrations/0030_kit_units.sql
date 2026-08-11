-- MatriSure Kit stewardship — Fase K-1 (Global + Distribuidor), 2026-08-11.
-- Unit-serialized kit tracking, adapted from the standalone DECCO-MatriSure
-- app's proven design (kit_units/kit_releases/kit_receipts/kit_dispatches)
-- but re-expressed against this app's real org tree + is_in_subtree()/
-- has_role() RLS helpers instead of DECCO's flat single-tenant model — see
-- project memory "matri-kit-stewardship-integration" for the full design.
--
-- Deliberate simplifications vs. DECCO, per Juan's decisions 2026-08-11:
--   - No separate "confirm receipt" step: releasing a lot to a Distributor
--     changes org_id directly, so it just shows up as that Distributor's
--     stock — DECCO needed an explicit receipt-confirm click because it has
--     no real org hierarchy to already imply "this is now yours"; here the
--     org tree itself carries that.
--   - One generic append-only kit_unit_movements audit log instead of
--     DECCO's three separate typed tables (kit_releases/receipts/dispatches)
--     — same traceability, fewer tables, and no schema change needed when
--     this extends to Sub-distribuidor/Cliente in a later Fase.
--   - Release always targets one specific Distributor explicitly (like
--     Generator transfer-to-Sub-distributor), never DECCO's "pool, first to
--     receive claims it" model.
--
-- Replaces matrisure_kit_lots (0026) eventually — that table is left alone
-- for now (still in use) and will be migrated/retired once this new flow is
-- proven end to end (see Fase K-1 step 5 in project memory), not in this
-- migration.

create table kit_units (
  id                                    uuid primary key default gen_random_uuid(),
  tracking_number                       text not null unique, -- serialized identifier printed/etched on the physical kit
  lot_number                            text not null,        -- "Lot/Batch No." on the card, same format as matrisure_kit_lots.lot_number
  org_id                                uuid not null references organizations(id), -- current holder — Global right after registration, then wherever it's been released/assigned
  status                                text not null default 'registered'
                                          check (status in ('registered','released','assigned','used','destroyed')),

  assigned_to_profile_id                uuid references profiles(id), -- the Aplicador currently holding it, once assigned
  assigned_at                           timestamptz,

  -- Juan's 5 QA directives, same items as treatment_dispatch_checklists
  -- (0025) — reused verbatim per his explicit instruction 2026-08-11,
  -- recorded at ASSIGNMENT time (Manager/Encargado de Kits → Aplicador),
  -- not at release or at an org-to-org forward.
  checklist_training_completed          boolean not null default false,
  checklist_kept_vacuum_sealed          boolean not null default false,
  checklist_refrigerated_2_6c           boolean not null default false,
  checklist_lot_age_verified            boolean not null default false,
  checklist_followed_card_instructions  boolean not null default false,

  used_at                               timestamptz, -- wired to a real Treatment/MatriSure Verification in a later Fase-K step

  destroyed_at                          timestamptz,
  destroyed_by                          uuid references profiles(id),
  destroyed_reason                      text,

  created_by                            uuid references profiles(id),
  created_at                            timestamptz not null default now(),

  constraint kit_units_assignment_requires_full_checklist check (
    status not in ('assigned','used') or (
      checklist_training_completed and checklist_kept_vacuum_sealed
      and checklist_refrigerated_2_6c and checklist_lot_age_verified
      and checklist_followed_card_instructions
    )
  ),
  constraint kit_units_destroyed_requires_fields check (
    status <> 'destroyed' or destroyed_at is not null
  )
);
create index kit_units_org_id_idx on kit_units(org_id);
create index kit_units_status_idx on kit_units(status);
create index kit_units_assigned_to_profile_id_idx on kit_units(assigned_to_profile_id);

-- Append-only audit trail — one row per state change, mirrors the "merged
-- activity timeline" pattern DECCO built (flagged as a portable pattern
-- worth reusing, project memory). Covers register/release/forward/assign/
-- use/destroy uniformly instead of DECCO's per-action tables.
create table kit_unit_movements (
  id            uuid primary key default gen_random_uuid(),
  kit_unit_id   uuid not null references kit_units(id),
  action        text not null check (action in ('registered','released','forwarded','assigned','used','destroyed')),
  from_org_id   uuid references organizations(id),
  to_org_id     uuid references organizations(id),
  moved_by      uuid references profiles(id),
  moved_at      timestamptz not null default now(),
  notes         text
);
create index kit_unit_movements_kit_unit_id_idx on kit_unit_movements(kit_unit_id);

alter table kit_units enable row level security;
alter table kit_unit_movements enable row level security;

-- Who may register/release/assign/destroy kit units, given their OWN org —
-- at Global this is the "Encargado de Kits" (Operador) or Manager
-- (Owner/Aprobador); everywhere else in the tree, kit handling is
-- deliberately Manager-only (Juan's call 2026-08-11 — assigning a kit to an
-- Aplicador is a supervisory decision, not routine clerical work, unlike
-- Global's kit registration which is pure technical intake).
create or replace function can_manage_kit_units() returns boolean
language sql stable security definer set search_path = public
as $$
  select case when is_global_member()
    then has_role(array['owner','approver','operator']::business_role[])
    else has_role(array['owner','approver']::business_role[])
  end;
$$;

create policy kit_units_select on kit_units
  for select using (is_in_subtree(org_id, current_org_id()));

-- Only Global registers brand-new kit stock — nobody else originates it.
create policy kit_units_insert on kit_units
  for insert with check (is_global_member() and can_manage_kit_units());

create policy kit_units_update on kit_units
  for update
  using (is_in_subtree(org_id, current_org_id()) and can_manage_kit_units())
  with check (is_in_subtree(org_id, current_org_id()) and can_manage_kit_units());

create policy kit_unit_movements_select on kit_unit_movements
  for select using (
    is_in_subtree(from_org_id, current_org_id()) or is_in_subtree(to_org_id, current_org_id())
  );

create policy kit_unit_movements_insert on kit_unit_movements
  for insert with check (
    is_in_subtree(to_org_id, current_org_id()) and can_manage_kit_units()
  );

-- ============================================================================
-- Global registers brand-new kit units (bulk, atomic) — mirrors
-- Generators.jsx's generateSequence() correlative-numbering pattern
-- client-side; this just inserts whatever tracking numbers the client
-- already generated, one movement row per unit.
-- ============================================================================
create or replace function register_kit_units(p_units jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_global_org_id uuid;
begin
  if not (is_global_member() and can_manage_kit_units()) then
    raise exception 'Solo el Encargado de Kits o Manager de FreshInset Global puede registrar kits.';
  end if;

  select org_id into v_global_org_id from profiles where id = auth.uid();

  with inserted as (
    insert into kit_units (tracking_number, lot_number, org_id, created_by)
    select u->>'tracking_number', u->>'lot_number', v_global_org_id, auth.uid()
    from jsonb_array_elements(p_units) as u
    returning id
  )
  insert into kit_unit_movements (kit_unit_id, action, from_org_id, to_org_id, moved_by)
  select id, 'registered', null, v_global_org_id, auth.uid()
  from inserted;
end;
$$;

-- ============================================================================
-- Global releases a lot to one specific Distributor (bulk, atomic).
-- ============================================================================
create or replace function release_kit_units(p_unit_ids uuid[], p_target_org_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_global_org_id uuid;
  v_target_org_type text;
begin
  if not (is_global_member() and can_manage_kit_units()) then
    raise exception 'Solo el Encargado de Kits o Manager de FreshInset Global puede liberar kits.';
  end if;

  select org_id into v_global_org_id from profiles where id = auth.uid();

  select org_type into v_target_org_type from organizations where id = p_target_org_id;
  if v_target_org_type is distinct from 'distributor' then
    raise exception 'El destino de la liberación tiene que ser un Distribuidor.';
  end if;

  if exists (
    select 1 from kit_units
    where id = any(p_unit_ids) and (org_id <> v_global_org_id or status <> 'registered')
  ) then
    raise exception 'Una o más unidades ya no están disponibles para liberar (ya fueron liberadas o no pertenecen a Global).';
  end if;

  update kit_units
  set org_id = p_target_org_id, status = 'released'
  where id = any(p_unit_ids);

  insert into kit_unit_movements (kit_unit_id, action, from_org_id, to_org_id, moved_by)
  select id, 'released', v_global_org_id, p_target_org_id, auth.uid()
  from kit_units where id = any(p_unit_ids);
end;
$$;

-- ============================================================================
-- A Manager (or Global's Encargado de Kits, forward-compatible) assigns
-- specific units to one Aplicador — checklist required, all-or-nothing.
-- ============================================================================
create or replace function assign_kit_units(
  p_unit_ids uuid[],
  p_applicator_profile_id uuid,
  p_checklist_training_completed boolean,
  p_checklist_kept_vacuum_sealed boolean,
  p_checklist_refrigerated_2_6c boolean,
  p_checklist_lot_age_verified boolean,
  p_checklist_followed_card_instructions boolean
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_org_id uuid;
  v_applicator_org_id uuid;
begin
  if not can_manage_kit_units() then
    raise exception 'No tenés permiso para asignar kits.';
  end if;

  if not (
    p_checklist_training_completed and p_checklist_kept_vacuum_sealed
    and p_checklist_refrigerated_2_6c and p_checklist_lot_age_verified
    and p_checklist_followed_card_instructions
  ) then
    raise exception 'El checklist tiene que estar completo antes de asignar el kit.';
  end if;

  select org_id into v_caller_org_id from profiles where id = auth.uid();

  select org_id into v_applicator_org_id from profiles where id = p_applicator_profile_id;
  if v_applicator_org_id is null or not is_in_subtree(v_applicator_org_id, v_caller_org_id) then
    raise exception 'Ese Aplicador no pertenece a tu organización ni a las que tenés debajo.';
  end if;

  if exists (
    select 1 from kit_units
    where id = any(p_unit_ids)
      and (not is_in_subtree(org_id, v_caller_org_id) or status not in ('released','registered'))
  ) then
    raise exception 'Una o más unidades no están disponibles para asignar.';
  end if;

  update kit_units
  set status = 'assigned',
      assigned_to_profile_id = p_applicator_profile_id,
      assigned_at = now(),
      checklist_training_completed = true,
      checklist_kept_vacuum_sealed = true,
      checklist_refrigerated_2_6c = true,
      checklist_lot_age_verified = true,
      checklist_followed_card_instructions = true
  where id = any(p_unit_ids);

  insert into kit_unit_movements (kit_unit_id, action, from_org_id, to_org_id, moved_by, notes)
  select id, 'assigned', org_id, org_id, auth.uid(), 'Asignado a Aplicador'
  from kit_units where id = any(p_unit_ids);
end;
$$;
