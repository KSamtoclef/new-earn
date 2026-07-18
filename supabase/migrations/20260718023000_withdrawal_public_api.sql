-- Module 5C: normalized frontend-facing withdrawal API
-- Safe public responses only. No administrator notes or full account numbers are exposed.

create or replace function chatearn_private.withdrawal_status_ui(
  p_status text
) returns jsonb
language sql
immutable
security definer
set search_path = pg_catalog
as $$
  select case lower(coalesce(p_status,''))
    when 'eligible' then jsonb_build_object('key','eligible','label','Ready to withdraw','stage','ready','terminal',false,'success',false,'action','submit')
    when 'submitted' then jsonb_build_object('key','submitted','label','Request submitted','stage','review','terminal',false,'success',false,'action','wait')
    when 'sharing_required' then jsonb_build_object('key','sharing_required','label','Complete sharing requirement','stage','action_required','terminal',false,'success',false,'action','share')
    when 'kyc_required' then jsonb_build_object('key','kyc_required','label','Identity verification required','stage','action_required','terminal',false,'success',false,'action','kyc')
    when 'under_review' then jsonb_build_object('key','under_review','label','Under review','stage','review','terminal',false,'success',false,'action','wait')
    when 'processing' then jsonb_build_object('key','processing','label','Payment processing','stage','processing','terminal',false,'success',false,'action','wait')
    when 'needs_action' then jsonb_build_object('key','needs_action','label','Action required','stage','action_required','terminal',false,'success',false,'action','review')
    when 'paid' then jsonb_build_object('key','paid','label','Payment completed','stage','complete','terminal',true,'success',true,'action','none')
    when 'completed' then jsonb_build_object('key','completed','label','Payment completed','stage','complete','terminal',true,'success',true,'action','none')
    when 'rejected' then jsonb_build_object('key','rejected','label','Request rejected','stage','closed','terminal',true,'success',false,'action','review')
    when 'cancelled' then jsonb_build_object('key','cancelled','label','Request cancelled','stage','closed','terminal',true,'success',false,'action','none')
    else jsonb_build_object('key',coalesce(nullif(lower(p_status),''),'unknown'),'label','Status unavailable','stage','unknown','terminal',false,'success',false,'action','refresh')
  end
$$;

revoke all on function chatearn_private.withdrawal_status_ui(text) from public, anon, authenticated;

create or replace function public.chatearn_get_payout_accounts_v5()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when auth.uid() is null then jsonb_build_object('ok',false,'code','authentication_required','accounts','[]'::jsonb)
    else jsonb_build_object(
      'ok',true,
      'accounts',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',p.id,
            'provider',p.provider,
            'account_name',p.account_name,
            'account_last4',right(coalesce(p.account_number,''),4),
            'masked_account',case when char_length(coalesce(p.account_number,'')) >= 4 then '•••• '||right(p.account_number,4) else '••••' end,
            'is_default',p.is_default,
            'verified',p.verified_at is not null,
            'verified_at',p.verified_at,
            'created_at',p.created_at
          ) order by p.is_default desc,p.created_at desc
        )
        from public.payout_accounts p
        where p.user_id=auth.uid() and p.archived_at is null
      ),'[]'::jsonb)
    )
  end
$$;

revoke all on function public.chatearn_get_payout_accounts_v5() from public, anon;
grant execute on function public.chatearn_get_payout_accounts_v5() to authenticated;

create or replace function public.chatearn_submit_withdrawal_v5(
  p_payout_account_id uuid,
  p_amount bigint,
  p_idempotency_key text,
  p_user_note text default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
  v_status text;
begin
  v_result := public.chatearn_request_withdrawal_v5(
    p_payout_account_id,
    p_amount,
    p_idempotency_key,
    p_user_note
  );

  v_status := v_result->>'status';
  return v_result || jsonb_build_object(
    'status_ui',chatearn_private.withdrawal_status_ui(v_status),
    'message',case v_status
      when 'kyc_required' then 'Your funds are reserved. Complete identity verification to continue.'
      when 'under_review' then 'Your withdrawal has been submitted and is now under review.'
      when 'processing' then 'Your payment is being processed.'
      else 'Your withdrawal request was received.'
    end
  );
exception
  when sqlstate '23505' then
    return jsonb_build_object('ok',false,'code','active_withdrawal_exists','message','You already have an active withdrawal request.','retryable',false);
  when sqlstate '22003' then
    return jsonb_build_object('ok',false,'code','amount_not_allowed','message',sqlerrm,'retryable',false);
  when sqlstate 'P0002' then
    return jsonb_build_object('ok',false,'code','required_record_missing','message',sqlerrm,'retryable',false);
  when sqlstate '28000' then
    return jsonb_build_object('ok',false,'code','authentication_required','message','Please log in again to continue.','retryable',false);
  when others then
    return jsonb_build_object('ok',false,'code','withdrawal_submission_failed','message',sqlerrm,'retryable',true);
end
$$;

revoke all on function public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text) from public, anon;
grant execute on function public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text) to authenticated;

create or replace function public.chatearn_get_withdrawal_portal_v5()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_user uuid := auth.uid();
  v_wallet public.wallets;
  v_progress public.withdrawal_progress;
  v_active public.withdrawals;
  v_kyc_status text;
  v_threshold bigint := 0;
  v_available bigint := 0;
  v_can_submit boolean := false;
begin
  if v_user is null then
    return jsonb_build_object('ok',false,'code','authentication_required');
  end if;

  select * into v_wallet from public.wallets where user_id=v_user;
  select * into v_progress from public.withdrawal_progress where user_id=v_user;

  select * into v_active
  from public.withdrawals
  where user_id=v_user
    and status::text in ('submitted','sharing_required','kyc_required','under_review','processing','needs_action')
  order by submitted_at desc
  limit 1;

  select k.status::text into v_kyc_status
  from public.kyc_submissions k
  where k.user_id=v_user
  order by k.created_at desc
  limit 1;

  v_threshold := greatest(0,coalesce(v_progress.assigned_threshold,0));
  v_available := greatest(0,coalesce(v_wallet.available_balance,0));
  v_can_submit := v_active.id is null and v_available >= v_threshold and v_threshold > 0;

  return jsonb_build_object(
    'ok',true,
    'wallet',jsonb_build_object(
      'currency',coalesce(v_wallet.currency,'NGN'),
      'available_balance',v_available,
      'held_balance',greatest(0,coalesce(v_wallet.held_balance,0)),
      'lifetime_earned',greatest(0,coalesce(v_wallet.lifetime_earned,0)),
      'lifetime_withdrawn',greatest(0,coalesce(v_wallet.lifetime_withdrawn,0))
    ),
    'eligibility',jsonb_build_object(
      'can_submit',v_can_submit,
      'threshold',v_threshold,
      'amount_remaining',greatest(0,v_threshold-v_available),
      'earnings_paused',coalesce(v_progress.earnings_paused,false),
      'reason',case
        when v_active.id is not null then 'active_withdrawal_exists'
        when v_threshold <= 0 then 'withdrawal_rule_unavailable'
        when v_available < v_threshold then 'threshold_not_reached'
        else 'eligible'
      end
    ),
    'kyc',jsonb_build_object(
      'status',coalesce(v_kyc_status,'not_started'),
      'approved',coalesce(v_kyc_status='approved',false),
      'required',coalesce(v_active.status::text='kyc_required',false)
    ),
    'active_withdrawal',case when v_active.id is null then null else jsonb_build_object(
      'id',v_active.id,
      'public_reference',v_active.public_reference,
      'amount',v_active.amount,
      'currency',v_active.currency,
      'status',v_active.status,
      'status_ui',chatearn_private.withdrawal_status_ui(v_active.status::text),
      'submitted_at',v_active.submitted_at,
      'processing_at',v_active.processing_at,
      'paid_at',v_active.paid_at,
      'cancelled_at',v_active.cancelled_at
    ) end,
    'history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',w.id,
        'public_reference',w.public_reference,
        'amount',w.amount,
        'currency',w.currency,
        'status',w.status,
        'status_ui',chatearn_private.withdrawal_status_ui(w.status::text),
        'submitted_at',w.submitted_at,
        'processing_at',w.processing_at,
        'paid_at',w.paid_at,
        'cancelled_at',w.cancelled_at
      ) order by w.submitted_at desc)
      from (
        select * from public.withdrawals
        where user_id=v_user
        order by submitted_at desc
        limit 20
      ) w
    ),'[]'::jsonb),
    'payout_accounts',(public.chatearn_get_payout_accounts_v5()->'accounts')
  );
end
$$;

revoke all on function public.chatearn_get_withdrawal_portal_v5() from public, anon;
grant execute on function public.chatearn_get_withdrawal_portal_v5() to authenticated;
