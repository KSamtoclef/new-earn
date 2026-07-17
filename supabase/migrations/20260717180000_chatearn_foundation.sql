-- ChatEarn canonical foundation
-- Additive only: this migration does not rename, drop, or mutate legacy ChatEarn tables.
-- All monetary values are stored as whole Nigerian naira (NGN), matching the live data.

begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists chatearn_private;
revoke all on schema chatearn_private from public, anon, authenticated;
grant usage on schema chatearn_private to service_role;

create table if not exists public.chatearn_admin_roles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null default 'admin'
    check (role in ('admin', 'support', 'finance', 'compliance')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);

create table if not exists public.chatearn_settings (
  setting_key text primary key
    check (setting_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  value jsonb not null,
  description text not null,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chatearn_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  direction text not null check (direction in ('credit', 'debit')),
  amount bigint not null check (amount > 0),
  signed_amount bigint generated always as (
    case when direction = 'credit' then amount else -amount end
  ) stored,
  entry_type text not null check (char_length(entry_type) between 2 and 80),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  source_table text,
  source_id text,
  balance_after bigint check (balance_after is null or balance_after >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chatearn_wallet_ledger_user_idempotency_unique
    unique (user_id, idempotency_key)
);

create index if not exists chatearn_wallet_ledger_user_created_idx
  on public.chatearn_wallet_ledger (user_id, created_at desc, id desc);
create index if not exists chatearn_wallet_ledger_type_created_idx
  on public.chatearn_wallet_ledger (entry_type, created_at desc, id desc);
create unique index if not exists chatearn_wallet_ledger_source_unique
  on public.chatearn_wallet_ledger (source_table, source_id)
  where source_table is not null and source_id is not null;

create table if not exists public.chatearn_user_journeys (
  user_id uuid primary key references auth.users(id) on delete restrict,
  journey_state text not null default 'earning_enabled'
    check (journey_state in (
      'earning_enabled',
      'withdrawal_required',
      'sharing_required',
      'kyc_required',
      'kyc_pending',
      'processing',
      'completed',
      'correction_required',
      'suspended'
    )),
  first_withdrawal_gate_passed boolean not null default false,
  earnings_paused boolean not null default false,
  sponsored_rewards_paused boolean not null default false,
  active_withdrawal_id uuid,
  active_partner_key text,
  sponsored_cycle integer not null default 1 check (sponsored_cycle > 0),
  next_sponsored_slot smallint not null default 1 check (next_sponsored_slot between 1 and 6),
  processing_reached_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chatearn_user_journeys_pause_state_consistent check (
    case
      when journey_state in (
        'withdrawal_required', 'sharing_required', 'kyc_required',
        'kyc_pending', 'correction_required', 'suspended'
      ) then earnings_paused and sponsored_rewards_paused
      else not earnings_paused and not sponsored_rewards_paused
    end
  )
);

create index if not exists chatearn_user_journeys_state_updated_idx
  on public.chatearn_user_journeys (journey_state, updated_at desc, user_id);

create table if not exists public.chatearn_withdrawal_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  external_withdrawal_id uuid,
  journey_state text not null default 'sharing_required'
    check (journey_state in (
      'withdrawal_required',
      'details_pending',
      'sharing_required',
      'kyc_required',
      'kyc_pending',
      'processing',
      'approved',
      'rejected',
      'paid',
      'correction_required'
    )),
  requested_amount bigint not null check (requested_amount > 0),
  share_required_count smallint not null default 5 check (share_required_count >= 0),
  share_completed_count smallint not null default 0 check (share_completed_count >= 0),
  earning_access_restored_at timestamptz,
  processing_reached_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chatearn_withdrawal_journeys_external_unique unique (external_withdrawal_id)
);

create unique index if not exists chatearn_withdrawal_journeys_one_active_idx
  on public.chatearn_withdrawal_journeys (user_id)
  where journey_state in (
    'withdrawal_required', 'details_pending', 'sharing_required',
    'kyc_required', 'kyc_pending', 'processing', 'correction_required'
  );
create index if not exists chatearn_withdrawal_journeys_queue_idx
  on public.chatearn_withdrawal_journeys (journey_state, updated_at, id);

create table if not exists public.chatearn_conversation_states (
  user_id uuid not null references auth.users(id) on delete restrict,
  partner_key text not null check (char_length(partner_key) between 1 and 100),
  current_node_key text not null default 'opening',
  latest_partner_message_id uuid,
  latest_user_message_id uuid,
  eligible_user_message_count integer not null default 0
    check (eligible_user_message_count >= 0),
  total_message_count integer not null default 0
    check (total_message_count >= 0),
  suggested_replies jsonb not null default '[]'::jsonb
    check (jsonb_typeof(suggested_replies) = 'array'),
  conversation_context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(conversation_context) = 'object'),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, partner_key)
);

create index if not exists chatearn_conversation_states_recent_idx
  on public.chatearn_conversation_states (user_id, last_message_at desc nulls last, partner_key);

create table if not exists public.chatearn_sponsored_slots (
  slot_number smallint primary key check (slot_number between 1 and 100),
  message_milestone integer not null unique check (message_milestone > 0),
  reward_amount bigint not null check (reward_amount > 0),
  minimum_seconds_away integer not null default 12 check (minimum_seconds_away >= 0),
  offer_key text,
  active boolean not null default true,
  card_content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(card_content) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chatearn_sponsored_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  cycle_number integer not null default 1 check (cycle_number > 0),
  slot_number smallint not null references public.chatearn_sponsored_slots(slot_number) on delete restrict,
  partner_key text not null,
  reward_amount bigint not null check (reward_amount > 0),
  offer_key text,
  status text not null default 'presented'
    check (status in (
      'presented', 'opened', 'returned', 'verified', 'credited', 'expired', 'rejected'
    )),
  presented_at timestamptz not null default now(),
  opened_at timestamptz,
  returned_at timestamptz,
  verified_at timestamptz,
  credited_at timestamptz,
  credit_ledger_id uuid unique references public.chatearn_wallet_ledger(id) on delete restrict,
  verification_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chatearn_sponsored_opportunities_once_per_cycle
    unique (user_id, cycle_number, slot_number)
);

create index if not exists chatearn_sponsored_opportunities_user_status_idx
  on public.chatearn_sponsored_opportunities (user_id, status, created_at desc, id);

create table if not exists public.chatearn_kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  withdrawal_journey_id uuid references public.chatearn_withdrawal_journeys(id) on delete restrict,
  external_kyc_id uuid unique,
  full_name text not null,
  phone text,
  identification_type text not null,
  identification_number_last4 text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'resubmit')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chatearn_kyc_submissions_id_user_unique unique (id, user_id)
);

create index if not exists chatearn_kyc_submissions_user_created_idx
  on public.chatearn_kyc_submissions (user_id, created_at desc, id desc);
create index if not exists chatearn_kyc_submissions_review_queue_idx
  on public.chatearn_kyc_submissions (status, submitted_at nulls first, id);

create table if not exists public.chatearn_kyc_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  document_kind text not null check (document_kind in ('identity_front', 'identity_back', 'selfie', 'other')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  sha256 text,
  created_at timestamptz not null default now(),
  constraint chatearn_kyc_documents_submission_user_fk
    foreign key (submission_id, user_id)
    references public.chatearn_kyc_submissions(id, user_id)
    on delete restrict
);

create table if not exists chatearn_private.kyc_sensitive_details (
  submission_id uuid primary key references public.chatearn_kyc_submissions(id) on delete restrict,
  identification_number_ciphertext bytea not null,
  encryption_key_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on table chatearn_private.kyc_sensitive_details from public, anon, authenticated;
grant all on table chatearn_private.kyc_sensitive_details to service_role;

create table if not exists public.chatearn_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 120),
  target_type text not null,
  target_id text,
  request_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chatearn_audit_log_created_idx
  on public.chatearn_audit_log (created_at desc, id desc);
create index if not exists chatearn_audit_log_target_idx
  on public.chatearn_audit_log (target_type, target_id, created_at desc, id desc);

create or replace function chatearn_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function chatearn_private.reject_immutable_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception '% rows are immutable; create a compensating entry instead', tg_table_name
    using errcode = '55000';
end;
$$;

create or replace function public.chatearn_current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.chatearn_admin_roles ar
       where ar.user_id = auth.uid()
         and ar.role in ('admin', 'support', 'finance', 'compliance')
     );
$$;

create or replace function chatearn_private.append_wallet_entry(
  p_user_id uuid,
  p_direction text,
  p_amount bigint,
  p_entry_type text,
  p_idempotency_key text,
  p_source_table text default null,
  p_source_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.chatearn_wallet_ledger
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_existing public.chatearn_wallet_ledger;
  v_balance numeric;
  v_new_balance numeric;
  v_inserted public.chatearn_wallet_ledger;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22004';
  end if;
  if p_direction not in ('credit', 'debit') then
    raise exception 'invalid ledger direction' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'ledger amount must be positive' using errcode = '22023';
  end if;
  if nullif(trim(p_entry_type), '') is null then
    raise exception 'entry_type is required' using errcode = '22023';
  end if;
  if char_length(coalesce(p_idempotency_key, '')) not between 8 and 200 then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into v_existing
  from public.chatearn_wallet_ledger
  where user_id = p_user_id
    and idempotency_key = p_idempotency_key;

  if found then
    return v_existing;
  end if;

  select coalesce(sum(signed_amount), 0)
  into v_balance
  from public.chatearn_wallet_ledger
  where user_id = p_user_id;

  v_new_balance := v_balance + case when p_direction = 'credit' then p_amount else -p_amount end;
  if v_new_balance < 0 then
    raise exception 'insufficient wallet balance' using errcode = '22003';
  end if;
  if v_new_balance > 9223372036854775807::numeric then
    raise exception 'wallet balance overflow' using errcode = '22003';
  end if;

  insert into public.chatearn_wallet_ledger (
    user_id, direction, amount, entry_type, idempotency_key,
    source_table, source_id, balance_after, metadata
  ) values (
    p_user_id, p_direction, p_amount, trim(p_entry_type), p_idempotency_key,
    nullif(trim(p_source_table), ''), nullif(trim(p_source_id), ''),
    v_new_balance::bigint, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_inserted;

  return v_inserted;
end;
$$;

create or replace function chatearn_private.set_journey_state(
  p_user_id uuid,
  p_state text,
  p_active_withdrawal_id uuid default null,
  p_gate_passed boolean default null,
  p_processing_reached_at timestamptz default null
)
returns public.chatearn_user_journeys
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_paused boolean;
  v_result public.chatearn_user_journeys;
begin
  if p_state not in (
    'earning_enabled', 'withdrawal_required', 'sharing_required', 'kyc_required',
    'kyc_pending', 'processing', 'completed', 'correction_required', 'suspended'
  ) then
    raise exception 'invalid journey state' using errcode = '22023';
  end if;

  v_paused := p_state in (
    'withdrawal_required', 'sharing_required', 'kyc_required',
    'kyc_pending', 'correction_required', 'suspended'
  );

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));

  insert into public.chatearn_user_journeys (
    user_id, journey_state, first_withdrawal_gate_passed,
    earnings_paused, sponsored_rewards_paused, active_withdrawal_id,
    processing_reached_at
  ) values (
    p_user_id, p_state, coalesce(p_gate_passed, false),
    v_paused, v_paused, p_active_withdrawal_id, p_processing_reached_at
  )
  on conflict (user_id) do update set
    journey_state = excluded.journey_state,
    first_withdrawal_gate_passed =
      public.chatearn_user_journeys.first_withdrawal_gate_passed
      or excluded.first_withdrawal_gate_passed,
    earnings_paused = excluded.earnings_paused,
    sponsored_rewards_paused = excluded.sponsored_rewards_paused,
    active_withdrawal_id = coalesce(
      excluded.active_withdrawal_id,
      public.chatearn_user_journeys.active_withdrawal_id
    ),
    processing_reached_at = coalesce(
      excluded.processing_reached_at,
      public.chatearn_user_journeys.processing_reached_at
    ),
    version = public.chatearn_user_journeys.version + 1,
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.chatearn_get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_object_agg(setting_key, value order by setting_key), '{}'::jsonb)
  from public.chatearn_settings
  where is_public = true;
$$;

create or replace function public.chatearn_get_my_foundation_state()
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
    'wallet_balance', coalesce((
      select sum(l.signed_amount)
      from public.chatearn_wallet_ledger l
      where l.user_id = v_user_id
    ), 0),
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
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

insert into public.chatearn_settings (setting_key, value, description, is_public)
values
  ('currency', '"NGN"'::jsonb, 'Display and ledger currency.', true),
  ('first_withdrawal_minimum', '40000'::jsonb, 'Minimum first withdrawal amount in naira.', true),
  ('first_withdrawal_maximum', '65000'::jsonb, 'Mandatory first-withdrawal ceiling in naira.', true),
  ('share_required_count', '5'::jsonb, 'Verified shares required in the first-withdrawal journey.', true),
  ('signup_bonus', '10000'::jsonb, 'One-time registration credit in naira.', true),
  ('platform_mode', '"foundation"'::jsonb, 'Internal rollout mode; legacy remains live until cutover.', false)
on conflict (setting_key) do nothing;

insert into public.chatearn_sponsored_slots (
  slot_number, message_milestone, reward_amount, minimum_seconds_away, card_content
)
values
  (1, 3, 20000, 12, '{"label":"Sponsored reward"}'::jsonb),
  (2, 7, 22000, 12, '{"label":"Sponsored reward"}'::jsonb),
  (3, 12, 25000, 12, '{"label":"Sponsored reward"}'::jsonb),
  (4, 18, 27000, 12, '{"label":"Sponsored reward"}'::jsonb),
  (5, 25, 30000, 12, '{"label":"Sponsored reward"}'::jsonb)
on conflict (slot_number) do nothing;

drop trigger if exists chatearn_settings_touch_updated_at on public.chatearn_settings;
create trigger chatearn_settings_touch_updated_at
before update on public.chatearn_settings
for each row execute function chatearn_private.touch_updated_at();

drop trigger if exists chatearn_user_journeys_touch_updated_at on public.chatearn_user_journeys;
create trigger chatearn_user_journeys_touch_updated_at
before update on public.chatearn_user_journeys
for each row execute function chatearn_private.touch_updated_at();

drop trigger if exists chatearn_withdrawal_journeys_touch_updated_at on public.chatearn_withdrawal_journeys;
create trigger chatearn_withdrawal_journeys_touch_updated_at
before update on public.chatearn_withdrawal_journeys
for each row execute function chatearn_private.touch_updated_at();

drop trigger if exists chatearn_conversation_states_touch_updated_at on public.chatearn_conversation_states;
create trigger chatearn_conversation_states_touch_updated_at
before update on public.chatearn_conversation_states
for each row execute function chatearn_private.touch_updated_at();

drop trigger if exists chatearn_sponsored_slots_touch_updated_at on public.chatearn_sponsored_slots;
create trigger chatearn_sponsored_slots_touch_updated_at
before update on public.chatearn_sponsored_slots
for each row execute function chatearn_private.touch_updated_at();

drop trigger if exists chatearn_sponsored_opportunities_touch_updated_at on public.chatearn_sponsored_opportunities;
create trigger chatearn_sponsored_opportunities_touch_updated_at
before update on public.chatearn_sponsored_opportunities
for each row execute function chatearn_private.touch_updated_at();

drop trigger if exists chatearn_kyc_submissions_touch_updated_at on public.chatearn_kyc_submissions;
create trigger chatearn_kyc_submissions_touch_updated_at
before update on public.chatearn_kyc_submissions
for each row execute function chatearn_private.touch_updated_at();

drop trigger if exists chatearn_kyc_sensitive_touch_updated_at on chatearn_private.kyc_sensitive_details;
create trigger chatearn_kyc_sensitive_touch_updated_at
before update on chatearn_private.kyc_sensitive_details
for each row execute function chatearn_private.touch_updated_at();

drop trigger if exists chatearn_wallet_ledger_immutable on public.chatearn_wallet_ledger;
create trigger chatearn_wallet_ledger_immutable
before update or delete on public.chatearn_wallet_ledger
for each row execute function chatearn_private.reject_immutable_change();

drop trigger if exists chatearn_audit_log_immutable on public.chatearn_audit_log;
create trigger chatearn_audit_log_immutable
before update or delete on public.chatearn_audit_log
for each row execute function chatearn_private.reject_immutable_change();

alter table public.chatearn_admin_roles enable row level security;
alter table public.chatearn_settings enable row level security;
alter table public.chatearn_wallet_ledger enable row level security;
alter table public.chatearn_user_journeys enable row level security;
alter table public.chatearn_withdrawal_journeys enable row level security;
alter table public.chatearn_conversation_states enable row level security;
alter table public.chatearn_sponsored_slots enable row level security;
alter table public.chatearn_sponsored_opportunities enable row level security;
alter table public.chatearn_kyc_submissions enable row level security;
alter table public.chatearn_kyc_documents enable row level security;
alter table public.chatearn_audit_log enable row level security;

drop policy if exists chatearn_admin_roles_self_or_admin_read on public.chatearn_admin_roles;
create policy chatearn_admin_roles_self_or_admin_read
on public.chatearn_admin_roles for select to authenticated
using (user_id = auth.uid() or public.chatearn_current_user_is_admin());

drop policy if exists chatearn_settings_public_read on public.chatearn_settings;
create policy chatearn_settings_public_read
on public.chatearn_settings for select to anon, authenticated
using (is_public = true);

drop policy if exists chatearn_settings_admin_read on public.chatearn_settings;
create policy chatearn_settings_admin_read
on public.chatearn_settings for select to authenticated
using (public.chatearn_current_user_is_admin());

drop policy if exists chatearn_wallet_owner_read on public.chatearn_wallet_ledger;
create policy chatearn_wallet_owner_read
on public.chatearn_wallet_ledger for select to authenticated
using (user_id = auth.uid());

drop policy if exists chatearn_wallet_admin_read on public.chatearn_wallet_ledger;
create policy chatearn_wallet_admin_read
on public.chatearn_wallet_ledger for select to authenticated
using (public.chatearn_current_user_is_admin());

drop policy if exists chatearn_user_journey_owner_read on public.chatearn_user_journeys;
create policy chatearn_user_journey_owner_read
on public.chatearn_user_journeys for select to authenticated
using (user_id = auth.uid());

drop policy if exists chatearn_user_journey_admin_read on public.chatearn_user_journeys;
create policy chatearn_user_journey_admin_read
on public.chatearn_user_journeys for select to authenticated
using (public.chatearn_current_user_is_admin());

drop policy if exists chatearn_withdrawal_journey_owner_read on public.chatearn_withdrawal_journeys;
create policy chatearn_withdrawal_journey_owner_read
on public.chatearn_withdrawal_journeys for select to authenticated
using (user_id = auth.uid());

drop policy if exists chatearn_withdrawal_journey_admin_read on public.chatearn_withdrawal_journeys;
create policy chatearn_withdrawal_journey_admin_read
on public.chatearn_withdrawal_journeys for select to authenticated
using (public.chatearn_current_user_is_admin());

drop policy if exists chatearn_conversation_state_owner_read on public.chatearn_conversation_states;
create policy chatearn_conversation_state_owner_read
on public.chatearn_conversation_states for select to authenticated
using (user_id = auth.uid());

drop policy if exists chatearn_conversation_state_admin_read on public.chatearn_conversation_states;
create policy chatearn_conversation_state_admin_read
on public.chatearn_conversation_states for select to authenticated
using (public.chatearn_current_user_is_admin());

drop policy if exists chatearn_sponsored_slots_active_read on public.chatearn_sponsored_slots;
create policy chatearn_sponsored_slots_active_read
on public.chatearn_sponsored_slots for select to authenticated
using (active = true or public.chatearn_current_user_is_admin());

drop policy if exists chatearn_sponsored_opportunity_owner_read on public.chatearn_sponsored_opportunities;
create policy chatearn_sponsored_opportunity_owner_read
on public.chatearn_sponsored_opportunities for select to authenticated
using (user_id = auth.uid());

drop policy if exists chatearn_sponsored_opportunity_admin_read on public.chatearn_sponsored_opportunities;
create policy chatearn_sponsored_opportunity_admin_read
on public.chatearn_sponsored_opportunities for select to authenticated
using (public.chatearn_current_user_is_admin());

drop policy if exists chatearn_kyc_submission_owner_read on public.chatearn_kyc_submissions;
create policy chatearn_kyc_submission_owner_read
on public.chatearn_kyc_submissions for select to authenticated
using (user_id = auth.uid());

drop policy if exists chatearn_kyc_submission_admin_read on public.chatearn_kyc_submissions;
create policy chatearn_kyc_submission_admin_read
on public.chatearn_kyc_submissions for select to authenticated
using (public.chatearn_current_user_is_admin());

drop policy if exists chatearn_kyc_document_owner_read on public.chatearn_kyc_documents;
create policy chatearn_kyc_document_owner_read
on public.chatearn_kyc_documents for select to authenticated
using (user_id = auth.uid());

drop policy if exists chatearn_kyc_document_admin_read on public.chatearn_kyc_documents;
create policy chatearn_kyc_document_admin_read
on public.chatearn_kyc_documents for select to authenticated
using (public.chatearn_current_user_is_admin());

drop policy if exists chatearn_audit_admin_read on public.chatearn_audit_log;
create policy chatearn_audit_admin_read
on public.chatearn_audit_log for select to authenticated
using (public.chatearn_current_user_is_admin());

revoke all on table
  public.chatearn_admin_roles,
  public.chatearn_settings,
  public.chatearn_wallet_ledger,
  public.chatearn_user_journeys,
  public.chatearn_withdrawal_journeys,
  public.chatearn_conversation_states,
  public.chatearn_sponsored_slots,
  public.chatearn_sponsored_opportunities,
  public.chatearn_kyc_submissions,
  public.chatearn_kyc_documents,
  public.chatearn_audit_log
from public, anon, authenticated;

grant select on public.chatearn_settings to anon, authenticated;
grant select on
  public.chatearn_admin_roles,
  public.chatearn_wallet_ledger,
  public.chatearn_user_journeys,
  public.chatearn_withdrawal_journeys,
  public.chatearn_conversation_states,
  public.chatearn_sponsored_slots,
  public.chatearn_sponsored_opportunities,
  public.chatearn_kyc_submissions,
  public.chatearn_kyc_documents,
  public.chatearn_audit_log
to authenticated;

grant all on table
  public.chatearn_admin_roles,
  public.chatearn_settings,
  public.chatearn_wallet_ledger,
  public.chatearn_user_journeys,
  public.chatearn_withdrawal_journeys,
  public.chatearn_conversation_states,
  public.chatearn_sponsored_slots,
  public.chatearn_sponsored_opportunities,
  public.chatearn_kyc_submissions,
  public.chatearn_kyc_documents,
  public.chatearn_audit_log
to service_role;

grant usage, select on sequence public.chatearn_audit_log_id_seq to service_role;

revoke all on function public.chatearn_current_user_is_admin() from public;
revoke all on function public.chatearn_get_public_settings() from public;
revoke all on function public.chatearn_get_my_foundation_state() from public;
revoke all on function chatearn_private.append_wallet_entry(uuid, text, bigint, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function chatearn_private.set_journey_state(uuid, text, uuid, boolean, timestamptz) from public, anon, authenticated;
revoke all on function chatearn_private.touch_updated_at() from public, anon, authenticated;
revoke all on function chatearn_private.reject_immutable_change() from public, anon, authenticated;

grant execute on function public.chatearn_current_user_is_admin() to authenticated;
grant execute on function public.chatearn_get_public_settings() to anon, authenticated;
grant execute on function public.chatearn_get_my_foundation_state() to authenticated;
grant execute on function chatearn_private.append_wallet_entry(uuid, text, bigint, text, text, text, text, jsonb) to service_role;
grant execute on function chatearn_private.set_journey_state(uuid, text, uuid, boolean, timestamptz) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chatearn-kyc',
  'chatearn-kyc',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chatearn_kyc_storage_owner_read on storage.objects;
create policy chatearn_kyc_storage_owner_read
on storage.objects for select to authenticated
using (
  bucket_id = 'chatearn-kyc'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.chatearn_current_user_is_admin()
  )
);

drop policy if exists chatearn_kyc_storage_owner_upload on storage.objects;
create policy chatearn_kyc_storage_owner_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chatearn-kyc'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
