-- "Quitar acceso" (Users.jsx) used to only strip user_roles, leaving a
-- zombie `profiles` row (org_id still set, zero roles) with no way to
-- reassign that person anywhere else — both the manual "Agregar usuario"
-- flow and redeem_invite() (migration 0014) block on "ya pertenece a otra
-- organización" as soon as a profiles row exists for that id, regardless of
-- whether it actually has any roles. There was also no UI path to undo it:
-- the "Quitar acceso" button itself only rendered when the member still had
-- at least one role.
--
-- Fix: "Quitar acceso" now deletes the whole `profiles` row. A new trigger
-- re-materializes them into pending_user_signups (mirroring the auth.users
-- insert trigger from migration 0013, same "regardless of which flow does
-- it" philosophy already stated there) so they land back in "Solicitudes de
-- usuario pendientes de asignar" for a corrected assignment, and any
-- already-generated, still-unused invite link for them keeps working
-- exactly as designed (no more false "ya pertenece a otra organización").

create or replace function restore_pending_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into pending_user_signups (id, email, full_name)
  select u.id, u.email, coalesce(old.full_name, u.raw_user_meta_data->>'full_name')
  from auth.users u where u.id = old.id
  on conflict (id) do nothing;
  return old;
end;
$$;

create trigger on_profile_deleted
  after delete on profiles
  for each row execute function restore_pending_signup();

-- Same authority as removing a role directly (Rule 19) — Owner-only within
-- your own subtree. No profiles_delete policy existed before this; deleting
-- a profiles row was never possible from the client until now.
create policy profiles_delete on profiles
  for delete using (is_in_subtree(org_id, current_org_id()) and has_role(array['owner']::business_role[]));

-- Deleting a profiles row is now a normal operation, not something that only
-- happened via auth.users cascading — user_invites.used_by (nullable,
-- previously implicit ON DELETE RESTRICT) would otherwise block removing
-- anyone who had ever redeemed an invite. Set null instead: the invite's
-- historical record stays, just without a still-valid profile to point at.
alter table user_invites drop constraint user_invites_used_by_fkey;
alter table user_invites add constraint user_invites_used_by_fkey
  foreign key (used_by) references profiles(id) on delete set null;
