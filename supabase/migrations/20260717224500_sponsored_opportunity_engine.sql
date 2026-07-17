-- ChatEarn Module 4B: sponsored opportunity lifecycle and atomic crediting.
-- Depends on Module 4A and the existing sponsored slot/opportunity foundation.

begin;
set local lock_timeout = '15s';

insert into public.chatearn_settings (setting_key, value, description, is_public)
values
  ('sponsored_opportunity_ttl_hours', '24'::jsonb,
   'Hours before an uncredited sponsored opportunity expires.', false)
on conflict (setting_key) do nothing;

create or replace function chatearn_private.sponsored_required_message_count(
  p_cycle_number integer,
  p_message_milestone integer
)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
  select (
    greatest(coalesce(p_cycle_number, 1), 1)::bigint - 1
  ) * coalesce((
    select max(s.message_milestone)::bigint
    from public.chatearn_sponsored_slots s
    where s.active = true
  ), 0) + greatest(coalesce(p_message_milestone, 1), 1)::bigint;
$$;

create or replace function chatearn_private.present_sponsored_opportunity(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_journey public.chatearn_user_journeys;
  v_slot public.chatearn_sponsored_slots;
  v_existing public.chatearn_sponsored_opportunities;
  v_created public.chatearn_sponsored_opportunities;
  v_rewarded_count bigint;
  v_required_count bigint;
  v_ttl_hours bigint;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22004';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));

  select * into v_journey
  from public.chatearn_user_journeys j
  where j.user_id = p_user_id
  for update;

  if not found then
    raise exception 'account journey is missing' using errcode = '55000';
  end if;

  if not chatearn_private.setting_boolean('sponsored_rewards_enabled', true) then
    return jsonb_build_object('ok', true, 'available', false, 'reason', 'sponsored_rewards_disabled');
  end if;

  if v_journey.sponsored_rewards_paused or v_journey.journey_state <> 'earning_enabled' then
    return jsonb_build_object(
      'ok', true, 'available', false, 'reason', 'sponsored_rewards_paused',
      'journey_state', v_journey.journey_state
    );
  end if;

  v_ttl_hours := greatest(1, chatearn_private.setting_bigint('sponsored_opportunity_ttl_hours', 24));

  update public.chatearn_sponsored_opportunities o
  set status = 'expired',
      verification_data = o.verification_data || jsonb_build_object('expired_at', now())
  where o.user_id = p_user_id
    and o.status in ('presented', 'opened', 'returned', 'verified')
    and o.presented_at < now() - make_interval(hours => v_ttl_hours::integer);

  select * into v_existing
  from public.chatearn_sponsored_opportunities o
  where o.user_id = p_user_id
    and o.status in ('presented', 'opened', 'returned', 'verified')
  order by o.created_at desc, o.id desc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'ok', true,
      'available', true,
      'created', false,
      'opportunity', to_jsonb(v_existing) - 'user_id' - 'verification_data'
    );
  end if;

  select * into v_slot
  from public.chatearn_sponsored_slots s
  where s.slot_number = v_journey.next_sponsored_slot
    and s.active = true;

  if not found then
    select * into v_slot
    from public.chatearn_sponsored_slots s
    where s.active = true
    order by s.slot_number
    limit 1;
  end if;

  if not found then
    return jsonb_build_object('ok', true, 'available', false, 'reason', 'no_active_sponsored_slot');
  end if;

  select count(*)::bigint into v_rewarded_count
  from public.chatearn_conversation_messages m
  where m.user_id = p_user_id
    and m.sender = 'user'
    and m.reward_ledger_id is not null;

  v_required_count := chatearn_private.sponsored_required_message_count(
    v_journey.sponsored_cycle,
    v_slot.message_milestone
  );

  if v_rewarded_count < v_required_count then
    return jsonb_build_object(
      'ok', true,
      'available', false,
      'reason', 'milestone_not_reached',
      'rewarded_message_count', v_rewarded_count,
      'required_message_count', v_required_count,
      'cycle_number', v_journey.sponsored_cycle,
      'slot_number', v_slot.slot_number
    );
  end if;

  insert into public.chatearn_sponsored_opportunities (
    user_id, cycle_number, slot_number, partner_key,
    reward_amount, offer_key, status, verification_data
  )
  values (
    p_user_id,
    v_journey.sponsored_cycle,
    v_slot.slot_number,
    coalesce(v_journey.active_partner_key, 'system'),
    v_slot.reward_amount,
    v_slot.offer_key,
    'presented',
    jsonb_build_object(
      'engine', 'module4b',
      'required_message_count', v_required_count,
      'rewarded_message_count_at_presentation', v_rewarded_count,
      'minimum_seconds_away', v_slot.minimum_seconds_away
    )
  )
  on conflict (user_id, cycle_number, slot_number) do update
  set updated_at = now()
  returning * into v_created;

  return jsonb_build_object(
    'ok', true,
    'available', true,
    'created', true,
    'opportunity', (to_jsonb(v_created) - 'user_id' - 'verification_data') ||
      jsonb_build_object(
        'minimum_seconds_away', v_slot.minimum_seconds_away,
        'card_content', v_slot.card_content,
        'required_message_count', v_required_count
      )
  );
end;
$$;

create or replace function public.chatearn_get_sponsored_opportunity()
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
  return chatearn_private.present_sponsored_opportunity(v_user_id);
end;
$$;

create or replace function public.chatearn_open_sponsored_opportunity(
  p_opportunity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_opportunity public.chatearn_sponsored_opportunities;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.chatearn_sponsored_opportunities o
  set status = 'opened',
      opened_at = coalesce(o.opened_at, now()),
      verification_data = o.verification_data || jsonb_build_object('open_recorded_at', now())
  where o.id = p_opportunity_id
    and o.user_id = v_user_id
    and o.status in ('presented', 'opened')
  returning * into v_opportunity;

  if not found then
    raise exception 'sponsored opportunity is unavailable' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'ok', true,
    'opportunity', to_jsonb(v_opportunity) - 'user_id' - 'verification_data'
  );
end;
$$;

create or replace function public.chatearn_return_sponsored_opportunity(
  p_opportunity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_opportunity public.chatearn_sponsored_opportunities;
  v_slot public.chatearn_sponsored_slots;
  v_seconds_away integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into v_opportunity
  from public.chatearn_sponsored_opportunities o
  where o.id = p_opportunity_id
    and o.user_id = v_user_id
  for update;

  if not found or v_opportunity.status not in ('opened', 'returned') then
    raise exception 'sponsored opportunity must be opened first' using errcode = '22023';
  end if;

  select * into v_slot
  from public.chatearn_sponsored_slots s
  where s.slot_number = v_opportunity.slot_number;

  v_seconds_away := greatest(
    0,
    floor(extract(epoch from (now() - v_opportunity.opened_at)))::integer
  );

  update public.chatearn_sponsored_opportunities o
  set status = 'returned',
      returned_at = now(),
      verification_data = o.verification_data || jsonb_build_object(
        'seconds_away', v_seconds_away,
        'minimum_seconds_away', v_slot.minimum_seconds_away,
        'return_recorded_at', now()
      )
  where o.id = v_opportunity.id
  returning * into v_opportunity;

  return jsonb_build_object(
    'ok', true,
    'eligible_for_verification', v_seconds_away >= v_slot.minimum_seconds_away,
    'seconds_away', v_seconds_away,
    'minimum_seconds_away', v_slot.minimum_seconds_away,
    'opportunity', to_jsonb(v_opportunity) - 'user_id' - 'verification_data'
  );
end;
$$;

create or replace function public.chatearn_verify_sponsored_opportunity(
  p_opportunity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_opportunity public.chatearn_sponsored_opportunities;
  v_slot public.chatearn_sponsored_slots;
  v_journey public.chatearn_user_journeys;
  v_ledger public.chatearn_wallet_ledger;
  v_seconds_away integer;
  v_next_slot smallint;
  v_next_cycle integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 2));

  select * into v_opportunity
  from public.chatearn_sponsored_opportunities o
  where o.id = p_opportunity_id
    and o.user_id = v_user_id
  for update;

  if not found then
    raise exception 'sponsored opportunity was not found' using errcode = '22023';
  end if;

  if v_opportunity.status = 'credited' then
    return jsonb_build_object(
      'ok', true, 'credited', false, 'duplicate', true,
      'reason', 'already_credited', 'ledger_id', v_opportunity.credit_ledger_id
    );
  end if;

  if v_opportunity.status <> 'returned' or v_opportunity.opened_at is null then
    raise exception 'sponsored opportunity is not ready for verification' using errcode = '22023';
  end if;

  select * into v_journey
  from public.chatearn_user_journeys j
  where j.user_id = v_user_id
  for update;

  if v_journey.sponsored_rewards_paused or v_journey.journey_state <> 'earning_enabled' then
    return jsonb_build_object('ok', true, 'credited', false, 'duplicate', false, 'reason', 'sponsored_rewards_paused');
  end if;

  select * into v_slot
  from public.chatearn_sponsored_slots s
  where s.slot_number = v_opportunity.slot_number
    and s.active = true;

  if not found then
    raise exception 'sponsored slot is unavailable' using errcode = '55000';
  end if;

  v_seconds_away := floor(extract(epoch from (coalesce(v_opportunity.returned_at, now()) - v_opportunity.opened_at)))::integer;

  if v_seconds_away < v_slot.minimum_seconds_away then
    update public.chatearn_sponsored_opportunities
    set status = 'rejected',
        verification_data = verification_data || jsonb_build_object(
          'rejected_at', now(), 'reason', 'returned_too_quickly',
          'seconds_away', v_seconds_away
        )
    where id = v_opportunity.id;

    return jsonb_build_object(
      'ok', true, 'credited', false, 'duplicate', false,
      'reason', 'returned_too_quickly',
      'seconds_away', v_seconds_away,
      'minimum_seconds_away', v_slot.minimum_seconds_away
    );
  end if;

  update public.chatearn_sponsored_opportunities
  set status = 'verified', verified_at = now()
  where id = v_opportunity.id;

  v_ledger := chatearn_private.append_wallet_entry(
    v_user_id,
    'credit',
    v_opportunity.reward_amount,
    'sponsored_reward',
    'sponsored_reward:' || v_opportunity.id::text,
    'chatearn_sponsored_opportunities',
    v_opportunity.id::text,
    jsonb_build_object(
      'engine', 'module4b',
      'opportunity_id', v_opportunity.id,
      'cycle_number', v_opportunity.cycle_number,
      'slot_number', v_opportunity.slot_number,
      'offer_key', v_opportunity.offer_key,
      'seconds_away', v_seconds_away
    )
  );

  update public.chatearn_sponsored_opportunities
  set status = 'credited',
      credited_at = now(),
      credit_ledger_id = v_ledger.id,
      verification_data = verification_data || jsonb_build_object('credited_at', now())
  where id = v_opportunity.id;

  select min(s.slot_number) into v_next_slot
  from public.chatearn_sponsored_slots s
  where s.active = true
    and s.slot_number > v_opportunity.slot_number;

  if v_next_slot is null then
    select min(s.slot_number) into v_next_slot
    from public.chatearn_sponsored_slots s
    where s.active = true;
    v_next_cycle := v_opportunity.cycle_number + 1;
  else
    v_next_cycle := v_opportunity.cycle_number;
  end if;

  update public.chatearn_user_journeys
  set sponsored_cycle = v_next_cycle,
      next_sponsored_slot = coalesce(v_next_slot, next_sponsored_slot),
      version = version + 1,
      updated_at = now()
  where user_id = v_user_id;

  v_journey := chatearn_private.apply_first_withdrawal_pause(v_user_id, v_ledger.balance_after);

  return jsonb_build_object(
    'ok', true,
    'credited', true,
    'duplicate', false,
    'amount', v_ledger.amount,
    'balance', v_ledger.balance_after,
    'ledger_id', v_ledger.id,
    'next_cycle', v_next_cycle,
    'next_slot', v_next_slot,
    'earnings_paused', v_journey.earnings_paused,
    'journey_state', v_journey.journey_state
  );
end;
$$;

revoke all on function public.chatearn_get_sponsored_opportunity() from public, anon, authenticated;
grant execute on function public.chatearn_get_sponsored_opportunity() to authenticated;

revoke all on function public.chatearn_open_sponsored_opportunity(uuid) from public, anon, authenticated;
grant execute on function public.chatearn_open_sponsored_opportunity(uuid) to authenticated;

revoke all on function public.chatearn_return_sponsored_opportunity(uuid) from public, anon, authenticated;
grant execute on function public.chatearn_return_sponsored_opportunity(uuid) to authenticated;

revoke all on function public.chatearn_verify_sponsored_opportunity(uuid) from public, anon, authenticated;
grant execute on function public.chatearn_verify_sponsored_opportunity(uuid) to authenticated;

revoke all on function chatearn_private.sponsored_required_message_count(integer, integer) from public, anon, authenticated;
revoke all on function chatearn_private.present_sponsored_opportunity(uuid) from public, anon, authenticated;

commit;
