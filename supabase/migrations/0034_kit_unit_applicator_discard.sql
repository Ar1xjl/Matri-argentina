-- MatriSure Kit stewardship — backport from the sibling DECCO-MatriSure app
-- (its own Fase 7, 2026-08-10/11): an Aplicador can now discard a kit
-- already assigned to them if they open it and find it damaged. Before
-- this, only a Manager could destroy stock, and only *unassigned* stock
-- (KitsDistributor.jsx's "🗑️ Descartar"). See project memory
-- "matri-kit-stewardship-integration", "Two concrete backport candidates
-- from DECCO Fase 7".
--
-- Can't reuse KitsDistributor.jsx's plain client-side `update` pattern here:
-- kit_units_update's RLS (0030) is gated by can_manage_kit_units(), which is
-- Manager-only (owner/approver) outside Global — an Aplicador (operator
-- role) has no UPDATE access to kit_units at all under that policy. Same
-- fix shape as use_kit_unit() (0031): security definer, ownership validated
-- inside the function itself instead of via RLS.
create or replace function discard_kit_unit(p_unit_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Contá brevemente qué encontraste mal con el kit.';
  end if;

  select org_id into v_org_id from kit_units
  where id = p_unit_id and assigned_to_profile_id = auth.uid() and status = 'assigned';

  if v_org_id is null then
    raise exception 'Ese kit no está asignado a vos, o ya fue usado o descartado.';
  end if;

  update kit_units
  set status = 'destroyed', destroyed_at = now(), destroyed_by = auth.uid(), destroyed_reason = btrim(p_reason)
  where id = p_unit_id;

  insert into kit_unit_movements (kit_unit_id, action, from_org_id, to_org_id, moved_by, notes)
  values (p_unit_id, 'destroyed', v_org_id, v_org_id, auth.uid(), btrim(p_reason));
end;
$$;
