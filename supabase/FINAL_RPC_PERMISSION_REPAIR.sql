-- ChatEarn final RPC permission repair (corrected)
-- Restores execute access without changing function logic.
-- Safe to run repeatedly.

begin;

-- Authenticated user RPCs.
do $$
declare
  r record;
begin
  for r in
    select p.oid,
           p.oid::regprocedure as function_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'chatearn_send_message',
        'chatearn_get_withdrawal_portal_v5',
        'chatearn_get_payout_accounts_v5',
        'chatearn_save_payout_account_v5',
        'chatearn_submit_withdrawal_v5',
        'chatearn_place_withdrawal_direct_v6',
        'chatearn_record_withdrawal_share_v5',
        'chatearn_resume_earning_after_withdrawal_v6',
        'chatearn_v4_get_unique_offer',
        'chatearn_v3_track_offer_event'
      )
  loop
    execute format('revoke all on function %s from public, anon', r.function_signature);
    execute format('grant execute on function %s to authenticated', r.function_signature);
  end loop;
end $$;

-- Admin RPCs. Each function must still perform its own admin authorization internally.
do $$
declare
  r record;
begin
  for r in
    select p.oid,
           p.oid::regprocedure as function_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'chatearn_admin_list_withdrawals_v5',
        'chatearn_admin_transition_withdrawal_v5',
        'chatearn_v6_admin_queue',
        'chatearn_v6_admin_bulk_review',
        'chatearn_v4_admin_offer_manager',
        'chatearn_v4_admin_save_offer',
        'chatearn_v4_admin_toggle_offer',
        'chatearn_v4_admin_save_task',
        'chatearn_v4_admin_toggle_task',
        'chatearn_v5_admin_save_offer_presentation'
      )
  loop
    execute format('revoke all on function %s from public, anon', r.function_signature);
    execute format('grant execute on function %s to authenticated', r.function_signature);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;

-- Verification report: every returned row should show authenticated_can_execute = true.
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.oid::regprocedure::text as function_signature,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'chatearn_send_message',
    'chatearn_get_withdrawal_portal_v5',
    'chatearn_get_payout_accounts_v5',
    'chatearn_save_payout_account_v5',
    'chatearn_submit_withdrawal_v5',
    'chatearn_place_withdrawal_direct_v6',
    'chatearn_record_withdrawal_share_v5',
    'chatearn_resume_earning_after_withdrawal_v6',
    'chatearn_v4_get_unique_offer',
    'chatearn_v3_track_offer_event',
    'chatearn_admin_list_withdrawals_v5',
    'chatearn_admin_transition_withdrawal_v5',
    'chatearn_v6_admin_queue',
    'chatearn_v6_admin_bulk_review',
    'chatearn_v4_admin_offer_manager',
    'chatearn_v4_admin_save_offer',
    'chatearn_v4_admin_toggle_offer',
    'chatearn_v4_admin_save_task',
    'chatearn_v4_admin_toggle_task',
    'chatearn_v5_admin_save_offer_presentation'
  )
order by p.proname, p.oid::regprocedure::text;