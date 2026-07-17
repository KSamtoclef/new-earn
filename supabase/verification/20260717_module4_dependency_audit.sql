-- ChatEarn Module 4 dependency audit (read-only)
-- Run this once in Supabase SQL Editor and send back the complete result.
-- This script does not create, alter, grant, revoke, insert, update, or delete anything.

with relevant_tables as (
  select
    n.nspname as schema_name,
    c.relname as object_name,
    case c.relkind
      when 'r' then 'table'
      when 'p' then 'partitioned table'
      when 'v' then 'view'
      when 'm' then 'materialized view'
      else c.relkind::text
    end as object_type,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'chatearn_private')
    and c.relkind in ('r', 'p', 'v', 'm')
    and (
      c.relname ilike 'chatearn_%'
      or c.relname ilike '%wallet%'
      or c.relname ilike '%ledger%'
      or c.relname ilike '%reward%'
      or c.relname ilike '%profile%'
      or c.relname ilike '%conversation%'
    )
),
relevant_columns as (
  select
    table_schema as schema_name,
    table_name as object_name,
    ordinal_position,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
  from information_schema.columns
  where table_schema in ('public', 'chatearn_private')
    and (
      table_name ilike 'chatearn_%'
      or table_name ilike '%wallet%'
      or table_name ilike '%ledger%'
      or table_name ilike '%reward%'
      or table_name ilike '%profile%'
      or table_name ilike '%conversation%'
    )
),
relevant_functions as (
  select
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_function_result(p.oid) as return_type,
    l.lanname as language,
    p.prosecdef as security_definer,
    p.provolatile as volatility,
    pg_get_userbyid(p.proowner) as owner_name,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname in ('public', 'chatearn_private')
    and (
      p.proname ilike 'chatearn_%'
      or p.proname ilike '%wallet%'
      or p.proname ilike '%ledger%'
      or p.proname ilike '%reward%'
      or p.proname ilike '%credit%'
      or p.proname ilike '%balance%'
    )
),
relevant_policies as (
  select
    schemaname as schema_name,
    tablename as object_name,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
  from pg_policies
  where schemaname in ('public', 'chatearn_private')
    and (
      tablename ilike 'chatearn_%'
      or tablename ilike '%wallet%'
      or tablename ilike '%ledger%'
      or tablename ilike '%reward%'
      or tablename ilike '%profile%'
      or tablename ilike '%conversation%'
    )
),
relevant_constraints as (
  select
    n.nspname as schema_name,
    c.relname as object_name,
    con.conname as constraint_name,
    con.contype as constraint_type,
    pg_get_constraintdef(con.oid, true) as definition
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'chatearn_private')
    and (
      c.relname ilike 'chatearn_%'
      or c.relname ilike '%wallet%'
      or c.relname ilike '%ledger%'
      or c.relname ilike '%reward%'
      or c.relname ilike '%profile%'
      or c.relname ilike '%conversation%'
    )
),
relevant_indexes as (
  select
    schemaname as schema_name,
    tablename as object_name,
    indexname,
    indexdef
  from pg_indexes
  where schemaname in ('public', 'chatearn_private')
    and (
      tablename ilike 'chatearn_%'
      or tablename ilike '%wallet%'
      or tablename ilike '%ledger%'
      or tablename ilike '%reward%'
      or tablename ilike '%profile%'
      or tablename ilike '%conversation%'
    )
),
relevant_triggers as (
  select
    event_object_schema as schema_name,
    event_object_table as object_name,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
  from information_schema.triggers
  where event_object_schema in ('public', 'chatearn_private')
    and (
      event_object_table ilike 'chatearn_%'
      or event_object_table ilike '%wallet%'
      or event_object_table ilike '%ledger%'
      or event_object_table ilike '%reward%'
      or event_object_table ilike '%profile%'
      or event_object_table ilike '%conversation%'
    )
)
select jsonb_pretty(
  jsonb_build_object(
    'generated_at', now(),
    'tables', coalesce((select jsonb_agg(to_jsonb(t) order by schema_name, object_name) from relevant_tables t), '[]'::jsonb),
    'columns', coalesce((select jsonb_agg(to_jsonb(c) order by schema_name, object_name, ordinal_position) from relevant_columns c), '[]'::jsonb),
    'functions', coalesce((select jsonb_agg(to_jsonb(f) order by schema_name, function_name, identity_arguments) from relevant_functions f), '[]'::jsonb),
    'policies', coalesce((select jsonb_agg(to_jsonb(p) order by schema_name, object_name, policyname) from relevant_policies p), '[]'::jsonb),
    'constraints', coalesce((select jsonb_agg(to_jsonb(c) order by schema_name, object_name, constraint_name) from relevant_constraints c), '[]'::jsonb),
    'indexes', coalesce((select jsonb_agg(to_jsonb(i) order by schema_name, object_name, indexname) from relevant_indexes i), '[]'::jsonb),
    'triggers', coalesce((select jsonb_agg(to_jsonb(t) order by schema_name, object_name, trigger_name) from relevant_triggers t), '[]'::jsonb)
  )
) as module4_dependency_audit;
