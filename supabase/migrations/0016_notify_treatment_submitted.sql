-- Closes a real gap Juan found testing the notification bell: the existing
-- treatment_approved/treatment_rejected notifications (migration 0015) only
-- fire once the Approver has already decided — there was no notification the
-- other direction, when a Customer submits a new Treatment and it's actually
-- waiting on someone. Treatments are always inserted with status='submitted'
-- directly (Portal.jsx's addTreatment — there's no separate Draft step in
-- this app today), so this must fire on INSERT, not just UPDATE.

do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'notifications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%event_type%';
  if v_constraint_name is not null then
    execute format('alter table notifications drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table notifications add constraint notifications_event_type_check check (event_type in (
  'treatment_approved', 'treatment_rejected', 'treatment_submitted',
  'pending_signup', 'access_request',
  'matrisure_assistance_requested', 'invite_redeemed'
));

-- Notifies the same audience that reviews it: Owner/Approver of the
-- Treatment's org's immediate parent (a Customer's parent is always a
-- Distributor or Sub-distributor, never Global directly — Rule 1/valid child
-- types in Organizations.jsx) — same scope as notify_matrisure_assistance.
create or replace function notify_treatment_submitted() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_parent_org uuid;
begin
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select parent_id into v_parent_org from organizations where id = new.org_id;
    if v_parent_org is not null then
      insert into notifications (recipient_profile_id, event_type, title, body, panel, related_id)
      select distinct p.id, 'treatment_submitted', 'Tratamiento pendiente de aprobación',
        'Hay un nuevo tratamiento esperando tu revisión.',
        'wassington', new.id
      from profiles p
      join user_roles ur on ur.profile_id = p.id
      where p.org_id = v_parent_org and ur.role in ('owner','approver');
    end if;
  end if;
  return new;
end;
$$;

create trigger on_treatment_submitted
  after insert or update on treatments
  for each row execute function notify_treatment_submitted();
