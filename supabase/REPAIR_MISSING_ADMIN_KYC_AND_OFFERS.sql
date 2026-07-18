-- ChatEarn repair for missing KYC/admin offer RPCs reported by live verification.
begin;

create table if not exists public.chatearn_v4_offers (
  offer_key text primary key,
  name text not null,
  url text not null,
  display_order integer not null default 10,
  audience text not null default 'all' check (audience in ('all','new','returning')),
  placements text[] not null default array['all']::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chatearn_v4_tasks (
  task_key text primary key,
  title text not null,
  subtitle text,
  button_text text not null,
  task_type text not null,
  required_count integer not null default 1,
  reward_amount bigint not null default 0,
  min_visit integer not null default 2,
  display_order integer not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chatearn_v4_offer_events (
  id bigint generated always as identity primary key,
  offer_key text not null,
  user_id uuid,
  visitor_id text,
  session_id text,
  event_type text not null,
  placement text,
  visit_number integer,
  messages_before integer,
  seconds_away integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.chatearn_v4_offers enable row level security;
alter table public.chatearn_v4_tasks enable row level security;
alter table public.chatearn_v4_offer_events enable row level security;
revoke all on public.chatearn_v4_offers, public.chatearn_v4_tasks, public.chatearn_v4_offer_events from anon, authenticated;

create or replace function public.chatearn_v4_get_unique_offer(
  p_placement text,
  p_visitor_id text,
  p_session_id text
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  v_offer public.chatearn_v4_offers;
  v_returning boolean := coalesce((auth.jwt()->>'is_returning')::boolean,false);
begin
  select o.* into v_offer
  from public.chatearn_v4_offers o
  where o.active=true
    and (o.audience='all' or (o.audience='returning' and v_returning) or (o.audience='new' and not v_returning))
    and ('all'=any(o.placements) or coalesce(p_placement,'')=any(o.placements))
    and not exists (
      select 1 from public.chatearn_v4_offer_events e
      where e.offer_key=o.offer_key
        and e.event_type='open'
        and ((auth.uid() is not null and e.user_id=auth.uid()) or (auth.uid() is null and e.visitor_id=p_visitor_id))
    )
  order by o.display_order asc, random()
  limit 1;

  if not found then
    return jsonb_build_object('available',false,'remaining',0);
  end if;

  return jsonb_build_object(
    'available',true,'offer_key',v_offer.offer_key,'name',v_offer.name,'url',v_offer.url,
    'remaining',(select count(*) from public.chatearn_v4_offers where active=true)-1,
    'visit_number',1
  );
end;
$$;

create or replace function public.chatearn_v3_track_offer_event(
  p_offer_key text,
  p_event_type text,
  p_visitor_id text,
  p_session_id text,
  p_placement text,
  p_visit_number integer,
  p_messages_before integer,
  p_seconds_away integer,
  p_metadata jsonb
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
begin
  insert into public.chatearn_v4_offer_events(
    offer_key,user_id,visitor_id,session_id,event_type,placement,visit_number,messages_before,seconds_away,metadata
  ) values (
    p_offer_key,auth.uid(),p_visitor_id,p_session_id,p_event_type,p_placement,p_visit_number,p_messages_before,p_seconds_away,coalesce(p_metadata,'{}'::jsonb)
  );
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.chatearn_v4_admin_save_offer(
  p_offer_key text,p_name text,p_url text,p_display_order integer,p_audience text,p_placements text[],p_active boolean
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
  if auth.uid() is null or not public.chatearn_admin_v2_is_admin() then raise exception 'administrator permission required' using errcode='42501'; end if;
  insert into public.chatearn_v4_offers(offer_key,name,url,display_order,audience,placements,active,updated_at)
  values(btrim(p_offer_key),btrim(p_name),btrim(p_url),coalesce(p_display_order,10),coalesce(p_audience,'all'),coalesce(p_placements,array['all']::text[]),coalesce(p_active,true),now())
  on conflict(offer_key) do update set name=excluded.name,url=excluded.url,display_order=excluded.display_order,audience=excluded.audience,placements=excluded.placements,active=excluded.active,updated_at=now();
  return jsonb_build_object('ok',true);
end;$$;

create or replace function public.chatearn_v4_admin_toggle_offer(p_offer_key text,p_active boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.uid() is null or not public.chatearn_admin_v2_is_admin() then raise exception 'administrator permission required' using errcode='42501'; end if;
  update public.chatearn_v4_offers set active=p_active,updated_at=now() where offer_key=p_offer_key;
  return jsonb_build_object('ok',true);
end;$$;

create or replace function public.chatearn_v4_admin_save_task(
  p_task_key text,p_title text,p_subtitle text,p_button_text text,p_task_type text,p_required_count integer,p_reward_amount bigint,p_min_visit integer,p_display_order integer,p_active boolean
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.uid() is null or not public.chatearn_admin_v2_is_admin() then raise exception 'administrator permission required' using errcode='42501'; end if;
  insert into public.chatearn_v4_tasks(task_key,title,subtitle,button_text,task_type,required_count,reward_amount,min_visit,display_order,active,updated_at)
  values(btrim(p_task_key),btrim(p_title),p_subtitle,btrim(p_button_text),btrim(p_task_type),greatest(1,coalesce(p_required_count,1)),greatest(0,coalesce(p_reward_amount,0)),greatest(1,coalesce(p_min_visit,2)),coalesce(p_display_order,10),coalesce(p_active,true),now())
  on conflict(task_key) do update set title=excluded.title,subtitle=excluded.subtitle,button_text=excluded.button_text,task_type=excluded.task_type,required_count=excluded.required_count,reward_amount=excluded.reward_amount,min_visit=excluded.min_visit,display_order=excluded.display_order,active=excluded.active,updated_at=now();
  return jsonb_build_object('ok',true);
end;$$;

create or replace function public.chatearn_v4_admin_toggle_task(p_task_key text,p_active boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.uid() is null or not public.chatearn_admin_v2_is_admin() then raise exception 'administrator permission required' using errcode='42501'; end if;
  update public.chatearn_v4_tasks set active=p_active,updated_at=now() where task_key=p_task_key;
  return jsonb_build_object('ok',true);
end;$$;

create or replace function public.chatearn_v4_admin_offer_manager()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if auth.uid() is null or not public.chatearn_admin_v2_is_admin() then raise exception 'administrator permission required' using errcode='42501'; end if;
  return jsonb_build_object(
    'offers',coalesce((select jsonb_agg(jsonb_build_object(
      'offer_key',o.offer_key,'name',o.name,'url',o.url,'display_order',o.display_order,'audience',o.audience,'placements',o.placements,'active',o.active,
      'impressions',(select count(*) from public.chatearn_v4_offer_events e where e.offer_key=o.offer_key and e.event_type='impression'),
      'opens',(select count(*) from public.chatearn_v4_offer_events e where e.offer_key=o.offer_key and e.event_type='open'),
      'returns',(select count(*) from public.chatearn_v4_offer_events e where e.offer_key=o.offer_key and e.event_type='return'),
      'unique_openers',(select count(distinct coalesce(e.user_id::text,e.visitor_id)) from public.chatearn_v4_offer_events e where e.offer_key=o.offer_key and e.event_type='open')
    ) order by o.display_order,o.created_at) from public.chatearn_v4_offers o),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.display_order,t.created_at) from public.chatearn_v4_tasks t),'[]'::jsonb)
  );
end;$$;

create or replace function public.chatearn_v6_admin_queue(
  p_kind text,p_status text,p_limit integer,p_offset integer
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public
as $$
declare v_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.chatearn_admin_v2_is_admin() then raise exception 'administrator permission required' using errcode='42501'; end if;
  if lower(coalesce(p_kind,''))='kyc' then
    if to_regclass('public.kyc_submissions') is null then return jsonb_build_object('ok',true,'rows','[]'::jsonb,'total',0); end if;
    execute format($q$
      select coalesce(jsonb_agg(x),'[]'::jsonb) from (
        select to_jsonb(k) as x
        from public.kyc_submissions k
        where ($1 is null or lower(coalesce(to_jsonb(k)->>'status','pending'))=lower($1))
        order by coalesce((to_jsonb(k)->>'created_at')::timestamptz,now()) desc
        limit $2 offset $3
      ) s$q$) into v_rows using p_status,greatest(1,least(coalesce(p_limit,100),500)),greatest(0,coalesce(p_offset,0));
  end if;
  return jsonb_build_object('ok',true,'rows',v_rows,'total',jsonb_array_length(v_rows));
end;$$;

-- Execute permissions.
do $$ declare r record; begin
  for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'chatearn_v4_get_unique_offer','chatearn_v3_track_offer_event','chatearn_v4_admin_save_offer','chatearn_v4_admin_toggle_offer',
      'chatearn_v4_admin_save_task','chatearn_v4_admin_toggle_task','chatearn_v4_admin_offer_manager','chatearn_v6_admin_queue'
    ) loop
      execute format('revoke all on function %s from public, anon',r.sig);
      execute format('grant execute on function %s to authenticated',r.sig);
  end loop;
end $$;

notify pgrst,'reload schema';
commit;

select
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='chatearn_v6_admin_queue') as admin_kyc_queue_rpc,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='chatearn_v4_admin_offer_manager') as admin_offer_manager_rpc,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='chatearn_v4_get_unique_offer') as unique_offer_router_rpc;