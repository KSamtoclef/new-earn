-- ChatEarn Module 2 verification
-- Uses a temporary result table only. No permanent application data is changed.

begin;

create temporary table chatearn_account_verification_results (
  check_name text not null,
  passed boolean not null,
  observed text not null,
  expected text not null,
  severity text not null check (severity in ('blocking', 'warning'))
) on commit drop;

insert into chatearn_account_verification_results
select
  'canonical user profile table exists',
  to_regclass('public.chatearn_user_profiles') is not null,
  coalesce(to_regclass('public.chatearn_user_profiles')::text, 'missing'),
  'chatearn_user_profiles',
  'blocking';

insert into chatearn_account_verification_results
select
  'canonical user profiles have RLS enabled',
  count(*) = 1 and bool_and(c.relrowsecurity),
  format('tables=%s all_rls=%s', count(*), coalesce(bool_and(c.relrowsecurity), false)),
  'tables=1 all_rls=true',
  'blocking'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'chatearn_user_profiles';

insert into chatearn_account_verification_results
select
  'no client mutation grants on user profiles',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'chatearn_user_profiles'
  and grantee in ('anon', 'authenticated', 'PUBLIC')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES');

insert into chatearn_account_verification_results
select
  'profile RLS policies do not allow client mutations',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from pg_policies
where schemaname = 'public'
  and tablename = 'chatearn_user_profiles'
  and cmd <> 'SELECT';

insert into chatearn_account_verification_results
select
  'Auth registration trigger is enabled',
  count(*) = 1 and bool_and(t.tgenabled in ('O', 'A')),
  format('triggers=%s enabled=%s', count(*), coalesce(bool_and(t.tgenabled in ('O', 'A')), false)),
  'triggers=1 enabled=true',
  'blocking'
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth'
  and c.relname = 'users'
  and t.tgname = 'chatearn_auth_user_created'
  and not t.tgisinternal;

insert into chatearn_account_verification_results
select
  'Auth trigger does not issue wallet credits',
  count(*) = 1
    and bool_and(position('ensure_signup_credit' in pg_get_functiondef(p.oid)) = 0)
    and bool_and(position('append_wallet_entry' in pg_get_functiondef(p.oid)) = 0),
  format(
    'functions=%s wallet_writer_references=%s',
    count(*),
    count(*) filter (
      where position('ensure_signup_credit' in pg_get_functiondef(p.oid)) > 0
         or position('append_wallet_entry' in pg_get_functiondef(p.oid)) > 0
    )
  ),
  'functions=1 wallet_writer_references=0',
  'blocking'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'chatearn_private'
  and p.proname = 'handle_auth_user_created'
  and p.pronargs = 0;

insert into chatearn_account_verification_results
select
  'all Auth users have canonical profiles',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from auth.users u
left join public.chatearn_user_profiles p on p.user_id = u.id
where p.user_id is null;

insert into chatearn_account_verification_results
select
  'all Auth users have journey state',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from auth.users u
left join public.chatearn_user_journeys j on j.user_id = u.id
where j.user_id is null;

insert into chatearn_account_verification_results
select
  'no canonical profiles without Auth users',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from public.chatearn_user_profiles p
left join auth.users u on u.id = p.user_id
where u.id is null;

insert into chatearn_account_verification_results
select
  'bootstrap RPC privilege boundary',
  has_function_privilege(
    'authenticated',
    'public.chatearn_bootstrap_account(text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.chatearn_bootstrap_account(text)',
    'EXECUTE'
  ),
  format(
    'authenticated=%s anon=%s',
    has_function_privilege(
      'authenticated',
      'public.chatearn_bootstrap_account(text)',
      'EXECUTE'
    ),
    has_function_privilege(
      'anon',
      'public.chatearn_bootstrap_account(text)',
      'EXECUTE'
    )
  ),
  'authenticated=true anon=false',
  'blocking';

insert into chatearn_account_verification_results
select
  'application-state RPC privilege boundary',
  has_function_privilege(
    'authenticated',
    'public.chatearn_get_app_state()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.chatearn_get_app_state()',
    'EXECUTE'
  ),
  format(
    'authenticated=%s anon=%s',
    has_function_privilege(
      'authenticated',
      'public.chatearn_get_app_state()',
      'EXECUTE'
    ),
    has_function_privilege(
      'anon',
      'public.chatearn_get_app_state()',
      'EXECUTE'
    )
  ),
  'authenticated=true anon=false',
  'blocking';

insert into chatearn_account_verification_results
select
  'public account RPCs are security definer functions',
  count(*) = 2 and bool_and(p.prosecdef),
  format('functions=%s all_security_definer=%s', count(*), coalesce(bool_and(p.prosecdef), false)),
  'functions=2 all_security_definer=true',
  'blocking'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('chatearn_bootstrap_account', 'chatearn_get_app_state');

insert into chatearn_account_verification_results
select
  'private account writers are not client executable',
  not has_function_privilege(
    'authenticated',
    'chatearn_private.initialize_account_base(uuid,text,text,timestamptz,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'chatearn_private.ensure_signup_credit(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'chatearn_private.initialize_account_base(uuid,text,text,timestamptz,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'chatearn_private.ensure_signup_credit(uuid)',
    'EXECUTE'
  ),
  format(
    'authenticated_base=%s authenticated_credit=%s anon_base=%s anon_credit=%s',
    has_function_privilege(
      'authenticated',
      'chatearn_private.initialize_account_base(uuid,text,text,timestamptz,jsonb)',
      'EXECUTE'
    ),
    has_function_privilege(
      'authenticated',
      'chatearn_private.ensure_signup_credit(uuid)',
      'EXECUTE'
    ),
    has_function_privilege(
      'anon',
      'chatearn_private.initialize_account_base(uuid,text,text,timestamptz,jsonb)',
      'EXECUTE'
    ),
    has_function_privilege(
      'anon',
      'chatearn_private.ensure_signup_credit(uuid)',
      'EXECUTE'
    )
  ),
  'authenticated_base=false authenticated_credit=false anon_base=false anon_credit=false',
  'blocking';

insert into chatearn_account_verification_results
select
  'one signup credit per user',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from (
  select l.user_id
  from public.chatearn_wallet_ledger l
  where l.direction = 'credit'
    and l.entry_type = 'signup_bonus'
  group by l.user_id
  having count(*) > 1
) duplicate_signup_credits;

insert into chatearn_account_verification_results
select
  'signup bonus setting is positive',
  count(*) = 1
    and min((s.value #>> '{}')::bigint) > 0,
  format(
    'rows=%s amount=%s',
    count(*),
    coalesce(min((s.value #>> '{}')::bigint), 0)
  ),
  'rows=1 amount>0',
  'blocking'
from public.chatearn_settings s
where s.setting_key = 'signup_bonus';

do $$
declare
  v_backfill_completed boolean := false;
  v_mismatches bigint := 0;
begin
  select coalesce((s.value ->> 'completed')::boolean, false)
  into v_backfill_completed
  from public.chatearn_settings s
  where s.setting_key = 'legacy_backfill_state';

  if to_regclass('public.chatearn_profiles') is not null
     and coalesce(v_backfill_completed, false) then
    execute $sql$
      select count(*)
      from public.chatearn_profiles p
      join auth.users u on u.id = p.user_id
      join public.chatearn_user_journeys j on j.user_id = p.user_id
      cross join lateral (
        select coalesce((
          select (s.value #>> '{}')::bigint
          from public.chatearn_settings s
          where s.setting_key = 'first_withdrawal_minimum'
        ), 40000) as amount
      ) minimum
      where (
          coalesce(p.status, 'active') <> 'active'
          or p.balance >= minimum.amount
        )
        and j.journey_state = 'earning_enabled'
        and j.first_withdrawal_gate_passed = false
        and j.active_withdrawal_id is null
        and j.active_partner_key is null
        and j.version = 1
    $sql$
    into v_mismatches;

    insert into chatearn_account_verification_results values (
      'legacy default journeys were classified',
      v_mismatches = 0,
      v_mismatches::text,
      '0',
      'blocking'
    );
  else
    insert into chatearn_account_verification_results values (
      'legacy journey classification compatibility',
      true,
      'legacy backfill not completed in this environment',
      'not applicable before snapshot backfill',
      'warning'
    );
  end if;
end;
$$;

select
  severity,
  check_name,
  passed,
  observed,
  expected
from chatearn_account_verification_results
order by
  case severity when 'blocking' then 0 else 1 end,
  passed,
  check_name;

rollback;
