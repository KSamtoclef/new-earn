-- Rebuild the public chat-send RPC against the canonical schema only.
-- No legacy chatearn_reward_ledger, chatearn_chat_messages, or
-- chatearn_chat_threads relations are referenced.

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
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_partner public.chat_partners;
  v_version public.conversation_versions;
  v_conversation public.conversations;
  v_existing_message public.messages;
  v_client_uuid uuid;
  v_rate bigint;
  v_balance bigint;
  v_new_balance bigint;
  v_total integer;
  v_sequence bigint;
  v_message uuid;
  v_can_continue boolean := false;
  v_partner_key text := lower(btrim(coalesce(p_partner_key, '')));
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_user is null then
    raise exception 'Login required' using errcode = '28000';
  end if;

  if char_length(v_body) < 1 then
    raise exception 'Message cannot be empty' using errcode = '22023';
  end if;

  if char_length(v_body) > 1500 then
    raise exception 'Message is too long' using errcode = '22023';
  end if;

  if btrim(coalesce(p_client_message_id, '')) = '' then
    raise exception 'Message identifier is required' using errcode = '22023';
  end if;

  v_rate := case v_partner_key
    when 'alexlab102' then 15000
    when 'emiliacute' then 12000
    when 'mattjohn' then 10000
    when 'abi1990' then 15000
    when 'princess77' then 8000
    when 'camilaanders' then 10000
    else null
  end;

  if v_rate is null then
    raise exception 'Unknown chat partner' using errcode = '22023';
  end if;

  -- Preserve idempotency even when an older client sends a non-UUID key.
  if p_client_message_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_client_uuid := p_client_message_id::uuid;
  else
    v_client_uuid := (
      substr(md5(p_client_message_id), 1, 8) || '-' ||
      substr(md5(p_client_message_id), 9, 4) || '-' ||
      '4' || substr(md5(p_client_message_id), 14, 3) || '-' ||
      '8' || substr(md5(p_client_message_id), 18, 3) || '-' ||
      substr(md5(p_client_message_id), 21, 12)
    )::uuid;
  end if;

  select * into v_partner
  from public.chat_partners p
  where lower(p.slug) = v_partner_key
    and p.status::text in ('active', 'published')
  order by p.sort_order, p.created_at
  limit 1;

  if not found then
    raise exception 'Chat partner is unavailable' using errcode = 'P0002';
  end if;

  select * into v_version
  from public.conversation_versions cv
  where cv.partner_id = v_partner.id
    and cv.status::text in ('active', 'published')
  order by cv.published_at desc nulls last, cv.version_number desc
  limit 1;

  if not found then
    raise exception 'Chat conversation is unavailable' using errcode = 'P0002';
  end if;

  -- Serialize one user's writes for one partner to keep sequence numbers stable.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text || ':' || v_partner.id::text, 0)
  );

  select * into v_conversation
  from public.conversations c
  where c.user_id = v_user
    and c.partner_id = v_partner.id
    and c.status::text in ('active', 'paused')
  order by c.updated_at desc
  limit 1
  for update;

  if not found then
    insert into public.conversations(
      user_id,
      partner_id,
      version_id,
      status,
      last_message_at
    ) values (
      v_user,
      v_partner.id,
      v_version.id,
      'active'::public.conversation_status,
      now()
    )
    returning * into v_conversation;
  elsif v_conversation.status::text = 'paused' then
    update public.conversations
    set status = 'active'::public.conversation_status,
        version_id = v_version.id,
        updated_at = now()
    where id = v_conversation.id
    returning * into v_conversation;
  end if;

  -- Idempotent retry: return the existing message without paying twice.
  select * into v_existing_message
  from public.messages m
  where m.conversation_id = v_conversation.id
    and m.client_message_id = v_client_uuid
  order by m.created_at desc
  limit 1;

  if found then
    select coalesce(p.balance, 0)::bigint, coalesce(p.chats, 0)
      into v_new_balance, v_total
    from public.profiles p
    where p.user_id = v_user;

    return query
    select 0::bigint, v_new_balance, v_total, v_existing_message.id;
    return;
  end if;

  select coalesce(p.balance, 0)::bigint
    into v_balance
  from public.profiles p
  where p.user_id = v_user
  for update;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  v_can_continue := exists(
    select 1
    from public.withdrawals w
    where w.user_id = v_user
      and lower(coalesce(w.status::text, '')) in (
        'submitted', 'sharing_required', 'kyc_required', 'under_review',
        'needs_action', 'processing', 'paid', 'completed'
      )
  ) or exists(
    select 1
    from public.chatearn_user_journeys j
    where j.user_id = v_user
      and (
        j.first_withdrawal_gate_passed = true
        or j.journey_state in ('returning_earning', 'earning_enabled')
      )
  );

  if not v_can_continue and v_balance >= 80000 then
    raise exception 'Your first earning session is complete. Place your withdrawal to continue earning.'
      using errcode = '55000';
  end if;

  if not v_can_continue then
    v_rate := least(v_rate, greatest(0, 80000 - v_balance));
  end if;

  if v_rate <= 0 then
    raise exception 'Your first earning session is complete. Place your withdrawal to continue earning.'
      using errcode = '55000';
  end if;

  select coalesce(max(m.sequence_number), 0) + 1
    into v_sequence
  from public.messages m
  where m.conversation_id = v_conversation.id;

  insert into public.messages(
    conversation_id,
    sequence_number,
    sender,
    body,
    client_message_id,
    delivery_status,
    metadata,
    delivered_at,
    read_at
  ) values (
    v_conversation.id,
    v_sequence,
    'user'::public.message_sender,
    v_body,
    v_client_uuid,
    'read'::public.message_delivery_status,
    jsonb_build_object(
      'reward', v_rate,
      'partner_key', v_partner_key,
      'session_id', left(coalesce(p_session_id, ''), 120),
      'original_client_message_id', left(p_client_message_id, 200)
    ),
    now(),
    now()
  )
  returning id into v_message;

  update public.profiles p
  set balance = coalesce(p.balance, 0) + v_rate::integer,
      chats = coalesce(p.chats, 0) + 1,
      last_active_at = now(),
      updated_at = now()
  where p.user_id = v_user
  returning p.balance::bigint, p.chats
  into v_new_balance, v_total;

  update public.wallets w
  set available_balance = coalesce(w.available_balance, 0) + v_rate,
      lifetime_earned = coalesce(w.lifetime_earned, 0) + v_rate,
      ledger_sequence = coalesce(w.ledger_sequence, 0) + 1,
      updated_at = now()
  where w.user_id = v_user;

  if not found then
    insert into public.wallets(
      user_id,
      currency,
      available_balance,
      held_balance,
      lifetime_earned,
      lifetime_withdrawn,
      ledger_sequence
    ) values (
      v_user,
      'NGN',
      v_rate,
      0,
      v_rate,
      0,
      1
    );
  end if;

  update public.conversations
  set last_message_at = now(),
      updated_at = now()
  where id = v_conversation.id;

  return query
  select v_rate, v_new_balance, v_total, v_message;
end;
$function$;

revoke all on function public.chatearn_send_message(text, text, text, text) from public;
revoke all on function public.chatearn_send_message(text, text, text, text) from anon;
grant execute on function public.chatearn_send_message(text, text, text, text) to authenticated;

-- Installation guard: the rebuilt function must not contain legacy relations.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.chatearn_send_message(text,text,text,text)'::regprocedure
  ) into v_definition;

  if v_definition ilike '%chatearn_reward_ledger%'
     or v_definition ilike '%chatearn_chat_messages%'
     or v_definition ilike '%chatearn_chat_threads%' then
    raise exception 'Canonical chat-send installation still contains a legacy relation';
  end if;
end
$$;
