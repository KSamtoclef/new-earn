-- ChatEarn Module 2: canonical account bootstrap and application state.
-- Additive only. Signup credit is issued only by the authenticated bootstrap RPC.

begin;

create table if not exists public.chatearn_user_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null default 'User'
    check (char_length(full_name) between 1 and 120),
  email text,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'closed')),
  locale text not null default 'en-NG',
  timezone text not null default 'Africa/Lagos',
  last_seen_at timestamptz,
  last_page text,
  last_partner text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chatearn_user_profiles_status_registered_idx
  on public.chatearn_user_profiles (status, registered_at desc, user_id);
create index if not exists chatearn_user_profiles_last_seen_idx
  on public.chatearn_user_profiles (last_seen_at desc nulls last, user_id);

drop trigger if exists chatearn_user_profiles_touch_updated_at
on public.chatearn_user_profiles;
create trigger chatearn_user_profiles_touch_updated_at
before update on public.chatearn_user_profiles
for each row execute function chatearn_private.touch_updated_at();

alter table public.chatearn_user_profiles enable row level security;

drop policy if exists chatearn_user_profiles_owner_read
on public.chatearn_user_profiles;
create policy chatearn_user_profiles_owner_read
on public.chatearn_user_profiles for select to authenticated
using (user_id = auth.uid());

drop policy if exists chatearn_user_profiles_admin_read
on public.chatearn_user_profiles;
create policy chatearn_user_profiles_admin_read
on public.chatearn_user_profiles for select to authenticated
using (public.chatearn_current_user_is_admin());

revoke all on table public.chatearn_user_profiles
from public, anon, authenticated;
grant select on table public.chatearn_user_profiles to authenticated;
grant all on table public.chatearn_user_profiles to service_role;

create or replace function chatearn_private.normalized_display_name(
  p_name text,
  p_email text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select left(
    coalesce(
      nullif(
        regexp_replace(
          regexp_replace(trim(coalesce(p_name, '')), '[[:cntrl:]]', '', 'g'),
          '[[:space:]]+',
          ' ',
          'g'
        ),
        ''
      ),
      nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
      'User'
    ),
    120
  );
$$;

create or replace function chatearn_private.initialize_account_base(
  p_user_id uuid,
  p_full_name text default null,
  p_email text default null,
  p_registered_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns public.chatearn_user_profiles
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_auth_email text;
  v_auth_metadata jsonb;
  v_auth_created_at timestamptz;
  v_name text;
  v_profile public.chatearn_user_profiles;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22004';
  end if;

  select u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb), u.created_at
  into v_auth_email, v_auth_metadata, v_auth_created_at
  from auth.users u
  where u.id = p_user_id;

  if not found then
    raise exception 'Auth user does not exist' using errcode = '23503';
  end if;

  v_name := chatearn_private.normalized_display_name(
    coalesce(
      nullif(trim(p_full_name), ''),
      nullif(trim(v_auth_metadata ->> 'full_name'), ''),
      nullif(trim(v_auth_metadata ->> 'name'), '')
    ),
    coalesce(nullif(trim(p_email), ''), v_auth_email)
  );

  insert into public.chatearn_user_profiles (
    user_id,
    full_name,
    email,
    metadata,
    registered_at
  ) values (
    p_user_id,
    v_name,
    lower(coalesce(nullif(trim(p_email), ''), v_auth_email)),
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_registered_at, v_auth_created_at, now())
  )
  on conflict (user_id) do update set
    full_name = case
      when public.chatearn_user_profiles.full_name = 'User'
        and excluded.full_name <> 'User'
      then excluded.full_name
      else public.chatearn_user_profiles.full_name
    end,
    email = coalesce(public.chatearn_user_profiles.email, excluded.email),
    metadata = public.chatearn_user_profiles.metadata || excluded.metadata,
    updated_at = now()
  returning * into v_profile;

  insert into public.chatearn_user_journeys (
    user_id,
    journey_state,
    first_withdrawal_gate_passed,
    earnings_paused,
    sponsored_rewards_paused
  ) values (
    p_user_id,
    'earning_enabled',
    false,
    false,
    false
  )
  on conflict (user_id) do nothing;

  return v_profile;
end;
$$;

create or replace function chatearn_private.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
begin
  perform chatearn_private.initialize_account_base(
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), '')
    ),
    new.email,
    new.created_at,
    jsonb_build_object('bootstrap_source', 'auth_trigger')
  );
  return new;
end;
$$;

drop trigger if exists chatearn_auth_user_created on auth.users;
create trigger chatearn_auth_user_created
after insert on auth.users
for each row execute function chatearn_private.handle_auth_user_created();

-- Cover Auth users that existed before this migration without issuing money.
insert into public.chatearn_user_profiles (
  user_id,
  full_name,
  email,
  metadata,
  registered_at
)
select
  u.id,
  chatearn_private.normalized_display_name(
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'name'), '')
    ),
    u.email
  ),
  lower(u.email),
  jsonb_build_object('bootstrap_source', 'module_2_existing_auth'),
  u.created_at
from auth.users u
on conflict (user_id) do nothing;

insert into public.chatearn_user_journeys (
  user_id,
  journey_state,
  first_withdrawal_gate_passed,
  earnings_paused,
  sponsored_rewards_paused,
  created_at,
  updated_at
)
select
  u.id,
  'earning_enabled',
  false,
  false,
  false,
  u.created_at,
  u.created_at
from auth.users u
on conflict (user_id) do nothing;

create or replace function chatearn_private.ensure_signup_credit(
  p_user_id uuid
)
returns public.chatearn_wallet_ledger
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_existing public.chatearn_wallet_ledger;
  v_amount bigint;
  v_is_legacy_account boolean := false;
begin
  -- Legacy imports retain reward_type=signup_bonus, so this check also
  -- prevents a second signup credit after account migration.
  select *
  into v_existing
  from public.chatearn_wallet_ledger l
  where l.user_id = p_user_id
    and l.direction = 'credit'
    and l.entry_type = 'signup_bonus'
  order by l.created_at, l.id
  limit 1;

  if found then
    return v_existing;
  end if;

  -- If a frozen legacy snapshot is loaded, its matching profile must be
  -- backfilled before this RPC is allowed to create money. This prevents a
  -- migrated user from receiving a second signup bonus between Auth import
  -- and wallet reconciliation.
  if to_regclass('public.chatearn_profiles') is not null then
    execute $sql$
      select exists (
        select 1
        from public.chatearn_profiles p
        where p.user_id = $1
      )
    $sql$
    into v_is_legacy_account
    using p_user_id;

    if v_is_legacy_account then
      raise exception 'legacy account wallet must be backfilled before bootstrap'
        using errcode = '55000',
              hint = 'Run the guarded legacy snapshot backfill and verification during the controlled migration window.';
    end if;
  end if;

  select (s.value #>> '{}')::bigint
  into v_amount
  from public.chatearn_settings s
  where s.setting_key = 'signup_bonus';

  v_amount := coalesce(v_amount, 10000);
  if v_amount <= 0 then
    raise exception 'signup bonus configuration is invalid' using errcode = '22023';
  end if;

  return chatearn_private.append_wallet_entry(
    p_user_id,
    'credit',
    v_amount,
    'signup_bonus',
    'signup_bonus:' || p_user_id::text,
    'auth.users',
    p_user_id::text,
    jsonb_build_object('engine', 'canonical', 'reason', 'account_bootstrap')
  );
end;
$$;

create or replace function public.chatearn_bootstrap_account(
  p_full_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth_email text;
  v_auth_created_at timestamptz;
  v_profile public.chatearn_user_profiles;
  v_ledger public.chatearn_wallet_ledger;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select u.email, u.created_at
  into v_auth_email, v_auth_created_at
  from auth.users u
  where u.id = v_user_id;

  v_profile := chatearn_private.initialize_account_base(
    v_user_id,
    p_full_name,
    v_auth_email,
    v_auth_created_at,
    jsonb_build_object('bootstrap_source', 'authenticated_rpc')
  );

  v_ledger := chatearn_private.ensure_signup_credit(v_user_id);

  return jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'user_id', v_profile.user_id,
      'full_name', v_profile.full_name,
      'email', v_profile.email,
      'status', v_profile.status,
      'registered_at', v_profile.registered_at
    ),
    'signup_credit', jsonb_build_object(
      'ledger_id', v_ledger.id,
      'amount', v_ledger.amount,
      'created_at', v_ledger.created_at
    ),
    'wallet_balance', (
      select coalesce(sum(l.signed_amount), 0)
      from public.chatearn_wallet_ledger l
      where l.user_id = v_user_id
    )
  );
end;
$$;

create or replace function public.chatearn_get_app_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'server_time', now(),
    'profile', (
      select jsonb_build_object(
        'user_id', p.user_id,
        'full_name', p.full_name,
        'email', p.email,
        'status', p.status,
        'locale', p.locale,
        'timezone', p.timezone,
        'registered_at', p.registered_at,
        'last_seen_at', p.last_seen_at,
        'last_page', p.last_page,
        'last_partner', p.last_partner
      )
      from public.chatearn_user_profiles p
      where p.user_id = v_user_id
    ),
    'is_admin', public.chatearn_current_user_is_admin(),
    'wallet_balance', coalesce((
      select sum(l.signed_amount)
      from public.chatearn_wallet_ledger l
      where l.user_id = v_user_id
    ), 0),
    'wallet_entries', coalesce((
      select jsonb_agg(to_jsonb(entries) order by entries.created_at desc, entries.id desc)
      from (
        select
          l.id,
          l.direction,
          l.amount,
          l.entry_type,
          l.balance_after,
          l.metadata,
          l.created_at
        from public.chatearn_wallet_ledger l
        where l.user_id = v_user_id
        order by l.created_at desc, l.id desc
        limit 50
      ) entries
    ), '[]'::jsonb),
    'journey', (
      select to_jsonb(j) - 'user_id'
      from public.chatearn_user_journeys j
      where j.user_id = v_user_id
    ),
    'active_withdrawal_journey', (
      select to_jsonb(w) - 'user_id'
      from public.chatearn_withdrawal_journeys w
      where w.user_id = v_user_id
        and w.journey_state in (
          'withdrawal_required', 'details_pending', 'sharing_required',
          'kyc_required', 'kyc_pending', 'processing', 'correction_required'
        )
      order by w.updated_at desc, w.id desc
      limit 1
    ),
    'conversations', coalesce((
      select jsonb_agg(to_jsonb(conversations) order by conversations.last_message_at desc nulls last)
      from (
        select
          c.partner_key,
          c.current_node_key,
          c.eligible_user_message_count,
          c.total_message_count,
          c.suggested_replies,
          c.last_message_at
        from public.chatearn_conversation_states c
        where c.user_id = v_user_id
        order by c.last_message_at desc nulls last, c.partner_key
        limit 50
      ) conversations
    ), '[]'::jsonb),
    'pending_sponsored_opportunity', (
      select to_jsonb(o) - 'user_id' - 'verification_data'
      from public.chatearn_sponsored_opportunities o
      where o.user_id = v_user_id
        and o.status in ('presented', 'opened', 'returned', 'verified')
      order by o.created_at desc, o.id desc
      limit 1
    ),
    'sponsored_slots', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'slot_number', s.slot_number,
          'message_milestone', s.message_milestone,
          'reward_amount', s.reward_amount,
          'minimum_seconds_away', s.minimum_seconds_away,
          'card_content', s.card_content
        ) order by s.slot_number
      )
      from public.chatearn_sponsored_slots s
      where s.active = true
    ), '[]'::jsonb),
    'settings', public.chatearn_get_public_settings()
  ) into v_result;

  return v_result;
end;
$$;

create or replace function chatearn_private.backfill_legacy_account_profiles(
  p_confirmation text
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_rows bigint := 0;
begin
  if p_confirmation is distinct from 'BACKFILL_LEGACY_CHATEARN' then
    raise exception 'legacy backfill confirmation is required' using errcode = '22023';
  end if;
  if to_regclass('public.chatearn_profiles') is null then
    raise exception 'public.chatearn_profiles is not loaded' using errcode = '42P01';
  end if;

  execute $sql$
    insert into public.chatearn_user_profiles (
      user_id,
      full_name,
      email,
      status,
      last_seen_at,
      last_page,
      last_partner,
      metadata,
      registered_at,
      updated_at
    )
    select
      p.user_id,
      chatearn_private.normalized_display_name(p.full_name, p.email),
      lower(p.email),
      case when p.status in ('active', 'suspended', 'closed') then p.status else 'active' end,
      p.last_seen_at,
      p.last_page,
      p.last_partner,
      jsonb_build_object(
        'bootstrap_source', 'legacy_snapshot',
        'legacy_visit_count', p.visit_count,
        'legacy_total_messages', p.total_messages,
        'legacy_total_chat_opens', p.total_chat_opens,
        'legacy_total_share_attempts', p.total_share_attempts
      ),
      coalesce(p.registered_at, now()),
      coalesce(p.updated_at, p.registered_at, now())
    from public.chatearn_profiles p
    join auth.users u on u.id = p.user_id
    on conflict (user_id) do update set
      full_name = excluded.full_name,
      email = excluded.email,
      status = excluded.status,
      last_seen_at = excluded.last_seen_at,
      last_page = excluded.last_page,
      last_partner = excluded.last_partner,
      metadata = public.chatearn_user_profiles.metadata || excluded.metadata,
      registered_at = excluded.registered_at,
      updated_at = excluded.updated_at
  $sql$;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Wrap Module 1's guarded compatibility function so profile data is always
-- mapped before balances and journey states are reconciled.
do $$
begin
  if to_regprocedure('chatearn_private.backfill_legacy_snapshot_core(text)') is null then
    execute 'alter function chatearn_private.backfill_legacy_snapshot(text) rename to backfill_legacy_snapshot_core';
  end if;
end;
$$;

create or replace function chatearn_private.backfill_legacy_snapshot(
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_profiles bigint;
  v_placeholder_journeys bigint := 0;
  v_backfill_already_completed boolean := false;
  v_result jsonb;
begin
  v_profiles := chatearn_private.backfill_legacy_account_profiles(p_confirmation);

  select coalesce((s.value ->> 'completed')::boolean, false)
  into v_backfill_already_completed
  from public.chatearn_settings s
  where s.setting_key = 'legacy_backfill_state';

  -- Auth imports and this migration create safe default journey rows. Module 1
  -- intentionally used ON CONFLICT DO NOTHING, so remove only untouched
  -- defaults immediately before the first legacy classification pass. Any row
  -- with canonical activity or a completed prior backfill is preserved.
  if not coalesce(v_backfill_already_completed, false) then
    execute $sql$
      delete from public.chatearn_user_journeys j
      using public.chatearn_profiles p
      where j.user_id = p.user_id
        and j.journey_state = 'earning_enabled'
        and j.first_withdrawal_gate_passed = false
        and j.earnings_paused = false
        and j.sponsored_rewards_paused = false
        and j.active_withdrawal_id is null
        and j.active_partner_key is null
        and j.sponsored_cycle = 1
        and j.next_sponsored_slot = 1
        and j.processing_reached_at is null
        and j.version = 1
    $sql$;
    get diagnostics v_placeholder_journeys = row_count;
  end if;

  v_result := chatearn_private.backfill_legacy_snapshot_core(p_confirmation)
    || jsonb_build_object(
      'user_profiles_written', v_profiles,
      'placeholder_journeys_replaced', v_placeholder_journeys
    );

  update public.chatearn_settings
  set value = jsonb_set(value, '{result}', v_result, true),
      updated_at = now()
  where setting_key = 'legacy_backfill_state';

  return v_result;
end;
$$;

revoke all on function chatearn_private.normalized_display_name(text, text)
from public, anon, authenticated;
revoke all on function chatearn_private.initialize_account_base(uuid, text, text, timestamptz, jsonb)
from public, anon, authenticated;
revoke all on function chatearn_private.handle_auth_user_created()
from public, anon, authenticated;
revoke all on function chatearn_private.ensure_signup_credit(uuid)
from public, anon, authenticated;
revoke all on function chatearn_private.backfill_legacy_account_profiles(text)
from public, anon, authenticated;
revoke all on function chatearn_private.backfill_legacy_snapshot_core(text)
from public, anon, authenticated, service_role;
revoke all on function chatearn_private.backfill_legacy_snapshot(text)
from public, anon, authenticated;
revoke all on function public.chatearn_bootstrap_account(text)
from public, anon;
revoke all on function public.chatearn_get_app_state()
from public, anon;

grant execute on function chatearn_private.initialize_account_base(uuid, text, text, timestamptz, jsonb)
to service_role;
grant execute on function chatearn_private.ensure_signup_credit(uuid)
to service_role;
grant execute on function chatearn_private.backfill_legacy_snapshot(text)
to service_role;
grant execute on function public.chatearn_bootstrap_account(text)
to authenticated;
grant execute on function public.chatearn_get_app_state()
to authenticated;

commit;
