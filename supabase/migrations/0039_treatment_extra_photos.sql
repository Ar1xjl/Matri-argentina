-- Fotos adicionales por Tratamiento (2026-09-24, Juan) — documentar estado de
-- calidad de la fruta, llenado de la cámara, etc. Se pueden agregar en
-- cualquier momento, incluso con el Tratamiento ya Completado, y son un
-- registro de auditoría: solo se insertan, nunca se editan ni se borran.
--
-- Las fotos siguen siendo cámara en vivo únicamente (misma regla que Inicio/
-- Fin/MatriSure, DOMAIN_MODEL Rule 11 — se hace cumplir en el cliente con
-- MatriSureCapture, igual que las otras). Los archivos van al bucket privado
-- existente 'matrisure-photos' bajo {org_id}/{treatment_id}/..., así que la
-- policy de storage de 0004 ya los cubre sin cambios.
--
-- treatment_id/org_id son ON DELETE CASCADE y created_by ON DELETE SET NULL
-- a propósito: así delete_customer_organization() (0035) y
-- retire_organization() (0036) siguen funcionando sin tocarlos.

create table treatment_photos (
  id            uuid primary key default gen_random_uuid(),
  treatment_id  uuid not null references treatments(id) on delete cascade,
  org_id        uuid not null references organizations(id) on delete cascade, -- siempre el org del Tratamiento (lo fija el trigger)
  category      text not null check (category in ('fruit_quality','fill_level','other')),
  note          text,
  photo_path    text not null,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index treatment_photos_treatment_id_idx on treatment_photos(treatment_id);
create index treatment_photos_org_id_idx on treatment_photos(org_id);

alter table treatment_photos enable row level security;

-- org_id y created_by nunca vienen del cliente: se derivan acá, antes de que
-- se evalúe el WITH CHECK, así no se pueden falsificar.
create or replace function set_treatment_photo_owner() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select org_id into new.org_id from treatments where id = new.treatment_id;
  if new.org_id is null then
    raise exception 'Tratamiento inexistente.';
  end if;
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger trg_set_treatment_photo_owner
  before insert on treatment_photos
  for each row execute function set_treatment_photo_owner();

create policy treatment_photos_select on treatment_photos
  for select using (is_in_subtree(org_id, current_org_id()));

-- Cualquiera del subárbol con un rol operativo (todo menos Viewer). No hay
-- policies de update/delete: append-only.
create policy treatment_photos_insert on treatment_photos
  for insert with check (
    is_in_subtree(org_id, current_org_id())
    and has_role(array['owner','approver','planner','operator']::business_role[])
  );
