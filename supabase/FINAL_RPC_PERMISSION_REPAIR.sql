-- ChatEarn final RPC permission repair
-- Restores execute access for the live frontend and admin panel without changing function logic.

begin;

-- Authenticated user RPCs.
do $$
declare
  r record;
  fn text;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
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
    fn := format('%I.%I(%s)', r.schema_name, r.function_name, r.identity_args);
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Admin RPCs. Admin authorization must still be enforced inside each function.
do $$
declare
  r record;
  fn text;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
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
    fn := format('%I.%I(%s)', r.schema_name, r.function_name, r.identity_args);
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Ensure PostgREST refreshes the function signatures and grants.
notify pgrst, 'reload schema';

commit;

-- Verification report: every row should show authenticated_can_execute = true.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  has_function_privilege(
    'authenticated',
    format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
    'EXECUTE'
  ) as authenticated_can_execute,
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
order by p.proname, identity_arguments;
