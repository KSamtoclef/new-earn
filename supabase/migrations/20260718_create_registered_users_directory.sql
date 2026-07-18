-- Creates a visible public table for registered users and keeps it synced with auth.users.
-- Run this in Supabase SQL Editor if migrations are not applied automatically.

create table if not exists public.registered_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  email_confirmed boolean not null default false,
  provider text,
  registered_at timestamptz not null,
  last_sign_in_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists registered_users_email_lower_idx
  on public.registered_users (lower(email));

alter table public.registered_users enable row level security;

-- Do not expose the registration directory to normal website visitors.
revoke all on table public.registered_users from anon, authenticated;
grant all on table public.registered_users to service_role;

create or replace function public.sync_registered_user_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.registered_users (
    user_id,
    full_name,
    email,
    email_confirmed,
    provider,
    registered_at,
    last_sign_in_at,
    updated_at
  )
  values (
    new.id,
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'username',
      ''
    )), ''),
    coalesce(new.email, ''),
    new.email_confirmed_at is not null,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    new.created_at,
    new.last_sign_in_at,
    now()
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    email_confirmed = excluded.email_confirmed,
    provider = excluded.provider,
    registered_at = excluded.registered_at,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_registered_user_from_auth() from public, anon, authenticated;

-- Backfill everyone who already registered.
insert into public.registered_users (
  user_id,
  full_name,
  email,
  email_confirmed,
  provider,
  registered_at,
  last_sign_in_at,
  updated_at
)
select
  u.id,
  nullif(trim(coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    u.raw_user_meta_data ->> 'username',
    ''
  )), ''),
  coalesce(u.email, ''),
  u.email_confirmed_at is not null,
  coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
  u.created_at,
  u.last_sign_in_at,
  now()
from auth.users u
where u.email is not null
on conflict (user_id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  email_confirmed = excluded.email_confirmed,
  provider = excluded.provider,
  registered_at = excluded.registered_at,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = now();

drop trigger if exists on_auth_user_sync_registered_users on auth.users;
create trigger on_auth_user_sync_registered_users
after insert or update of email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, last_sign_in_at
on auth.users
for each row execute function public.sync_registered_user_from_auth();

comment on table public.registered_users is
  'Admin-only directory of registered ChatEarn users, synchronized from Supabase Auth.';

-- Verification:
-- select full_name, email, email_confirmed, provider, registered_at, last_sign_in_at
-- from public.registered_users
-- order by registered_at desc;
