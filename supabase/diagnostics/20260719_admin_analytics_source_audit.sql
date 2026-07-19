-- ChatEarn analytics source audit — schema discovery only
-- Read-only: this script does not modify data or functions.
-- It intentionally avoids hard-coded table names so it cannot fail when
-- analytics tables use project-specific names.

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

-- 2) All public tables/views that look related to analytics.
select
  n.nspname as schema_name,
  c.relname as relation_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned table'
    when 'v' then 'view'
    when 'm' then 'materialized view'
    else c.relkind::text
  end as relation_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','p','v','m')
  and (
    c.relname ilike '%event%'
    or c.relname ilike '%analytic%'
    or c.relname ilike '%presence%'
    or c.relname ilike '%offer%'
    or c.relname ilike '%assignment%'
    or c.relname ilike '%session%'
    or c.relname ilike '%visitor%'
    or c.relname ilike '%profile%'
    or c.relname ilike '%withdraw%'
    or c.relname ilike '%share%'
  )
order by relation_name;

-- 3) Columns for all likely analytics relations.
select
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and (
    c.table_name ilike '%event%'
    or c.table_name ilike '%analytic%'
    or c.table_name ilike '%presence%'
    or c.table_name ilike '%offer%'
    or c.table_name ilike '%assignment%'
    or c.table_name ilike '%session%'
    or c.table_name ilike '%visitor%'
    or c.table_name ilike '%profile%'
    or c.table_name ilike '%withdraw%'
    or c.table_name ilike '%share%'
  )
order by c.table_name, c.ordinal_position;

-- 4) Functions that reference likely analytics concepts.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    pg_get_functiondef(p.oid) ilike '%site_enter%'
    or pg_get_functiondef(p.oid) ilike '%landing_view%'
    or pg_get_functiondef(p.oid) ilike '%offer_open%'
    or pg_get_functiondef(p.oid) ilike '%offer_return%'
    or pg_get_functiondef(p.oid) ilike '%presence%'
    or pg_get_functiondef(p.oid) ilike '%visitor_id%'
    or pg_get_functiondef(p.oid) ilike '%session_id%'
  )
order by p.proname;

-- 5) Lightweight row estimates for likely analytics relations.
select
  schemaname,
  relname as relation_name,
  n_live_tup as estimated_rows,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
  and (
    relname ilike '%event%'
    or relname ilike '%analytic%'
    or relname ilike '%presence%'
    or relname ilike '%offer%'
    or relname ilike '%assignment%'
    or relname ilike '%session%'
    or relname ilike '%visitor%'
  )
order by estimated_rows desc, relation_name;
