-- ChatEarn stable V7 withdrawal endpoints
-- Run once in Supabase SQL Editor.

begin;

create or replace function public.chatearn_place_withdrawal_now_v7(
  p_provider text,
  p_account_number text,
  p_account_name text,
  p_amount bigint,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'code','authentication_required','message','Please sign in again.');
  end if;
  if to_regprocedure('public.chatearn_place_withdrawal_direct_v6_impl(text,text,text,bigint,text)') is not null then
    execute 'select public.chatearn_place_withdrawal_direct_v6_impl($1,$2,$3,$4,$5)'
      into v_result using p_provider,p_account_number,p_account_name,p_amount,p_idempotency_key;
  elsif to_regprocedure('public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text)') is not null then
    v_result := public.chatearn_place_withdrawal_direct_v6(p_provider,p_account_number,p_account_name,p_amount,p_idempotency_key);
  else
    return jsonb_build_object('ok',false,'code','withdrawal_service_unavailable','message','Withdrawal service is temporarily unavailable.');
  end if;
  return v_result;
exception when others then
  return jsonb_build_object('ok',false,'code','withdrawal_failed','message','We could not place the withdrawal yet. Please try again.');
end;
$$;

create or replace function public.chatearn_admin_list_withdrawals_v7(
  p_status text default null,
  p_limit integer default 200,
  p_offset integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_result jsonb;
begin
  if to_regprocedure('public.chatearn_admin_list_withdrawals_v5_impl(text,integer,integer)') is not null then
    execute 'select public.chatearn_admin_list_withdrawals_v5_impl($1,$2,$3)' into v_result using p_status,p_limit,p_offset;
  elsif to_regprocedure('public.chatearn_admin_list_withdrawals_v5(text,integer,integer)') is not null then
    v_result := public.chatearn_admin_list_withdrawals_v5(p_status,p_limit,p_offset);
  else
    raise exception 'withdrawal admin service unavailable';
  end if;
  return v_result;
end;
$$;

create or replace function public.chatearn_admin_transition_withdrawal_v7(
  p_withdrawal_id uuid,
  p_action text,
  p_reason text default null,
  p_admin_note text default null,
  p_external_withdrawal_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_result jsonb;
begin
  if to_regprocedure('public.chatearn_admin_transition_withdrawal_v5_impl(uuid,text,text,text,uuid)') is not null then
    execute 'select public.chatearn_admin_transition_withdrawal_v5_impl($1,$2,$3,$4,$5)'
      into v_result using p_withdrawal_id,p_action,p_reason,p_admin_note,p_external_withdrawal_id;
  elsif to_regprocedure('public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid)') is not null then
    v_result := public.chatearn_admin_transition_withdrawal_v5(p_withdrawal_id,p_action,p_reason,p_admin_note,p_external_withdrawal_id);
  else
    raise exception 'withdrawal transition service unavailable';
  end if;
  return v_result;
end;
$$;

revoke all on function public.chatearn_place_withdrawal_now_v7(text,text,text,bigint,text) from public,anon;
revoke all on function public.chatearn_admin_list_withdrawals_v7(text,integer,integer) from public,anon;
revoke all on function public.chatearn_admin_transition_withdrawal_v7(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.chatearn_place_withdrawal_now_v7(text,text,text,bigint,text) to authenticated;
grant execute on function public.chatearn_admin_list_withdrawals_v7(text,integer,integer) to authenticated;
grant execute on function public.chatearn_admin_transition_withdrawal_v7(uuid,text,text,text,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;

select p.proname,p.proargnames,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('chatearn_place_withdrawal_now_v7','chatearn_admin_list_withdrawals_v7','chatearn_admin_transition_withdrawal_v7')
order by p.proname;