-- MatriSure verification photos — Supabase Storage bucket + RLS
--
-- Private bucket (not public). Objects are stored at a path of
-- {org_id}/{treatment_id}/{filename} so the existing is_in_subtree()
-- helper can scope access exactly the same way it scopes every other
-- table — no new access-control concept, just a path-based org_id.

insert into storage.buckets (id, name, public)
values ('matrisure-photos', 'matrisure-photos', false)
on conflict (id) do nothing;

create policy matrisure_photos_select on storage.objects
  for select using (
    bucket_id = 'matrisure-photos'
    and is_in_subtree((storage.foldername(name))[1]::uuid, current_org_id())
  );

create policy matrisure_photos_insert on storage.objects
  for insert with check (
    bucket_id = 'matrisure-photos'
    and is_in_subtree((storage.foldername(name))[1]::uuid, current_org_id())
  );
