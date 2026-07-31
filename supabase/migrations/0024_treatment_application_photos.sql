-- Chain-of-custody photos for the "Registrar aplicación" step (Approved →
-- Applied). Requested by Juan 2026-07-31 to back up the existing
-- application_start_time/application_end_time timestamps with live-camera
-- proof, same anti-fraud requirement as the MatriSure verification photo
-- (DOMAIN_MODEL.md Business Rule 11) — no gallery upload, camera only,
-- enforced client-side in MatriSureCapture.jsx (getUserMedia + canvas, no
-- <input type="file"> escape hatch).
--
-- Stored in the existing matrisure-photos bucket (0004_matrisure_storage.sql)
-- under {org_id}/{treatment_id}/start-*.jpg and end-*.jpg — same path shape
-- the bucket's RLS already scopes by org_id, no new bucket/policy needed.

alter table treatments add column start_photo_url text;
alter table treatments add column end_photo_url text;

-- NOT VALID: real treatments already exist in 'applied'/'completed' status
-- without these columns (this app has been on real Supabase since
-- 2026-07-08). Only future status transitions into applied/completed are
-- required to carry both photos — existing rows are grandfathered in.
alter table treatments add constraint treatment_applied_requires_photos check (
  status not in ('applied', 'completed')
  or (start_photo_url is not null and end_photo_url is not null)
) not valid;
