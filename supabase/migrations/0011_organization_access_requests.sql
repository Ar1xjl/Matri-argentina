-- Fase E item 2: "Solicitar acceso — Nueva empresa"
-- A prospective Customer has no Organization/account yet, so this can't reuse
-- the `organizations` table's own RLS (which requires an existing org_id to
-- scope against). Instead: a standalone intake table, insertable by anonymous
-- visitors, reviewed by any non-Customer staff (Distributor/Sub-distributor/
-- Global — there's no subtree to scope by yet, see ORGANIZATION_ONBOARDING.md's
-- "no formal checklist" philosophy), and converted into a real Organization
-- row (still `pending` until FreshInset Global activates it, same as any
-- manually-created Organization — Business Rule 13) by whoever reviews it.

create table organization_access_requests (
  id                uuid primary key default gen_random_uuid(),
  company_name      text not null,
  tax_id            text,
  tax_status        text,
  region            text,
  contact_email     text not null,
  contact_phone     text,
  status            text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by       uuid references profiles(id),
  reviewed_at       timestamptz,
  resulting_org_id  uuid references organizations(id),
  notes             text,
  created_at        timestamptz not null default now()
);

alter table organization_access_requests enable row level security;

-- Anyone can submit — this is the public "request access" form, filled out
-- before the requester has any Auth account.
create policy organization_access_requests_insert on organization_access_requests
  for insert to anon, authenticated
  with check (status = 'pending' and resulting_org_id is null and reviewed_by is null);

-- Reviewable by any staff member whose own Organization isn't a Customer
-- (Customers never see this queue at all — same population as who can
-- already create child Organizations in Organizations.jsx).
create policy organization_access_requests_select on organization_access_requests
  for select using (
    coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
  );

create policy organization_access_requests_update on organization_access_requests
  for update
  using (coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false))
  with check (coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false));
