-- Fix for a "new row violates row-level security policy for table
-- treatment_dispatch_checklists" error hit in production, 2026-07-31 —
-- Wassington (owner+approver, treatment in its own subtree) got rejected on
-- an insert that should have passed the exact same is_in_subtree +
-- has_role pattern already working for firmness_evaluations/
-- matrisure_verifications. Re-asserting these policies idempotently (drop
-- if exists, recreate) in case 0025_treatment_dispatch_checklist.sql's
-- INSERT policy didn't fully apply when it was run.

drop policy if exists treatment_dispatch_checklists_select on treatment_dispatch_checklists;
drop policy if exists treatment_dispatch_checklists_insert on treatment_dispatch_checklists;

create policy treatment_dispatch_checklists_select on treatment_dispatch_checklists
  for select using (
    is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id())
  );

create policy treatment_dispatch_checklists_insert on treatment_dispatch_checklists
  for insert with check (
    is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id())
    and has_role(array['owner','approver']::business_role[])
  );
