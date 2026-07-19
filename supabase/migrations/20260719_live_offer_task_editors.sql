begin;

alter table public.chatearn_chat_task_config
  add column if not exists audience text not null default 'all',
  add column if not exists placement text not null default 'chat',
  add column if not exists trigger_message_count integer not null default 3,
  add column if not exists external_url text;

create or replace function public.chatearn_v6_admin_save_task(
  p_task_key text,
  p_title text,
  p_subtitle text,
  p_button_text text,
  p_task_type text,
  p_required_count integer,
  p_reward_amount bigint,
  p_min_visit integer,
  p_display_order integer,
  p_active boolean,
  p_cooldown_hours integer,
  p_max_daily_completions integer,
  p_linked_offer_key text,
  p_notes text default null,
  p_audience text default 'all',
  p_placement text default 'chat',
  p_trigger_message_count integer default 3,
  p_external_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_type text := lower(trim(coalesce(p_task_type, 'offer')));
  v_offer_exists boolean := false;
begin
  if not public.chatearn_v3_admin_is_admin() then
    raise exception 'Administrator access required';
  end if;

  if lower(trim(coalesce(p_task_key, 'chat_task'))) <> 'chat_task' then
    raise exception 'This installation supports one primary chat task';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Task title is required';
  end if;

  if nullif(trim(coalesce(p_button_text, '')), '') is null then
    raise exception 'Task button text is required';
  end if;

  if coalesce(p_audience, 'all') not in ('all','new','returning') then
    raise exception 'Unsupported task audience';
  end if;

  if coalesce(p_placement, 'chat') not in ('chat','dashboard','returning') then
    raise exception 'Unsupported task placement';
  end if;

  if v_type = 'offer' then
    if nullif(trim(coalesce(p_linked_offer_key, '')), '') is null then
      raise exception 'Select a sponsored campaign for an offer task';
    end if;

    select exists (
      select 1 from public.offers o
      where o.targeting ->> 'offer_key' = trim(p_linked_offer_key)
         or o.id::text = trim(p_linked_offer_key)
    ) into v_offer_exists;

    if not v_offer_exists then
      raise exception 'The linked sponsored campaign does not exist';
    end if;
  end if;

  if v_type = 'external' and coalesce(p_external_url, '') !~ '^https://' then
    raise exception 'External tasks require a complete HTTPS URL';
  end if;

  insert into public.chatearn_chat_task_config (
    id, title, description, cta, linked_offer_key, active,
    task_type, required_count, reward_amount, min_visit,
    display_order, cooldown_hours, max_daily_completions,
    audience, placement, trigger_message_count, external_url,
    notes, archived_at, updated_at
  ) values (
    true, trim(p_title), trim(coalesce(p_subtitle, '')), trim(p_button_text),
    nullif(trim(coalesce(p_linked_offer_key, '')), ''), coalesce(p_active, true),
    v_type, greatest(1, least(coalesce(p_required_count, 1), 100)),
    greatest(0, coalesce(p_reward_amount, 0)), greatest(1, coalesce(p_min_visit, 1)),
    greatest(1, least(coalesce(p_display_order, 10), 100)),
    greatest(0, least(coalesce(p_cooldown_hours, 0), 720)),
    greatest(1, least(coalesce(p_max_daily_completions, 1), 100)),
    coalesce(p_audience, 'all'), coalesce(p_placement, 'chat'),
    greatest(1, least(coalesce(p_trigger_message_count, 3), 100)),
    nullif(trim(coalesce(p_external_url, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''), null, now()
  )
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    cta = excluded.cta,
    linked_offer_key = excluded.linked_offer_key,
    active = excluded.active,
    task_type = excluded.task_type,
    required_count = excluded.required_count,
    reward_amount = excluded.reward_amount,
    min_visit = excluded.min_visit,
    display_order = excluded.display_order,
    cooldown_hours = excluded.cooldown_hours,
    max_daily_completions = excluded.max_daily_completions,
    audience = excluded.audience,
    placement = excluded.placement,
    trigger_message_count = excluded.trigger_message_count,
    external_url = excluded.external_url,
    notes = excluded.notes,
    archived_at = null,
    updated_at = now();

  return jsonb_build_object('ok', true, 'task_key', 'chat_task', 'message', 'Task saved successfully');
end;
$$;

revoke all on function public.chatearn_v6_admin_save_task(
  text,text,text,text,text,integer,bigint,integer,integer,boolean,
  integer,integer,text,text,text,text,integer,text
) from public, anon;

grant execute on function public.chatearn_v6_admin_save_task(
  text,text,text,text,text,integer,bigint,integer,integer,boolean,
  integer,integer,text,text,text,text,integer,text
) to authenticated;

create or replace function public.chatearn_v6_admin_save_offer(
  p_offer_key text,
  p_name text,
  p_url text,
  p_display_order integer,
  p_audience text,
  p_placements text[],
  p_active boolean,
  p_quality_threshold_seconds integer,
  p_max_exposures_per_user integer,
  p_cooldown_hours integer,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_key text := lower(trim(coalesce(p_offer_key, '')));
  v_offer public.offers%rowtype;
  v_status public.offer_status;
  v_creative jsonb := '{}'::jsonb;
begin
  if not public.chatearn_v3_admin_is_admin() then
    raise exception 'Administrator access required';
  end if;

  if v_key = '' or v_key !~ '^[a-z0-9][a-z0-9_-]{1,79}$' then
    raise exception 'Offer key must contain only letters, numbers, underscore or hyphen';
  end if;
  if trim(coalesce(p_name, '')) = '' then raise exception 'Campaign name is required'; end if;
  if p_url is null or p_url !~ '^https://' then raise exception 'A complete HTTPS destination URL is required'; end if;

  begin
    v_creative := coalesce(nullif(trim(p_notes), '')::jsonb, '{}'::jsonb);
  exception when others then
    v_creative := jsonb_build_object('note', coalesce(p_notes, ''));
  end;

  v_status := case when coalesce(p_active, true) then 'active'::public.offer_status else 'draft'::public.offer_status end;

  select * into v_offer from public.offers where targeting->>'offer_key' = v_key limit 1;

  if found then
    update public.offers set
      name = trim(p_name), destination_url = trim(p_url), status = v_status,
      priority_weight = greatest(1, least(100, 101 - greatest(1, least(coalesce(p_display_order, 10), 100)))),
      minimum_return_seconds = greatest(1, least(coalesce(p_quality_threshold_seconds, 30), 3600)),
      per_user_cap = greatest(1, least(coalesce(p_max_exposures_per_user, 1), 100)),
      targeting = coalesce(targeting, '{}'::jsonb) || jsonb_build_object(
        'offer_key', v_key,
        'display_order', greatest(1, least(coalesce(p_display_order, 10), 100)),
        'audience', coalesce(nullif(trim(p_audience), ''), 'all'),
        'placements', to_jsonb(coalesce(p_placements, array['all']::text[])),
        'quality_threshold_seconds', greatest(1, least(coalesce(p_quality_threshold_seconds, 30), 3600)),
        'max_exposures_per_user', greatest(1, least(coalesce(p_max_exposures_per_user, 1), 100)),
        'cooldown_hours', greatest(0, least(coalesce(p_cooldown_hours, 0), 720)),
        'creative', v_creative
      ),
      updated_at = now()
    where id = v_offer.id returning * into v_offer;
  else
    insert into public.offers (
      name, destination_url, status, priority_weight,
      minimum_return_seconds, per_user_cap, targeting, created_by
    ) values (
      trim(p_name), trim(p_url), v_status,
      greatest(1, least(100, 101 - greatest(1, least(coalesce(p_display_order, 10), 100)))),
      greatest(1, least(coalesce(p_quality_threshold_seconds, 30), 3600)),
      greatest(1, least(coalesce(p_max_exposures_per_user, 1), 100)),
      jsonb_build_object(
        'offer_key', v_key,
        'display_order', greatest(1, least(coalesce(p_display_order, 10), 100)),
        'audience', coalesce(nullif(trim(p_audience), ''), 'all'),
        'placements', to_jsonb(coalesce(p_placements, array['all']::text[])),
        'quality_threshold_seconds', greatest(1, least(coalesce(p_quality_threshold_seconds, 30), 3600)),
        'max_exposures_per_user', greatest(1, least(coalesce(p_max_exposures_per_user, 1), 100)),
        'cooldown_hours', greatest(0, least(coalesce(p_cooldown_hours, 0), 720)),
        'creative', v_creative
      ), auth.uid()
    ) returning * into v_offer;
  end if;

  return jsonb_build_object('ok', true, 'offer_key', v_key, 'id', v_offer.id, 'message', 'Sponsored campaign saved');
end;
$$;

create or replace function public.chatearn_v4_get_unique_offer(
  p_placement text,
  p_visitor_id text,
  p_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_offer record;
begin
  select
    o.id,
    coalesce(nullif(o.targeting->>'offer_key', ''), o.id::text) as offer_key,
    o.name,
    o.destination_url,
    coalesce(o.targeting->'creative', '{}'::jsonb) as creative
  into v_offer
  from public.offers o
  where o.status::text = 'active'
    and o.archived_at is null
    and o.destination_url ~ '^https://'
    and (o.starts_at is null or o.starts_at <= now())
    and (o.ends_at is null or o.ends_at > now())
    and (
      coalesce(o.targeting->'placements', '["all"]'::jsonb) ? 'all'
      or coalesce(o.targeting->'placements', '[]'::jsonb) ? coalesce(p_placement, '')
    )
  order by coalesce(nullif(o.targeting->>'display_order', '')::integer, 10), random()
  limit 1;

  if not found then return jsonb_build_object('available', false); end if;

  return jsonb_build_object(
    'available', true,
    'offer_key', v_offer.offer_key,
    'name', v_offer.name,
    'url', v_offer.destination_url,
    'placement', p_placement,
    'headline', coalesce(v_offer.creative->>'headline', v_offer.name),
    'description', coalesce(v_offer.creative->>'description', 'Open this sponsored opportunity to continue.'),
    'cta', coalesce(v_offer.creative->>'cta', 'Open Now'),
    'tag', coalesce(v_offer.creative->>'tag', 'SPONSORED'),
    'accent', coalesce(v_offer.creative->>'accent', '#16a34a'),
    'background', coalesce(v_offer.creative->>'background', '#f0fdf4'),
    'text', coalesce(v_offer.creative->>'text', '#14532d')
  );
end;
$$;

grant execute on function public.chatearn_v4_get_unique_offer(text,text,text) to anon, authenticated;

commit;