-- ChatEarn V4.0 — Performance Foundation
-- Additive, backward-compatible migration for chat-earn.xyz.
-- Run AFTER the existing V3/V3.2 SQL. No tables or user data are deleted.

begin;

-- ---------------------------------------------------------------------------
-- 1) INDEXES USED BY LIGHTWEIGHT ADMIN QUERIES
-- ---------------------------------------------------------------------------
create index if not exists chatearn_events_event_created_idx
  on public.chatearn_events(event_name, created_at desc);

create index if not exists chatearn_events_session_created_idx
  on public.chatearn_events(session_id, created_at desc);

create index if not exists chatearn_presence_visible_last_seen_idx
  on public.chatearn_presence(is_visible, last_seen_at desc);

create index if not exists chatearn_profiles_last_seen_idx
  on public.chatearn_profiles(last_seen_at desc);

create index if not exists chatearn_withdrawals_status_requested_idx
  on public.chatearn_withdrawals(status, requested_at desc);

create index if not exists chatearn_kyc_status_created_idx
  on public.chatearn_kyc(status, created_at desc);

create index if not exists chatearn_chat_threads_last_message_idx
  on public.chatearn_chat_threads(last_message_at desc nulls last);

create index if not exists chatearn_v3_offer_events_type_created_idx
  on public.chatearn_v3_offer_events(event_type, created_at desc);

create index if not exists chatearn_v3_share_events_type_created_idx
  on public.chatearn_v3_share_events(event_type, created_at desc);

-- ---------------------------------------------------------------------------
-- 2) SMALL BOOTSTRAP SNAPSHOT
-- Loads only data needed to open Overview/Live quickly.
-- ---------------------------------------------------------------------------
create or replace function public.chatearn_v4_admin_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_today timestamptz := date_trunc('day', now());
  v_live timestamptz := now() - interval '10 minutes';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.chatearn_v3_admin_is_admin() then raise exception 'Administrator permission required'; end if;

  return jsonb_build_object(
    'ok', true,
    'version', '4.0-bootstrap',
    'generated_at', now(),
    'data', jsonb_build_object(
      'presence', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.last_seen_at desc)
        from (
          select session_id, visitor_id, user_id, page, device, browser, source,
                 is_visible, first_seen_at, last_seen_at
          from public.chatearn_presence
          where last_seen_at >= v_live
          order by last_seen_at desc
          limit 500
        ) x
      ), '[]'::jsonb),

      'events', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.created_at desc)
        from (
          select id, user_id, session_id, visitor_id, event_name, page, partner,
                 metadata, created_at
          from public.chatearn_events
          where created_at >= v_today
          order by created_at desc
          limit 1200
        ) x
      ), '[]'::jsonb),

      'withdrawals', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.requested_at desc)
        from (
          select *
          from public.chatearn_withdrawals
          where status = 'pending'
          order by requested_at desc
          limit 100
        ) x
      ), '[]'::jsonb),

      'kyc', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.created_at desc)
        from (
          select *
          from public.chatearn_kyc
          where status = 'pending'
          order by created_at desc
          limit 100
        ) x
      ), '[]'::jsonb),

      'offers', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.display_order)
        from (
          select *
          from public.chatearn_v3_offers
          order by display_order
        ) x
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) LAZY SECTION LOADER
-- Only the opened admin section receives its historical dataset.
-- ---------------------------------------------------------------------------
create or replace function public.chatearn_v4_admin_section(
  p_section text,
  p_limit integer default 500,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_section text := lower(coalesce(p_section, ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 1000));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_week timestamptz := now() - interval '7 days';
  v_month timestamptz := now() - interval '30 days';
  v_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.chatearn_v3_admin_is_admin() then raise exception 'Administrator permission required'; end if;

  case v_section
    when 'analytics' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
      into v_rows
      from (
        select id, user_id, session_id, visitor_id, event_name, page, partner,
               metadata, created_at
        from public.chatearn_events
        where created_at >= v_week
        order by created_at desc
        limit v_limit offset v_offset
      ) x;

    when 'users' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.registered_at desc), '[]'::jsonb)
      into v_rows
      from (
        select user_id, full_name, email, balance, status, is_admin,
               registered_at, last_seen_at, last_page, last_partner,
               total_messages, total_chat_opens, total_share_attempts,
               checkin_streak, last_checkin_date, propush_status, updated_at,
               last_visit_at, visit_count, conversation_streak,
               last_conversation_date, referral_code, last_offer_key
        from public.chatearn_profiles
        order by registered_at desc
        limit v_limit offset v_offset
      ) x;

    when 'withdrawals' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_at desc), '[]'::jsonb)
      into v_rows
      from (
        select *
        from public.chatearn_withdrawals
        order by requested_at desc
        limit v_limit offset v_offset
      ) x;

    when 'kyc' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
      into v_rows
      from (
        select *
        from public.chatearn_kyc
        order by created_at desc
        limit v_limit offset v_offset
      ) x;

    when 'chats' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.last_message_at desc nulls last), '[]'::jsonb)
      into v_rows
      from (
        select *
        from public.chatearn_chat_threads
        order by last_message_at desc nulls last
        limit v_limit offset v_offset
      ) x;

    when 'chat_messages' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
      into v_rows
      from (
        select id, user_id, partner_key, sender, status, reward, created_at
        from public.chatearn_chat_messages
        where created_at >= v_week
        order by created_at desc
        limit v_limit offset v_offset
      ) x;

    when 'ledger' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
      into v_rows
      from (
        select id, user_id, reward_type, amount, unique_key, partner_key,
               metadata, created_at
        from public.chatearn_reward_ledger
        where created_at >= v_week
        order by created_at desc
        limit v_limit offset v_offset
      ) x;

    when 'offers' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
      into v_rows
      from (
        select id, offer_key, event_type, user_id, visitor_id, session_id,
               placement, visit_number, messages_before, seconds_away,
               metadata, created_at
        from public.chatearn_v3_offer_events
        where created_at >= v_month
        order by created_at desc
        limit v_limit offset v_offset
      ) x;

    when 'shares' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
      into v_rows
      from (
        select *
        from public.chatearn_v3_share_events
        where created_at >= v_month
        order by created_at desc
        limit v_limit offset v_offset
      ) x;

    when 'referrals' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
      into v_rows
      from (
        select *
        from public.chatearn_v3_referrals
        where created_at >= v_month
        order by created_at desc
        limit v_limit offset v_offset
      ) x;

    when 'activity' then
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
      into v_rows
      from (
        select id, user_id, session_id, visitor_id, event_name, page, partner,
               metadata, created_at
        from public.chatearn_events
        where created_at >= v_week
        order by created_at desc
        limit v_limit offset v_offset
      ) x;

    else
      raise exception 'Unsupported admin section: %', v_section;
  end case;

  return jsonb_build_object(
    'ok', true,
    'version', '4.0-section',
    'section', v_section,
    'limit', v_limit,
    'offset', v_offset,
    'generated_at', now(),
    'rows', v_rows
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) PERMISSIONS
-- ---------------------------------------------------------------------------
revoke all on function public.chatearn_v4_admin_bootstrap() from public, anon;
revoke all on function public.chatearn_v4_admin_section(text,integer,integer) from public, anon;
grant execute on function public.chatearn_v4_admin_bootstrap() to authenticated;
grant execute on function public.chatearn_v4_admin_section(text,integer,integer) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Installation verification
select
  to_regprocedure('public.chatearn_v4_admin_bootstrap()') as bootstrap_rpc,
  to_regprocedure('public.chatearn_v4_admin_section(text,integer,integer)') as section_rpc,
  has_function_privilege('authenticated','public.chatearn_v4_admin_bootstrap()','EXECUTE') as bootstrap_allowed,
  has_function_privilege('authenticated','public.chatearn_v4_admin_section(text,integer,integer)','EXECUTE') as section_allowed;
