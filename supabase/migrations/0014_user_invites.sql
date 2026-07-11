-- Invitation links: an Owner picks an Organization (already existing in the
-- tree) + Business Roles, generates a link, and shares it manually — via
-- WhatsApp, email, whatever — no automated sending, no service_role/Admin
-- API involved. Whoever opens the link and creates/logs into an account gets
-- assigned automatically, without the Owner ever needing to know their name
-- or email in advance (that's the whole point — see pending_user_signups,
-- migration 0013, for the other half of this same problem).

create table user_invites (
  id         uuid primary key default gen_random_uuid(),
  token      uuid not null unique default gen_random_uuid(),
  org_id     uuid not null references organizations(id),
  roles      business_role[] not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  used_at    timestamptz,
  used_by    uuid references profiles(id)
);
create index user_invites_org_id_idx on user_invites(org_id);

alter table user_invites enable row level security;

-- Managing invites (create/view/revoke) is Owner-only within your own
-- subtree — same authority as adding a user directly (Rule 19).
create policy user_invites_select on user_invites
  for select using (is_in_subtree(org_id, current_org_id()) and has_role(array['owner']::business_role[]));
create policy user_invites_insert on user_invites
  for insert with check (is_in_subtree(org_id, current_org_id()) and has_role(array['owner']::business_role[]));
create policy user_invites_delete on user_invites
  for delete using (is_in_subtree(org_id, current_org_id()) and has_role(array['owner']::business_role[]));

-- Public, narrow lookup for the invite landing page — returns only enough to
-- show "you're joining {org} as {roles}", never the raw table. Safe to expose
-- to anon: the token is an unguessable random uuid, not enumerable, and this
-- reveals nothing beyond an org name for someone who already holds that
-- specific token.
create or replace function get_invite_info(p_token uuid)
returns table(org_name text, roles business_role[])
language sql stable security definer set search_path = public as $$
  select o.name, ui.roles
  from user_invites ui join organizations o on o.id = ui.org_id
  where ui.token = p_token and ui.used_at is null;
$$;
grant execute on function get_invite_info(uuid) to anon, authenticated;

-- Redeems an invite for the calling (already authenticated) user: creates
-- their profiles row if they don't have one yet (mirrors the manual "Agregar
-- usuario" flow in Users.jsx), adds the invite's roles, marks it used. The
-- "no user in two orgs at once" rule still applies. Runs as the invited
-- user's own session — never needs the service_role key.
create or replace function redeem_invite(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_invite user_invites%rowtype;
  v_existing_org uuid;
begin
  select * into v_invite from user_invites where token = p_token and used_at is null;
  if v_invite.id is null then
    raise exception 'Este link de invitación ya no es válido — puede haber sido usado o revocado.';
  end if;

  select org_id into v_existing_org from profiles where id = auth.uid();
  if v_existing_org is not null and v_existing_org <> v_invite.org_id then
    raise exception 'Tu cuenta ya pertenece a otra organización — un usuario no puede estar en dos organizaciones a la vez.';
  end if;

  if v_existing_org is null then
    insert into profiles (id, org_id, full_name, email)
    select u.id, v_invite.org_id, coalesce(u.raw_user_meta_data->>'full_name', u.email), u.email
    from auth.users u where u.id = auth.uid();
  end if;

  insert into user_roles (profile_id, role)
  select auth.uid(), r from unnest(v_invite.roles) as r
  on conflict do nothing;

  update user_invites set used_at = now(), used_by = auth.uid() where id = v_invite.id;
end;
$$;
grant execute on function redeem_invite(uuid) to authenticated;
