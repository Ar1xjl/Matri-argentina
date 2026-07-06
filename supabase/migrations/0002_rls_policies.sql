-- MaTri Portal — Row Level Security
-- Implements DOMAIN_MODEL.md's single access rule (Rule 9 / Business Rules,
-- Organizational Model → Visibility rule): a user can see and manage their
-- own Organization and everything below it in the tree. Nothing else.
-- This is the actual security boundary — never trust the client for this.

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- The calling user's own Organization.
create or replace function current_org_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select org_id from profiles where id = auth.uid();
$$;

-- Is target_org equal to root_org, or a descendant of it?
-- Walks UP from target_org via parent_id; true if root_org appears in that chain.
create or replace function is_in_subtree(target_org uuid, root_org uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  with recursive ancestors as (
    select id, parent_id from organizations where id = target_org
    union all
    select o.id, o.parent_id from organizations o join ancestors a on o.id = a.parent_id
  )
  select exists (select 1 from ancestors where id = root_org);
$$;

-- Is the calling user a member of the FreshInset Global (root) organization?
create or replace function is_global_member() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles p
    join organizations o on o.id = p.org_id
    where p.id = auth.uid() and o.org_type = 'global'
  );
$$;

-- Does the calling user hold any of the given Business Roles, in their own Organization?
create or replace function has_role(roles business_role[]) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from user_roles ur
    where ur.profile_id = auth.uid() and ur.role = any(roles)
  );
$$;

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

alter table organizations enable row level security;

create policy org_select on organizations
  for select using (is_in_subtree(id, current_org_id()));

-- Rule 13: creating a new Organization is only allowed as a child within your own subtree.
-- It always lands in 'pending' — activation is gated separately below.
create policy org_insert on organizations
  for insert with check (
    parent_id is not null and is_in_subtree(parent_id, current_org_id())
  );

create policy org_update on organizations
  for update using (is_in_subtree(id, current_org_id()))
  with check (is_in_subtree(id, current_org_id()));

-- Rule 13: only FreshInset Global can flip an Organization from pending to active.
create or replace function enforce_org_activation_by_global()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and old.status = 'pending' and not is_global_member() then
    raise exception 'Only FreshInset Global can activate an Organization';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_org_activation
  before update on organizations
  for each row execute function enforce_org_activation_by_global();

-- ============================================================================
-- PROFILES & USER ROLES
-- ============================================================================

alter table profiles enable row level security;

create policy profiles_select on profiles
  for select using (is_in_subtree(org_id, current_org_id()));
create policy profiles_insert on profiles
  for insert with check (is_in_subtree(org_id, current_org_id()));
create policy profiles_update on profiles
  for update using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

alter table user_roles enable row level security;

create policy user_roles_select on user_roles
  for select using (is_in_subtree((select org_id from profiles where id = profile_id), current_org_id()));
create policy user_roles_insert on user_roles
  for insert with check (is_in_subtree((select org_id from profiles where id = profile_id), current_org_id()));
create policy user_roles_delete on user_roles
  for delete using (is_in_subtree((select org_id from profiles where id = profile_id), current_org_id()));

-- ============================================================================
-- COLD ROOMS, GENERATORS, PRICING, SEASON PLANS, TREATMENTS
-- (all have a direct org_id column — same pattern every time)
-- ============================================================================

alter table cold_rooms enable row level security;
create policy cold_rooms_all on cold_rooms for all
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

alter table generators enable row level security;
create policy generators_all on generators for all
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

alter table volume_brackets enable row level security;
create policy volume_brackets_all on volume_brackets for all
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

alter table pricing_product enable row level security;
create policy pricing_product_all on pricing_product for all
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

alter table pricing_service_fee enable row level security;
create policy pricing_service_fee_all on pricing_service_fee for all
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

alter table pricing_generator enable row level security;
create policy pricing_generator_all on pricing_generator for all
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

alter table season_plans enable row level security;
create policy season_plans_all on season_plans for all
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

alter table treatments enable row level security;
create policy treatments_all on treatments for all
  using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));

-- ============================================================================
-- TABLES SCOPED VIA A PARENT ROW (join to find the owning Organization)
-- ============================================================================

alter table generator_dispatches enable row level security;
create policy generator_dispatches_all on generator_dispatches for all
  using (
    is_in_subtree(dispatched_to_org_id, current_org_id())
    or is_in_subtree((select org_id from generators g where g.id = generator_id), current_org_id())
  )
  with check (
    is_in_subtree(dispatched_to_org_id, current_org_id())
    or is_in_subtree((select org_id from generators g where g.id = generator_id), current_org_id())
  );

alter table season_plan_lines enable row level security;
create policy season_plan_lines_all on season_plan_lines for all
  using (is_in_subtree((select org_id from season_plans sp where sp.id = season_plan_id), current_org_id()))
  with check (is_in_subtree((select org_id from season_plans sp where sp.id = season_plan_id), current_org_id()));

alter table matrisure_verifications enable row level security;
create policy matrisure_verifications_all on matrisure_verifications for all
  using (is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id()))
  with check (is_in_subtree((select org_id from treatments t where t.id = treatment_id), current_org_id()));

-- ============================================================================
-- DOCUMENTS  (global-scope rows are visible to everyone, not subtree-limited)
-- ============================================================================

alter table documents enable row level security;

create policy documents_select on documents
  for select using (scope = 'global' or is_in_subtree(org_id, current_org_id()));

create policy documents_insert on documents
  for insert with check (
    (scope = 'global' and is_global_member())
    or (scope = 'organization' and is_in_subtree(org_id, current_org_id()))
  );

create policy documents_update on documents
  for update
  using (scope = 'global' or is_in_subtree(org_id, current_org_id()))
  with check (
    (scope = 'global' and is_global_member())
    or (scope = 'organization' and is_in_subtree(org_id, current_org_id()))
  );

-- ============================================================================
-- NOTE — what's deliberately NOT yet encoded here
-- ============================================================================
-- These subtree policies are the core security boundary (who can see/touch
-- which Organization's data at all). Finer-grained Business Role permissions
-- (e.g. only a Planner may create a Treatment, only an Approver may move it
-- to 'approved', only an Operator may record application details) are a
-- second layer on top of this, best designed against the actual
-- Treatment-status-transition screens as they're built — not guessed at
-- upfront. Add them as targeted policies/triggers per action once those
-- flows exist.
