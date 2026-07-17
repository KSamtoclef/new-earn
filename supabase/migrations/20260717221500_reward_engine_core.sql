-- ChatEarn Module 4A: canonical chat reward core.
-- This stage integrates Module 3 eligible messages with the existing
-- chatearn_wallet_ledger and chatearn_user_journeys foundation.

begin;
set local lock_timeout = '15s';

alter table public.chatearn_conversation_messages
  add column if not exists reward_ledger_id uuid,
  add column if not exists rewarded_at timestamptz;

create unique index if not exists chatearn_conversation_messages_reward_ledger_unique
  on public.chatearn_conversation_messages (reward_ledger_id)
  where reward_ledger_id is not null;

alter table public.chatearn_conversation_messages
  drop constraint if exists chatearn_conversation_messages_reward_ledger_id_fkey;

alter table public.chatearn_conversation_messages
  add constraint chatearn_conversation_messages_reward_ledger_id_fkey
  foreign key (reward_ledger_id)
  references public.chatearn_wallet_ledger(id)
  on delete restrict;

insert into public.chatearn_settings (setting_key, value, description, is_public)
values
  ('chat_rewards_enabled', 'true'::jsonb,
   'Whether eligible chat messages may create wallet credits.', false),
  ('sponsored_rewards_enabled', 'true'::jsonb,
   'Whether sponsored milestone rewards may be issued.', false),
  ('first_withdrawal_threshold', '40000'::jsonb,
   'Wallet balance that pauses earning until the first withdrawal journey begins.', false)
on conflict (setting_key) do nothing;

create or replace function chatearn_private.setting_boolean(
  p_setting_key text,
  p_default boolean
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
  select coalesce(
    (
      select case jsonb_typeof(s.value)
        when 'boolean' then (s.value #>> '{}')::boolean
        when 'string' then lower(s.value #>> '{}') in ('true','1','yes','on')
        else null
      end
      from public.chatearn_settings s
      where s.setting_key = p_setting_key
    ),
    p_default
  );
$$;

create or replace function chatearn_private.setting_bigint(
  p_setting_key text,
  p_default bigint
)
returns bigint
language plpgsql
stable
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_value bigint;
begin
  begin
    select (s.value #>> '{}')::bigint
    into v_value
    from public.chatearn_settings s
    where s.setting_key = p_setting_key;
  exception when others then
    v_value := null;
  end;

  return coalesce(v_value, p_default);
end;
$$;

create or replace function chatearn_private.apply_first_withdrawal_pause(
  p_user_id uuid,
  p_balance bigint
)
returns public.chatearn_user_journeys
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_threshold bigint;
  v_journey public.chatearn_user_journeys;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22004';
  end if;

  v_threshold := greatest(
    1,
    chatearn_private.setting_bigint('first_withdrawal_threshold', 40000)
  );

  select *
  into v_journey
  from public.chatearn_user_journeys j
  where j.user_id = p_user_id
  for update;

  if not found then
    raise exception 'account journey is missing' using errcode = '55000';
  end if;

  if coalesce(p_balance, 0) >= v_threshold
     and not v_journey.first_withdrawal_gate_passed
     and v_journey.journey_state = 'earning_enabled' then
    update public.chatearn_user_journeys
    set journey_state = 'withdrawal_required',
        earnings_paused = true,
        sponsored_rewards_paused = true,
        version = version + 1,
        updated_at = now()
    where user_id = p_user_id
    returning * into v_journey;
  end if;

  return v_journey;
end;
$$;

create or replace function chatearn_private.credit_chat_message(
  p_user_id uuid,
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_message public.chatearn_conversation_messages;
  v_partner public.chatearn_chat_partners;
  v_journey public.chatearn_user_journeys;
  v_ledger public.chatearn_wallet_ledger;
  v_existing public.chatearn_wallet_ledger;
  v_amount bigint;
  v_enabled boolean;
begin
  if p_user_id is null or p_message_id is null then
    raise exception 'user_id and message_id are required' using errcode = '22004';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select *
  into v_message
  from public.chatearn_conversation_messages m
  where m.id = p_message_id
    and m.user_id = p_user_id
    and m.sender = 'user'
  for update;

  if not found then
    raise exception 'chat message was not found' using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.chatearn_wallet_ledger l
  where l.user_id = p_user_id
    and l.source_table = 'chatearn_conversation_messages'
    and l.source_id = p_message_id::text;

  if found then
    if v_message.reward_ledger_id is null then
      update public.chatearn_conversation_messages
      set reward_ledger_id = v_existing.id,
          rewarded_at = coalesce(rewarded_at, v_existing.created_at),
          metadata = metadata || jsonb_build_object(
            'reward_engine', 'module4',
            'reward_amount', v_existing.amount
          )
      where id = v_message.id;
    end if;

    select * into v_journey
    from public.chatearn_user_journeys
    where user_id = p_user_id;

    return jsonb_build_object(
      'ok', true,
      'credited', false,
      'duplicate', true,
      'reason', 'already_credited',
      'message_id', v_message.id,
      'ledger_id', v_existing.id,
      'amount', v_existing.amount,
      'balance', v_existing.balance_after,
      'earnings_paused', coalesce(v_journey.earnings_paused, false),
      'journey_state', coalesce(v_journey.journey_state, 'earning_enabled')
    );
  end if;

  if not v_message.eligible_for_reward then
    return jsonb_build_object(
      'ok', true,
      'credited', false,
      'duplicate', false,
      'reason', 'message_not_eligible',
      'message_id', v_message.id
    );
  end if;

  v_enabled := chatearn_private.setting_boolean('chat_rewards_enabled', true);
  if not v_enabled then
    return jsonb_build_object(
      'ok', true,
      'credited', false,
      'duplicate', false,
      'reason', 'chat_rewards_disabled',
      'message_id', v_message.id
    );
  end if;

  select *
  into v_journey
  from public.chatearn_user_journeys j
  where j.user_id = p_user_id
  for update;

  if not found then
    raise exception 'account journey is missing' using errcode = '55000';
  end if;

  if v_journey.earnings_paused
     or v_journey.journey_state <> 'earning_enabled' then
    return jsonb_build_object(
      'ok', true,
      'credited', false,
      'duplicate', false,
      'reason', 'earnings_paused',
      'message_id', v_message.id,
      'journey_state', v_journey.journey_state
    );
  end if;

  select *
  into v_partner
  from public.chatearn_chat_partners p
  where p.partner_key = v_message.partner_key
    and p.active = true;

  if not found then
    raise exception 'chat partner is unavailable' using errcode = '55000';
  end if;

  v_amount := v_partner.chat_reward_amount;
  if v_amount is null or v_amount <= 0 then
    raise exception 'chat reward configuration is invalid' using errcode = '22023';
  end if;

  v_ledger := chatearn_private.append_wallet_entry(
    p_user_id,
    'credit',
    v_amount,
    'chat_message_reward',
    'chat_message_reward:' || p_message_id::text,
    'chatearn_conversation_messages',
    p_message_id::text,
    jsonb_build_object(
      'engine', 'module4',
      'partner_key', v_message.partner_key,
      'message_id', p_message_id
    )
  );

  update public.chatearn_conversation_messages
  set reward_ledger_id = v_ledger.id,
      rewarded_at = v_ledger.created_at,
      metadata = metadata || jsonb_build_object(
        'reward_engine', 'module4',
        'reward_amount', v_amount
      )
  where id = v_message.id;

  v_journey := chatearn_private.apply_first_withdrawal_pause(
    p_user_id,
    v_ledger.balance_after
  );

  return jsonb_build_object(
    'ok', true,
    'credited', true,
    'duplicate', false,
    'message_id', v_message.id,
    'ledger_id', v_ledger.id,
    'amount', v_ledger.amount,
    'balance', v_ledger.balance_after,
    'earnings_paused', v_journey.earnings_paused,
    'sponsored_rewards_paused', v_journey.sponsored_rewards_paused,
    'journey_state', v_journey.journey_state
  );
end;
$$;

create or replace function public.chatearn_claim_chat_reward(
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  return chatearn_private.credit_chat_message(v_user_id, p_message_id);
end;
$$;

create or replace function public.chatearn_get_reward_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_journey public.chatearn_user_journeys;
  v_balance bigint;
  v_rewarded_messages bigint;
  v_eligible_messages bigint;
  v_pending_opportunities bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into v_journey
  from public.chatearn_user_journeys
  where user_id = v_user_id;

  if not found then
    raise exception 'account journey is missing' using errcode = '55000';
  end if;

  select coalesce(sum(l.signed_amount), 0)::bigint
  into v_balance
  from public.chatearn_wallet_ledger l
  where l.user_id = v_user_id;

  select
    count(*) filter (where m.eligible_for_reward),
    count(*) filter (where m.reward_ledger_id is not null)
  into v_eligible_messages, v_rewarded_messages
  from public.chatearn_conversation_messages m
  where m.user_id = v_user_id
    and m.sender = 'user';

  select count(*)
  into v_pending_opportunities
  from public.chatearn_sponsored_opportunities o
  where o.user_id = v_user_id
    and o.status in ('presented','opened','returned','verified');

  return jsonb_build_object(
    'ok', true,
    'balance', v_balance,
    'chat_rewards_enabled', chatearn_private.setting_boolean('chat_rewards_enabled', true),
    'sponsored_rewards_enabled', chatearn_private.setting_boolean('sponsored_rewards_enabled', true),
    'first_withdrawal_threshold', chatearn_private.setting_bigint('first_withdrawal_threshold', 40000),
    'eligible_message_count', v_eligible_messages,
    'rewarded_message_count', v_rewarded_messages,
    'pending_sponsored_opportunities', v_pending_opportunities,
    'journey_state', v_journey.journey_state,
    'earnings_paused', v_journey.earnings_paused,
    'sponsored_rewards_paused', v_journey.sponsored_rewards_paused,
    'first_withdrawal_gate_passed', v_journey.first_withdrawal_gate_passed
  );
end;
$$;

revoke all on function public.chatearn_claim_chat_reward(uuid)
from public, anon, authenticated;
grant execute on function public.chatearn_claim_chat_reward(uuid)
to authenticated;

revoke all on function public.chatearn_get_reward_state()
from public, anon, authenticated;
grant execute on function public.chatearn_get_reward_state()
to authenticated;

revoke all on function chatearn_private.setting_boolean(text, boolean)
from public, anon, authenticated;
revoke all on function chatearn_private.setting_bigint(text, bigint)
from public, anon, authenticated;
revoke all on function chatearn_private.apply_first_withdrawal_pause(uuid, bigint)
from public, anon, authenticated;
revoke all on function chatearn_private.credit_chat_message(uuid, uuid)
from public, anon, authenticated;

commit;
