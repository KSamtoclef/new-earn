-- Restore the missing ChatEarn chat RPC.
-- Safe to run repeatedly. Uses the existing ChatEarn V3/V4 tables.

begin;

create or replace function public.chatearn_send_message(
  p_partner_key text,
  p_body text,
  p_client_message_id text,
  p_session_id text default null
)
returns table(
  reward bigint,
  balance bigint,
  total_messages integer,
  message_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_rate bigint;
  v_balance bigint;
  v_new_balance bigint;
  v_message uuid;
  v_total integer;
  v_key text;
  v_can_continue boolean := false;
begin
  if v_user is null then raise exception 'Login required'; end if;
  if length(btrim(coalesce(p_body,''))) < 1 then raise exception 'Message cannot be empty'; end if;
  if length(p_body) > 1500 then raise exception 'Message is too long'; end if;
  if coalesce(btrim(p_client_message_id),'') = '' then raise exception 'Message identifier is required'; end if;

  v_rate := case lower(p_partner_key)
    when 'alexlab102' then 15000
    when 'emiliacute' then 12000
    when 'mattjohn' then 10000
    when 'abi1990' then 15000
    when 'princess77' then 8000
    when 'camilaanders' then 10000
    else null
  end;
  if v_rate is null then raise exception 'Unknown chat partner'; end if;

  select p.balance
    into v_balance
  from public.chatearn_profiles p
  where p.user_id = v_user
  for update;

  if v_balance is null then raise exception 'Profile not found'; end if;

  -- Users may continue after placing their first withdrawal or after becoming returning users.
  v_can_continue := exists(
    select 1
    from public.chatearn_withdrawals w
    where w.user_id = v_user
      and lower(coalesce(w.status,'')) in (
        'submitted','sharing_required','kyc_required','under_review',
        'needs_action','processing','pending','paid','completed'
      )
  ) or exists(
    select 1
    from public.chatearn_user_journeys j
    where j.user_id = v_user
      and (
        j.first_withdrawal_gate_passed = true
        or j.journey_state = 'returning_earning'
      )
  );

  if not v_can_continue and v_balance >= 80000 then
    raise exception 'Your first earning session is complete. Place your withdrawal to continue earning.';
  end if;

  if not v_can_continue then
    v_rate := least(v_rate, greatest(0, 80000 - v_balance));
  end if;

  v_key := 'chat:' || left(p_client_message_id,160);

  insert into public.chatearn_reward_ledger(
    user_id,reward_type,amount,unique_key,partner_key,metadata
  ) values (
    v_user,'chat_reply',v_rate,v_key,left(p_partner_key,80),
    jsonb_build_object('session_id',left(coalesce(p_session_id,''),120))
  )
  on conflict(user_id,unique_key) do nothing;

  if not found then
    select m.id,m.reward into v_message,v_rate
    from public.chatearn_chat_messages m
    where m.user_id=v_user
      and m.client_message_id=left(p_client_message_id,160);

    select p.balance,p.total_messages into v_new_balance,v_total
    from public.chatearn_profiles p
    where p.user_id=v_user;

    return query select coalesce(v_rate,0),v_new_balance,v_total,v_message;
    return;
  end if;

  insert into public.chatearn_chat_messages(
    user_id,partner_key,sender,body,client_message_id,status,reward
  ) values (
    v_user,left(p_partner_key,80),'user',p_body,
    left(p_client_message_id,160),'read',v_rate
  )
  returning chatearn_chat_messages.id into v_message;

  update public.chatearn_profiles p
  set balance=p.balance+v_rate,
      total_messages=p.total_messages+1,
      last_seen_at=now(),
      last_partner=left(p_partner_key,80),
      updated_at=now()
  where p.user_id=v_user
  returning p.balance,p.total_messages into v_new_balance,v_total;

  insert into public.chatearn_chat_threads(
    user_id,partner_key,opened_at,last_message_at,
    last_message_preview,message_count,unread_count
  ) values (
    v_user,left(p_partner_key,80),now(),now(),left(p_body,120),1,0
  )
  on conflict(user_id,partner_key) do update set
    last_message_at=now(),
    last_message_preview=left(p_body,120),
    message_count=public.chatearn_chat_threads.message_count+1;

  return query select v_rate,v_new_balance,v_total,v_message;
end;
$$;

revoke all on function public.chatearn_send_message(text,text,text,text) from public, anon;
grant execute on function public.chatearn_send_message(text,text,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;

select
  to_regprocedure('public.chatearn_send_message(text,text,text,text)') is not null as chat_rpc_exists,
  has_function_privilege(
    'authenticated',
    'public.chatearn_send_message(text,text,text,text)',
    'EXECUTE'
  ) as authenticated_can_execute;
