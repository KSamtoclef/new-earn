-- Module 5B verification: admin withdrawal processing engine
with checks as (
  select 1 as ord,'blocking'::text severity,'admin authorization helper exists'::text check_name,
    to_regprocedure('chatearn_private.is_withdrawal_admin()') is not null passed,
    coalesce(to_regprocedure('chatearn_private.is_withdrawal_admin()')::text,'missing') observed,
    'present'::text expected
  union all
  select 2,'blocking','admin transition RPC exists',
    to_regprocedure('public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid)') is not null,
    coalesce(to_regprocedure('public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid)')::text,'missing'),'present'
  union all
  select 3,'blocking','admin queue RPC exists',
    to_regprocedure('public.chatearn_admin_list_withdrawals_v5(text,integer,integer)') is not null,
    coalesce(to_regprocedure('public.chatearn_admin_list_withdrawals_v5(text,integer,integer)')::text,'missing'),'present'
  union all
  select 4,'blocking','transition RPC privilege boundary',
    has_function_privilege('authenticated','public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid)','EXECUTE')
      and not has_function_privilege('anon','public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid)','EXECUTE'),
    'authenticated='||has_function_privilege('authenticated','public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid)','EXECUTE')||
      ' anon='||has_function_privilege('anon','public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid)','EXECUTE'),
    'authenticated=true anon=false'
  union all
  select 5,'blocking','queue RPC privilege boundary',
    has_function_privilege('authenticated','public.chatearn_admin_list_withdrawals_v5(text,integer,integer)','EXECUTE')
      and not has_function_privilege('anon','public.chatearn_admin_list_withdrawals_v5(text,integer,integer)','EXECUTE'),
    'authenticated='||has_function_privilege('authenticated','public.chatearn_admin_list_withdrawals_v5(text,integer,integer)','EXECUTE')||
      ' anon='||has_function_privilege('anon','public.chatearn_admin_list_withdrawals_v5(text,integer,integer)','EXECUTE'),
    'authenticated=true anon=false'
  union all
  select 6,'blocking','admin helper is not callable by clients',
    not has_function_privilege('authenticated','chatearn_private.is_withdrawal_admin()','EXECUTE')
      and not has_function_privilege('anon','chatearn_private.is_withdrawal_admin()','EXECUTE'),
    'authenticated='||has_function_privilege('authenticated','chatearn_private.is_withdrawal_admin()','EXECUTE')||
      ' anon='||has_function_privilege('anon','chatearn_private.is_withdrawal_admin()','EXECUTE'),
    'authenticated=false anon=false'
  union all
  select 7,'blocking','wallet settlement writer remains private',
    not has_function_privilege('authenticated','chatearn_private.write_canonical_wallet_entry(uuid,uuid,bigint,bigint,text,text,text[],jsonb)','EXECUTE')
      and not has_function_privilege('anon','chatearn_private.write_canonical_wallet_entry(uuid,uuid,bigint,bigint,text,text,text[],jsonb)','EXECUTE'),
    'authenticated='||has_function_privilege('authenticated','chatearn_private.write_canonical_wallet_entry(uuid,uuid,bigint,bigint,text,text,text[],jsonb)','EXECUTE')||
      ' anon='||has_function_privilege('anon','chatearn_private.write_canonical_wallet_entry(uuid,uuid,bigint,bigint,text,text,text[],jsonb)','EXECUTE'),
    'authenticated=false anon=false'
  union all
  select 8,'blocking','withdrawal enum supports processing',
    exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname='public' and t.typname='withdrawal_status' and e.enumlabel='processing'),
    coalesce((select string_agg(e.enumlabel,',' order by e.enumsortorder) from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname='public' and t.typname='withdrawal_status'),'missing'),
    'contains processing'
  union all
  select 9,'blocking','withdrawal enum has terminal success state',
    exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname='public' and t.typname='withdrawal_status' and e.enumlabel in ('paid','completed','complete')),
    coalesce((select string_agg(e.enumlabel,',' order by e.enumsortorder) from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname='public' and t.typname='withdrawal_status'),'missing'),
    'contains paid/completed'
  union all
  select 10,'blocking','withdrawal enum has terminal failure state',
    exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname='public' and t.typname='withdrawal_status' and e.enumlabel in ('rejected','declined','cancelled','canceled')),
    coalesce((select string_agg(e.enumlabel,',' order by e.enumsortorder) from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname='public' and t.typname='withdrawal_status'),'missing'),
    'contains rejection/cancellation'
)
select severity,check_name,passed,observed,expected
from checks
order by ord;
