with checks as (
  select 1 as ord,'blocking'::text severity,'canonical withdrawal tables exist'::text check_name,
    (select count(*)=7 from information_schema.tables where table_schema='public' and table_name in ('wallets','wallet_ledger','withdrawals','withdrawal_rules','withdrawal_progress','withdrawal_status_history','payout_accounts')) passed,
    (select count(*)::text from information_schema.tables where table_schema='public' and table_name in ('wallets','wallet_ledger','withdrawals','withdrawal_rules','withdrawal_progress','withdrawal_status_history','payout_accounts')) observed,'7' expected
  union all
  select 2,'blocking','withdrawal request RPC exists',
    to_regprocedure('public.chatearn_request_withdrawal_v5(uuid,bigint,text,text)') is not null,
    coalesce(to_regprocedure('public.chatearn_request_withdrawal_v5(uuid,bigint,text,text)')::text,'missing'),'present'
  union all
  select 3,'blocking','withdrawal state RPC exists',
    to_regprocedure('public.chatearn_get_withdrawal_state_v5()') is not null,
    coalesce(to_regprocedure('public.chatearn_get_withdrawal_state_v5()')::text,'missing'),'present'
  union all
  select 4,'blocking','wallet writer is private',
    not has_function_privilege('anon','chatearn_private.write_canonical_wallet_entry(uuid,uuid,bigint,bigint,text,text,text[],jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','chatearn_private.write_canonical_wallet_entry(uuid,uuid,bigint,bigint,text,text,text[],jsonb)','EXECUTE'),
    format('anon=%s authenticated=%s',has_function_privilege('anon','chatearn_private.write_canonical_wallet_entry(uuid,uuid,bigint,bigint,text,text,text[],jsonb)','EXECUTE'),has_function_privilege('authenticated','chatearn_private.write_canonical_wallet_entry(uuid,uuid,bigint,bigint,text,text,text[],jsonb)','EXECUTE')),
    'anon=false authenticated=false'
  union all
  select 5,'blocking','request RPC privilege boundary',
    has_function_privilege('authenticated','public.chatearn_request_withdrawal_v5(uuid,bigint,text,text)','EXECUTE')
    and not has_function_privilege('anon','public.chatearn_request_withdrawal_v5(uuid,bigint,text,text)','EXECUTE'),
    format('authenticated=%s anon=%s',has_function_privilege('authenticated','public.chatearn_request_withdrawal_v5(uuid,bigint,text,text)','EXECUTE'),has_function_privilege('anon','public.chatearn_request_withdrawal_v5(uuid,bigint,text,text)','EXECUTE')),
    'authenticated=true anon=false'
  union all
  select 6,'blocking','withdrawal enum supports active states',
    (select count(*)=6 from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='withdrawal_status' and e.enumlabel in ('submitted','sharing_required','kyc_required','under_review','processing','needs_action')),
    (select count(*)::text from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='withdrawal_status' and e.enumlabel in ('submitted','sharing_required','kyc_required','under_review','processing','needs_action')),'6'
  union all
  select 7,'blocking','wallet enums expose withdrawal-compatible labels',
    chatearn_private.pick_enum_label('wallet_entry_kind',array['withdrawal_hold','hold','withdrawal_reserved','reserve']) is not null
    and chatearn_private.pick_enum_label('wallet_source_type',array['withdrawal','withdrawals','payout']) is not null,
    format('kind=%s source=%s',coalesce(chatearn_private.pick_enum_label('wallet_entry_kind',array['withdrawal_hold','hold','withdrawal_reserved','reserve']),'missing'),coalesce(chatearn_private.pick_enum_label('wallet_source_type',array['withdrawal','withdrawals','payout']),'missing')),
    'both present'
  union all
  select 8,'blocking','one-open-withdrawal index exists',
    exists(select 1 from pg_indexes where schemaname='public' and tablename='withdrawals' and indexname='withdrawals_one_open_idx'),
    coalesce((select indexname from pg_indexes where schemaname='public' and tablename='withdrawals' and indexname='withdrawals_one_open_idx'),'missing'),'withdrawals_one_open_idx'
  union all
  select 9,'blocking','withdrawal idempotency index exists',
    exists(select 1 from pg_indexes where schemaname='public' and tablename='withdrawals' and indexdef ilike '%user_id%idempotency_key%'),
    coalesce((select indexname from pg_indexes where schemaname='public' and tablename='withdrawals' and indexdef ilike '%user_id%idempotency_key%' limit 1),'missing'),'present'
)
select severity,check_name,passed,observed,expected from checks order by ord;
