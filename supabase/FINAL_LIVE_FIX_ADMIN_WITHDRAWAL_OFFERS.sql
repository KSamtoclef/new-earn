-- ChatEarn final live repair: withdrawal RPC cache, admin permissions, KYC queue,
-- offer manager access and PostgREST schema refresh.

begin;

-- Recreate the direct withdrawal entry point so PostgREST sees the exact frontend signature.
create or replace function public.chatearn_place_withdrawal_direct_v6(
  p_provider text,
  p_account_number text,
  p_account_name text,
  p_amount bigint,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_user uuid := auth.uid();
  v_amount bigint := greatest(0, coalesce(p_amount, 0));
  v_saved jsonb;
  v_account_id uuid;
  v_result jsonb;
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
begin
  if v_user is null then
    return jsonb_build_object('ok',false,'code','authentication_required','message','Please log in again.');
  end if;

  if v_key is null then v_key := 'direct-' || gen_random_uuid()::text; end if;

  if v_amount <= 0 then
    select greatest(0, coalesce(balance, 0))::bigint
      into v_amount
    from public.chatearn_profiles
    where user_id = v_user;
  end if;

  if v_amount < 40000 then
    return jsonb_build_object('ok',false,'code','minimum_not_reached','message','The withdrawal minimum is ₦40,000.');
  end if;

  -- Idempotent retry: return the already-created withdrawal instead of duplicating it.
  select jsonb_build_object(
    'ok', true,
    'withdrawal_id', w.id,
    'status', w.status::text,
    'idempotency_key', v_key,
    'next', case when w.status::text = 'sharing_required' then 'sharewall' else 'processing' end,
    'idempotent', true
  )
  into v_result
  from public.withdrawals w
  where w.user_id = v_user and w.idempotency_key = v_key
  order by w.created_at desc
  limit 1;

  if v_result is not null then return v_result; end if;

  v_saved := public.chatearn_save_payout_account_v5(
    p_provider, p_account_number, p_account_name, false
  );
  v_account_id := (v_saved->'account'->>'id')::uuid;

  v_result := public.chatearn_submit_withdrawal_v5(
    v_account_id, v_amount, v_key, null
  );

  return v_result || jsonb_build_object(
    'idempotency_key', v_key,
    'payout_account_id', v_account_id,
    'next', 'sharewall'
  );
exception
  when others then
    return jsonb_build_object(
      'ok',false,
      'code','direct_withdrawal_failed',
      'message',sqlerrm,
      'retryable',true
    );
end;
$$;

revoke all on function public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text) from public, anon;
grant execute on function public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text) to authenticated;

-- Grant authenticated access to public user RPCs when they exist.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'chatearn_get_withdrawal_portal_v5',
        'chatearn_get_payout_accounts_v5',
        'chatearn_save_payout_account_v5',
        'chatearn_submit_withdrawal_v5',
        'chatearn_record_withdrawal_share_v5',
        'chatearn_get_withdrawal_share_state_v5',
        'chatearn_resume_earning_after_withdrawal_v6',
        'chatearn_v4_get_unique_offer',
        'chatearn_v3_track_offer_event'
      )
  loop
    execute format('revoke all on function %s from public, anon', r.signature);
    execute format('grant execute on function %s to authenticated', r.signature);
  end loop;
end $$;

-- Grant the signed-in administrator access to protected admin RPC boundaries.
-- The functions still perform their own administrator checks internally.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'chatearn_admin_v2_is_admin',
        'chatearn_admin_v2_snapshot',
        'chatearn_admin_list_withdrawals_v5',
        'chatearn_admin_transition_withdrawal_v5',
        'chatearn_v6_admin_queue',
        'chatearn_v6_admin_bulk_review',
        'chatearn_v4_admin_save_offer',
        'chatearn_v4_admin_toggle_offer',
        'chatearn_v4_admin_save_task',
        'chatearn_v4_admin_toggle_task',
        'chatearn_v4_admin_offer_manager',
        'chatearn_v5_admin_save_offer_presentation'
      )
  loop
    execute format('revoke all on function %s from public, anon', r.signature);
    execute format('grant execute on function %s to authenticated', r.signature);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;

-- Final verification. All values used by the live frontend should be true.
select
  to_regprocedure('public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text)') is not null as direct_withdrawal_rpc,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='chatearn_get_withdrawal_portal_v5') as withdrawal_portal_rpc,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='chatearn_admin_list_withdrawals_v5') as admin_withdrawal_list_rpc,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='chatearn_v6_admin_queue') as admin_kyc_queue_rpc,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='chatearn_v4_admin_offer_manager') as admin_offer_manager_rpc,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='chatearn_v4_get_unique_offer') as unique_offer_router_rpc;