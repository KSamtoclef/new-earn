-- ChatEarn analytics source audit
-- Read-only: this script does not modify data or functions.
-- Run in Supabase SQL Editor, then send back all result grids.

-- 1) Current definitions of the admin analytics functions.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'chatearn_v6_admin_overview_fast',
    'chatearn_v6_admin_performance',
    'chatearn_v6_admin_offer_task_manager',
    'chatearn_v6_admin_manager_inventory',
    'chatearn_v6_admin_live'
  )
order by p.proname;

-- 2) Analytics-related tables and their columns.
select
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and (
    c.table_name ilike 'chatearn%event%'
    or c.table_name ilike 'chatearn%presence%'
    or c.table_name ilike 'chatearn%offer%'
    or c.table_name ilike 'chatearn%assignment%'
    or c.table_name ilike 'chatearn%session%'
    or c.table_name ilike 'chatearn%profile%'
    or c.table_name ilike 'chatearn%withdraw%'
    or c.table_name ilike 'chatearn%share%'
  )
order by c.table_name, c.ordinal_position;

-- 3) Today in Africa/Lagos: raw event totals versus unique identities.
with bounds as (
  select
    (date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos') as start_at,
    ((date_trunc('day', now() at time zone 'Africa/Lagos') + interval '1 day') at time zone 'Africa/Lagos') as end_at
), e as (
  select *
  from public.chatearn_events
  where created_at >= (select start_at from bounds)
    and created_at < (select end_at from bounds)
)
select
  event_name,
  count(*) as raw_events,
  count(distinct nullif(visitor_id,'')) as unique_visitor_ids,
  count(distinct nullif(session_id,'')) as unique_sessions,
  count(distinct user_id) as unique_users
from e
group by event_name
order by raw_events desc, event_name;

-- 4) Today: duplicate site-entry concentration per browser identity.
with bounds as (
  select
    (date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos') as start_at,
    ((date_trunc('day', now() at time zone 'Africa/Lagos') + interval '1 day') at time zone 'Africa/Lagos') as end_at
)
select
  coalesce(user_id::text, nullif(visitor_id,''), nullif(session_id,''), 'unknown') as identity_key,
  count(*) filter (where event_name in ('site_enter','landing_view')) as entry_events,
  count(distinct nullif(session_id,'')) as sessions,
  min(created_at) as first_seen,
  max(created_at) as last_seen
from public.chatearn_events
where created_at >= (select start_at from bounds)
  and created_at < (select end_at from bounds)
group by 1
having count(*) filter (where event_name in ('site_enter','landing_view')) > 0
order by entry_events desc
limit 100;

-- 5) Today: genuine offer impressions, opens and returns by offer.
with bounds as (
  select
    (date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos') as start_at,
    ((date_trunc('day', now() at time zone 'Africa/Lagos') + interval '1 day') at time zone 'Africa/Lagos') as end_at
)
select
  offer_key,
  count(*) filter (where event_type in ('impression','view','shown','assigned')) as views,
  count(*) filter (where event_type in ('open','click')) as clicks,
  count(*) filter (where event_type in ('return','returned')) as returns,
  count(distinct coalesce(user_id::text, nullif(visitor_id,''), nullif(session_id,'')))
    filter (where event_type in ('impression','view','shown','assigned')) as unique_viewers,
  count(distinct coalesce(user_id::text, nullif(visitor_id,''), nullif(session_id,'')))
    filter (where event_type in ('open','click')) as unique_clickers
from public.chatearn_offer_events
where created_at >= (select start_at from bounds)
  and created_at < (select end_at from bounds)
group by offer_key
order by clicks desc, views desc;

-- 6) Current live-presence rows and heartbeat freshness.
select
  visitor_id,
  user_id,
  session_id,
  page,
  is_visible,
  last_seen_at,
  now() - last_seen_at as heartbeat_age
from public.chatearn_presence
order by last_seen_at desc
limit 100;
