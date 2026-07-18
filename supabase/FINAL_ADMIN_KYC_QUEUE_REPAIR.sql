-- ChatEarn final admin KYC queue repair
-- Safe to run repeatedly. Restores the KYC queue and bulk review RPCs used by the admin panel.

begin;

create schema if not exists chatearn_private;

create or replace function chatearn_private.assert_chatearn_admin()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, chatearn_private
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Reuse an existing project-specific admin checker when available.
  if to_regprocedure('chatearn_private.assert_admin()') is not null then
    execute 'select chatearn_private.assert_admin()';
    return;
  end if;
  if to_regprocedure('chatearn_private.require_admin()') is not null then
    execute 'select chatearn_private.require_admin()';
    return;
  end if;

  -- Fall back to common admin tables/columns without assuming one fixed schema.
  if to_regclass('public.admin_users') is not null then
    execute 'select exists(select 1 from public.admin_users where user_id = $1 and coalesce(active,true))'
      into v_allowed using v_uid;
  end if;

  if not v_allowed and to_regclass('public.profiles') is not null then
    execute $q$
      select exists(
        select 1 from public.profiles p
        where p.id = $1
          and (
            coalesce((to_jsonb(p)->>'is_admin')::boolean,false)
            or lower(coalesce(to_jsonb(p)->>'role','')) in ('admin','super_admin','owner')
          )
      )
    $q$ into v_allowed using v_uid;
  end if;

  if not v_allowed then
    raise exception 'admin access required' using errcode = '42501';
  end if;
end $$;

revoke all on function chatearn_private.assert_chatearn_admin() from public, anon, authenticated;

create or replace function public.chatearn_v6_admin_queue(
  p_kind text,
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, chatearn_private
as $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_limit integer := greatest(1, least(coalesce(p_limit,100),500));
  v_offset integer := greatest(0, coalesce(p_offset,0));
begin
  perform chatearn_private.assert_chatearn_admin();

  if lower(coalesce(p_kind,'')) <> 'kyc' then
    return jsonb_build_object('ok',false,'message','Unsupported queue type.','rows','[]'::jsonb);
  end if;

  if to_regclass('public.kyc_submissions') is null then
    return jsonb_build_object('ok',true,'rows','[]'::jsonb,'missing_table','public.kyc_submissions');
  end if;

  select coalesce(jsonb_agg(row_data order by sort_at desc), '[]'::jsonb)
  into v_rows
  from (
    select jsonb_build_object(
      'id', k.id,
      'user_id', k.user_id,
      'status', coalesce(to_jsonb(k)->>'status','pending'),
      'full_name', coalesce(to_jsonb(k)->>'full_name', to_jsonb(p)->>'full_name', u.raw_user_meta_data->>'full_name', u.email, 'User'),
      'account_name', coalesce(to_jsonb(k)->>'account_name', to_jsonb(p)->>'full_name'),
      'email', u.email,
      'reference', coalesce(to_jsonb(k)->>'reference', to_jsonb(k)->>'public_reference'),
      'public_reference', coalesce(to_jsonb(k)->>'public_reference', to_jsonb(k)->>'reference'),
      'provider', to_jsonb(k)->>'provider',
      'external_url', coalesce(to_jsonb(k)->>'external_url', to_jsonb(k)->>'verification_url'),
      'external_opened', coalesce((to_jsonb(k)->>'external_opened')::boolean,false),
      'admin_note', to_jsonb(k)->>'admin_note',
      'created_at', coalesce(to_jsonb(k)->>'created_at', to_jsonb(k)->>'submitted_at'),
      'submitted_at', coalesce(to_jsonb(k)->>'submitted_at', to_jsonb(k)->>'created_at')
    ) as row_data,
    coalesce((to_jsonb(k)->>'created_at')::timestamptz,(to_jsonb(k)->>'submitted_at')::timestamptz,now()) as sort_at
    from public.kyc_submissions k
    left join auth.users u on u.id = k.user_id
    left join public.profiles p on to_regclass('public.profiles') is not null and p.id = k.user_id
    where p_status is null or lower(coalesce(to_jsonb(k)->>'status','pending')) = lower(p_status)
    order by sort_at desc
    limit v_limit offset v_offset
  ) q;

  return jsonb_build_object('ok',true,'rows',v_rows,'count',jsonb_array_length(v_rows));
end $$;

revoke all on function public.chatearn_v6_admin_queue(text,text,integer,integer) from public, anon;
grant execute on function public.chatearn_v6_admin_queue(text,text,integer,integer) to authenticated;

create or replace function public.chatearn_v6_admin_bulk_review(
  p_kind text,
  p_ids uuid[],
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, chatearn_private
as $$
declare
  v_id uuid;
  v_ok integer := 0;
  v_failed integer := 0;
  v_status_type text;
  v_set text;
  v_sql text;
  v_allowed_status text := lower(coalesce(p_status,''));
begin
  perform chatearn_private.assert_chatearn_admin();

  if lower(coalesce(p_kind,'')) <> 'kyc' then
    raise exception 'unsupported queue type' using errcode='22023';
  end if;
  if v_allowed_status not in ('approved','rejected') then
    raise exception 'invalid KYC review status' using errcode='22023';
  end if;
  if coalesce(array_length(p_ids,1),0) = 0 then
    return jsonb_build_object('ok',true,'updated',0,'failed',0);
  end if;
  if to_regclass('public.kyc_submissions') is null then
    raise exception 'public.kyc_submissions is missing' using errcode='42P01';
  end if;

  select case
    when data_type = 'USER-DEFINED' then quote_ident(udt_schema)||'.'||quote_ident(udt_name)
    else data_type
  end
  into v_status_type
  from information_schema.columns
  where table_schema='public' and table_name='kyc_submissions' and column_name='status';

  if v_status_type is null then
    raise exception 'KYC status column is missing' using errcode='42703';
  end if;

  foreach v_id in array p_ids loop
    begin
      v_set := format('status = %L::%s', v_allowed_status, v_status_type);
      if exists(select 1 from information_schema.columns where table_schema='public' and table_name='kyc_submissions' and column_name='admin_note') then
        v_set := v_set || format(', admin_note = %L', nullif(btrim(coalesce(p_note,'')),''));
      end if;
      if exists(select 1 from information_schema.columns where table_schema='public' and table_name='kyc_submissions' and column_name='reviewed_at') then
        v_set := v_set || ', reviewed_at = now()';
      end if;
      if exists(select 1 from information_schema.columns where table_schema='public' and table_name='kyc_submissions' and column_name='reviewed_by') then
        v_set := v_set || format(', reviewed_by = %L::uuid', auth.uid());
      end if;
      if exists(select 1 from information_schema.columns where table_schema='public' and table_name='kyc_submissions' and column_name='updated_at') then
        v_set := v_set || ', updated_at = now()';
      end if;

      v_sql := format('update public.kyc_submissions set %s where id = %L::uuid', v_set, v_id);
      execute v_sql;
      if found then v_ok := v_ok + 1; else v_failed := v_failed + 1; end if;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object('ok',v_failed=0,'updated',v_ok,'failed',v_failed,'status',v_allowed_status);
end $$;

revoke all on function public.chatearn_v6_admin_bulk_review(text,uuid[],text,text) from public, anon;
grant execute on function public.chatearn_v6_admin_bulk_review(text,uuid[],text,text) to authenticated;

-- Reassert access to the canonical withdrawal admin RPCs without replacing their financial logic.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('chatearn_admin_list_withdrawals_v5','chatearn_admin_transition_withdrawal_v5')
  loop
    execute format('grant execute on function %s to authenticated',r.signature);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;

select
  p.proname as function_name,
  p.oid::regprocedure::text as signature,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'chatearn_v6_admin_queue',
    'chatearn_v6_admin_bulk_review',
    'chatearn_admin_list_withdrawals_v5',
    'chatearn_admin_transition_withdrawal_v5'
  )
order by p.proname;
