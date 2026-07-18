-- ChatEarn production hotfix: withdrawal unlocks at 40,000, earning pauses at 80,000.
-- Run this migration in Supabase after the earlier Module 4 migrations.

begin;

insert into public.chatearn_settings (setting_key, value, description, is_public)
values
  ('first_withdrawal_threshold', '40000'::jsonb,
   'Balance at which withdrawal becomes available.', false),
  ('first_session_earning_limit', '80000'::jsonb,
   'Balance at which the first earning session pauses until withdrawal.', false)
on conflict (setting_key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();

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
  v_session_limit bigint;
  v_journey public.chatearn_user_journeys;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22004';
  end if;

  v_session_limit := greatest(
    1,
    chatearn_private.setting_bigint('first_session_earning_limit', 80000)
  );

  select *
  into v_journey
  from public.chatearn_user_journeys j
  where j.user_id = p_user_id
  for update;

  if not found then
    raise exception 'account journey is missing' using errcode = '55000';
  end if;

  if coalesce(p_balance, 0) >= v_session_limit
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

-- Repair users who were incorrectly paused at 40,000-79,999 before this hotfix.
update public.chatearn_user_journeys j
set journey_state = 'earning_enabled',
    earnings_paused = false,
    sponsored_rewards_paused = false,
    version = version + 1,
    updated_at = now()
where j.first_withdrawal_gate_passed = false
  and j.journey_state = 'withdrawal_required'
  and coalesce((
    select sum(l.signed_amount)::bigint
    from public.chatearn_wallet_ledger l
    where l.user_id = j.user_id
  ), 0) < 80000;

commit;
