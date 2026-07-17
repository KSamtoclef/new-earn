-- ChatEarn Module 1 verification
-- Read-only against permanent data. Results must all show passed = true before cutover.

begin;

create temporary table chatearn_verification_results (
  check_name text not null,
  passed boolean not null,
  observed text not null,
  expected text not null,
  severity text not null check (severity in ('blocking', 'warning'))
) on commit drop;

insert into chatearn_verification_results
select
  'canonical public tables exist',
  count(*) = 11,
  count(*)::text,
  '11',
  'blocking'
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'chatearn_admin_roles',
    'chatearn_settings',
    'chatearn_wallet_ledger',
    'chatearn_user_journeys',
    'chatearn_withdrawal_journeys',
    'chatearn_conversation_states',
    'chatearn_sponsored_slots',
    'chatearn_sponsored_opportunities',
    'chatearn_kyc_submissions',
    'chatearn_kyc_documents',
    'chatearn_audit_log'
  );

insert into chatearn_verification_results
select
  'canonical tables have RLS enabled',
  count(*) = 11 and bool_and(c.relrowsecurity),
  format('%s tables; all_rls=%s', count(*), coalesce(bool_and(c.relrowsecurity), false)),
  '11 tables; all_rls=true',
  'blocking'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'chatearn_admin_roles',
    'chatearn_settings',
    'chatearn_wallet_ledger',
    'chatearn_user_journeys',
    'chatearn_withdrawal_journeys',
    'chatearn_conversation_states',
    'chatearn_sponsored_slots',
    'chatearn_sponsored_opportunities',
    'chatearn_kyc_submissions',
    'chatearn_kyc_documents',
    'chatearn_audit_log'
  );

insert into chatearn_verification_results
select
  'no client mutation grants on canonical tables',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'chatearn_admin_roles',
    'chatearn_settings',
    'chatearn_wallet_ledger',
    'chatearn_user_journeys',
    'chatearn_withdrawal_journeys',
    'chatearn_conversation_states',
    'chatearn_sponsored_slots',
    'chatearn_sponsored_opportunities',
    'chatearn_kyc_submissions',
    'chatearn_kyc_documents',
    'chatearn_audit_log'
  )
  and grantee in ('anon', 'authenticated', 'PUBLIC')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES');

insert into chatearn_verification_results
select
  'canonical RLS policies do not allow client mutations',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from pg_policies
where schemaname = 'public'
  and tablename in (
    'chatearn_admin_roles',
    'chatearn_settings',
    'chatearn_wallet_ledger',
    'chatearn_user_journeys',
    'chatearn_withdrawal_journeys',
    'chatearn_conversation_states',
    'chatearn_sponsored_slots',
    'chatearn_sponsored_opportunities',
    'chatearn_kyc_submissions',
    'chatearn_kyc_documents',
    'chatearn_audit_log'
  )
  and cmd <> 'SELECT';

insert into chatearn_verification_results
select
  'default sponsored milestones and amounts',
  count(*) = 5
    and array_agg(message_milestone order by slot_number) = array[3, 7, 12, 18, 25]
    and array_agg(reward_amount order by slot_number) = array[20000, 22000, 25000, 27000, 30000]::bigint[],
  format(
    'slots=%s milestones=%s amounts=%s',
    count(*),
    array_agg(message_milestone order by slot_number),
    array_agg(reward_amount order by slot_number)
  ),
  'slots=5 milestones={3,7,12,18,25} amounts={20000,22000,25000,27000,30000}',
  'blocking'
from public.chatearn_sponsored_slots
where active = true
  and slot_number between 1 and 5;

insert into chatearn_verification_results
select
  'first-withdrawal settings',
  min_value = 40000 and max_value = 65000 and min_value < max_value,
  format('minimum=%s maximum=%s', min_value, max_value),
  'minimum=40000 maximum=65000',
  'blocking'
from (
  select
    (
      select (value #>> '{}')::bigint
      from public.chatearn_settings
      where setting_key = 'first_withdrawal_minimum'
    ) as min_value,
    (
      select (value #>> '{}')::bigint
      from public.chatearn_settings
      where setting_key = 'first_withdrawal_maximum'
    ) as max_value
) settings;

insert into chatearn_verification_results
select
  'wallet idempotency duplicates',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from (
  select user_id, idempotency_key
  from public.chatearn_wallet_ledger
  group by user_id, idempotency_key
  having count(*) > 1
) duplicate_keys;

insert into chatearn_verification_results
select
  'wallet source duplicates',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from (
  select source_table, source_id
  from public.chatearn_wallet_ledger
  where source_table is not null and source_id is not null
  group by source_table, source_id
  having count(*) > 1
) duplicate_sources;

insert into chatearn_verification_results
select
  'wallet users never reconcile below zero',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from (
  select user_id
  from public.chatearn_wallet_ledger
  group by user_id
  having sum(signed_amount) < 0
) negative_wallets;

insert into chatearn_verification_results
select
  'journey pause flags match state',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from public.chatearn_user_journeys
where case
  when journey_state in (
    'withdrawal_required', 'sharing_required', 'kyc_required',
    'kyc_pending', 'correction_required', 'suspended'
  ) then not (earnings_paused and sponsored_rewards_paused)
  else earnings_paused or sponsored_rewards_paused
end;

insert into chatearn_verification_results
select
  'one sponsored reward per user cycle and slot',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from (
  select user_id, cycle_number, slot_number
  from public.chatearn_sponsored_opportunities
  group by user_id, cycle_number, slot_number
  having count(*) > 1
) repeated_slots;

insert into chatearn_verification_results
select
  'private KYC bucket',
  count(*) = 1 and bool_and(public = false),
  format('rows=%s all_private=%s', count(*), coalesce(bool_and(public = false), false)),
  'rows=1 all_private=true',
  'blocking'
from storage.buckets
where id = 'chatearn-kyc';

insert into chatearn_verification_results
select
  'KYC document ownership is consistent',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from public.chatearn_kyc_documents d
left join public.chatearn_kyc_submissions s
  on s.id = d.submission_id and s.user_id = d.user_id
where s.id is null;

insert into chatearn_verification_results
select
  'private wallet writer is not client executable',
  not has_function_privilege(
    'authenticated',
    'chatearn_private.append_wallet_entry(uuid,text,bigint,text,text,text,text,jsonb)',
    'EXECUTE'
  ),
  has_function_privilege(
    'authenticated',
    'chatearn_private.append_wallet_entry(uuid,text,bigint,text,text,text,text,jsonb)',
    'EXECUTE'
  )::text,
  'false',
  'blocking';

do $$
declare
  v_mismatches bigint;
  v_difference numeric;
begin
  if to_regclass('public.chatearn_profiles') is not null
     and to_regclass('public.chatearn_reward_ledger') is not null
     and to_regclass('public.chatearn_withdrawals') is not null then
    execute $sql$
      with canonical as (
        select user_id, coalesce(sum(signed_amount), 0)::numeric as balance
        from public.chatearn_wallet_ledger
        group by user_id
      ), comparison as (
        select
          p.user_id,
          p.balance::numeric as profile_balance,
          coalesce(c.balance, 0) as canonical_balance
        from public.chatearn_profiles p
        left join canonical c on c.user_id = p.user_id
      )
      select
        count(*) filter (where profile_balance <> canonical_balance),
        coalesce(sum(abs(profile_balance - canonical_balance))
          filter (where profile_balance <> canonical_balance), 0)
      from comparison
    $sql$ into v_mismatches, v_difference;

    insert into chatearn_verification_results values (
      'legacy-to-canonical wallet reconciliation',
      v_mismatches = 0,
      format('mismatches=%s difference=%s', v_mismatches, v_difference),
      'mismatches=0 difference=0',
      'blocking'
    );

    execute $sql$
      select count(*)
      from public.chatearn_profiles p
      join auth.users u on u.id = p.user_id
      left join public.chatearn_user_journeys j on j.user_id = p.user_id
      where j.user_id is null
    $sql$ into v_mismatches;

    insert into chatearn_verification_results values (
      'authenticated legacy profiles have journey state',
      v_mismatches = 0,
      v_mismatches::text,
      '0',
      'blocking'
    );
  else
    insert into chatearn_verification_results values (
      'legacy compatibility checks',
      true,
      'legacy tables not loaded in this environment',
      'not applicable before snapshot import',
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
from chatearn_verification_results
order by
  case severity when 'blocking' then 0 else 1 end,
  passed,
  check_name;

rollback;
