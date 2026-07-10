-- generators.unit_code was unique across the whole platform (inherited from
-- the original schema) — found to be a real problem once transfers between
-- Distributors became possible: two independent Distributors both using a
-- simple "GEN-001" numbering scheme would collide with each other, even
-- though they have nothing to do with one another. Scope uniqueness to the
-- owning Organization instead — matches every other per-org uniqueness rule
-- in this schema (e.g. pouch_catalog, tablet_catalog).

alter table generators drop constraint generators_unit_code_key;
alter table generators add constraint generators_org_id_unit_code_key unique (org_id, unit_code);
