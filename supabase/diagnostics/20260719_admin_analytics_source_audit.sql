-- ChatEarn analytics source audit — exact discovery
-- Read-only: this script does not modify production data or functions.

-- 1) Exact admin analytics function definitions.
select
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

-- 2) Exact columns for the relations discovered in this project.
select
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'offers',
    'app_events',
    'chatearn_offer_presentations',
    'error_events',
    'offer_assignments',
    'presence_sessions',
    'share_events',
    'share_sessions',
    'sponsored_events'
  )
order by c.table_name, c.ordinal_position;

-- 3) Exact row counts. pg_stat estimates can be zero before ANALYZE even when rows exist.
drop table if exists pg_temp.ce_exact_counts;
create temporary table ce_exact_counts (
  relation_name text primary key,
  exact_rows bigint,
  error_text text
) on commit drop;

do $$
declare
  r record;
  n bigint;
begin
  for r in
    select unnest(array[
      'offers',
      'app_events',
      'chatearn_offer_presentations',
      'error_events',
      'offer_assignments',
      'presence_sessions',
      'share_events',
      'share_sessions',
      'sponsored_events'
    ]) as relation_name
  loop
    begin
      execute format('select count(*) from public.%I', r.relation_name) into n;
      insert into ce_exact_counts values (r.relation_name, n, null);
    exception when others then
      insert into ce_exact_counts values (r.relation_name, null, sqlerrm);
    end;
  end loop;
end $$;

select * from ce_exact_counts order by exact_rows desc nulls last, relation_name;

-- 4) Find which real tables are referenced by the admin calculations.
select
  p.proname as function_name,
  regexp_matches(
    lower(pg_get_functiondef(p.oid)),
    '(?:from|join)\s+(?:public\.)?([a-z_][a-z0-9_]*)',
    'g'
  ) as referenced_relation
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

-- 5) Functions that record analytics events, presence, offers or shares.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    pg_get_functiondef(p.oid) ilike '%app_events%'
    or pg_get_functiondef(p.oid) ilike '%sponsored_events%'
    or pg_get_functiondef(p.oid) ilike '%offer_assignments%'
    or pg_get_functiondef(p.oid) ilike '%presence_sessions%'
    or pg_get_functiondef(p.oid) ilike '%share_events%'
    or pg_get_functiondef(p.oid) ilike '%share_sessions%'
  )
order by p.proname;
