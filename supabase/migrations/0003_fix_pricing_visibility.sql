-- Fix: Pricing tables need read access to flow DOWN the tree, not just within
-- your own managed subtree.
--
-- The original policies in 0002 (is_in_subtree(org_id, current_org_id()))
-- only let you see pricing rows belonging to organizations *you manage*
-- (yourself + descendants). That's correct for every other table, but wrong
-- for pricing: a Customer needs to READ the pricing its Distributor set
-- (an ancestor, not a descendant) in order to show indicative costs —
-- see DOMAIN_MODEL.md → Pricing ("pricing here exists only to give customers
-- transparent, indicative cost visibility").
--
-- Fix: split each pricing table's policy into SELECT (visible along your
-- entire lineage — ancestors AND descendants) vs. INSERT/UPDATE/DELETE
-- (still restricted to your own managed subtree only — a Customer must
-- never be able to edit its Distributor's prices).

-- ============================================================================
-- VOLUME BRACKETS
-- ============================================================================

drop policy volume_brackets_all on volume_brackets;

create policy volume_brackets_select on volume_brackets
  for select using (
    is_in_subtree(org_id, current_org_id()) or is_in_subtree(current_org_id(), org_id)
  );
create policy volume_brackets_insert on volume_brackets
  for insert with check (is_in_subtree(org_id, current_org_id()));
create policy volume_brackets_update on volume_brackets
  for update using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));
create policy volume_brackets_delete on volume_brackets
  for delete using (is_in_subtree(org_id, current_org_id()));

-- ============================================================================
-- PRICING PRODUCT
-- ============================================================================

drop policy pricing_product_all on pricing_product;

create policy pricing_product_select on pricing_product
  for select using (
    is_in_subtree(org_id, current_org_id()) or is_in_subtree(current_org_id(), org_id)
  );
create policy pricing_product_insert on pricing_product
  for insert with check (is_in_subtree(org_id, current_org_id()));
create policy pricing_product_update on pricing_product
  for update using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));
create policy pricing_product_delete on pricing_product
  for delete using (is_in_subtree(org_id, current_org_id()));

-- ============================================================================
-- PRICING SERVICE FEE
-- ============================================================================

drop policy pricing_service_fee_all on pricing_service_fee;

create policy pricing_service_fee_select on pricing_service_fee
  for select using (
    is_in_subtree(org_id, current_org_id()) or is_in_subtree(current_org_id(), org_id)
  );
create policy pricing_service_fee_insert on pricing_service_fee
  for insert with check (is_in_subtree(org_id, current_org_id()));
create policy pricing_service_fee_update on pricing_service_fee
  for update using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));
create policy pricing_service_fee_delete on pricing_service_fee
  for delete using (is_in_subtree(org_id, current_org_id()));

-- ============================================================================
-- PRICING GENERATOR
-- ============================================================================

drop policy pricing_generator_all on pricing_generator;

create policy pricing_generator_select on pricing_generator
  for select using (
    is_in_subtree(org_id, current_org_id()) or is_in_subtree(current_org_id(), org_id)
  );
create policy pricing_generator_insert on pricing_generator
  for insert with check (is_in_subtree(org_id, current_org_id()));
create policy pricing_generator_update on pricing_generator
  for update using (is_in_subtree(org_id, current_org_id()))
  with check (is_in_subtree(org_id, current_org_id()));
create policy pricing_generator_delete on pricing_generator
  for delete using (is_in_subtree(org_id, current_org_id()));
