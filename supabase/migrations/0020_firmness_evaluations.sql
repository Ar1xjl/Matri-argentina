-- Firmness Evaluation — traditional post-application quality control,
-- comparing treated ("Matri") vs. untreated ("Testigo") fruit firmness over
-- shelf-life days, as a Treatment sub-entity alongside matrisure_verifications
-- (a different verification method entirely — MatriSure confirms in-room
-- concentration, this confirms the effect on the fruit itself; Wassington
-- runs both). Modeled on a real signed "Declaración jurada" report an
-- agronomist issues per room/application.
--
-- Structured fields feed an in-app table + chart (computed client-side —
-- loss rate and the chart are always derived from `samples`, never stored);
-- `pdf_url` optionally attaches the real signed document for the Customer to
-- download as-is, same pattern as MatriSure's photo attachment.

create table firmness_evaluations (
  id                  uuid primary key default gen_random_uuid(),
  treatment_id        uuid not null unique references treatments(id),

  declaration_number  text,   -- Wassington's own numbering ("Declaración jurada N°"), not app-generated
  variety             text,
  lot_number          text,
  cold_type           text,
  harvest_date        date,
  room_fill_start     date,
  room_fill_end       date,
  room_exit_date      date,
  evaluator_name      text,

  -- [{ day: number, testigo: number, matri: number }, ...] — usually 3 rows
  -- (day 1/7/14) but the day values are editable since a holiday/delay can
  -- shift the actual sampling day slightly.
  samples             jsonb not null default '[]',

  pdf_url             text,   -- path in the firmness-evaluations bucket, nullable

  created_by          uuid references profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index firmness_evaluations_treatment_id_idx on firmness_evaluations(treatment_id);

alter table firmness_evaluations enable row level security;

-- Visible to the whole ancestor chain of the Treatment's Organization
-- (Customer up through Global) — same visibility as the Treatment itself.
create policy firmness_evaluations_select on firmness_evaluations
  for select using (
    is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id())
  );

-- Only staff of a non-Customer Organization (Distributor/Sub-distributor/
-- Global) in that same ancestor chain can create or edit one — it's always
-- an agronomist doing the sampling and signing, never the Customer itself.
create policy firmness_evaluations_insert on firmness_evaluations
  for insert with check (
    is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id())
    and coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
  );

create policy firmness_evaluations_update on firmness_evaluations
  for update
  using (
    is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id())
    and coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
  )
  with check (
    is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id())
    and coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
  );

-- Private bucket for the optional signed PDF attachment, same path/RLS shape
-- as matrisure-photos (migration 0004): {org_id}/{treatment_id}/{filename}.
insert into storage.buckets (id, name, public)
values ('firmness-evaluations', 'firmness-evaluations', false)
on conflict (id) do nothing;

create policy firmness_evaluations_pdf_select on storage.objects
  for select using (
    bucket_id = 'firmness-evaluations'
    and is_in_subtree((storage.foldername(name))[1]::uuid, current_org_id())
  );

create policy firmness_evaluations_pdf_insert on storage.objects
  for insert with check (
    bucket_id = 'firmness-evaluations'
    and is_in_subtree((storage.foldername(name))[1]::uuid, current_org_id())
    and coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
  );
