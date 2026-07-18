-- Module 5C verification: normalized frontend withdrawal API
with checks as (
  select 'blocking'::text severity,
         'status UI helper exists'::text check_name,
         to_regprocedure('chatearn_private.withdrawal_status_ui(text)') is not null passed,
         coalesce(to_regprocedure('chatearn_private.withdrawal_status_ui(text)')::text,'missing') observed,
         'present'::text expected

  union all
  select 'blocking','payout accounts RPC exists',
         to_regprocedure('public.chatearn_get_payout_accounts_v5()') is not null,
         coalesce(to_regprocedure('public.chatearn_get_payout_accounts_v5()')::text,'missing'),'present'

  union all
  select 'blocking','submit wrapper RPC exists',
         to_regprocedure('public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text)') is not null,
         coalesce(to_regprocedure('public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text)')::text,'missing'),'present'

  union all
  select 'blocking','withdrawal portal RPC exists',
         to_regprocedure('public.chatearn_get_withdrawal_portal_v5()') is not null,
         coalesce(to_regprocedure('public.chatearn_get_withdrawal_portal_v5()')::text,'missing'),'present'

  union all
  select 'blocking','status helper is private',
         not has_function_privilege('authenticated','chatearn_private.withdrawal_status_ui(text)','execute')
         and not has_function_privilege('anon','chatearn_private.withdrawal_status_ui(text)','execute'),
         format('authenticated=%s anon=%s',
           has_function_privilege('authenticated','chatearn_private.withdrawal_status_ui(text)','execute'),
           has_function_privilege('anon','chatearn_private.withdrawal_status_ui(text)','execute')),
         'authenticated=false anon=false'

  union all
  select 'blocking','payout accounts RPC privilege boundary',
         has_function_privilege('authenticated','public.chatearn_get_payout_accounts_v5()','execute')
         and not has_function_privilege('anon','public.chatearn_get_payout_accounts_v5()','execute'),
         format('authenticated=%s anon=%s',
           has_function_privilege('authenticated','public.chatearn_get_payout_accounts_v5()','execute'),
           has_function_privilege('anon','public.chatearn_get_payout_accounts_v5()','execute')),
         'authenticated=true anon=false'

  union all
  select 'blocking','submit wrapper privilege boundary',
         has_function_privilege('authenticated','public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text)','execute')
         and not has_function_privilege('anon','public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text)','execute'),
         format('authenticated=%s anon=%s',
           has_function_privilege('authenticated','public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text)','execute'),
           has_function_privilege('anon','public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text)','execute')),
         'authenticated=true anon=false'

  union all
  select 'blocking','portal RPC privilege boundary',
         has_function_privilege('authenticated','public.chatearn_get_withdrawal_portal_v5()','execute')
         and not has_function_privilege('anon','public.chatearn_get_withdrawal_portal_v5()','execute'),
         format('authenticated=%s anon=%s',
           has_function_privilege('authenticated','public.chatearn_get_withdrawal_portal_v5()','execute'),
           has_function_privilege('anon','public.chatearn_get_withdrawal_portal_v5()','execute')),
         'authenticated=true anon=false'

  union all
  select 'blocking','portal does not expose full account number',
         position('account_number' in pg_get_functiondef('public.chatearn_get_withdrawal_portal_v5()'::regprocedure)) = 0,
         case when position('account_number' in pg_get_functiondef('public.chatearn_get_withdrawal_portal_v5()'::regprocedure)) = 0 then 'not exposed' else 'account_number referenced' end,
         'not exposed'

  union all
  select 'blocking','payout RPC masks account details',
         position('masked_account' in pg_get_functiondef('public.chatearn_get_payout_accounts_v5()'::regprocedure)) > 0
         and position('account_last4' in pg_get_functiondef('public.chatearn_get_payout_accounts_v5()'::regprocedure)) > 0,
         'masked_account and account_last4 checked',
         'both present'
)
select severity,check_name,passed,observed,expected
from checks
order by case when severity='blocking' then 0 else 1 end,check_name;
