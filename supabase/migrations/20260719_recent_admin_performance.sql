begin;

create or replace function public.chatearn_v6_admin_recent_performance(
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 50));
begin
  if not public.chatearn_v3_admin_is_admin() then
    raise exception 'Administrator access required';
  end if;

  return jsonb_build_object(
    'rows',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', q.user_id,
            'display_name', q.display_name,
            'email', q.email,
            'visitor_id', q.visitor_id,
            'registered', q.registered,
            'messages', q.messages,
            'sessions', q.sessions,
            'total_seconds', q.total_seconds,
            'ad_views', q.ad_views,
            'ad_clicks', q.ad_clicks,
            'shared', q.shared,
            'kyc_reached', q.kyc_reached,
            'processing_reached', q.processing_reached,
            'returned_after_processing', q.returned_after_processing,
            'last_seen_at', q.last_seen_at
          )
          order by q.last_seen_at desc
        )
        from (
          select
            p.user_id,
            p.display_name,
            coalesce(u.email, '') as email,
            coalesce(ps.visitor_id::text, '') as visitor_id,
            true as registered,
            coalesce(p.chats, 0) as messages,
            coalesce(ps.session_count, 0) as sessions,
            coalesce(ps.total_seconds, 0) as total_seconds,
            coalesce(se.ad_views, 0) as ad_views,
            coalesce(se.ad_clicks, 0) as ad_clicks,
            coalesce(p.shares, 0) > 0 as shared,
            coalesce(p.kyc_done, false) or coalesce(p.kyc_pending, false) as kyc_reached,
            coalesce(p.has_withdrawn, false) as processing_reached,
            coalesce(p.has_withdrawn, false)
              and coalesce(ps.last_seen_at, p.last_active_at, p.updated_at, p.created_at)
                  > coalesce(p.updated_at, p.created_at) as returned_after_processing,
            coalesce(ps.last_seen_at, p.last_active_at, p.updated_at, p.created_at) as last_seen_at
          from public.profiles p
          left join auth.users u on u.id = p.user_id
          left join lateral (
            select
              max(x.visitor_id) as visitor_id,
              count(distinct x.session_id)::integer as session_count,
              sum(
                greatest(
                  0,
                  extract(epoch from (coalesce(x.ended_at, x.last_seen_at) - x.started_at))::integer
                )
              )::bigint as total_seconds,
              max(x.last_seen_at) as last_seen_at
            from public.presence_sessions x
            where x.user_id = p.user_id
          ) ps on true
          left join lateral (
            select
              count(*) filter (where e.event_type in ('impression', 'view', 'presented'))::integer as ad_views,
              count(*) filter (where e.event_type in ('open', 'click'))::integer as ad_clicks
            from public.sponsored_events e
            where e.user_id = p.user_id
          ) se on true
          order by coalesce(ps.last_seen_at, p.last_active_at, p.updated_at, p.created_at) desc
          limit v_limit
        ) q
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.chatearn_v6_admin_recent_performance(integer)
from public, anon;

grant execute on function public.chatearn_v6_admin_recent_performance(integer)
to authenticated;

commit;
