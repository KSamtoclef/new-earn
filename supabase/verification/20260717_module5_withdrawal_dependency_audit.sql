-- ChatEarn Module 5 dependency audit (read-only)
-- Run this in Supabase SQL Editor and export the single JSON result.

with target_tables as (
  select c.oid, n.nspname as schema_name, c.relname as object_name, c.relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','chatearn_private')
    and (
      c.relname ilike '%withdraw%'
      or c.relname ilike '%wallet%'
      or c.relname ilike '%kyc%'
      or c.relname ilike '%journey%'
      or c.relname ilike '%payout%'
      or c.relname ilike '%bank%'
      or c.relname ilike '%profile%'
    )
), columns_json as (
  select jsonb_agg(jsonb_build_object(
    'schema_name', table_schema,
    'object_name', table_name,
    'column_name', column_name,
    'data_type', data_type,
    'udt_name', udt_name,
    'is_nullable', is_nullable,
    'column_default', column_default,
    'ordinal_position', ordinal_position
  ) order by table_schema, table_name, ordinal_position) as data
  from information_schema.columns
  where table_schema in ('public','chatearn_private')
    and (
      table_name ilike '%withdraw%'
      or table_name ilike '%wallet%'
      or table_name ilike '%kyc%'
      or table_name ilike '%journey%'
      or table_name ilike '%payout%'
      or table_name ilike '%bank%'
      or table_name ilike '%profile%'
    )
), constraints_json as (
  select jsonb_agg(jsonb_build_object(
    'schema_name', n.nspname,
    'object_name', c.relname,
    'constraint_name', con.conname,
    'constraint_type', con.contype,
    'definition', pg_get_constraintdef(con.oid, true)
  ) order by n.nspname, c.relname, con.conname) as data
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','chatearn_private')
    and (
      c.relname ilike '%withdraw%'
      or c.relname ilike '%wallet%'
      or c.relname ilike '%kyc%'
      or c.relname ilike '%journey%'
      or c.relname ilike '%payout%'
      or c.relname ilike '%bank%'
      or c.relname ilike '%profile%'
    )
), indexes_json as (
  select jsonb_agg(jsonb_build_object(
    'schema_name', schemaname,
    'object_name', tablename,
    'index_name', indexname,
    'definition', indexdef
  ) order by schemaname, tablename, indexname) as data
  from pg_indexes
  where schemaname in ('public','chatearn_private')
    and (
      tablename ilike '%withdraw%'
      or tablename ilike '%wallet%'
      or tablename ilike '%kyc%'
      or tablename ilike '%journey%'
      or tablename ilike '%payout%'
      or tablename ilike '%bank%'
      or tablename ilike '%profile%'
    )
), functions_json as (
  select jsonb_agg(jsonb_build_object(
    'schema_name', n.nspname,
    'function_name', p.proname,
    'identity_arguments', pg_get_function_identity_arguments(p.oid),
    'result_type', pg_get_function_result(p.oid),
    'security_definer', p.prosecdef,
    'definition', pg_get_functiondef(p.oid)
  ) order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as data
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','chatearn_private')
    and (
      p.proname ilike '%withdraw%'
      or p.proname ilike '%wallet%'
      or p.proname ilike '%kyc%'
      or p.proname ilike '%journey%'
      or p.proname ilike '%payout%'
      or p.proname ilike '%bank%'
    )
), policies_json as (
  select jsonb_agg(jsonb_build_object(
    'schema_name', schemaname,
    'object_name', tablename,
    'policy_name', policyname,
    'roles', roles,
    'command', cmd,
    'using_expression', qual,
    'check_expression', with_check
  ) order by schemaname, tablename, policyname) as data
  from pg_policies
  where schemaname in ('public','chatearn_private')
    and (
      tablename ilike '%withdraw%'
      or tablename ilike '%wallet%'
      or tablename ilike '%kyc%'
      or tablename ilike '%journey%'
      or tablename ilike '%payout%'
      or tablename ilike '%bank%'
      or tablename ilike '%profile%'
    )
)
select jsonb_pretty(jsonb_build_object(
  'generated_at', now(),
  'objects', coalesce((select jsonb_agg(jsonb_build_object(
    'schema_name', schema_name,
    'object_name', object_name,
    'relkind', relkind
  ) order by schema_name, object_name) from target_tables), '[]'::jsonb),
  'columns', coalesce((select data from columns_json), '[]'::jsonb),
  'constraints', coalesce((select data from constraints_json), '[]'::jsonb),
  'indexes', coalesce((select data from indexes_json), '[]'::jsonb),
  'functions', coalesce((select data from functions_json), '[]'::jsonb),
  'policies', coalesce((select data from policies_json), '[]'::jsonb)
)) as module5_withdrawal_dependency_audit;
