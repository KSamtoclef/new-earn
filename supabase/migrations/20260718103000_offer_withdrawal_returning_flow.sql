-- ChatEarn V8D: payout account capture, compulsory sharing, offer presentation metadata,
-- and returning-user handoff after completed withdrawal.

begin;

create schema if not exists chatearn_private;

-- Offer presentation metadata extends the existing unique-offer router without replacing it.
create table if not exists public.chatearn_offer_presentations (
  offer_key text primary key,
  format text not null default 'native' check (format in ('native','banner','half_screen','interstitial')),
  frequency_messages integer not null default 3 check (frequency_messages between 1 and 100),
  max_per_session integer not null default 3 check (max_per_session between 1 and 20),
  close_delay_seconds integer not null default 0 check (close_delay_seconds between 0 and 15),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chatearn_offer_presentations enable row level security;
revoke all on public.chatearn_offer_presentations from anon, authenticated;

create or replace function public.chatearn_v5_admin_save_offer_presentation(
  p_offer_key text,
  p_format text,
  p_frequency_messages integer default 3,
  p_max_per_session integer default 3,
  p_close_delay_seconds integer default 0,
  p_active boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not public.chatearn_admin_v2_is_admin() then
    raise exception 'administrator permission required' using errcode='42501';
  end if;
  if p_format not in ('native','banner','half_screen','interstitial') then
    raise exception 'invalid offer format' using errcode='22023';
  end if;
  insert into public.chatearn_offer_presentations(
    offer_key,format,frequency_messages,max_per_session,close_delay_seconds,active,updated_at
  ) values (
    btrim(p_offer_key),p_format,greatest(1,least(100,p_frequency_messages)),
    greatest(1,least(20,p_max_per_session)),greatest(0,least(15,p_close_delay_seconds)),p_active,now()
  )
  on conflict (offer_key) do update set
    format=excluded.format,
    frequency_messages=excluded.frequency_messages,
    max_per_session=excluded.max_per_session,
    close_delay_seconds=excluded.close_delay_seconds,
    active=excluded.active,
    updated_at=now();
  return jsonb_build_object('ok',true,'offer_key',btrim(p_offer_key));
end;
$$;

revoke all on function public.chatearn_v5_admin_save_offer_presentation(text,text,integer,integer,integer,boolean) from public, anon;
grant execute on function public.chatearn_v5_admin_save_offer_presentation(text,text,integer,integer,integer,boolean) to authenticated;

create or replace function public.chatearn_v5_get_offer_presentation(p_offer_key text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    (select jsonb_build_object(
      'offer_key',offer_key,
      'format',format,
      'frequency_messages',frequency_messages,
      'max_per_session',max_per_session,
      'close_delay_seconds',close_delay_seconds,
      'active',active
    ) from public.chatearn_offer_presentations
      where offer_key=p_offer_key and active=true),
    jsonb_build_object(
      'offer_key',p_offer_key,
      'format','native',
      'frequency_messages',3,
      'max_per_session',3,
      'close_delay_seconds',0,
      'active',true
    )
  )
$$;

revoke all on function public.chatearn_v5_get_offer_presentation(text) from public, anon;
grant execute on function public.chatearn_v5_get_offer_presentation(text) to authenticated;

-- Payout account capture. Accounts remain unverified until the existing verification/admin flow approves them.
create or replace function public.chatearn_save_payout_account_v5(
  p_provider text,
  p_account_number text,
  p_account_name text,
  p_is_default boolean default true
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
  if v_provider not in ('opay','palmpay') then raise exception 'unsupported payout provider' using errcode='22023'; end if;
  if char_length(v_number) <> 10 then raise exception 'account number must contain 10 digits' using errcode='22023'; end if;
  if char_length(v_name) < 3 then raise exception 'account name is required' using errcode='22023'; end if;

  if p_is_default then
    update public.payout_accounts set is_default=false where user_id=v_user and archived_at is null;
  end if;

  insert into public.payout_accounts(user_id,provider,account_number,account_name,is_default,verified_at)
  values(v_user,v_provider,v_number,left(v_name,120),coalesce(p_is_default,true),null)
  returning * into v_account;

  return jsonb_build_object(
    'ok',true,
    'account',jsonb_build_object(
      'id',v_account.id,
      'provider',v_account.provider,
      'account_name',v_account.account_name,
      'masked_account','•••• '||right(v_account.account_number,4),
      'verified',false,
      'is_default',v_account.is_default
    ),
    'message','Payout account saved. Verification is required before withdrawal.'
  );
end;
$$;

revoke all on function public.chatearn_save_payout_account_v5(text,text,text,boolean) from public, anon;
grant execute on function public.chatearn_save_payout_account_v5(text,text,text,boolean) to authenticated;

-- Compulsory share progress for each withdrawal.
create table if not exists public.chatearn_withdrawal_share_progress (
  withdrawal_id uuid primary key references public.withdrawals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  required_count integer not null default 5 check (required_count between 1 and 20),
  completed_count integer not null default 0 check (completed_count >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chatearn_withdrawal_share_progress enable row level security;
revoke all on public.chatearn_withdrawal_share_progress from anon, authenticated;

-- Force every new withdrawal through the sharing-required stage after funds are reserved.
create or replace function public.chatearn_submit_withdrawal_v5(
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
  v_result jsonb;
  v_withdrawal_id uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok',false,'code','authentication_required','message','Please log in again.');
  end if;

  v_result := public.chatearn_request_withdrawal_v5(
    p_payout_account_id,p_amount,p_idempotency_key,p_user_note
  );

  if coalesce((v_result->>'ok')::boolean,false) is not true then return v_result; end if;
  v_withdrawal_id := (v_result->>'withdrawal_id')::uuid;

  update public.withdrawals
  set status='sharing_required'::public.withdrawal_status,
      updated_at=now()
  where id=v_withdrawal_id and user_id=v_user;

  insert into public.chatearn_withdrawal_share_progress(withdrawal_id,user_id,required_count)
  values(v_withdrawal_id,v_user,5)
  on conflict (withdrawal_id) do nothing;

  update public.chatearn_user_journeys
  set journey_state='sharing_required',
      earnings_paused=true,
      sponsored_rewards_paused=true,
      version=version+1,
      updated_at=now()
  where user_id=v_user;

  return v_result || jsonb_build_object(
    'status','sharing_required',
    'message','Your funds are reserved. Complete the required sharing step to continue.',
    'sharing',jsonb_build_object('required',5,'completed',0)
  );
exception
  when others then
    return jsonb_build_object('ok',false,'code','withdrawal_submission_failed','message',sqlerrm,'retryable',true);
end;
$$;

revoke all on function public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text) from public, anon;
grant execute on function public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text) to authenticated;

create or replace function public.chatearn_record_withdrawal_share_v5(
  p_withdrawal_id uuid,
  p_channel text default 'whatsapp'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_progress public.chatearn_withdrawal_share_progress;
  v_kyc_approved boolean;
begin
  if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
  if lower(coalesce(p_channel,'')) <> 'whatsapp' then raise exception 'unsupported sharing channel' using errcode='22023'; end if;

  select * into v_progress
  from public.chatearn_withdrawal_share_progress
  where withdrawal_id=p_withdrawal_id and user_id=v_user
  for update;
  if not found then raise exception 'sharing progress not found' using errcode='P0002'; end if;

  if v_progress.completed_at is null then
    update public.chatearn_withdrawal_share_progress
    set completed_count=least(required_count,completed_count+1),
        completed_at=case when completed_count+1>=required_count then now() else null end,
        updated_at=now()
    where withdrawal_id=p_withdrawal_id
    returning * into v_progress;
  end if;

  if v_progress.completed_at is not null then
    select exists(
      select 1 from public.kyc_submissions
      where user_id=v_user and status::text='approved'
        and (expires_at is null or expires_at>now())
    ) into v_kyc_approved;

    update public.withdrawals
    set status=(case when v_kyc_approved then 'under_review' else 'kyc_required' end)::public.withdrawal_status,
        updated_at=now()
    where id=p_withdrawal_id and user_id=v_user and status::text='sharing_required';

    update public.chatearn_user_journeys
    set journey_state=case when v_kyc_approved then 'withdrawal_review' else 'kyc_required' end,
        version=version+1,
        updated_at=now()
    where user_id=v_user;
  end if;

  return jsonb_build_object(
    'ok',true,
    'withdrawal_id',p_withdrawal_id,
    'required',v_progress.required_count,
    'completed',v_progress.completed_count,
    'done',v_progress.completed_at is not null,
    'next',case when v_progress.completed_at is null then 'share' when v_kyc_approved then 'processing' else 'kyc' end
  );
end;
$$;

revoke all on function public.chatearn_record_withdrawal_share_v5(uuid,text) from public, anon;
grant execute on function public.chatearn_record_withdrawal_share_v5(uuid,text) to authenticated;

create or replace function public.chatearn_get_withdrawal_share_state_v5(p_withdrawal_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((
    select jsonb_build_object(
      'ok',true,
      'withdrawal_id',withdrawal_id,
      'required',required_count,
      'completed',completed_count,
      'done',completed_at is not null
    ) from public.chatearn_withdrawal_share_progress
    where withdrawal_id=p_withdrawal_id and user_id=auth.uid()
  ),jsonb_build_object('ok',false,'code','not_found'))
$$;

revoke all on function public.chatearn_get_withdrawal_share_state_v5(uuid) from public, anon;
grant execute on function public.chatearn_get_withdrawal_share_state_v5(uuid) to authenticated;

-- When payment reaches a terminal success state, restore earning and mark the account as returning.
create or replace function chatearn_private.handle_paid_withdrawal_returning_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status::text in ('paid','completed')
     and old.status::text is distinct from new.status::text then
    update public.chatearn_user_journeys
    set first_withdrawal_gate_passed=true,
        active_withdrawal_id=null,
        journey_state='earning_enabled',
        earnings_paused=false,
        sponsored_rewards_paused=false,
        version=version+1,
        updated_at=now()
    where user_id=new.user_id;

    update public.withdrawal_progress
    set earnings_paused=false,updated_at=now()
    where user_id=new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists chatearn_paid_withdrawal_returning_user on public.withdrawals;
create trigger chatearn_paid_withdrawal_returning_user
after update of status on public.withdrawals
for each row execute function chatearn_private.handle_paid_withdrawal_returning_user();

notify pgrst, 'reload schema';
commit;
