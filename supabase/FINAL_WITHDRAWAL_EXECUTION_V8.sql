-- ChatEarn final withdrawal execution V8
-- Run this entire file once in Supabase SQL Editor.

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
  v_user uuid := auth.uid();
  v_saved jsonb;
  v_account_id uuid;
  v_result jsonb;
  v_existing public.withdrawals;
  v_key text := nullif(btrim(coalesce(p_idempotency_key,'')),'');
  v_amount bigint := greatest(0,coalesce(p_amount,0));
begin
  if v_user is null then
    return jsonb_build_object('ok',false,'code','authentication_required');
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
      'next','sharewall'
    );
  end if;

  if v_amount < 40000 then
    return jsonb_build_object('ok',false,'code','minimum_not_reached');
  end if;

  v_saved := public.chatearn_save_payout_account_v5(
    p_provider,
    p_account_number,
    p_account_name,
    false
  );

  if coalesce((v_saved->>'ok')::boolean,false) is not true then
    return jsonb_build_object('ok',false,'code','bank_details_failed');
  end if;

  v_account_id := (v_saved->'account'->>'id')::uuid;
  if v_account_id is null then
    return jsonb_build_object('ok',false,'code','bank_details_failed');
  end if;

  v_result := public.chatearn_submit_withdrawal_v5(
    v_account_id,
    v_amount,
    v_key,
    null
  );

  if coalesce((v_result->>'ok')::boolean,false) is not true then
    return v_result;
  end if;

  return v_result || jsonb_build_object(
    'ok',true,
    'payout_account_id',v_account_id,
    'next','sharewall'
  );
exception when others then
  return jsonb_build_object('ok',false,'code','withdrawal_failed');
end;
$$;

revoke all on function public.chatearn_place_withdrawal_now_v7(text,text,text,bigint,text) from public, anon;
grant execute on function public.chatearn_place_withdrawal_now_v7(text,text,text,bigint,text) to authenticated;

notify pgrst, 'reload schema';
commit;

select
  p.proname,
  p.proargnames,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname='chatearn_place_withdrawal_now_v7';