-- Solves a real gap: when someone self-registers via "Crear usuario"
-- (supabase.auth.signUp(), no profile/org yet — see migration 0006), no
-- Organization admin has any way to find out unless they already know the
-- exact email to look up. Auto-track every new Auth user in a lightweight
-- table so Global/Distributor/Sub-distributor staff can see (and claim) new
-- signups without needing to know their name or email in advance.

create table pending_user_signups (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  created_at timestamptz not null default now()
);

alter table pending_user_signups enable row level security;

-- Same visibility rule as organization_access_requests (migration 0011) —
-- a self-registered person has no Organization yet, so there's no subtree to
-- scope this by; any non-Customer staff member can see the queue.
create policy pending_user_signups_select on pending_user_signups
  for select using (
    coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
  );

create policy pending_user_signups_delete on pending_user_signups
  for delete using (
    coalesce((select org_type from organizations where id = current_org_id()) <> 'customer', false)
  );

-- Populated automatically on signup — no client-side privilege needed.
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into pending_user_signups (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- Cleared automatically the moment someone actually assigns this person into
-- an Organization (profiles row created) — regardless of which flow does it
-- (today's manual "Agregar usuario", or the future invite-link redemption).
create or replace function cleanup_pending_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from pending_user_signups where id = new.id;
  return new;
end;
$$;

create trigger on_profile_created
  after insert on profiles
  for each row execute function cleanup_pending_signup();
