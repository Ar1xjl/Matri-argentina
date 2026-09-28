-- Real document upload/assignment (2026-09-28, Juan) — replaces the
-- hardcoded DOCS array in Documents.jsx. Only FreshInset Global (Owner/
-- Aprobador) uploads a document and assigns it to one or more Distributors;
-- everything below an assigned Distributor (Sub-distribuidor, Cliente) sees
-- it too, same subtree-visibility rule as every other feature in this app
-- (Treatments, Precios, kit stewardship, etc.) — Juan confirmed this is the
-- behavior he wants rather than Distributor-only visibility.
--
-- "Asignar por geografía" (Juan's ask, so the same file isn't uploaded once
-- per Distributor) is deliberately NOT a third assignment kind keyed on
-- organizations.country — it's a plain multi-select of Distributor orgs
-- (document_assignments is a flat many-to-many), with the client offering a
-- "seleccionar todos los de <país>" shortcut that just pre-ticks the
-- Distributors sharing a country at that moment. A Distributor created in
-- that country later does not retroactively inherit past assignments —
-- Juan's explicit choice over a live per-country rule, simpler to reason
-- about and to audit ("who is this file actually assigned to, right now").
--
-- Versioning is deliberately NOT built here (Juan's choice) — re-uploading a
-- document replaces its file_path/file_name in place via a plain UPDATE, no
-- history kept. If real version history is wanted later, it needs its own
-- migration (a documents_versions table) — don't bolt it onto this shape.
--
-- Replaces the ORIGINAL `documents` table from 0001/0002 (scope/doc_type/
-- version/file_url columns, matching DOMAIN_MODEL Rule 26's aspirational
-- design) — that table was schema-only from day one: no code ever read or
-- wrote it (Documents.jsx used a hardcoded array), so there is no real data
-- to migrate. Dropped and recreated with the shape this feature actually
-- needs, rather than layering a second table on top of a dead one.
drop table if exists documents cascade;

create table documents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text,                 -- free text (e.g. "Etiqueta", "Manual", "Guía") — no fixed list, Global types whatever fits
  file_path    text not null,        -- storage object path: {id}/{file_name}
  file_name    text not null,        -- original filename, for display and the download's suggested name
  uploaded_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table document_assignments (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  org_id       uuid not null references organizations(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (document_id, org_id)
);
create index document_assignments_document_id_idx on document_assignments(document_id);
create index document_assignments_org_id_idx on document_assignments(org_id);

alter table documents enable row level security;
alter table document_assignments enable row level security;

-- security definer so documents_select can check assignments without
-- document_assignments' own (Global-only) RLS blocking the subquery for
-- everyone else — same pattern as can_manage_kit_units()/has_role().
create or replace function can_read_document(p_document_id uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select is_global_member() or exists (
    select 1 from document_assignments da
    where da.document_id = p_document_id and is_in_subtree(current_org_id(), da.org_id)
  );
$$;

-- Global always sees every document it holds (oversight/authoring), assigned
-- or not yet; everyone else sees it once their own org is at-or-below an
-- assigned Distributor.
create policy documents_select on documents
  for select using (can_read_document(id));

create policy documents_insert on documents
  for insert with check (is_global_member() and has_role(array['owner','approver']::business_role[]));

create policy documents_update on documents
  for update
  using (is_global_member() and has_role(array['owner','approver']::business_role[]))
  with check (is_global_member() and has_role(array['owner','approver']::business_role[]));

create policy documents_delete on documents
  for delete using (is_global_member() and has_role(array['owner','approver']::business_role[]));

-- Assignment rows themselves are Global-only admin metadata (who is this
-- document assigned to, right now) — no descendant org ever needs to read
-- this table directly, they just get filtered `documents` rows via
-- can_read_document() above.
create policy document_assignments_select on document_assignments
  for select using (is_global_member() and has_role(array['owner','approver']::business_role[]));

create policy document_assignments_insert on document_assignments
  for insert with check (is_global_member() and has_role(array['owner','approver']::business_role[]));

create policy document_assignments_delete on document_assignments
  for delete using (is_global_member() and has_role(array['owner','approver']::business_role[]));

-- Private bucket, same shape as matrisure-photos (0004) — object path is
-- {document_id}/{file_name}, so RLS can key off the id directly instead of
-- an org segment (one document can be assigned to several orgs at once, so
-- there is no single "owning org" to put in the path).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_storage_select on storage.objects
  for select using (
    bucket_id = 'documents' and can_read_document((storage.foldername(name))[1]::uuid)
  );

create policy documents_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'documents' and is_global_member() and has_role(array['owner','approver']::business_role[])
  );

create policy documents_storage_update on storage.objects
  for update
  using (bucket_id = 'documents' and is_global_member() and has_role(array['owner','approver']::business_role[]))
  with check (bucket_id = 'documents' and is_global_member() and has_role(array['owner','approver']::business_role[]));

create policy documents_storage_delete on storage.objects
  for delete using (
    bucket_id = 'documents' and is_global_member() and has_role(array['owner','approver']::business_role[])
  );
