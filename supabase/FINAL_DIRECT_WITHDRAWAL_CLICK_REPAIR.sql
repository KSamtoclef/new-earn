-- ChatEarn final direct-withdrawal click repair
-- Safe to run repeatedly in Supabase SQL Editor.

begin;

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
  v_amount bigint := greatest(0,coalesce(p_amount,0));
  v_saved jsonb;
  v_account_id uuid;
  v_result jsonb;
  v_existing public.withdrawals;
  v_key text := nullif(btrim(coalesce(p_idempotency_key,'')),'');
begin
  if v_user is null then
    return jsonb_build_object('ok',false,'code','authentication_required','message','Please log in again.');
  end if;

  if v_key is null then v_key := 'direct-'||gen_random_uuid()::text; end if;

  select * into v_existing
  from public.withdrawals
  where user_id=v_user and idempotency_key=v_key
  order by submitted_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok',true,'idempotent',true,'withdrawal_id',v_existing.id,
      'public_reference',v_existing.public_reference,'status',v_existing.status,
      'amount',v_existing.amount,'idempotency_key',v_key,
      'payout_account_id',v_existing.payout_account_id,'next','sharewall'
    );
  end if;

  if v_amount <= 0 then
    select greatest(0,coalesce(balance,0))::bigint into v_amount
    from public.chatearn_profiles where user_id=v_user;
  end if;

  if v_amount < 40000 then
    return jsonb_build_object('ok',false,'code','minimum_not_reached','message','The withdrawal minimum is ₦40,000.');
  end if;

  v_saved := public.chatearn_save_payout_account_v5(p_provider,p_account_number,p_account_name,false);
  v_account_id := (v_saved->'account'->>'id')::uuid;
  v_result := public.chatearn_submit_withdrawal_v5(v_account_id,v_amount,v_key,null);

  return v_result || jsonb_build_object('idempotency_key',v_key,'payout_account_id',v_account_id,'next','sharewall');
exception when others then
  return jsonb_build_object('ok',false,'code','direct_withdrawal_failed','message',sqlerrm,'retryable',true);
end;
$$;

revoke all on function public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text) from public, anon;
grant execute on function public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text) to authenticated;

grant execute on function public.chatearn_save_payout_account_v5(text,text,text,boolean) to authenticated;
grant execute on function public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text) to authenticated;
grant execute on function public.chatearn_get_withdrawal_portal_v5() to authenticated;

notify pgrst, 'reload schema';
commit;

select
  to_regprocedure('public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text)') is not null as direct_rpc_exists,
  has_function_privilege('authenticated','public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text)','EXECUTE') as authenticated_can_execute,
  to_regprocedure('public.chatearn_save_payout_account_v5(text,text,text,boolean)') is not null as save_account_rpc_exists,
  to_regprocedure('public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text)') is not null as submit_rpc_exists;