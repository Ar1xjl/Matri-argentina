-- Narrowed down the exact failure Juan hit: creating a new Organization
-- directly under YOUR OWN Organization (parent_id = current_org_id() exactly
-- — e.g. Wassington creating a Customer/Sub-distributor directly) always
-- failed with "new row violates row-level security policy for table
-- organizations". Creating one via Global approving a pending access request
-- (parent_id = a DIFFERENT, descendant org, e.g. Global assigning something
-- under Wassington) always worked — that's the only path ever tested before
-- today. So the self-referential case (target_org == root_org, evaluated via
-- is_in_subtree's recursive walk) is what's specifically broken — every
-- other manual check of the same values (direct SELECT, a debug trigger
-- capturing the live request's real auth.uid()/current_org_id(), even a
-- plpgsql rewrite of is_in_subtree) confirmed the values themselves are
-- correct and the boolean SHOULD be true.
--
-- Rather than keep chasing the exact internal reason (suspected: something
-- about a SECURITY DEFINER function reading the SAME table it's gating an
-- INSERT policy on, specifically for the target_org == root_org case), add a
-- trivial, non-recursive fast path for exactly this case: if you're
-- attaching a new child directly under your own org, no ancestor walk is
-- needed at all — parent_id = current_org_id() is definitionally true.
drop policy if exists org_insert on organizations;
create policy org_insert on organizations
  for insert with check (
    parent_id is not null and (
      parent_id = current_org_id() or is_in_subtree(parent_id, current_org_id())
    )
  );
