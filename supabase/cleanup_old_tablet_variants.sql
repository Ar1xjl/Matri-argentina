-- One-off cleanup: removes the orphaned MatriTablets inventory rows left
-- over from before the envelope/sobre redesign (variant 'grande'/'chica'),
-- which no longer match Inventory.jsx's SKU_VARIANTS catalog.
--
-- Run ONCE, via the Supabase Dashboard SQL Editor.

delete from inventory_items
where sku = 'MatriTablets' and variant in ('grande', 'chica');
