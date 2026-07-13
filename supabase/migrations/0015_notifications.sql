-- In-app notifications ("campanita"). Email is explicitly deferred — Supabase's
-- shared SMTP has a low rate limit (already hit testing password reset) and
-- Juan hasn't set up a real SMTP provider yet. This covers the four events
-- Juan asked for first: Treatment approved/rejected, a new pending signup or
-- company access request, a MatriSure assistance request, and an invite link
-- being redeemed.
--
-- One row per recipient (fan-out happens at write time, via triggers) rather
-- than a shared/broadcast row + a separate per-user read-tracking table —
-- simpler RLS (recipient_profile_id = auth.uid()) and a trivial unread count.

create table notifications (
  id                    uuid primary key default gen_random_uuid(),
  recipient_profile_id  uuid not null references profiles(id) on delete cascade,
  event_type            text not null check (event_type in (
                          'treatment_approved', 'treatment_rejected',
                          'pending_signup', 'access_request',
                          'matrisure_assistance_requested', 'invite_redeemed'
                        )),
  title                 text not null,
  body                  text,
  panel                 text,   -- which Portal.jsx panel key to jump to on click
  related_id            uuid,   -- treatment/request/invite id — reference only, no FK (crosses tables)
  read_at               timestamptz,
  created_at            timestamptz not null default now()
);
create index notifications_recipient_idx on notifications(recipient_profile_id, read_at);

alter table notifications enable row level security;

-- Recipients only ever see/manage their own notifications. No insert policy:
-- every row is created by a SECURITY DEFINER trigger function below, which
-- (like handle_new_auth_user in migration 0013) runs as the table owner and
-- bypasses RLS — the client never inserts here directly.
create policy notifications_select on notifications
  for select using (recipient_profile_id = auth.uid());
create policy notifications_update on notifications
  for update using (recipient_profile_id = auth.uid()) with check (recipient_profile_id = auth.uid());

-- ============================================================================
-- Treatment approved/rejected → notify whoever created it (Rule 20/21 context)
-- ============================================================================
create or replace function notify_treatment_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('approved','rejected')
     and new.status is distinct from old.status
     and new.created_by is not null then
    insert into notifications (recipient_profile_id, event_type, title, body, panel, related_id)
    values (
      new.created_by,
      case when new.status = 'approved' then 'treatment_approved' else 'treatment_rejected' end,
      case when new.status = 'approved' then 'Tratamiento aprobado' else 'Tratamiento rechazado' end,
      case when new.status = 'approved' then 'Tu tratamiento fue aprobado.'
           else coalesce('Motivo: ' || new.rejection_reason, 'Tu tratamiento fue rechazado.') end,
      'treatments',
      new.id
    );
  end if;
  return new;
end;
$$;

create trigger on_treatment_decision
  after update on treatments
  for each row execute function notify_treatment_decision();

-- ============================================================================
-- New pending signup / access request → notify every non-Customer staff
-- member (same audience these two queues are already visible to, migrations
-- 0011/0013 — there's no subtree to scope by until the person/org is placed).
-- ============================================================================
create or replace function notify_pending_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (recipient_profile_id, event_type, title, body, panel, related_id)
  select p.id, 'pending_signup', 'Nuevo usuario autoregistrado',
    coalesce(new.full_name, new.email) || ' se registró y espera asignación.',
    'users', new.id
  from profiles p
  join organizations o on o.id = p.org_id
  where o.org_type <> 'customer';
  return new;
end;
$$;

create trigger on_pending_signup_created
  after insert on pending_user_signups
  for each row execute function notify_pending_signup();

create or replace function notify_access_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (recipient_profile_id, event_type, title, body, panel, related_id)
  select p.id, 'access_request', 'Nueva solicitud de acceso — empresa',
    new.company_name || ' solicitó acceso.',
    'wassington', new.id
  from profiles p
  join organizations o on o.id = p.org_id
  where o.org_type <> 'customer';
  return new;
end;
$$;

create trigger on_access_request_created
  after insert on organization_access_requests
  for each row execute function notify_access_request();

-- ============================================================================
-- MatriSure assistance requested → notify Owner/Approver of the Customer's
-- immediate parent Organization (Rule 32 — that's who reviews it).
-- ============================================================================
create or replace function notify_matrisure_assistance() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_customer_org uuid;
  v_parent_org uuid;
begin
  if new.assistance_requested
     and (tg_op = 'INSERT' or old.assistance_requested is distinct from new.assistance_requested) then
    select org_id into v_customer_org from treatments where id = new.treatment_id;
    select parent_id into v_parent_org from organizations where id = v_customer_org;
    if v_parent_org is not null then
      insert into notifications (recipient_profile_id, event_type, title, body, panel, related_id)
      select distinct p.id, 'matrisure_assistance_requested', 'Pedido de asistencia MatriSure',
        'Un cliente pidió ayuda para revisar su verificación MatriSure.',
        'wassington', new.id
      from profiles p
      join user_roles ur on ur.profile_id = p.id
      where p.org_id = v_parent_org and ur.role in ('owner','approver');
    end if;
  end if;
  return new;
end;
$$;

create trigger on_matrisure_assistance_requested
  after insert or update on matrisure_verifications
  for each row execute function notify_matrisure_assistance();

-- ============================================================================
-- Invite redeemed → notify whichever Owner generated that link (migration
-- 0014). Folded directly into redeem_invite() itself, which already has all
-- the context (created_by, and the new/existing profile just redeemed it).
-- ============================================================================
create or replace function redeem_invite(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_invite user_invites%rowtype;
  v_existing_org uuid;
  v_redeemer_label text;
begin
  select * into v_invite from user_invites where token = p_token and used_at is null;
  if v_invite.id is null then
    raise exception 'Este link de invitación ya no es válido — puede haber sido usado o revocado.';
  end if;

  select org_id into v_existing_org from profiles where id = auth.uid();
  if v_existing_org is not null and v_existing_org <> v_invite.org_id then
    raise exception 'Tu cuenta ya pertenece a otra organización — un usuario no puede estar en dos organizaciones a la vez.';
  end if;

  if v_existing_org is null then
    insert into profiles (id, org_id, full_name, email)
    select u.id, v_invite.org_id, coalesce(u.raw_user_meta_data->>'full_name', u.email), u.email
    from auth.users u where u.id = auth.uid();
  end if;

  insert into user_roles (profile_id, role)
  select auth.uid(), r from unnest(v_invite.roles) as r
  on conflict do nothing;

  update user_invites set used_at = now(), used_by = auth.uid() where id = v_invite.id;

  select coalesce(full_name, email) into v_redeemer_label from profiles where id = auth.uid();
  insert into notifications (recipient_profile_id, event_type, title, body, panel, related_id)
  values (
    v_invite.created_by, 'invite_redeemed', 'Invitación usada',
    coalesce(v_redeemer_label, 'Alguien') || ' se unió usando tu link de invitación.',
    'users', v_invite.id
  );
end;
$$;
grant execute on function redeem_invite(uuid) to authenticated;
