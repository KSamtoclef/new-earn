-- ChatEarn one-click live Supabase installer
-- Run this entire file once in Supabase SQL Editor.
-- It upgrades the existing ChatEarn database used by chat-earn.xyz.

begin;
set local lock_timeout = '20s';

create schema if not exists chatearn_private;

-- Fail early with one clear message rather than leaving half-installed functions.
do $$
declare
  missing text[] := array[]::text[];
begin
  if to_regclass('public.wallets') is null then missing := array_append(missing,'public.wallets'); end if;
  if to_regclass('public.withdrawals') is null then missing := array_append(missing,'public.withdrawals'); end if;
  if to_regclass('public.payout_accounts') is null then missing := array_append(missing,'public.payout_accounts'); end if;
  if to_regclass('public.withdrawal_progress') is null then missing := array_append(missing,'public.withdrawal_progress'); end if;
  if to_regclass('public.chatearn_user_journeys') is null then missing := array_append(missing,'public.chatearn_user_journeys'); end if;
  if to_regprocedure('public.chatearn_request_withdrawal_v5(uuid,bigint,text,text)') is null then
    missing := array_append(missing,'public.chatearn_request_withdrawal_v5(uuid,bigint,text,text)');
  end if;
  if array_length(missing,1) is not null then
    raise exception 'ChatEarn core dependency missing: %', array_to_string(missing,', ');
  end if;
end $$;

-- Correct thresholds: withdrawal available at 40k, first session pauses at 80k.
insert into public.chatearn_settings(setting_key,value,description,is_public)
values
 ('first_withdrawal_threshold','40000'::jsonb,'Balance at which withdrawal becomes available.',false),
 ('first_session_earning_limit','80000'::jsonb,'Balance at which the first earning session pauses until withdrawal.',false)
on conflict (setting_key) do update
set value=excluded.value,description=excluded.description,updated_at=now();

create or replace function chatearn_private.apply_first_withdrawal_pause(p_user_id uuid,p_balance bigint)
returns public.chatearn_user_journeys
language plpgsql
security definer
set search_path=pg_catalog,public,chatearn_private
as $$
declare
  v_limit bigint;
  v_journey public.chatearn_user_journeys;
begin
  if p_user_id is null then raise exception 'user_id is required' using errcode='22004'; end if;
  v_limit := greatest(1,chatearn_private.setting_bigint('first_session_earning_limit',80000));
  select * into v_journey from public.chatearn_user_journeys where user_id=p_user_id for update;
  if not found then raise exception 'account journey is missing' using errcode='55000'; end if;
  if coalesce(p_balance,0)>=v_limit and not v_journey.first_withdrawal_gate_passed and v_journey.journey_state='earning_enabled' then
    update public.chatearn_user_journeys
    set journey_state='withdrawal_required',earnings_paused=true,sponsored_rewards_paused=true,version=version+1,updated_at=now()
    where user_id=p_user_id returning * into v_journey;
  end if;
  return v_journey;
end $$;

update public.chatearn_user_journeys j
set journey_state='earning_enabled',earnings_paused=false,sponsored_rewards_paused=false,version=version+1,updated_at=now()
where not j.first_withdrawal_gate_passed
  and j.journey_state='withdrawal_required'
  and coalesce((select sum(l.signed_amount)::bigint from public.chatearn_wallet_ledger l where l.user_id=j.user_id),0)<80000;

-- Public payout account API.
create or replace function public.chatearn_get_payout_accounts_v5()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public
as $$
select case when auth.uid() is null then jsonb_build_object('ok',false,'code','authentication_required','accounts','[]'::jsonb)
else jsonb_build_object('ok',true,'accounts',coalesce((
  select jsonb_agg(jsonb_build_object(
    'id',p.id,'provider',p.provider,'account_name',p.account_name,
    'account_last4',right(coalesce(p.account_number,''),4),
    'masked_account',case when char_length(coalesce(p.account_number,''))>=4 then '•••• '||right(p.account_number,4) else '••••' end,
    'is_default',p.is_default,'verified',p.verified_at is not null,'verified_at',p.verified_at,'created_at',p.created_at
  ) order by p.is_default desc,p.created_at desc)
  from public.payout_accounts p where p.user_id=auth.uid() and p.archived_at is null
),'[]'::jsonb)) end
$$;
revoke all on function public.chatearn_get_payout_accounts_v5() from public,anon;
grant execute on function public.chatearn_get_payout_accounts_v5() to authenticated;

create or replace function public.chatearn_save_payout_account_v5(
  p_provider text,p_account_number text,p_account_name text,p_is_default boolean default true
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  v_user uuid:=auth.uid();
  v_number text:=regexp_replace(coalesce(p_account_number,''),'\D','','g');
  v_name text:=btrim(coalesce(p_account_name,''));
  v_provider text:=lower(btrim(coalesce(p_provider,'')));
  v_account public.payout_accounts;
begin
  if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
  if v_provider not in ('opay','palmpay') then raise exception 'unsupported payout provider' using errcode='22023'; end if;
  if char_length(v_number)<>10 then raise exception 'account number must contain 10 digits' using errcode='22023'; end if;
  if char_length(v_name)<3 then raise exception 'account name is required' using errcode='22023'; end if;
  if p_is_default then update public.payout_accounts set is_default=false where user_id=v_user and archived_at is null; end if;
  insert into public.payout_accounts(user_id,provider,account_number,account_name,is_default,verified_at)
  values(v_user,v_provider,v_number,left(v_name,120),coalesce(p_is_default,true),null)
  returning * into v_account;
  return jsonb_build_object('ok',true,'account',jsonb_build_object(
    'id',v_account.id,'provider',v_account.provider,'account_name',v_account.account_name,
    'masked_account','•••• '||right(v_account.account_number,4),'verified',false,'is_default',v_account.is_default
  ),'message','Payout account saved. Verification is required before withdrawal.');
end $$;
revoke all on function public.chatearn_save_payout_account_v5(text,text,text,boolean) from public,anon;
grant execute on function public.chatearn_save_payout_account_v5(text,text,text,boolean) to authenticated;

-- Safe withdrawal portal response.
create or replace function public.chatearn_get_withdrawal_portal_v5()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public
as $$
declare
  v_user uuid:=auth.uid();
  v_wallet public.wallets;
  v_progress public.withdrawal_progress;
  v_active public.withdrawals;
  v_threshold bigint:=0;
  v_available bigint:=0;
begin
  if v_user is null then return jsonb_build_object('ok',false,'code','authentication_required'); end if;
  select * into v_wallet from public.wallets where user_id=v_user;
  select * into v_progress from public.withdrawal_progress where user_id=v_user;
  select * into v_active from public.withdrawals
   where user_id=v_user and status::text in ('submitted','sharing_required','kyc_required','under_review','processing','needs_action')
   order by submitted_at desc limit 1;
  v_threshold:=greatest(0,coalesce(v_progress.assigned_threshold,40000));
  v_available:=greatest(0,coalesce(v_wallet.available_balance,0));
  return jsonb_build_object(
    'ok',true,
    'wallet',jsonb_build_object('currency',coalesce(v_wallet.currency,'NGN'),'available_balance',v_available,'held_balance',greatest(0,coalesce(v_wallet.held_balance,0))),
    'eligibility',jsonb_build_object('can_submit',v_active.id is null and v_available>=v_threshold,'minimum_amount',v_threshold,'assigned_threshold',v_threshold,'amount_remaining',greatest(0,v_threshold-v_available),'earnings_paused',coalesce(v_progress.earnings_paused,false)),
    'active_withdrawal',case when v_active.id is null then null else jsonb_build_object('id',v_active.id,'public_reference',v_active.public_reference,'amount',v_active.amount,'currency',v_active.currency,'status',v_active.status,'submitted_at',v_active.submitted_at) end,
    'payout_accounts',(public.chatearn_get_payout_accounts_v5()->'accounts')
  );
end $$;
revoke all on function public.chatearn_get_withdrawal_portal_v5() from public,anon;
grant execute on function public.chatearn_get_withdrawal_portal_v5() to authenticated;

-- Compulsory sharing.
create table if not exists public.chatearn_withdrawal_share_progress(
  withdrawal_id uuid primary key references public.withdrawals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  required_count integer not null default 5 check(required_count between 1 and 20),
  completed_count integer not null default 0 check(completed_count>=0),
  completed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.chatearn_withdrawal_share_progress enable row level security;
revoke all on public.chatearn_withdrawal_share_progress from anon,authenticated;

create or replace function public.chatearn_submit_withdrawal_v5(
  p_payout_account_id uuid,p_amount bigint,p_idempotency_key text,p_user_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  v_user uuid:=auth.uid();
  v_result jsonb;
  v_id uuid;
begin
  if v_user is null then return jsonb_build_object('ok',false,'code','authentication_required','message','Please log in again.'); end if;
  v_result:=public.chatearn_request_withdrawal_v5(p_payout_account_id,p_amount,p_idempotency_key,p_user_note);
  if coalesce((v_result->>'ok')::boolean,false) is not true then return v_result; end if;
  v_id:=(v_result->>'withdrawal_id')::uuid;
  update public.withdrawals set status='sharing_required'::public.withdrawal_status,updated_at=now() where id=v_id and user_id=v_user;
  insert into public.chatearn_withdrawal_share_progress(withdrawal_id,user_id,required_count) values(v_id,v_user,5) on conflict(withdrawal_id) do nothing;
  update public.chatearn_user_journeys set journey_state='sharing_required',earnings_paused=true,sponsored_rewards_paused=true,version=version+1,updated_at=now() where user_id=v_user;
  return v_result||jsonb_build_object('status','sharing_required','message','Your funds are reserved. Complete the required sharing step to continue.','sharing',jsonb_build_object('required',5,'completed',0));
exception when others then
  return jsonb_build_object('ok',false,'code','withdrawal_submission_failed','message',sqlerrm,'retryable',true);
end $$;
revoke all on function public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text) from public,anon;
grant execute on function public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text) to authenticated;

create or replace function public.chatearn_record_withdrawal_share_v5(p_withdrawal_id uuid,p_channel text default 'whatsapp')
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  v_user uuid:=auth.uid();
  v_progress public.chatearn_withdrawal_share_progress;
  v_kyc boolean:=false;
begin
  if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
  if lower(coalesce(p_channel,''))<>'whatsapp' then raise exception 'unsupported sharing channel' using errcode='22023'; end if;
  select * into v_progress from public.chatearn_withdrawal_share_progress where withdrawal_id=p_withdrawal_id and user_id=v_user for update;
  if not found then raise exception 'sharing progress not found' using errcode='P0002'; end if;
  if v_progress.completed_at is null then
    update public.chatearn_withdrawal_share_progress
    set completed_count=least(required_count,completed_count+1),completed_at=case when completed_count+1>=required_count then now() else null end,updated_at=now()
    where withdrawal_id=p_withdrawal_id returning * into v_progress;
  end if;
  if v_progress.completed_at is not null then
    select exists(select 1 from public.kyc_submissions where user_id=v_user and status::text='approved' and (expires_at is null or expires_at>now())) into v_kyc;
    update public.withdrawals set status=(case when v_kyc then 'under_review' else 'kyc_required' end)::public.withdrawal_status,updated_at=now()
      where id=p_withdrawal_id and user_id=v_user and status::text='sharing_required';
    update public.chatearn_user_journeys set journey_state=case when v_kyc then 'withdrawal_review' else 'kyc_required' end,version=version+1,updated_at=now() where user_id=v_user;
  end if;
  return jsonb_build_object('ok',true,'withdrawal_id',p_withdrawal_id,'required',v_progress.required_count,'completed',v_progress.completed_count,'done',v_progress.completed_at is not null,'next',case when v_progress.completed_at is null then 'share' when v_kyc then 'processing' else 'kyc' end);
end $$;
revoke all on function public.chatearn_record_withdrawal_share_v5(uuid,text) from public,anon;
grant execute on function public.chatearn_record_withdrawal_share_v5(uuid,text) to authenticated;

create or replace function public.chatearn_get_withdrawal_share_state_v5(p_withdrawal_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
select coalesce((select jsonb_build_object('ok',true,'withdrawal_id',withdrawal_id,'required',required_count,'completed',completed_count,'done',completed_at is not null)
from public.chatearn_withdrawal_share_progress where withdrawal_id=p_withdrawal_id and user_id=auth.uid()),jsonb_build_object('ok',false,'code','not_found'))
$$;
revoke all on function public.chatearn_get_withdrawal_share_state_v5(uuid) from public,anon;
grant execute on function public.chatearn_get_withdrawal_share_state_v5(uuid) to authenticated;

-- Offer display configuration controlled by admin.
create table if not exists public.chatearn_offer_presentations(
  offer_key text primary key,
  format text not null default 'native' check(format in ('native','banner','half_screen','interstitial')),
  frequency_messages integer not null default 3 check(frequency_messages between 1 and 100),
  max_per_session integer not null default 3 check(max_per_session between 1 and 20),
  close_delay_seconds integer not null default 0 check(close_delay_seconds between 0 and 15),
  active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.chatearn_offer_presentations enable row level security;
revoke all on public.chatearn_offer_presentations from anon,authenticated;

create or replace function public.chatearn_v5_get_offer_presentation(p_offer_key text)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
select coalesce((select jsonb_build_object('offer_key',offer_key,'format',format,'frequency_messages',frequency_messages,'max_per_session',max_per_session,'close_delay_seconds',close_delay_seconds,'active',active)
from public.chatearn_offer_presentations where offer_key=p_offer_key and active=true),jsonb_build_object('offer_key',p_offer_key,'format','native','frequency_messages',3,'max_per_session',3,'close_delay_seconds',0,'active',true))
$$;
revoke all on function public.chatearn_v5_get_offer_presentation(text) from public,anon;
grant execute on function public.chatearn_v5_get_offer_presentation(text) to authenticated;

create or replace function public.chatearn_v5_admin_save_offer_presentation(p_offer_key text,p_format text,p_frequency_messages integer default 3,p_max_per_session integer default 3,p_close_delay_seconds integer default 0,p_active boolean default true)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.uid() is null or not public.chatearn_admin_v2_is_admin() then raise exception 'administrator permission required' using errcode='42501'; end if;
  if p_format not in ('native','banner','half_screen','interstitial') then raise exception 'invalid offer format' using errcode='22023'; end if;
  insert into public.chatearn_offer_presentations(offer_key,format,frequency_messages,max_per_session,close_delay_seconds,active,updated_at)
  values(btrim(p_offer_key),p_format,greatest(1,least(100,p_frequency_messages)),greatest(1,least(20,p_max_per_session)),greatest(0,least(15,p_close_delay_seconds)),p_active,now())
  on conflict(offer_key) do update set format=excluded.format,frequency_messages=excluded.frequency_messages,max_per_session=excluded.max_per_session,close_delay_seconds=excluded.close_delay_seconds,active=excluded.active,updated_at=now();
  return jsonb_build_object('ok',true,'offer_key',btrim(p_offer_key));
end $$;
revoke all on function public.chatearn_v5_admin_save_offer_presentation(text,text,integer,integer,integer,boolean) from public,anon;
grant execute on function public.chatearn_v5_admin_save_offer_presentation(text,text,integer,integer,integer,boolean) to authenticated;

-- Restore earning and returning-user state after payment succeeds.
create or replace function chatearn_private.handle_paid_withdrawal_returning_user()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.status::text in ('paid','completed') and old.status::text is distinct from new.status::text then
    update public.chatearn_user_journeys set first_withdrawal_gate_passed=true,active_withdrawal_id=null,journey_state='earning_enabled',earnings_paused=false,sponsored_rewards_paused=false,version=version+1,updated_at=now() where user_id=new.user_id;
    update public.withdrawal_progress set earnings_paused=false,updated_at=now() where user_id=new.user_id;
  end if;
  return new;
end $$;

drop trigger if exists chatearn_withdrawal_returning_user on public.withdrawals;
create trigger chatearn_withdrawal_returning_user after update of status on public.withdrawals for each row execute function chatearn_private.handle_paid_withdrawal_returning_user();

-- Repair users incorrectly paused below 80k.
update public.chatearn_user_journeys j
set journey_state='earning_enabled',earnings_paused=false,sponsored_rewards_paused=false,version=version+1,updated_at=now()
where not j.first_withdrawal_gate_passed
  and j.journey_state='withdrawal_required'
  and coalesce((select sum(l.signed_amount)::bigint from public.chatearn_wallet_ledger l where l.user_id=j.user_id),0)<80000;

notify pgrst,'reload schema';
commit;

-- Verification: this result should show every item as true.
select
 to_regprocedure('public.chatearn_get_withdrawal_portal_v5()') is not null as withdrawal_portal_rpc,
 to_regprocedure('public.chatearn_get_payout_accounts_v5()') is not null as payout_accounts_rpc,
 to_regprocedure('public.chatearn_save_payout_account_v5(text,text,text,boolean)') is not null as save_account_rpc,
 to_regprocedure('public.chatearn_submit_withdrawal_v5(uuid,bigint,text,text)') is not null as submit_withdrawal_rpc,
 to_regprocedure('public.chatearn_record_withdrawal_share_v5(uuid,text)') is not null as share_rpc,
 to_regprocedure('public.chatearn_v5_admin_save_offer_presentation(text,text,integer,integer,integer,boolean)') is not null as offer_admin_rpc;
