create table if not exists public.chatearn_chat_task_config (
  id boolean primary key default true check (id),
  title text not null default 'Quick earning task',
  description text not null default 'Complete this short task, then return and continue earning.',
  cta text not null default 'Start quick task',
  linked_offer_key text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.chatearn_chat_task_config (id)
values (true)
on conflict (id) do nothing;

alter table public.chatearn_chat_task_config enable row level security;
revoke all on public.chatearn_chat_task_config from anon, authenticated;
grant all on public.chatearn_chat_task_config to service_role;

create or replace function public.chatearn_get_chat_task_config()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title', c.title,
    'description', c.description,
    'cta', c.cta,
    'active', c.active,
    'offer_key', o.offer_key,
    'url', coalesce(nullif(cast(o.url as text), ''), ''),
    'offer_name', coalesce(o.name, '')
  )
  from public.chatearn_chat_task_config c
  left join public.chatearn_offers o on o.offer_key = c.linked_offer_key
  where c.id = true
  limit 1;
$$;

grant execute on function public.chatearn_get_chat_task_config() to anon, authenticated, service_role;

create or replace function public.chatearn_admin_save_chat_task_config(
  p_title text,
  p_description text,
  p_cta text,
  p_linked_offer_key text,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.chatearn_v3_admin_is_admin() then
    raise exception 'Administrator access required';
  end if;

  if nullif(trim(p_title), '') is null then raise exception 'Task headline is required'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Task description is required'; end if;
  if nullif(trim(p_cta), '') is null then raise exception 'CTA text is required'; end if;
  if not exists (select 1 from public.chatearn_offers where offer_key = p_linked_offer_key and archived_at is null) then
    raise exception 'Select a valid sponsored ad';
  end if;

  insert into public.chatearn_chat_task_config(id,title,description,cta,linked_offer_key,active,updated_at)
  values(true,trim(p_title),trim(p_description),trim(p_cta),p_linked_offer_key,coalesce(p_active,true),now())
  on conflict(id) do update set
    title=excluded.title,
    description=excluded.description,
    cta=excluded.cta,
    linked_offer_key=excluded.linked_offer_key,
    active=excluded.active,
    updated_at=now();

  return public.chatearn_get_chat_task_config();
end;
$$;

grant execute on function public.chatearn_admin_save_chat_task_config(text,text,text,text,boolean) to authenticated, service_role;
