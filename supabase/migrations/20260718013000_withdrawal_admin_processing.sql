-- Module 5B: canonical admin withdrawal processing engine
-- Atomic status transitions, held-fund settlement/refund, history and journey cleanup.

create schema if not exists chatearn_private;

create or replace function chatearn_private.is_withdrawal_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_role text;
  v_user uuid := auth.uid();
  v_ok boolean := false;
begin
  v_role := lower(coalesce(
    v_claims #>> '{app_metadata,role}',
    v_claims #>> '{user_metadata,role}',
    v_claims ->> 'role',
    ''
  ));

  if v_role in ('admin','super_admin','administrator','service_role')
     or coalesce((v_claims #>> '{app_metadata,is_admin}')::boolean, false)
     or coalesce((v_claims #>> '{user_metadata,is_admin}')::boolean, false) then
    return true;
  end if;

  -- Compatibility with common existing admin membership tables, when present.
  if v_user is not null and to_regclass('public.chatearn_admin_users') is not null then
    begin
      execute 'select exists(select 1 from public.chatearn_admin_users where user_id=$1 and coalesce(active,true))'
      into v_ok using v_user;
      if v_ok then return true; end if;
    exception when undefined_column then
      begin
        execute 'select exists(select 1 from public.chatearn_admin_users where user_id=$1)'
        into v_ok using v_user;
        if v_ok then return true; end if;
      exception when others then null;
      end;
    when others then null;
    end;
  end if;

  if v_user is not null and to_regclass('public.admin_users') is not null then
    begin
      execute 'select exists(select 1 from public.admin_users where user_id=$1 and coalesce(active,true))'
      into v_ok using v_user;
      if v_ok then return true; end if;
    exception when undefined_column then
      begin
        execute 'select exists(select 1 from public.admin_users where user_id=$1)'
        into v_ok using v_user;
        if v_ok then return true; end if;
      exception when others then null;
      end;
    when others then null;
    end;
  end if;

  return false;
end;
$$;

revoke all on function chatearn_private.is_withdrawal_admin() from public, anon, authenticated;
grant execute on function chatearn_private.is_withdrawal_admin() to service_role;

create or replace function public.chatearn_admin_transition_withdrawal_v5(
  p_withdrawal_id uuid,
  p_action text,
  p_reason text default null,
  p_admin_note text default null,
  p_external_withdrawal_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_actor uuid := auth.uid();
  v_withdrawal public.withdrawals;
  v_wallet public.wallets;
  v_from text;
  v_to text;
  v_action text := lower(btrim(coalesce(p_action,'')));
  v_terminal boolean := false;
  v_refund boolean := false;
  v_pay boolean := false;
  v_kind_candidates text[];
  v_existing_label text;
begin
  if not chatearn_private.is_withdrawal_admin() then
    raise exception 'administrator access required' using errcode='42501';
  end if;
  if p_withdrawal_id is null then
    raise exception 'withdrawal id is required' using errcode='22004';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_withdrawal_id::text, 0));

  select * into v_withdrawal
  from public.withdrawals
  where id=p_withdrawal_id
  for update;
  if not found then raise exception 'withdrawal not found' using errcode='P0002'; end if;

  v_from := v_withdrawal.status::text;

  if v_action in ('process','processing','approve') then
    v_to := 'processing';
    if v_from not in ('submitted','sharing_required','kyc_required','under_review','needs_action') then
      raise exception 'illegal withdrawal transition from % to processing', v_from using errcode='55000';
    end if;
  elsif v_action in ('pay','paid','complete','completed') then
    v_to := chatearn_private.pick_enum_label('withdrawal_status', array['paid','completed','complete']);
    if v_to is null then raise exception 'withdrawal enum has no paid/completed state' using errcode='55000'; end if;
    if v_from <> 'processing' then
      raise exception 'withdrawal must be processing before payment' using errcode='55000';
    end if;
    v_terminal := true; v_pay := true;
  elsif v_action in ('reject','rejected','decline','declined') then
    v_to := chatearn_private.pick_enum_label('withdrawal_status', array['rejected','declined','cancelled','canceled']);
    if v_to is null then raise exception 'withdrawal enum has no rejection/cancellation state' using errcode='55000'; end if;
    if v_from in ('paid','completed','complete','rejected','declined','cancelled','canceled') then
      raise exception 'terminal withdrawal cannot be rejected' using errcode='55000';
    end if;
    v_terminal := true; v_refund := true;
  elsif v_action in ('cancel','cancelled','canceled') then
    v_to := chatearn_private.pick_enum_label('withdrawal_status', array['cancelled','canceled','rejected','declined']);
    if v_to is null then raise exception 'withdrawal enum has no cancellation state' using errcode='55000'; end if;
    if v_from in ('paid','completed','complete','rejected','declined','cancelled','canceled') then
      raise exception 'terminal withdrawal cannot be cancelled' using errcode='55000';
    end if;
    v_terminal := true; v_refund := true;
  else
    raise exception 'unsupported withdrawal action' using errcode='22023';
  end if;

  -- Idempotent repeat of the same final/state action.
  if v_from = v_to then
    return jsonb_build_object('ok',true,'idempotent',true,'withdrawal_id',v_withdrawal.id,'status',v_from);
  end if;

  if v_pay then
    select * into v_wallet from public.wallets where user_id=v_withdrawal.user_id for update;
    if not found then raise exception 'wallet not found' using errcode='P0002'; end if;
    if v_wallet.held_balance < v_withdrawal.amount then
      raise exception 'held balance is lower than withdrawal amount' using errcode='22003';
    end if;

    perform chatearn_private.write_canonical_wallet_entry(
      v_withdrawal.user_id,v_withdrawal.id,0,-v_withdrawal.amount,
      'withdrawal-paid:'||v_withdrawal.id::text,
      'Withdrawal paid '||v_withdrawal.public_reference,
      array['withdrawal_paid','withdrawal','debit','payout'],
      jsonb_build_object('withdrawal_id',v_withdrawal.id,'public_reference',v_withdrawal.public_reference,'actor_id',v_actor)
    );

    update public.wallets
    set lifetime_withdrawn=lifetime_withdrawn+v_withdrawal.amount,
        updated_at=now()
    where user_id=v_withdrawal.user_id;
  elsif v_refund then
    select * into v_wallet from public.wallets where user_id=v_withdrawal.user_id for update;
    if not found then raise exception 'wallet not found' using errcode='P0002'; end if;
    if v_wallet.held_balance < v_withdrawal.amount then
      raise exception 'held balance is lower than withdrawal amount' using errcode='22003';
    end if;

    perform chatearn_private.write_canonical_wallet_entry(
      v_withdrawal.user_id,v_withdrawal.id,v_withdrawal.amount,-v_withdrawal.amount,
      'withdrawal-refund:'||v_withdrawal.id::text,
      'Withdrawal funds released '||v_withdrawal.public_reference,
      array['withdrawal_release','release','refund','reversal'],
      jsonb_build_object('withdrawal_id',v_withdrawal.id,'public_reference',v_withdrawal.public_reference,'actor_id',v_actor,'reason',nullif(left(btrim(coalesce(p_reason,'')),500),''))
    );
  end if;

  execute format(
    'update public.withdrawals set status=%L::public.withdrawal_status, admin_note=$2, external_withdrawal_id=coalesce($3,external_withdrawal_id), processing_at=case when %L=''processing'' then coalesce(processing_at,now()) else processing_at end, paid_at=case when %L in (''paid'',''completed'',''complete'') then coalesce(paid_at,now()) else paid_at end, cancelled_at=case when %L in (''rejected'',''declined'',''cancelled'',''canceled'') then coalesce(cancelled_at,now()) else cancelled_at end, updated_at=now() where id=$1',
    v_to,v_to,v_to,v_to
  )
  using p_withdrawal_id,nullif(left(btrim(coalesce(p_admin_note,'')),1000),''),p_external_withdrawal_id;

  insert into public.withdrawal_status_history(withdrawal_id,from_status,to_status,actor_id,reason,metadata)
  values(
    v_withdrawal.id,
    v_withdrawal.status,
    v_to::public.withdrawal_status,
    v_actor,
    nullif(left(btrim(coalesce(p_reason,'')),500),''),
    jsonb_build_object('action',v_action,'external_withdrawal_id',p_external_withdrawal_id)
  );

  if v_terminal then
    update public.withdrawal_progress
    set earnings_paused=false,
        first_workflow_completed_at=coalesce(first_workflow_completed_at,now()),
        updated_at=now()
    where user_id=v_withdrawal.user_id;

    update public.chatearn_user_journeys
    set active_withdrawal_id=null,
        first_withdrawal_gate_passed=true,
        journey_state='earning_enabled',
        earnings_paused=false,
        sponsored_rewards_paused=false,
        processing_reached_at=case when v_pay then coalesce(processing_reached_at,now()) else processing_reached_at end,
        version=version+1,
        updated_at=now()
    where user_id=v_withdrawal.user_id
      and active_withdrawal_id=v_withdrawal.id;
  elsif v_to='processing' then
    update public.chatearn_user_journeys
    set journey_state='withdrawal_processing',
        processing_reached_at=coalesce(processing_reached_at,now()),
        version=version+1,
        updated_at=now()
    where user_id=v_withdrawal.user_id;
  end if;

  return jsonb_build_object(
    'ok',true,'idempotent',false,'withdrawal_id',v_withdrawal.id,
    'from_status',v_from,'status',v_to,'terminal',v_terminal,
    'funds_paid',v_pay,'funds_refunded',v_refund
  );
end;
$$;

revoke all on function public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid) from public, anon;
grant execute on function public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid) to authenticated, service_role;

create or replace function public.chatearn_admin_list_withdrawals_v5(
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
begin
  if not chatearn_private.is_withdrawal_admin() then
    raise exception 'administrator access required' using errcode='42501';
  end if;

  return jsonb_build_object(
    'ok',true,
    'items',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.submitted_at desc)
      from (
        select w.id,w.user_id,w.amount,w.currency,w.status,w.public_reference,
               w.submitted_at,w.processing_at,w.paid_at,w.cancelled_at,
               w.user_note,w.admin_note,w.external_withdrawal_id,
               p.provider,p.account_name,right(p.account_number,4) as account_last4,
               coalesce(pr.display_name,cp.full_name,'User') as user_name
        from public.withdrawals w
        join public.payout_accounts p on p.id=w.payout_account_id
        left join public.profiles pr on pr.user_id=w.user_id
        left join public.chatearn_user_profiles cp on cp.user_id=w.user_id
        where p_status is null or w.status::text=p_status
        order by w.submitted_at desc
        limit least(greatest(coalesce(p_limit,50),1),200)
        offset greatest(coalesce(p_offset,0),0)
      ) x
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.chatearn_admin_list_withdrawals_v5(text,integer,integer) from public, anon;
grant execute on function public.chatearn_admin_list_withdrawals_v5(text,integer,integer) to authenticated, service_role;
