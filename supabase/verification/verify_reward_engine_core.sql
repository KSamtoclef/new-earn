-- ChatEarn Module 4A verification.
-- Read-only: safe to run after 20260717221500_reward_engine_core.sql.

with checks as (
  select 'blocking'::text as severity,
         'reward columns exist'::text as check_name,
         (
           select count(*) = 2
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'chatearn_conversation_messages'
             and column_name in ('reward_ledger_id','rewarded_at')
         ) as passed,
         (
           select count(*)::text
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'chatearn_conversation_messages'
             and column_name in ('reward_ledger_id','rewarded_at')
         ) as observed,
         '2'::text as expected

  union all

  select 'blocking',
         'reward ledger foreign key exists',
         exists (
           select 1
           from pg_constraint c
           join pg_class t on t.oid = c.conrelid
           join pg_namespace n on n.oid = t.relnamespace
           where n.nspname = 'public'
             and t.relname = 'chatearn_conversation_messages'
             and c.conname = 'chatearn_conversation_messages_reward_ledger_id_fkey'
             and c.contype = 'f'
         ),
         coalesce((
           select pg_get_constraintdef(c.oid)
           from pg_constraint c
           join pg_class t on t.oid = c.conrelid
           join pg_namespace n on n.oid = t.relnamespace
           where n.nspname = 'public'
             and t.relname = 'chatearn_conversation_messages'
             and c.conname = 'chatearn_conversation_messages_reward_ledger_id_fkey'
           limit 1
         ), 'missing'),
         'foreign key to chatearn_wallet_ledger'

  union all

  select 'blocking',
         'reward source remains unique',
         exists (
           select 1
           from pg_indexes
           where schemaname = 'public'
             and tablename = 'chatearn_wallet_ledger'
             and indexname = 'chatearn_wallet_ledger_source_unique'
         ),
         coalesce((
           select indexdef
           from pg_indexes
           where schemaname = 'public'
             and tablename = 'chatearn_wallet_ledger'
             and indexname = 'chatearn_wallet_ledger_source_unique'
         ), 'missing'),
         'unique source_table/source_id index'

  union all

  select 'blocking',
         'module 4 settings exist',
         (
           select count(*) = 3
           from public.chatearn_settings
           where setting_key in (
             'chat_rewards_enabled',
             'sponsored_rewards_enabled',
             'first_withdrawal_threshold'
           )
         ),
         (
           select count(*)::text
           from public.chatearn_settings
           where setting_key in (
             'chat_rewards_enabled',
             'sponsored_rewards_enabled',
             'first_withdrawal_threshold'
           )
         ),
         '3'

  union all

  select 'blocking',
         'private chat credit function exists',
         to_regprocedure('chatearn_private.credit_chat_message(uuid,uuid)') is not null,
         coalesce(to_regprocedure('chatearn_private.credit_chat_message(uuid,uuid)')::text, 'missing'),
         'chatearn_private.credit_chat_message(uuid,uuid)'

  union all

  select 'blocking',
         'public claim RPC exists',
         to_regprocedure('public.chatearn_claim_chat_reward(uuid)') is not null,
         coalesce(to_regprocedure('public.chatearn_claim_chat_reward(uuid)')::text, 'missing'),
         'chatearn_claim_chat_reward(uuid)'

  union all

  select 'blocking',
         'reward state RPC exists',
         to_regprocedure('public.chatearn_get_reward_state()') is not null,
         coalesce(to_regprocedure('public.chatearn_get_reward_state()')::text, 'missing'),
         'chatearn_get_reward_state()'

  union all

  select 'blocking',
         'authenticated may execute public reward RPCs',
         has_function_privilege(
           'authenticated',
           'public.chatearn_claim_chat_reward(uuid)',
           'EXECUTE'
         )
         and has_function_privilege(
           'authenticated',
           'public.chatearn_get_reward_state()',
           'EXECUTE'
         ),
         format(
           'claim=%s state=%s',
           has_function_privilege(
             'authenticated',
             'public.chatearn_claim_chat_reward(uuid)',
             'EXECUTE'
           ),
           has_function_privilege(
             'authenticated',
             'public.chatearn_get_reward_state()',
             'EXECUTE'
           )
         ),
         'claim=true state=true'

  union all

  select 'blocking',
         'anon cannot execute public reward RPCs',
         not has_function_privilege(
           'anon',
           'public.chatearn_claim_chat_reward(uuid)',
           'EXECUTE'
         )
         and not has_function_privilege(
           'anon',
           'public.chatearn_get_reward_state()',
           'EXECUTE'
         ),
         format(
           'claim=%s state=%s',
           has_function_privilege(
             'anon',
             'public.chatearn_claim_chat_reward(uuid)',
             'EXECUTE'
           ),
           has_function_privilege(
             'anon',
             'public.chatearn_get_reward_state()',
             'EXECUTE'
           )
         ),
         'claim=false state=false'

  union all

  select 'blocking',
         'client cannot directly mutate wallet ledger',
         not has_table_privilege('authenticated', 'public.chatearn_wallet_ledger', 'INSERT')
         and not has_table_privilege('authenticated', 'public.chatearn_wallet_ledger', 'UPDATE')
         and not has_table_privilege('authenticated', 'public.chatearn_wallet_ledger', 'DELETE'),
         format(
           'insert=%s update=%s delete=%s',
           has_table_privilege('authenticated', 'public.chatearn_wallet_ledger', 'INSERT'),
           has_table_privilege('authenticated', 'public.chatearn_wallet_ledger', 'UPDATE'),
           has_table_privilege('authenticated', 'public.chatearn_wallet_ledger', 'DELETE')
         ),
         'insert=false update=false delete=false'

  union all

  select 'blocking',
         'chat credit uses canonical wallet writer',
         position(
           'chatearn_private.append_wallet_entry' in
           pg_get_functiondef(
             'chatearn_private.credit_chat_message(uuid,uuid)'::regprocedure
           )
         ) > 0,
         case when position(
           'chatearn_private.append_wallet_entry' in
           pg_get_functiondef(
             'chatearn_private.credit_chat_message(uuid,uuid)'::regprocedure
           )
         ) > 0 then 'canonical writer referenced' else 'writer missing' end,
         'canonical writer referenced'

  union all

  select 'blocking',
         'threshold pause updates journey flags together',
         position(
           'earnings_paused = true' in
           pg_get_functiondef(
             'chatearn_private.apply_first_withdrawal_pause(uuid,bigint)'::regprocedure
           )
         ) > 0
         and position(
           'sponsored_rewards_paused = true' in
           pg_get_functiondef(
             'chatearn_private.apply_first_withdrawal_pause(uuid,bigint)'::regprocedure
           )
         ) > 0,
         'function definition inspected',
         'both pause flags updated'
)
select severity, check_name, passed, observed, expected
from checks
order by case severity when 'blocking' then 1 else 2 end, check_name;
