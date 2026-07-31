-- Pre-shipment quality-control checklist, requested by Juan 2026-07-31 to
-- meet MatriSure QA directives around kit handling before a Distributor
-- ships a kit to a Customer. Ties to the existing Submitted → Approved
-- transition (approveTreatment in Portal.jsx, triggered from Wassington.jsx
-- by the Distributor's Owner/Approver) — that's the moment the Distributor
-- commits to sending the kit.
--
-- Same "blocking checklist before a physical dispatch" shape as
-- generator_dispatches (0001_initial_schema.sql), but the row is only ever
-- inserted atomically at approval time (no partial/pending state), so the
-- CHECK constraint can require all five items true directly, and the actual
-- per-item state the user checked is what gets persisted — unlike
-- GeneratorTransferModal.jsx, which hardcodes all four booleans to true
-- regardless of what was individually ticked.

create table treatment_dispatch_checklists (
  id                         uuid primary key default gen_random_uuid(),
  treatment_id               uuid not null unique references treatments(id),

  -- Juan's 5 QA directives, 2026-07-31:
  training_completed         boolean not null default false, -- protocol + MatriSure QA handling training executed
  kept_vacuum_sealed         boolean not null default false, -- kept in the vacuum-sealed plastic until ready for use
  refrigerated_2_6c          boolean not null default false, -- refrigerated storage on site, 2-6°C
  lot_age_verified           boolean not null default false, -- lot checked against the 30-day aging rule (matrisure_kit_lots)
  followed_card_instructions boolean not null default false, -- followed the directions on the MatriSure card

  completed_by               uuid references profiles(id),
  completed_at               timestamptz not null default now(),

  constraint checklist_all_items_required check (
    training_completed and kept_vacuum_sealed and refrigerated_2_6c
    and lot_age_verified and followed_card_instructions
  )
);
create index treatment_dispatch_checklists_treatment_id_idx on treatment_dispatch_checklists(treatment_id);

alter table treatment_dispatch_checklists enable row level security;

create policy treatment_dispatch_checklists_select on treatment_dispatch_checklists
  for select using (
    is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id())
  );

-- Same actor as the approval itself: Owner/Approver of the org doing the
-- approving (current_org_id()), mirroring treatments_update's role check
-- (0022_fase_g_role_enforcement.sql).
create policy treatment_dispatch_checklists_insert on treatment_dispatch_checklists
  for insert with check (
    is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id())
    and has_role(array['owner','approver']::business_role[])
  );

-- Database-level gate, matching Business Rule 43's precedent ("enforced at
-- the database level, not just hidden in the UI"): a Treatment cannot move
-- into 'approved' without a completed checklist row already existing for it.
-- Since the table above already requires all five items true, existence of
-- the row is sufficient proof of completion.
create or replace function require_dispatch_checklist() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if not exists (select 1 from treatment_dispatch_checklists where treatment_id = new.id) then
      raise exception 'No se puede aprobar un tratamiento sin completar el checklist de pre-envío de MatriSure';
    end if;
  end if;
  return new;
end;
$$;

create trigger treatments_require_checklist
  before update on treatments
  for each row execute function require_dispatch_checklist();
