-- Country-specific fiscal/regional data (tax id, tax status, region) no longer
-- collected on the public "Solicitar acceso" intake form — those categories
-- vary per country (Argentina's "Situación Fiscal" options don't map to
-- Brazil, for example) and blocking registration on them doesn't scale as
-- more countries are added. Instead, self-service, free text, filled in by
-- the Organization's own Owner from Profile ("Mi Empresa") once the org
-- already exists — see DOMAIN_MODEL.md's existing `language` column (Rule 16)
-- for the same "configurable per Organization, never a blocker" pattern.
-- No RLS change needed: org_update already allows an org to update its own row.

alter table organizations
  add column tax_id     text,
  add column tax_status text,
  add column region      text;
