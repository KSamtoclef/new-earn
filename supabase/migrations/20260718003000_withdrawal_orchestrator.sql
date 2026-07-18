-- Module 5A: canonical withdrawal orchestrator
-- Uses public.wallets / public.wallet_ledger / public.withdrawals only.

create schema if not exists chatearn_private;

create or replace function chatearn_private.pick_enum_label(
  p_type_name text,
  p_candidates text[]
) returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select e.enumlabel
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public'
    and t.typname = p_type_name
    and e.enumlabel = any(p_candidates)
  order by array_position(p_candidates, e.enumlabel)
  limit 1
$$;

revoke all on function chatearn_private.pick_enum_label(text,text[]) from public, anon, authenticated;

create or replace function chatearn_private.write_canonical_wallet_entry(
  p_user_id uuid,
  p_source_id uuid,
  p_available_delta bigint,
  p_held_delta bigint,
  p_idempotency_key text,
  p_description text,
  p_kind_candidates text[],
  p_metadata jsonb default '{}'::jsonb
) returns public.wallet_ledger
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_wallet public.wallets;
  v_existing public.wallet_ledger;
  v_inserted public.wallet_ledger;
  v_kind text;
  v_source text;
  v_sequence bigint;
begin
  if p_user_id is null or p_source_id is null then
    raise exception 'wallet entry identity is required' using errcode='22004';
  end if;
  if char_length(coalesce(p_idempotency_key,'')) not between 8 and 200 then
    raise exception 'invalid idempotency key' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select * into v_existing
  from public.wallet_ledger
  where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return v_existing; end if;

  select * into v_wallet
  from public.wallets
  where user_id=p_user_id
  for update;
  if not found then raise exception 'wallet not found' using errcode='P0002'; end if;

  if v_wallet.available_balance + p_available_delta < 0 then
    raise exception 'insufficient available balance' using errcode='22003';
  end if;
  if v_wallet.held_balance + p_held_delta < 0 then
    raise exception 'insufficient held balance' using errcode='22003';
  end if;

  v_kind := chatearn_private.pick_enum_label('wallet_entry_kind', p_kind_candidates);
  v_source := chatearn_private.pick_enum_label('wallet_source_type', array['withdrawal','withdrawals','payout']);
  if v_kind is null or v_source is null then
    raise exception 'canonical wallet enums do not contain withdrawal labels' using errcode='55000';
  end if;

  v_sequence := v_wallet.ledger_sequence + 1;

  execute format(
    'insert into public.wallet_ledger(user_id,sequence_number,kind,source_type,source_id,available_delta,held_delta,available_balance_after,held_balance_after,idempotency_key,description,metadata) values ($1,$2,%L::public.wallet_entry_kind,%L::public.wallet_source_type,$3,$4,$5,$6,$7,$8,$9,$10) returning *',
    v_kind, v_source
  )
  into v_inserted
  using p_user_id, v_sequence, p_source_id, p_available_delta, p_held_delta,
        v_wallet.available_balance+p_available_delta,
        v_wallet.held_balance+p_held_delta,
        p_idempotency_key, p_description, coalesce(p_metadata,'{}'::jsonb);

  update public.wallets
  set available_balance=available_balance+p_available_delta,
      held_balance=held_balance+p_held_delta,
      ledger_sequence=v_sequence,
      updated_at=now()
  where user_id=p_user_id;

  return v_inserted;
end;
$$;

revoke all on function chatearn_private.write_canonical_wallet_entry(uuid,uuid,bigint,bigint,text,text,text[],jsonb) from public, anon, authenticated;

create or replace function public.chatearn_request_withdrawal_v5(
  p_payout_account_id uuid,
  p_amount bigint,
  p_idempotency_key text,
  p_user_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_user uuid := auth.uid();
  v_wallet public.wallets;
  v_account public.payout_accounts;
  v_existing public.withdrawals;
  v_withdrawal public.withdrawals;
  v_rule public.withdrawal_rules;
  v_progress public.withdrawal_progress;
  v_minimum bigint;
  v_status public.withdrawal_status;
  v_kyc_approved boolean;
  v_reference text;
begin
  if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'withdrawal amount must be positive' using errcode='22023'; end if;
  if char_length(coalesce(p_idempotency_key,'')) not between 8 and 200 then raise exception 'invalid idempotency key' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select * into v_existing from public.withdrawals
  where user_id=v_user and idempotency_key=p_idempotency_key;
  if found then
    return jsonb_build_object('ok',true,'idempotent',true,'withdrawal_id',v_existing.id,'public_reference',v_existing.public_reference,'status',v_existing.status,'amount',v_existing.amount);
  end if;

  if exists(select 1 from public.withdrawals where user_id=v_user and status::text in ('submitted','sharing_required','kyc_required','under_review','processing','needs_action')) then
    raise exception 'an active withdrawal already exists' using errcode='23505';
  end if;

  select * into v_wallet from public.wallets where user_id=v_user for update;
  if not found then raise exception 'wallet not found' using errcode='P0002'; end if;

  select * into v_account from public.payout_accounts
  where id=p_payout_account_id and user_id=v_user and archived_at is null
  for update;
  if not found then raise exception 'payout account not found' using errcode='P0002'; end if;
  if v_account.verified_at is null then raise exception 'payout account must be verified' using errcode='55000'; end if;

  select * into v_progress from public.withdrawal_progress where user_id=v_user for update;
  if not found then raise exception 'withdrawal progress is missing' using errcode='55000'; end if;
  select * into v_rule from public.withdrawal_rules where id=v_progress.rule_id and is_active;
  if not found then raise exception 'active withdrawal rule is missing' using errcode='55000'; end if;

  v_minimum := greatest(1, v_progress.assigned_threshold);
  if p_amount < v_minimum then raise exception 'amount is below the assigned withdrawal threshold' using errcode='22003'; end if;
  if p_amount > v_wallet.available_balance then raise exception 'insufficient available balance' using errcode='22003'; end if;

  select exists(
    select 1 from public.kyc_submissions
    where user_id=v_user and status::text='approved'
      and (expires_at is null or expires_at>now())
  ) into v_kyc_approved;

  v_status := case when v_kyc_approved then 'under_review'::public.withdrawal_status else 'kyc_required'::public.withdrawal_status end;
  v_reference := 'CE-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  insert into public.withdrawals(user_id,payout_account_id,amount,currency,status,idempotency_key,public_reference,user_note)
  values(v_user,p_payout_account_id,p_amount,v_wallet.currency,v_status,p_idempotency_key,v_reference,nullif(left(btrim(coalesce(p_user_note,'')),500),''))
  returning * into v_withdrawal;

  perform chatearn_private.write_canonical_wallet_entry(
    v_user,v_withdrawal.id,-p_amount,p_amount,
    'withdrawal-hold:'||v_withdrawal.id::text,
    'Funds reserved for withdrawal '||v_reference,
    array['withdrawal_hold','hold','withdrawal_reserved','reserve'],
    jsonb_build_object('withdrawal_id',v_withdrawal.id,'public_reference',v_reference)
  );

  insert into public.withdrawal_status_history(withdrawal_id,from_status,to_status,actor_id,reason,metadata)
  values(v_withdrawal.id,null,v_status,v_user,'Withdrawal submitted',jsonb_build_object('amount',p_amount,'payout_account_id',p_payout_account_id));

  update public.withdrawal_progress
  set earnings_paused=true, updated_at=now()
  where user_id=v_user;

  update public.chatearn_user_journeys
  set active_withdrawal_id=v_withdrawal.id,
      journey_state=case when v_kyc_approved then 'withdrawal_review' else 'kyc_required' end,
      earnings_paused=true,
      sponsored_rewards_paused=true,
      version=version+1,
      updated_at=now()
  where user_id=v_user;

  return jsonb_build_object(
    'ok',true,'idempotent',false,'withdrawal_id',v_withdrawal.id,
    'public_reference',v_reference,'status',v_status,'amount',p_amount,
    'available_balance',v_wallet.available_balance-p_amount,
    'held_balance',v_wallet.held_balance+p_amount,
    'kyc_required',not v_kyc_approved
  );
end;
$$;

revoke all on function public.chatearn_request_withdrawal_v5(uuid,bigint,text,text) from public, anon;
grant execute on function public.chatearn_request_withdrawal_v5(uuid,bigint,text,text) to authenticated;

create or replace function public.chatearn_get_withdrawal_state_v5()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'ok', auth.uid() is not null,
    'wallet', (select to_jsonb(w) from public.wallets w where w.user_id=auth.uid()),
    'progress', (select to_jsonb(p) from public.withdrawal_progress p where p.user_id=auth.uid()),
    'active_withdrawal', (
      select to_jsonb(x) from (
        select id,amount,currency,status,public_reference,submitted_at,processing_at,paid_at,cancelled_at,user_note
        from public.withdrawals
        where user_id=auth.uid()
          and status::text in ('submitted','sharing_required','kyc_required','under_review','processing','needs_action')
        order by submitted_at desc limit 1
      ) x
    ),
    'history', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.submitted_at desc)
      from (
        select id,amount,currency,status,public_reference,submitted_at,processing_at,paid_at,cancelled_at
        from public.withdrawals where user_id=auth.uid()
        order by submitted_at desc limit 20
      ) x
    ),'[]'::jsonb),
    'payout_accounts', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.is_default desc,x.created_at desc)
      from (
        select id,provider,account_name,right(account_number,4) as account_last4,is_default,verified_at,created_at
        from public.payout_accounts where user_id=auth.uid() and archived_at is null
      ) x
    ),'[]'::jsonb)
  )
$$;

revoke all on function public.chatearn_get_withdrawal_state_v5() from public, anon;
grant execute on function public.chatearn_get_withdrawal_state_v5() to authenticated;
