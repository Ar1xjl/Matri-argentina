-- Fix for create_season_plan's clone branch (migration 0036): cloning a
-- Plan Line used to drop planned_date entirely (left null), on the theory
-- that a new campaign has its own dates. In practice the day/month is still
-- useful ("siempre tratamos a mediados de marzo") — what actually needs to
-- change is the year, to match the campaign being planned. Juan, 2026-08-26.
--
-- The target year comes from the new campaign's own label (e.g. "Temporada
-- 2027" -> 2027) via a plain 4-digit-run regex — if the label doesn't
-- contain one (a customer free-typed something else), dates fall back to
-- null rather than guessing. `date + make_interval(years => n)` (not manual
-- date construction) so a Feb 29 source date lands on a sane Mar 1 in a
-- non-leap target year instead of erroring.
create or replace function create_season_plan(
  p_org_id uuid,
  p_label text,
  p_make_active boolean default true,
  p_clone_from_plan_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_new_plan_id uuid;
  v_target_year int;
begin
  if p_make_active then
    update season_plans set status = 'archived' where org_id = p_org_id and status = 'active';
  end if;

  insert into season_plans (org_id, season_label, created_by, status)
  values (p_org_id, p_label, auth.uid(), case when p_make_active then 'active' else 'archived' end)
  returning id into v_new_plan_id;

  if p_clone_from_plan_id is not null then
    v_target_year := substring(p_label from '\d{4}')::int;

    insert into season_plan_lines (season_plan_id, cold_room_id, planned_date, planned_dose_ppb, product_preference, crop, variety, notes)
    select
      v_new_plan_id,
      sl.cold_room_id,
      case when sl.planned_date is not null and v_target_year is not null
        then sl.planned_date + make_interval(years => v_target_year - extract(year from sl.planned_date)::int)
        else null
      end,
      sl.planned_dose_ppb, sl.product_preference, sl.crop, sl.variety, sl.notes
    from season_plan_lines sl
    where sl.season_plan_id = p_clone_from_plan_id;
  end if;

  return v_new_plan_id;
end;
$$;
grant execute on function create_season_plan(uuid, text, boolean, uuid) to authenticated;
