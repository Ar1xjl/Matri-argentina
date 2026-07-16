-- Fase G: role enforcement at the database level, not just hiding UI. Two
-- gaps the permission-matrix review found (2026-07-15): approving/rejecting
-- a Treatment had no role check at all (only subtree membership), and
-- recording a Firmness Evaluation only checked org_type, not the specific
-- role (Owner/Aprobador/Operador) agreed for that job.

-- ============================================================================
-- TREATMENTS — split the single "for all" policy so UPDATE can add a role
-- check on top, without touching SELECT/INSERT/DELETE's existing behavior.
-- ============================================================================
drop policy if exists treatments_all on treatments;

create policy treatments_select on treatments
  for select using (is_in_subtree(org_id, current_org_id()));

create policy treatments_insert on treatments
  for insert with check (is_in_subtree(org_id, current_org_id()));

-- Only Owner/Aprobador may move a Treatment into approved/rejected — every
-- other transition (submitted→cancelled, applied, completed, etc.) is
-- unaffected, so Planificador/Operador keep doing their own transitions.
create policy treatments_update on treatments
  for update using (is_in_subtree(org_id, current_org_id()))
  with check (
    is_in_subtree(org_id, current_org_id())
    and (
      status not in ('approved','rejected')
      or has_role(array['owner','approver']::business_role[])
    )
  );

create policy treatments_delete on treatments
  for delete using (is_in_subtree(org_id, current_org_id()));

-- ============================================================================
-- FIRMNESS EVALUATIONS — narrow from "any non-Customer org member" to
-- specifically Owner/Aprobador/Operador (the roles the matrix agreed on).
-- ============================================================================
drop policy if exists firmness_evaluations_insert on firmness_evaluations;
drop policy if exists firmness_evaluations_update on firmness_evaluations;

create policy firmness_evaluations_insert on firmness_evaluations
  for insert with check (
    is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id())
    and coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
    and has_role(array['owner','approver','operator']::business_role[])
  );

create policy firmness_evaluations_update on firmness_evaluations
  for update
  using (
    is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id())
    and coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
    and has_role(array['owner','approver','operator']::business_role[])
  )
  with check (
    is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id())
    and coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
    and has_role(array['owner','approver','operator']::business_role[])
  );
