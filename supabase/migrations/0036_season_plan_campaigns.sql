-- Season Plan multi-campaign support (2026-08-26) — until now `season_plans`
-- was implicitly "one per Organization, whichever is newest" (see Portal.jsx's
-- old loadSeasonPlan: `order by created_at desc limit 1`). Juan's ask: keep
-- old campaigns around as read-only reference data (e.g. a real 2021 season
-- uploaded from an old Excel "tal cual"), let a Customer pick which campaign
-- they're looking at, and let them spin up a new editable campaign seeded
-- from an old one's rooms/crop/variety/doses.
--
-- `status` makes "which one is the real, live campaign" explicit instead of
-- inferred from created_at — critical once an archived upload can happen
-- *after* the active campaign already exists (e.g. backfilling 2021 data
-- today). Only one `active` per org, enforced by the partial unique index
-- below, not just convention.

alter table season_plans
  add column status text not null default 'active' check (status in ('active','archived'));

-- Some orgs may already have more than one season_plans row today (nothing
-- before this migration prevented it — the old code just always picked the
-- newest). Demote every non-newest row to 'archived' *before* adding the
-- uniqueness constraint, so it doesn't fail on data that already violates it.
with ranked as (
  select id, row_number() over (partition by org_id order by created_at desc) as rn
  from season_plans
)
update season_plans sp
set status = 'archived'
from ranked r
where sp.id = r.id and r.rn > 1;

create unique index season_plans_one_active_per_org on season_plans(org_id) where status = 'active';

-- Cultivo/Variedad move from being read live off `cold_rooms` to a snapshot
-- on the Plan Line itself. Necessary once campaigns are archived: a Cámara's
-- current crop/variety changing next season must never retroactively rewrite
-- what an old, already-archived campaign says it grew. `variety` is new and
-- deliberately lives ONLY here, never on `cold_rooms` — unlike Cultivo, a
-- Cámara routinely grows a different variety each campaign, so there's no
-- single "current" value worth caching on the room.
alter table season_plan_lines add column crop text;
alter table season_plan_lines add column variety text;

-- Backfill existing lines from their room's current Cultivo — the best
-- approximation available for data that predates the snapshot. Variety has
-- no prior source, stays null.
update season_plan_lines spl
set crop = cr.primary_crop
from cold_rooms cr
where cr.id = spl.cold_room_id and spl.crop is null and cr.primary_crop is not null;

-- Creates a new Season Plan for an org — blank, or seeded from an existing
-- one's lines (Juan's "nueva campaña basada en..."). `p_make_active` controls
-- both branches of the feature: true for a normal new/derived campaign (which
-- demotes whatever was active before it, and becomes the one that feeds
-- Treatments/Rollup/generator planning from here on); false for creating an
-- empty *archived* shell to upload a historical Excel file into, without
-- disturbing the campaign actually in progress.
-- SECURITY INVOKER (not DEFINER) — this only ever touches the caller's own
-- org, which the existing season_plans/season_plan_lines RLS policies
-- (subtree-based) already let them read and write; no elevation needed.
-- Doing the demote-then-insert as one function call, rather than two
-- separate client-side round-trips, is what keeps
-- season_plans_one_active_per_org from ever seeing two actives at once.
create or replace function create_season_plan(
  p_org_id uuid,
  p_label text,
  p_make_active boolean default true,
  p_clone_from_plan_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_new_plan_id uuid;
begin
  if p_make_active then
    update season_plans set status = 'archived' where org_id = p_org_id and status = 'active';
  end if;

  insert into season_plans (org_id, season_label, created_by, status)
  values (p_org_id, p_label, auth.uid(), case when p_make_active then 'active' else 'archived' end)
  returning id into v_new_plan_id;

  -- Rooms, crop, variety and the previous dose/product choice carry over as a
  -- starting point to edit from; planned_date and status reset — a new
  -- campaign has its own dates, and nothing in it has been converted to a
  -- real Treatment yet regardless of what the source campaign's lines were.
  if p_clone_from_plan_id is not null then
    insert into season_plan_lines (season_plan_id, cold_room_id, planned_dose_ppb, product_preference, crop, variety, notes)
    select v_new_plan_id, sl.cold_room_id, sl.planned_dose_ppb, sl.product_preference, sl.crop, sl.variety, sl.notes
    from season_plan_lines sl
    where sl.season_plan_id = p_clone_from_plan_id;
  end if;

  return v_new_plan_id;
end;
$$;
grant execute on function create_season_plan(uuid, text, boolean, uuid) to authenticated;

-- share_season_plan_draft (0021) used to find the Customer's plan by "newest
-- row" — now that an archived historical upload can be newer than the real
-- active campaign, it must ask for the active one explicitly. Also carries
-- the room's current Cultivo onto each shared line as its snapshot (drafts
-- don't collect Variedad, so that stays null).
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

  select id into v_plan_id from season_plans where org_id = v_draft.customer_org_id and status = 'active' limit 1;
  if v_plan_id is null then
    insert into season_plans (org_id, season_label, created_by)
    values (v_draft.customer_org_id, 'Temporada ' || extract(year from now())::text, v_draft.created_by)
    returning id into v_plan_id;
  end if;

  select name into v_sharer_org_name from organizations where id = current_org_id();

  insert into season_plan_lines (season_plan_id, cold_room_id, planned_date, planned_dose_ppb, product_preference, notes, crop)
  select v_plan_id, dl.cold_room_id, dl.planned_date, dl.planned_dose_ppb, dl.product_preference,
    trim(both ' — ' from concat(dl.notes, ' — Sugerido por ', coalesce(v_sharer_org_name, 'tu distribuidor'))),
    cr.primary_crop
  from season_plan_draft_lines dl
  join cold_rooms cr on cr.id = dl.cold_room_id
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
