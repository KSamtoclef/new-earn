-- ChatEarn final PostgREST named-argument bridge
-- Run this entire file once in Supabase SQL Editor.
-- It preserves existing verified function logic, but exposes the exact parameter names used by supabase-js.

begin;

-- Helper pattern: move the existing implementation aside once, then expose a stable wrapper.

-- Admin withdrawal list: frontend sends p_status, p_limit, p_offset.
do $$
begin
  if to_regprocedure('public.chatearn_admin_list_withdrawals_v5(text,integer,integer)') is not null
     and to_regprocedure('public.chatearn_admin_list_withdrawals_v5_impl(text,integer,integer)') is null then
    alter function public.chatearn_admin_list_withdrawals_v5(text,integer,integer)
      rename to chatearn_admin_list_withdrawals_v5_impl;
  elsif to_regprocedure('public.chatearn_admin_list_withdrawals_v5(text,integer,integer)') is not null
     and to_regprocedure('public.chatearn_admin_list_withdrawals_v5_impl(text,integer,integer)') is not null then
    drop function public.chatearn_admin_list_withdrawals_v5(text,integer,integer);
  end if;
end $$;

create function public.chatearn_admin_list_withdrawals_v5(
  p_status text default null,
  p_limit integer default 200,
  p_offset integer default 0
) returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.chatearn_admin_list_withdrawals_v5_impl(p_status, p_limit, p_offset);
$$;

-- Admin withdrawal transition: exact names used by the canonical admin UI.
do $$
begin
  if to_regprocedure('public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid)') is not null
     and to_regprocedure('public.chatearn_admin_transition_withdrawal_v5_impl(uuid,text,text,text,uuid)') is null then
    alter function public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid)
      rename to chatearn_admin_transition_withdrawal_v5_impl;
  elsif to_regprocedure('public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid)') is not null
     and to_regprocedure('public.chatearn_admin_transition_withdrawal_v5_impl(uuid,text,text,text,uuid)') is not null then
    drop function public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid);
  end if;
end $$;

create function public.chatearn_admin_transition_withdrawal_v5(
  p_withdrawal_id uuid,
  p_action text,
  p_reason text default null,
  p_admin_note text default null,
  p_external_withdrawal_id uuid default null
) returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.chatearn_admin_transition_withdrawal_v5_impl(
    p_withdrawal_id, p_action, p_reason, p_admin_note, p_external_withdrawal_id
  );
$$;

-- Direct withdrawal: exact names sent by the user withdrawal form.
do $$
begin
  if to_regprocedure('public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text)') is not null
     and to_regprocedure('public.chatearn_place_withdrawal_direct_v6_impl(text,text,text,bigint,text)') is null then
    alter function public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text)
      rename to chatearn_place_withdrawal_direct_v6_impl;
  elsif to_regprocedure('public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text)') is not null
     and to_regprocedure('public.chatearn_place_withdrawal_direct_v6_impl(text,text,text,bigint,text)') is not null then
    drop function public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text);
  end if;
end $$;

create function public.chatearn_place_withdrawal_direct_v6(
  p_provider text,
  p_account_number text,
  p_account_name text,
  p_amount bigint,
  p_idempotency_key text
) returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.chatearn_place_withdrawal_direct_v6_impl(
    p_provider, p_account_number, p_account_name, p_amount, p_idempotency_key
  );
$$;

-- KYC queue: exact names sent by the canonical admin panel.
do $$
begin
  if to_regprocedure('public.chatearn_v6_admin_queue(text,text,integer,integer)') is not null
     and to_regprocedure('public.chatearn_v6_admin_queue_impl(text,text,integer,integer)') is null then
    alter function public.chatearn_v6_admin_queue(text,text,integer,integer)
      rename to chatearn_v6_admin_queue_impl;
  elsif to_regprocedure('public.chatearn_v6_admin_queue(text,text,integer,integer)') is not null
     and to_regprocedure('public.chatearn_v6_admin_queue_impl(text,text,integer,integer)') is not null then
    drop function public.chatearn_v6_admin_queue(text,text,integer,integer);
  end if;
end $$;

create function public.chatearn_v6_admin_queue(
  p_kind text,
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
) returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.chatearn_v6_admin_queue_impl(p_kind, p_status, p_limit, p_offset);
$$;

-- KYC bulk review: exact names sent by the canonical admin panel.
do $$
begin
  if to_regprocedure('public.chatearn_v6_admin_bulk_review(text,uuid[],text,text)') is not null
     and to_regprocedure('public.chatearn_v6_admin_bulk_review_impl(text,uuid[],text,text)') is null then
    alter function public.chatearn_v6_admin_bulk_review(text,uuid[],text,text)
      rename to chatearn_v6_admin_bulk_review_impl;
  elsif to_regprocedure('public.chatearn_v6_admin_bulk_review(text,uuid[],text,text)') is not null
     and to_regprocedure('public.chatearn_v6_admin_bulk_review_impl(text,uuid[],text,text)') is not null then
    drop function public.chatearn_v6_admin_bulk_review(text,uuid[],text,text);
  end if;
end $$;

create function public.chatearn_v6_admin_bulk_review(
  p_kind text,
  p_ids uuid[],
  p_status text,
  p_note text default null
) returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.chatearn_v6_admin_bulk_review_impl(p_kind, p_ids, p_status, p_note);
$$;

revoke all on function public.chatearn_admin_list_withdrawals_v5(text,integer,integer) from public, anon;
revoke all on function public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid) from public, anon;
revoke all on function public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text) from public, anon;
revoke all on function public.chatearn_v6_admin_queue(text,text,integer,integer) from public, anon;
revoke all on function public.chatearn_v6_admin_bulk_review(text,uuid[],text,text) from public, anon;

grant execute on function public.chatearn_admin_list_withdrawals_v5(text,integer,integer) to authenticated;
grant execute on function public.chatearn_admin_transition_withdrawal_v5(uuid,text,text,text,uuid) to authenticated;
grant execute on function public.chatearn_place_withdrawal_direct_v6(text,text,text,bigint,text) to authenticated;
grant execute on function public.chatearn_v6_admin_queue(text,text,integer,integer) to authenticated;
grant execute on function public.chatearn_v6_admin_bulk_review(text,uuid[],text,text) to authenticated;

notify pgrst, 'reload schema';
commit;

-- Verification: argument_names must match exactly and authenticated_can_execute must be true.
select
  p.proname as function_name,
  p.oid::regprocedure::text as signature,
  p.proargnames as argument_names,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'chatearn_admin_list_withdrawals_v5',
    'chatearn_admin_transition_withdrawal_v5',
    'chatearn_place_withdrawal_direct_v6',
    'chatearn_v6_admin_queue',
    'chatearn_v6_admin_bulk_review'
  )
order by p.proname;
