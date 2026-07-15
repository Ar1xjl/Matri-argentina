-- Distributor-authored Season Plan drafts — Juan's real scenario: a Customer
-- hasn't loaded their own Season Plan, but Wassington/a Sub-distributor knows
-- them well enough to estimate one. Unlike the real season_plans/
-- season_plan_lines (which the Customer can already read the moment a row
-- exists, since RLS there is subtree-wide in both directions), a draft is
-- invisible to the Customer entirely until explicitly shared — a separate
-- table, not a visibility flag on the real one, so "not shared yet" can
-- never leak by a client-side bug.

create table season_plan_drafts (
  id              uuid primary key default gen_random_uuid(),
  customer_org_id uuid not null references organizations(id),
  created_by      uuid references profiles(id),
  status          text not null default 'draft' check (status in ('draft','shared')),
  shared_at       timestamptz,
  shared_by       uuid references profiles(id),
  created_at      timestamptz not null default now()
);
create index season_plan_drafts_customer_org_id_idx on season_plan_drafts(customer_org_id);

create table season_plan_draft_lines (
  id                 uuid primary key default gen_random_uuid(),
  draft_id           uuid not null references season_plan_drafts(id) on delete cascade,
  cold_room_id       uuid not null references cold_rooms(id),
  planned_date       date,
  planned_dose_ppb   numeric,
  product_preference text not null default 'undecided' check (product_preference in ('powder','tablets','undecided')),
  notes              text
);
create index season_plan_draft_lines_draft_id_idx on season_plan_draft_lines(draft_id);

alter table season_plan_drafts enable row level security;
alter table season_plan_draft_lines enable row level security;

-- Only non-Customer staff in the target Customer's ancestor chain — the
-- Customer itself gets no policy at all here, so it has zero visibility,
-- not even read, until the RPC below copies lines into their real plan.
create policy season_plan_drafts_all on season_plan_drafts
  for all using (
    is_in_subtree(customer_org_id, current_org_id())
    and coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
  )
  with check (
    is_in_subtree(customer_org_id, current_org_id())
    and coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
  );

create policy season_plan_draft_lines_all on season_plan_draft_lines
  for all using (
    is_in_subtree((select customer_org_id from season_plan_drafts d where d.id = draft_id), current_org_id())
    and coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
  )
  with check (
    is_in_subtree((select customer_org_id from season_plan_drafts d where d.id = draft_id), current_org_id())
    and coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
  );

-- Widen notifications' event_type check (migration 0015/0016) for the new event.
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
  'matrisure_assistance_requested', 'invite_redeemed', 'season_plan_shared'
));

-- Copies a draft's lines into the Customer's real Season Plan (creating it
-- if this is their first one, same auto-create rule as loadSeasonPlan),
-- marks the draft shared, and notifies that Customer's Owner/Planificador —
-- the two roles who'd actually act on a Season Plan (DOMAIN_MODEL.md role
-- descriptions). Runs as the sharer's own session; SECURITY DEFINER only to
-- read/write the Customer's tables the same way redeem_invite reads profiles.
create or replace function share_season_plan_draft(p_draft_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_draft season_plan_drafts%rowtype;
  v_plan_id uuid;
  v_sharer_org_name text;
begin
  select * into v_draft from season_plan_drafts where id = p_draft_id and status = 'draft';
  if v_draft.id is null then
    raise exception 'Este borrador ya no existe o ya fue compartido.';
  end if;

  select id into v_plan_id from season_plans where org_id = v_draft.customer_org_id order by created_at desc limit 1;
  if v_plan_id is null then
    insert into season_plans (org_id, season_label, created_by)
    values (v_draft.customer_org_id, 'Temporada ' || extract(year from now())::text, v_draft.created_by)
    returning id into v_plan_id;
  end if;

  select name into v_sharer_org_name from organizations where id = current_org_id();

  insert into season_plan_lines (season_plan_id, cold_room_id, planned_date, planned_dose_ppb, product_preference, notes)
  select v_plan_id, dl.cold_room_id, dl.planned_date, dl.planned_dose_ppb, dl.product_preference,
    trim(both ' — ' from concat(dl.notes, ' — Sugerido por ', coalesce(v_sharer_org_name, 'tu distribuidor')))
  from season_plan_draft_lines dl
  where dl.draft_id = p_draft_id;

  update season_plan_drafts set status = 'shared', shared_at = now(), shared_by = auth.uid() where id = p_draft_id;

  insert into notifications (recipient_profile_id, event_type, title, body, panel, related_id)
  select p.id, 'season_plan_shared', 'Nueva sugerencia de Plan de Temporada',
    coalesce(v_sharer_org_name, 'Tu distribuidor') || ' te sugirió líneas para tu Plan de Temporada.',
    'seasonplan', v_plan_id
  from profiles p
  join user_roles ur on ur.profile_id = p.id
  where p.org_id = v_draft.customer_org_id and ur.role in ('owner','planner');
end;
$$;
grant execute on function share_season_plan_draft(uuid) to authenticated;
