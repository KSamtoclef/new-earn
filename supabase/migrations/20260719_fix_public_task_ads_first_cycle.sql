begin;

create or replace function public.chatearn_get_chat_task_config()
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog','public'
as $$
  select case
    when t.id is null or coalesce(t.active,false) is false or t.archived_at is not null then
      jsonb_build_object('available',false)
    else jsonb_build_object(
      'available',true,
      'title',coalesce(nullif(t.title,''),'Quick earning task'),
      'description',coalesce(nullif(t.description,''),'Complete this task, then return and continue earning.'),
      'cta',coalesce(nullif(t.cta,''),'Start task'),
      'task_type',coalesce(nullif(t.task_type,''),'offer'),
      'linked_offer_key',t.linked_offer_key,
      'external_url',t.external_url,
      'trigger_message_count',greatest(1,coalesce(t.trigger_message_count,3)),
      'audience',coalesce(nullif(t.audience,''),'all'),
      'placement',coalesce(nullif(t.placement,''),'chat')
    )
  end
  from (select 1) seed
  left join public.chatearn_chat_task_config t on t.id=true;
$$;

revoke all on function public.chatearn_get_chat_task_config() from public;
grant execute on function public.chatearn_get_chat_task_config() to anon, authenticated;

create or replace function public.chatearn_first_cycle_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public'
as $$
declare
  v_user uuid := auth.uid();
  v_balance bigint := 0;
  v_unlocked boolean := false;
begin
  if v_user is null then
    return jsonb_build_object('authenticated',false,'balance',0,'unlocked',false,'limit',80000,'minimum',40000);
  end if;

  select greatest(0,coalesce(p.balance,0))::bigint into v_balance
  from public.profiles p where p.user_id=v_user;

  v_unlocked := exists(
    select 1 from public.withdrawals w
    where w.user_id=v_user
      and w.status::text in ('under_review','processing','paid','completed')
  ) or exists(
    select 1 from public.chatearn_user_journeys j
    where j.user_id=v_user
      and coalesce(j.first_withdrawal_gate_passed,false)=true
  );

  return jsonb_build_object(
    'authenticated',true,
    'balance',coalesce(v_balance,0),
    'unlocked',v_unlocked,
    'limit',80000,
    'minimum',40000
  );
end;
$$;

revoke all on function public.chatearn_first_cycle_state() from public,anon;
grant execute on function public.chatearn_first_cycle_state() to authenticated;

-- Tighten the canonical send RPC: merely submitting or sharing a withdrawal
-- does not unlock another earning cycle. Review/processing or a completed gate does.
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.chatearn_send_message(text,text,text,text)'::regprocedure) into v_def;
  v_new := replace(
    v_def,
    '''submitted'', ''sharing_required'', ''kyc_required'', ''under_review'',
        ''needs_action'', ''processing'', ''paid'', ''completed''',
    '''under_review'', ''processing'', ''paid'', ''completed'''
  );
  if v_new = v_def then
    raise exception 'Expected first-cycle status block was not found in chatearn_send_message';
  end if;
  execute v_new;
end
$$;

commit;
