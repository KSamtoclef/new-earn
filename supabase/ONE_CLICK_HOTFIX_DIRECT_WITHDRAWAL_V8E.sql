-- ChatEarn V8E.1 one-click hotfix: direct bank entry, persistent withdrawal flow,
-- compulsory sharing, and safe return-to-chat while payment is processing.

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

  select * into v_account
  from public.payout_accounts
  where user_id=v_user
    and provider=v_provider
    and account_number=v_number
    and archived_at is null
  order by created_at desc
  limit 1;

  if not found then
    insert into public.payout_accounts(user_id,provider,account_number,account_name,is_default,verified_at)
    values(v_user,v_provider,v_number,left(v_name,120),false,now())
    returning * into v_account;
  else
    update public.payout_accounts
    set account_name=left(v_name,120), verified_at=coalesce(verified_at,now())
    where id=v_account.id
    returning * into v_account;
  end if;

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
      'ok',true,
      'idempotent',true,
      'withdrawal_id',v_existing.id,
      'public_reference',v_existing.public_reference,
      'status',v_existing.status,
      'amount',v_existing.amount,
      'idempotency_key',v_key,
      'payout_account_id',v_existing.payout_account_id,
      'next','sharewall'
    );
  end if;

  if v_amount <= 0 then
    select greatest(0,coalesce(balance,0))::bigint into v_amount
    from public.chatearn_profiles
    where user_id=v_user;
  end if;

  if v_amount < 40000 then
    return jsonb_build_object('ok',false,'code','minimum_not_reached','message','The withdrawal minimum is ₦40,000.');
  end if;

  v_saved := public.chatearn_save_payout_account_v5(p_provider,p_account_number,p_account_name,false);
  v_account_id := (v_saved->'account'->>'id')::uuid;
  v_result := public.chatearn_submit_withdrawal_v5(v_account_id,v_amount,v_key,null);

  return v_result || jsonb_build_object(
    'idempotency_key',v_key,
    'payout_account_id',v_account_id,
    'next','sharewall'
  );
exception
  when others then
    return jsonb_build_object('ok',false,'code','direct_withdrawal_failed','message',sqlerrm,'retryable',true);
end;
$$;

revoke all on function public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text) from public, anon;
grant execute on function public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text) to authenticated;

create or replace function public.chatearn_resume_earning_after_withdrawal_v6(
  p_withdrawal_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_withdrawal public.withdrawals;
begin
  if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;

  select * into v_withdrawal
  from public.withdrawals
  where id=p_withdrawal_id and user_id=v_user
  for update;

  if not found then raise exception 'withdrawal not found' using errcode='P0002'; end if;

  if v_withdrawal.status::text not in ('under_review','processing','submitted') then
    raise exception 'complete sharing and KYC before continuing to earn' using errcode='55000';
  end if;

  update public.chatearn_user_journeys
  set first_withdrawal_gate_passed=true,
      journey_state='earning_enabled',
      earnings_paused=false,
      sponsored_rewards_paused=false,
      version=version+1,
      updated_at=now()
  where user_id=v_user;

  update public.withdrawal_progress
  set earnings_paused=false,
      updated_at=now()
  where user_id=v_user;

  return jsonb_build_object(
    'ok',true,
    'withdrawal_id',v_withdrawal.id,
    'status',v_withdrawal.status,
    'earning_resumed',true,
    'message','Your payment remains in processing and your next earning session is active.'
  );
end;
$$;

revoke all on function public.chatearn_resume_earning_after_withdrawal_v6(uuid) from public, anon;
grant execute on function public.chatearn_resume_earning_after_withdrawal_v6(uuid) to authenticated;

-- Restore users incorrectly paused below the first-session limit.
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
  to_regprocedure('public.chatearn_get_withdrawal_portal_v5()') is not null as withdrawal_portal_rpc,
  to_regprocedure('public.chatearn_resume_earning_after_withdrawal_v6(uuid)') is not null as resume_earning_rpc;