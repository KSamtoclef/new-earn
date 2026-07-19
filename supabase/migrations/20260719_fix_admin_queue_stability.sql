begin;

create or replace function public.chatearn_v6_admin_queue_impl(
  p_kind text,
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'chatearn_private'
as $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_status text := lower(trim(coalesce(p_status, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 50));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  perform chatearn_private.assert_chatearn_admin();

  if v_kind = 'kyc' then
    select coalesce(jsonb_agg(q.row_data order by q.sort_at desc), '[]'::jsonb)
    into v_rows
    from (
      select
        jsonb_build_object(
          'id', k.id,
          'user_id', k.user_id,
          'status', coalesce(to_jsonb(k)->>'status', 'draft'),
          'full_name', coalesce(p.display_name, u.raw_user_meta_data->>'full_name', u.email, 'User'),
          'account_name', coalesce(p.display_name, u.raw_user_meta_data->>'full_name', u.email, 'User'),
          'email', u.email,
          'reference', k.id::text,
          'public_reference', k.id::text,
          'provider', coalesce(k.form_data->>'provider', ''),
          'external_url', coalesce(k.form_data->>'external_url', k.form_data->>'verification_url', ''),
          'external_opened', coalesce((k.form_data->>'external_opened')::boolean, false),
          'admin_note', null,
          'created_at', k.created_at,
          'submitted_at', k.submitted_at,
          'reviewed_at', k.reviewed_at
        ) as row_data,
        coalesce(k.submitted_at, k.created_at) as sort_at
      from public.kyc_submissions k
      left join auth.users u on u.id = k.user_id
      left join public.profiles p on p.user_id = k.user_id
      where
        v_status = ''
        or (v_status = 'pending' and lower(k.status::text) in ('draft', 'submitted', 'pending'))
        or lower(k.status::text) = v_status
      order by coalesce(k.submitted_at, k.created_at) desc
      limit v_limit offset v_offset
    ) q;

  elsif v_kind = 'withdrawals' then
    select coalesce(jsonb_agg(q.row_data order by q.sort_at desc), '[]'::jsonb)
    into v_rows
    from (
      select
        jsonb_build_object(
          'id', w.id,
          'user_id', w.user_id,
          'status', w.status::text,
          'full_name', coalesce(p.display_name, u.raw_user_meta_data->>'full_name', u.email, 'User'),
          'account_name', coalesce(p.display_name, u.raw_user_meta_data->>'full_name', u.email, 'User'),
          'email', u.email,
          'amount', w.amount,
          'currency', trim(w.currency::text),
          'public_reference', w.public_reference,
          'reference', w.public_reference,
          'payout_account_id', w.payout_account_id,
          'bank', '',
          'masked_account', '',
          'admin_note', w.admin_note,
          'user_note', w.user_note,
          'submitted_at', w.submitted_at,
          'processing_at', w.processing_at,
          'paid_at', w.paid_at,
          'cancelled_at', w.cancelled_at,
          'updated_at', w.updated_at
        ) as row_data,
        w.submitted_at as sort_at
      from public.withdrawals w
      left join auth.users u on u.id = w.user_id
      left join public.profiles p on p.user_id = w.user_id
      where
        v_status = ''
        or (v_status = 'pending' and lower(w.status::text) in ('submitted', 'pending'))
        or lower(w.status::text) = v_status
      order by w.submitted_at desc
      limit v_limit offset v_offset
    ) q;

  else
    return jsonb_build_object(
      'ok', false,
      'message', 'Unsupported queue type.',
      'rows', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'kind', v_kind,
    'rows', v_rows,
    'count', jsonb_array_length(v_rows),
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

create or replace function public.chatearn_v6_admin_bulk_review_impl(
  p_kind text,
  p_ids uuid[],
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'chatearn_private'
as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_requested text := lower(trim(coalesce(p_status, '')));
  v_id uuid;
  v_ok integer := 0;
  v_failed integer := 0;
  v_target_status text;
  v_status_type text;
  v_labels text[];
  v_sql text;
begin
  perform chatearn_private.assert_chatearn_admin();

  if coalesce(array_length(p_ids, 1), 0) = 0 then
    return jsonb_build_object('ok', true, 'updated', 0, 'failed', 0);
  end if;

  if v_kind = 'kyc' then
    if v_requested not in ('approved', 'rejected') then
      raise exception 'invalid KYC review status' using errcode = '22023';
    end if;

    select case
      when c.data_type = 'USER-DEFINED' then quote_ident(c.udt_schema) || '.' || quote_ident(c.udt_name)
      else c.data_type
    end
    into v_status_type
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'kyc_submissions'
      and c.column_name = 'status';

    foreach v_id in array p_ids loop
      begin
        v_sql := format(
          'update public.kyc_submissions set status = %L::%s, reviewed_at = now(), updated_at = now() where id = %L::uuid',
          v_requested,
          v_status_type,
          v_id
        );
        execute v_sql;
        if found then v_ok := v_ok + 1; else v_failed := v_failed + 1; end if;
      exception when others then
        v_failed := v_failed + 1;
      end;
    end loop;

    v_target_status := v_requested;

  elsif v_kind = 'withdrawals' then
    select array_agg(e.enumlabel order by e.enumsortorder),
           quote_ident(n.nspname) || '.' || quote_ident(t.typname)
    into v_labels, v_status_type
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    join information_schema.columns c
      on c.udt_schema = n.nspname
     and c.udt_name = t.typname
    where c.table_schema = 'public'
      and c.table_name = 'withdrawals'
      and c.column_name = 'status'
    group by n.nspname, t.typname;

    if v_requested = 'approved' then
      if 'processing' = any(v_labels) then v_target_status := 'processing';
      elsif 'approved' = any(v_labels) then v_target_status := 'approved';
      elsif 'paid' = any(v_labels) then v_target_status := 'paid';
      else raise exception 'No supported approval status exists for withdrawals';
      end if;
    elsif v_requested = 'rejected' then
      if 'rejected' = any(v_labels) then v_target_status := 'rejected';
      elsif 'cancelled' = any(v_labels) then v_target_status := 'cancelled';
      else raise exception 'No supported rejection status exists for withdrawals';
      end if;
    else
      raise exception 'invalid withdrawal review status' using errcode = '22023';
    end if;

    foreach v_id in array p_ids loop
      begin
        v_sql := format(
          'update public.withdrawals set status = %L::%s, admin_note = %L, updated_at = now()%s where id = %L::uuid',
          v_target_status,
          v_status_type,
          nullif(trim(coalesce(p_note, '')), ''),
          case
            when v_target_status = 'processing' then ', processing_at = coalesce(processing_at, now())'
            when v_target_status = 'paid' then ', paid_at = coalesce(paid_at, now())'
            when v_target_status in ('cancelled', 'rejected') then ', cancelled_at = coalesce(cancelled_at, now())'
            else ''
          end,
          v_id
        );
        execute v_sql;
        if found then v_ok := v_ok + 1; else v_failed := v_failed + 1; end if;
      exception when others then
        v_failed := v_failed + 1;
      end;
    end loop;

  else
    raise exception 'unsupported queue type' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'ok', v_failed = 0,
    'kind', v_kind,
    'requested_status', v_requested,
    'applied_status', v_target_status,
    'updated', v_ok,
    'failed', v_failed
  );
end;
$$;

revoke all on function public.chatearn_v6_admin_queue_impl(text, text, integer, integer)
from public, anon;
revoke all on function public.chatearn_v6_admin_bulk_review_impl(text, uuid[], text, text)
from public, anon;

grant execute on function public.chatearn_v6_admin_queue_impl(text, text, integer, integer)
to authenticated;
grant execute on function public.chatearn_v6_admin_bulk_review_impl(text, uuid[], text, text)
to authenticated;

commit;
