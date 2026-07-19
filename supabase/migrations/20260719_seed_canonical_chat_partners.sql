-- Ensure the six public ChatEarn partner identities exist in the canonical
-- chat_partners and conversation_versions tables used by chatearn_send_message.
-- Safe to rerun: existing slugs are updated and missing versions are inserted.

with partner_seed(slug,name,age,location,interests,tone,bio,presence_text,typing_min,typing_max,sort_order) as (
  values
    ('alexlab102','alexlab102',29,'Houston, United States',array['technology','music','travel']::text[],'friendly','Friendly guided-chat partner from Houston.','Online now',900,1800,10),
    ('emiliacute','EmiliaCute',25,'London, United Kingdom',array['music','fashion','travel']::text[],'warm','Warm guided-chat partner from London.','Online now',900,1800,20),
    ('mattjohn','MattJohn',31,'Toronto, Canada',array['sports','technology','movies']::text[],'friendly','Friendly guided-chat partner from Toronto.','Online now',900,1800,30),
    ('abi1990','Abi1990',30,'Atlanta, United States',array['music','food','travel']::text[],'friendly','Friendly guided-chat partner from Atlanta.','Online now',900,1800,40),
    ('princess77','princess77',27,'Berlin, Germany',array['fashion','music','travel']::text[],'warm','Warm guided-chat partner from Berlin.','Online now',900,1800,50),
    ('camilaanders','CamilaAnders',28,'Madrid, Spain',array['travel','music','lifestyle']::text[],'friendly','Friendly guided-chat partner from Madrid.','Online now',900,1800,60)
)
insert into public.chat_partners(
  id,slug,name,age,location,interests,tone,bio,avatar_url,presence_text,
  typing_delay_min_ms,typing_delay_max_ms,sort_order,status,created_at,updated_at
)
select
  gen_random_uuid(),s.slug,s.name,s.age,s.location,s.interests,s.tone,s.bio,null,
  s.presence_text,s.typing_min,s.typing_max,s.sort_order,
  'published'::public.content_status,now(),now()
from partner_seed s
where not exists (
  select 1 from public.chat_partners p where lower(p.slug)=s.slug
);

with partner_seed(slug,name,age,location,interests,tone,bio,presence_text,typing_min,typing_max,sort_order) as (
  values
    ('alexlab102','alexlab102',29,'Houston, United States',array['technology','music','travel']::text[],'friendly','Friendly guided-chat partner from Houston.','Online now',900,1800,10),
    ('emiliacute','EmiliaCute',25,'London, United Kingdom',array['music','fashion','travel']::text[],'warm','Warm guided-chat partner from London.','Online now',900,1800,20),
    ('mattjohn','MattJohn',31,'Toronto, Canada',array['sports','technology','movies']::text[],'friendly','Friendly guided-chat partner from Toronto.','Online now',900,1800,30),
    ('abi1990','Abi1990',30,'Atlanta, United States',array['music','food','travel']::text[],'friendly','Friendly guided-chat partner from Atlanta.','Online now',900,1800,40),
    ('princess77','princess77',27,'Berlin, Germany',array['fashion','music','travel']::text[],'warm','Warm guided-chat partner from Berlin.','Online now',900,1800,50),
    ('camilaanders','CamilaAnders',28,'Madrid, Spain',array['travel','music','lifestyle']::text[],'friendly','Friendly guided-chat partner from Madrid.','Online now',900,1800,60)
)
update public.chat_partners p
set name=s.name,
    age=s.age,
    location=s.location,
    interests=s.interests,
    tone=s.tone,
    bio=s.bio,
    presence_text=s.presence_text,
    typing_delay_min_ms=s.typing_min,
    typing_delay_max_ms=s.typing_max,
    sort_order=s.sort_order,
    status='published'::public.content_status,
    updated_at=now()
from partner_seed s
where lower(p.slug)=s.slug;

insert into public.conversation_versions(
  id,partner_id,version_number,status,opening_node_id,published_at,created_at,updated_at
)
select
  gen_random_uuid(),p.id,
  coalesce((select max(cv.version_number)+1 from public.conversation_versions cv where cv.partner_id=p.id),1),
  'published'::public.content_status,null,now(),now(),now()
from public.chat_partners p
where lower(p.slug) in ('alexlab102','emiliacute','mattjohn','abi1990','princess77','camilaanders')
  and not exists (
    select 1
    from public.conversation_versions cv
    where cv.partner_id=p.id and cv.status::text='published'
  );

-- Installation guard: every frontend key must resolve to one published partner
-- with at least one published conversation version.
do $$
declare
  v_missing text;
begin
  select string_agg(k.slug, ', ' order by k.slug)
  into v_missing
  from (values
    ('alexlab102'),('emiliacute'),('mattjohn'),('abi1990'),('princess77'),('camilaanders')
  ) as k(slug)
  where not exists (
    select 1
    from public.chat_partners p
    join public.conversation_versions cv on cv.partner_id=p.id
    where lower(p.slug)=k.slug
      and p.status::text='published'
      and cv.status::text='published'
  );

  if v_missing is not null then
    raise exception 'Missing published chat partners or versions: %', v_missing;
  end if;
end
$$;
