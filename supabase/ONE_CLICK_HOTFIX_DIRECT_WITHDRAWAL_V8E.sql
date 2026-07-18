-- ChatEarn V8E one-click hotfix: direct bank entry, persistent withdrawal flow,
-- compulsory sharing, and return-to-chat processing experience.

begin;

create or replace function public.chatearn_save_payout_account_v5(
  p_provider text,
  p_account_number text,
  p_account_name text,
  p_is_default boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_number text := regexp_replace(coalesce(p_account_number,''),'\D','','g');
  v_name text := btrim(coalesce(p_account_name,''));
  v_provider text := lower(btrim(coalesce(p_provider,'')));
  v_account public.payout_accounts;
begin
  if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
  if v_provider not in (
    'opay','palmpay','kuda','moniepoint','gtbank','access','firstbank','uba','zenith',
    'fcmb','fidelity','sterling','wema','union','stanbic','ecobank','polaris','keystone',
    'providus','other'
  ) then raise exception 'unsupported payout provider' using errcode='22023'; end if;
  if char_length(v_number) <> 10 then raise exception 'account number must contain 10 digits' using errcode='22023'; end if;
  if char_length(v_name) < 3 then raise exception 'account name is required' using errcode='22023'; end if;

  insert into public.payout_accounts(user_id,provider,account_number,account_name,is_default,verified_at)
  values(v_user,v_provider,v_number,left(v_name,120),false,now())
  returning * into v_account;

  return jsonb_build_object(
    'ok',true,
    'account',jsonb_build_object(
      'id',v_account.id,
      'provider',v_account.provider,
      'account_name',v_account.account_name,
      'masked_account','•••• '||right(v_account.account_number,4),
      'confirmed',true,
      'is_default',false
    ),
    'message','Bank details confirmed for this withdrawal.'
  );
end;
$$;

revoke all on function public.chatearn_save_payout_account_v5(text,text,text,boolean) from public, anon;
grant execute on function public.chatearn_save_payout_account_v5(text,text,text,boolean) to authenticated;

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
  v_key text := nullif(btrim(coalesce(p_idempotency_key,'')),'');
begin
  if v_user is null then
    return jsonb_build_object('ok',false,'code','authentication_required','message','Please log in again.');
  end if;

  if v_key is null then v_key := 'direct-'||gen_random_uuid()::text; end if;

  if v_amount <= 0 then
    select greatest(0,coalesce(balance,0))::bigint
      into v_amount
    from public.chatearn_profiles
    where user_id=v_user;
  end if;

  if v_amount < 40000 then
    return jsonb_build_object('ok',false,'code','minimum_not_reached','message','The withdrawal minimum is ₦40,000.');
  end if;

  v_saved := public.chatearn_save_payout_account_v5(
    p_provider,p_account_number,p_account_name,false
  );
  v_account_id := (v_saved->'account'->>'id')::uuid;

  v_result := public.chatearn_submit_withdrawal_v5(
    v_account_id,v_amount,v_key,null
  );

  return v_result || jsonb_build_object(
    'idempotency_key',v_key,
    'payout_account_id',v_account_id,
    'next','sharewall'
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

-- Keep reward balances durable and restore users who were incorrectly paused below ₦80,000.
update public.chatearn_user_journeys j
set journey_state='earning_enabled',
    earnings_paused=false,
    sponsored_rewards_paused=false,
    version=version+1,
    updated_at=now()
where j.first_withdrawal_gate_passed=false
  and j.journey_state='withdrawal_required'
  and coalesce((select sum(l.signed_amount)::bigint from public.chatearn_wallet_ledger l where l.user_id=j.user_id),0) < 80000;

notify pgrst, 'reload schema';
commit;

select
  to_regprocedure('public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text)') is not null as direct_withdrawal_rpc,
  to_regprocedure('public.chatearn_save_payout_account_v5(text,text,text,boolean)') is not null as bank_capture_rpc,
  to_regprocedure('public.chatearn_record_withdrawal_share_v5(uuid,text)') is not null as compulsory_share_rpc,
  to_regprocedure('public.chatearn_get_withdrawal_portal_v5()') is not null as withdrawal_portal_rpc;