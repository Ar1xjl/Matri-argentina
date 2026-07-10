-- Real gap found while testing the editable SKU catalog (2026-07-12): the
-- sachet breakdown shown for a Treatment was always recomputed live from
-- whatever pouch_catalog looks like TODAY, unlike price_local which is
-- already properly frozen at approval time. If a pouch size used by an old
-- Treatment gets removed from the catalog later, the displayed breakdown
-- would silently change to something that no longer matches what actually
-- happened — a real traceability problem, not just cosmetic.
--
-- Fix: freeze the breakdown the same way price is frozen — at approval.
-- Only meaningful for MatriPowder (MatriTablets dosing doesn't depend on
-- the editable catalog at all, see dosing.js's tabletCombo).

alter table treatments add column pouch_breakdown jsonb;
