-- Bug fix, found 2026-08-11 by a real live-testing report from a Distributor-
-- dispatched Aplicador ("no se pudo guardar el inicio de la aplicación:
-- new row violates row-level security policy for table treatments").
--
-- Fase G-3's treatments_update policy (0022_fase_g_role_enforcement.sql)
-- meant to gate only the ACT of moving a Treatment INTO approved/rejected
-- to Owner/Aprobador — its own comment says so explicitly ("every other
-- transition ... is unaffected, so Planificador/Operador keep doing their
-- own transitions"). But its WITH CHECK tested the NEW row's status
-- ('approved' or 'rejected'), not whether status was actually CHANGING —
-- so ANY update to an already-Approved Treatment (like recording the
-- Inicio/Fin application photos, which never touch `status` at all — it
-- stays 'approved' the whole time until Fin flips it to 'applied') got
-- blocked for anyone without Owner/Aprobador, even though nothing about
-- approval was happening.
--
-- This was invisible until now because the only accounts that had ever
-- called startApplication/finishApplication were Customers, who
-- self-service and typically hold 'owner' on their own small org — so the
-- role check always silently passed. A Distributor-dispatched Aplicador
-- (Fase K-2, 'operator' role only) is the first caller that doesn't.
--
-- Fix: RLS policies can only see one row version at a time (USING sees
-- OLD, WITH CHECK sees NEW) — there's no way to compare OLD vs NEW status
-- inside a single declarative check. So the real "is status transitioning
-- into approved/rejected" gate moves into a BEFORE UPDATE trigger (same
-- pattern already used elsewhere in this schema — prevent_removing_last_owner,
-- require_dispatch_checklist), which does have both OLD and NEW available.
-- treatments_update's own WITH CHECK goes back to just the subtree check.

drop policy if exists treatments_update on treatments;

create policy treatments_update on treatments
  for update
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

create or replace function enforce_treatment_approval_role() returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.status is distinct from new.status
     and new.status in ('approved','rejected')
     and not has_role(array['owner','approver']::business_role[]) then
    raise exception 'Solo Owner/Aprobador puede aprobar o rechazar un tratamiento.';
  end if;
  return new;
end;
$$;

drop trigger if exists treatments_approval_role_gate on treatments;
create trigger treatments_approval_role_gate
  before update on treatments
  for each row execute function enforce_treatment_approval_role();
