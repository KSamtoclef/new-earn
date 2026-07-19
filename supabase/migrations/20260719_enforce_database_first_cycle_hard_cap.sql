begin;

-- One authoritative definition of a completed first-withdrawal cycle.
-- A fresh account is never unlocked merely because its journey state is
-- "earning_enabled". Only a reviewed/processing/completed withdrawal or the
-- explicit first_withdrawal_gate_passed flag unlocks another earning cycle.
create or replace function public.chatearn_first_cycle_unlocked_for(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select p_user is not null and (
    exists (
      select 1
      from public.withdrawals w
      where w.user_id = p_user
        and lower(w.status::text) in ('under_review', 'processing', 'paid', 'completed')
    )
    or exists (
      select 1
      from public.chatearn_user_journeys j
      where j.user_id = p_user
        and coalesce(j.first_withdrawal_gate_passed, false) = true
    )
  );
$$;

revoke all on function public.chatearn_first_cycle_unlocked_for(uuid) from public, anon;
grant execute on function public.chatearn_first_cycle_unlocked_for(uuid) to authenticated;

-- Replace the complete unlock expression inside the active canonical RPC.
-- This edits only the v_can_continue assignment and preserves the rest of the
-- already-working canonical chat transaction.
do $$
declare
  v_oid oid;
  v_definition text;
  v_start integer;
  v_marker integer;
  v_rebuilt text;
begin
  select 'public.chatearn_send_message(text,text,text,text)'::regprocedure::oid
    into v_oid;

  select pg_get_functiondef(v_oid)
    into v_definition;

  v_start := strpos(v_definition, 'v_can_continue := exists(');
  v_marker := strpos(v_definition, 'if not v_can_continue and v_balance >= 80000 then');

  if v_start = 0 or v_marker = 0 or v_marker <= v_start then
    raise exception 'Unable to locate the first-cycle decision block in chatearn_send_message';
  end if;

  v_rebuilt := substr(v_definition, 1, v_start - 1)
    || 'v_can_continue := public.chatearn_first_cycle_unlocked_for(v_user);'
    || chr(10) || chr(10) || '  '
    || substr(v_definition, v_marker);

  execute v_rebuilt;
end
$$;

-- Keep the public state endpoint on the exact same server-side rule.
create or replace function public.chatearn_first_cycle_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_balance bigint := 0;
  v_unlocked boolean := false;
begin
  if v_user is null then
    return jsonb_build_object(
      'authenticated', false,
      'balance', 0,
      'unlocked', false,
      'limit', 80000,
      'minimum', 40000
    );
  end if;

  select greatest(0, coalesce(p.balance, 0))::bigint
    into v_balance
  from public.profiles p
  where p.user_id = v_user;

  v_unlocked := public.chatearn_first_cycle_unlocked_for(v_user);

  return jsonb_build_object(
    'authenticated', true,
    'user_id', v_user,
    'balance', coalesce(v_balance, 0),
    'unlocked', v_unlocked,
    'blocked', coalesce(v_balance, 0) >= 80000 and not v_unlocked,
    'limit', 80000,
    'minimum', 40000
  );
end;
$$;

revoke all on function public.chatearn_first_cycle_state() from public, anon;
grant execute on function public.chatearn_first_cycle_state() to authenticated;

-- Installation guards. The migration must fail rather than report success if
-- the live reward function can still use the registration-time journey state.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.chatearn_send_message(text,text,text,text)'::regprocedure
  ) into v_definition;

  if v_definition not ilike '%chatearn_first_cycle_unlocked_for(v_user)%' then
    raise exception 'The chat RPC is not using the authoritative first-cycle rule';
  end if;

  if v_definition ilike '%journey_state%'
     or v_definition ilike '%earning_enabled%'
     or v_definition ilike '%sharing_required%'
     or v_definition ilike '%kyc_required%'
     or v_definition ilike '%needs_action%' then
    raise exception 'The chat RPC still contains a premature first-cycle unlock path';
  end if;

  if v_definition not ilike '%v_balance >= 80000%'
     or v_definition not ilike '%80000 - v_balance%' then
    raise exception 'The database hard cap is missing from the chat RPC';
  end if;
end
$$;

commit;
