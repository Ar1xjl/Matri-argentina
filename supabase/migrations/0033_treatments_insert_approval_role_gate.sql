-- Gap found while fixing 0032: treatments_insert (0022) only checks subtree
-- membership (is_in_subtree(org_id, current_org_id())) — nothing at the RLS
-- level restricts what `status` a newly-inserted Treatment row can have. In
-- practice addTreatment (Portal.jsx) always inserts status: 'submitted', so
-- this isn't exploited today, but nothing stops a direct API insert with
-- status: 'approved' or 'rejected' from skipping the whole Owner/Aprobador
-- review + Treatment Dispatch Checklist flow — the same authority Business
-- Rule 8 ("The Approver has final authority over the confirmed price at
-- approval time") and Rule 43 ("Approving or rejecting a Treatment likewise
-- requires Owner or Aprobador, enforced at the database level, not just
-- hidden in the UI") already assume is closed on the UPDATE side.
--
-- Fix: extend enforce_treatment_approval_role() (introduced in 0032 for
-- BEFORE UPDATE) to also run BEFORE INSERT, using tg_op to branch. A new row
-- may start as 'draft' or 'submitted' freely, same as today; starting
-- anywhere else (approved, rejected, applied, completed, cancelled) now
-- requires Owner/Aprobador — the same has_role(['owner','approver']) check
-- the UPDATE-side trigger already uses. The UPDATE branch is untouched.

create or replace function enforce_treatment_approval_role() returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft','submitted')
       and not has_role(array['owner','approver']::business_role[]) then
      raise exception 'Solo Owner/Aprobador puede crear un tratamiento que no empiece en borrador o enviado.';
    end if;
    return new;
  end if;

  if old.status is distinct from new.status
     and new.status in ('approved','rejected')
     and not has_role(array['owner','approver']::business_role[]) then
    raise exception 'Solo Owner/Aprobador puede aprobar o rechazar un tratamiento.';
  end if;
  return new;
end;
$$;

drop trigger if exists treatments_insert_approval_role_gate on treatments;
create trigger treatments_insert_approval_role_gate
  before insert on treatments
  for each row execute function enforce_treatment_approval_role();
