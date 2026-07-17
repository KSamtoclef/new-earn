-- ChatEarn Module 4B verification. Read-only.

with checks as (
  select
    'sponsored lifecycle RPCs exist'::text as check_name,
    (
      to_regprocedure('public.chatearn_get_sponsored_opportunity()') is not null
      and to_regprocedure('public.chatearn_open_sponsored_opportunity(uuid)') is not null
      and to_regprocedure('public.chatearn_return_sponsored_opportunity(uuid)') is not null
      and to_regprocedure('public.chatearn_verify_sponsored_opportunity(uuid)') is not null
    ) as passed,
    concat(
      'get=', to_regprocedure('public.chatearn_get_sponsored_opportunity()') is not null,
      ' open=', to_regprocedure('public.chatearn_open_sponsored_opportunity(uuid)') is not null,
      ' return=', to_regprocedure('public.chatearn_return_sponsored_opportunity(uuid)') is not null,
      ' verify=', to_regprocedure('public.chatearn_verify_sponsored_opportunity(uuid)') is not null
    ) as observed,
    'all four RPCs exist'::text as expected

  union all

  select
    'sponsored private helpers exist',
    (
      to_regprocedure('chatearn_private.sponsored_required_message_count(integer,integer)') is not null
      and to_regprocedure('chatearn_private.present_sponsored_opportunity(uuid)') is not null
    ),
    concat(
      'required_count=', to_regprocedure('chatearn_private.sponsored_required_message_count(integer,integer)') is not null,
      ' present=', to_regprocedure('chatearn_private.present_sponsored_opportunity(uuid)') is not null
    ),
    'both private helpers exist'

  union all

  select
    'authenticated may execute sponsored RPCs only',
    (
      has_function_privilege('authenticated', 'public.chatearn_get_sponsored_opportunity()', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.chatearn_open_sponsored_opportunity(uuid)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.chatearn_return_sponsored_opportunity(uuid)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.chatearn_verify_sponsored_opportunity(uuid)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.chatearn_get_sponsored_opportunity()', 'EXECUTE')
      and not has_function_privilege('anon', 'public.chatearn_open_sponsored_opportunity(uuid)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.chatearn_return_sponsored_opportunity(uuid)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.chatearn_verify_sponsored_opportunity(uuid)', 'EXECUTE')
    ),
    concat(
      'authenticated=',
      has_function_privilege('authenticated', 'public.chatearn_get_sponsored_opportunity()', 'EXECUTE'), '/',
      has_function_privilege('authenticated', 'public.chatearn_open_sponsored_opportunity(uuid)', 'EXECUTE'), '/',
      has_function_privilege('authenticated', 'public.chatearn_return_sponsored_opportunity(uuid)', 'EXECUTE'), '/',
      has_function_privilege('authenticated', 'public.chatearn_verify_sponsored_opportunity(uuid)', 'EXECUTE'),
      ' anon=',
      has_function_privilege('anon', 'public.chatearn_get_sponsored_opportunity()', 'EXECUTE'), '/',
      has_function_privilege('anon', 'public.chatearn_open_sponsored_opportunity(uuid)', 'EXECUTE'), '/',
      has_function_privilege('anon', 'public.chatearn_return_sponsored_opportunity(uuid)', 'EXECUTE'), '/',
      has_function_privilege('anon', 'public.chatearn_verify_sponsored_opportunity(uuid)', 'EXECUTE')
    ),
    'authenticated=true/true/true/true anon=false/false/false/false'

  union all

  select
    'sponsored opportunity uniqueness remains enforced',
    exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'chatearn_sponsored_opportunities'
        and c.conname = 'chatearn_sponsored_opportunities_once_per_cycle'
        and c.contype = 'u'
    ),
    coalesce((
      select pg_get_constraintdef(c.oid)
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'chatearn_sponsored_opportunities'
        and c.conname = 'chatearn_sponsored_opportunities_once_per_cycle'
    ), 'missing'),
    'UNIQUE (user_id, cycle_number, slot_number)'

  union all

  select
    'sponsored credit ledger uniqueness remains enforced',
    exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'chatearn_sponsored_opportunities'
        and c.conname = 'chatearn_sponsored_opportunities_credit_ledger_id_key'
        and c.contype = 'u'
    ),
    coalesce((
      select pg_get_constraintdef(c.oid)
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'chatearn_sponsored_opportunities'
        and c.conname = 'chatearn_sponsored_opportunities_credit_ledger_id_key'
    ), 'missing'),
    'UNIQUE (credit_ledger_id)'

  union all

  select
    'sponsored opportunity statuses support full lifecycle',
    exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'chatearn_sponsored_opportunities'
        and c.conname = 'chatearn_sponsored_opportunities_status_check'
        and pg_get_constraintdef(c.oid) like '%presented%'
        and pg_get_constraintdef(c.oid) like '%opened%'
        and pg_get_constraintdef(c.oid) like '%returned%'
        and pg_get_constraintdef(c.oid) like '%verified%'
        and pg_get_constraintdef(c.oid) like '%credited%'
        and pg_get_constraintdef(c.oid) like '%expired%'
        and pg_get_constraintdef(c.oid) like '%rejected%'
    ),
    coalesce((
      select pg_get_constraintdef(c.oid)
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'chatearn_sponsored_opportunities'
        and c.conname = 'chatearn_sponsored_opportunities_status_check'
    ), 'missing'),
    'presented/opened/returned/verified/credited/expired/rejected allowed'

  union all

  select
    'sponsored TTL setting exists',
    exists (
      select 1 from public.chatearn_settings
      where setting_key = 'sponsored_opportunity_ttl_hours'
    ),
    coalesce((
      select value::text from public.chatearn_settings
      where setting_key = 'sponsored_opportunity_ttl_hours'
    ), 'missing'),
    'positive hour value exists'

  union all

  select
    'sponsored tables do not allow authenticated mutations',
    not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename in ('chatearn_sponsored_opportunities', 'chatearn_sponsored_slots')
        and 'authenticated' = any(p.roles)
        and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    ),
    coalesce((
      select string_agg(p.tablename || ':' || p.cmd, ', ' order by p.tablename, p.cmd)
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename in ('chatearn_sponsored_opportunities', 'chatearn_sponsored_slots')
        and 'authenticated' = any(p.roles)
        and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    ), 'none'),
    'none'
)
select
  case when passed then 'pass' else 'blocking' end as severity,
  check_name,
  passed,
  observed,
  expected
from checks
order by passed, check_name;
