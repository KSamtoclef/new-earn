-- ChatEarn Module 3: canonical structured conversation engine.
-- This module owns partner content, intent routing, messages, and resume state.
-- It deliberately does not credit chat or sponsored rewards; Module 4 owns money.

begin;

create table if not exists public.chatearn_chat_partners (
  partner_key text primary key
    check (partner_key ~ '^[A-Za-z0-9_]{3,50}$'),
  display_name text not null check (char_length(display_name) between 2 and 80),
  age smallint not null check (age between 18 and 80),
  city text not null check (char_length(city) between 2 and 80),
  country text not null check (char_length(country) between 2 and 80),
  timezone text not null,
  flag text not null,
  language_label text not null,
  personality text not null,
  tone text not null,
  interests jsonb not null default '[]'::jsonb
    check (jsonb_typeof(interests) = 'array'),
  occupation text not null,
  favorite_music text not null,
  favorite_food text not null,
  avatar_initials text not null check (char_length(avatar_initials) between 1 and 4),
  avatar_gradient text not null,
  chat_reward_amount bigint not null check (chat_reward_amount > 0),
  sort_order smallint not null check (sort_order > 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists chatearn_chat_partners_sort_order_unique
  on public.chatearn_chat_partners (sort_order);
create index if not exists chatearn_chat_partners_active_order_idx
  on public.chatearn_chat_partners (active, sort_order, partner_key);

create table if not exists public.chatearn_conversation_nodes (
  partner_key text not null references public.chatearn_chat_partners(partner_key)
    on delete restrict,
  node_key text not null check (node_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  topic text not null check (char_length(topic) between 2 and 80),
  stage smallint not null check (stage > 0),
  partner_message text not null check (char_length(partner_message) between 2 and 2000),
  default_next_node_key text not null,
  default_response_prefix text not null
    check (char_length(default_response_prefix) between 1 and 500),
  terminal boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (partner_key, node_key)
);

create index if not exists chatearn_conversation_nodes_partner_stage_idx
  on public.chatearn_conversation_nodes (partner_key, active, stage, node_key);

create table if not exists public.chatearn_intent_rules (
  intent_key text primary key
    check (intent_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  keywords text[] not null check (cardinality(keywords) > 0),
  priority smallint not null default 10,
  description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chatearn_conversation_choices (
  id uuid primary key default gen_random_uuid(),
  partner_key text not null,
  node_key text not null,
  choice_key text not null check (choice_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  label text not null check (char_length(label) between 1 and 500),
  intent_key text not null references public.chatearn_intent_rules(intent_key)
    on delete restrict,
  response_prefix text not null check (char_length(response_prefix) between 1 and 500),
  next_node_key text not null,
  display_order smallint not null check (display_order > 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chatearn_conversation_choices_node_fk
    foreign key (partner_key, node_key)
    references public.chatearn_conversation_nodes(partner_key, node_key)
    on delete restrict,
  constraint chatearn_conversation_choices_next_node_fk
    foreign key (partner_key, next_node_key)
    references public.chatearn_conversation_nodes(partner_key, node_key)
    on delete restrict,
  constraint chatearn_conversation_choices_key_unique
    unique (partner_key, node_key, choice_key),
  constraint chatearn_conversation_choices_intent_unique
    unique (partner_key, node_key, intent_key)
);

create index if not exists chatearn_conversation_choices_node_order_idx
  on public.chatearn_conversation_choices (
    partner_key, node_key, active, display_order, choice_key
  );

create table if not exists public.chatearn_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  partner_key text not null references public.chatearn_chat_partners(partner_key)
    on delete restrict,
  sender text not null check (sender in ('user', 'partner', 'system')),
  body text not null check (char_length(body) between 1 and 2000),
  intent_key text,
  node_key text,
  in_reply_to_message_id uuid references public.chatearn_conversation_messages(id)
    on delete restrict,
  client_message_id text not null
    check (char_length(client_message_id) between 1 and 160),
  status text not null default 'delivered'
    check (status in ('sent', 'delivered', 'read', 'failed')),
  eligible_for_reward boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint chatearn_conversation_messages_user_client_unique
    unique (user_id, client_message_id)
);

create index if not exists chatearn_conversation_messages_thread_idx
  on public.chatearn_conversation_messages (
    user_id, partner_key, created_at desc, id desc
  );
create index if not exists chatearn_conversation_messages_reply_idx
  on public.chatearn_conversation_messages (in_reply_to_message_id)
  where in_reply_to_message_id is not null;

alter table public.chatearn_conversation_states
  add column if not exists last_message_preview text,
  add column if not exists unread_count integer not null default 0
    check (unread_count >= 0),
  add column if not exists last_opened_at timestamptz,
  add column if not exists last_user_intent text;

drop trigger if exists chatearn_chat_partners_touch_updated_at
on public.chatearn_chat_partners;
create trigger chatearn_chat_partners_touch_updated_at
before update on public.chatearn_chat_partners
for each row execute function chatearn_private.touch_updated_at();

drop trigger if exists chatearn_conversation_nodes_touch_updated_at
on public.chatearn_conversation_nodes;
create trigger chatearn_conversation_nodes_touch_updated_at
before update on public.chatearn_conversation_nodes
for each row execute function chatearn_private.touch_updated_at();

drop trigger if exists chatearn_intent_rules_touch_updated_at
on public.chatearn_intent_rules;
create trigger chatearn_intent_rules_touch_updated_at
before update on public.chatearn_intent_rules
for each row execute function chatearn_private.touch_updated_at();

drop trigger if exists chatearn_conversation_choices_touch_updated_at
on public.chatearn_conversation_choices;
create trigger chatearn_conversation_choices_touch_updated_at
before update on public.chatearn_conversation_choices
for each row execute function chatearn_private.touch_updated_at();

insert into public.chatearn_chat_partners (
  partner_key, display_name, age, city, country, timezone, flag,
  language_label, personality, tone, interests, occupation,
  favorite_music, favorite_food, avatar_initials, avatar_gradient,
  chat_reward_amount, sort_order, active, metadata
) values
  (
    'alexlab102', 'alexlab102', 28, 'Houston', 'United States',
    'America/Chicago', '🇺🇸', 'American English',
    'Curious, energetic and straightforward', 'Casual, upbeat and playful',
    '["Afrobeats", "basketball", "travel", "technology"]'::jsonb,
    'logistics coordinator', 'Afrobeats and hip-hop', 'barbecue and jollof rice',
    'AL', 'linear-gradient(135deg,#1565C0,#42A5F5)', 15000, 1, true,
    '{"live_ui_index":0}'::jsonb
  ),
  (
    'EmiliaCute', 'EmiliaCute', 26, 'London', 'United Kingdom',
    'Europe/London', '🇬🇧', 'British English',
    'Warm, observant and friendly', 'Cheerful, thoughtful and lightly humorous',
    '["food", "books", "city walks", "Afrobeats"]'::jsonb,
    'office administrator', 'Afrobeats and R&B', 'suya and jollof rice',
    'EC', 'linear-gradient(135deg,#880E4F,#F06292)', 12000, 2, true,
    '{"live_ui_index":1}'::jsonb
  ),
  (
    'MattJohn', 'MattJohn', 31, 'Toronto', 'Canada',
    'America/Toronto', '🇨🇦', 'Canadian English',
    'Calm, curious and encouraging', 'Relaxed, respectful and conversational',
    '["ice hockey", "music", "community", "travel"]'::jsonb,
    'customer-support specialist', 'Afrobeats and pop', 'poutine and grilled chicken',
    'MJ', 'linear-gradient(135deg,#1B5E20,#66BB6A)', 10000, 3, true,
    '{"live_ui_index":2}'::jsonb
  ),
  (
    'Abi1990', 'Abi1990', 29, 'Atlanta', 'United States',
    'America/New_York', '🇺🇸', 'American English',
    'Friendly, practical and supportive', 'Easy-going, sincere and positive',
    '["health", "gospel music", "food", "family"]'::jsonb,
    'healthcare coordinator', 'Afrobeats and gospel', 'jollof rice and grilled fish',
    'AB', 'linear-gradient(135deg,#E65100,#FFA726)', 15000, 4, true,
    '{"live_ui_index":3}'::jsonb
  ),
  (
    'princess77', 'princess77', 27, 'Berlin', 'Germany',
    'Europe/Berlin', '🇩🇪', 'European English',
    'Creative, reflective and open-minded', 'Gentle, curious and concise',
    '["design", "electronic music", "museums", "travel"]'::jsonb,
    'visual designer', 'Afrobeats and electronic music', 'suya and vegetable dishes',
    'PR', 'linear-gradient(135deg,#4A148C,#CE93D8)', 8000, 5, true,
    '{"live_ui_index":4}'::jsonb
  ),
  (
    'CamilaAnders', 'CamilaAnders', 25, 'Sydney', 'Australia',
    'Australia/Sydney', '🇦🇺', 'Australian English',
    'Adventurous, expressive and optimistic', 'Bright, lively and informal',
    '["beaches", "road trips", "music", "photography"]'::jsonb,
    'hospitality supervisor', 'Afrobeats and pop', 'seafood and spicy rice',
    'CA', 'linear-gradient(135deg,#006064,#4DD0E1)', 10000, 6, true,
    '{"live_ui_index":5}'::jsonb
  )
on conflict (partner_key) do update set
  display_name = excluded.display_name,
  age = excluded.age,
  city = excluded.city,
  country = excluded.country,
  timezone = excluded.timezone,
  flag = excluded.flag,
  language_label = excluded.language_label,
  personality = excluded.personality,
  tone = excluded.tone,
  interests = excluded.interests,
  occupation = excluded.occupation,
  favorite_music = excluded.favorite_music,
  favorite_food = excluded.favorite_food,
  avatar_initials = excluded.avatar_initials,
  avatar_gradient = excluded.avatar_gradient,
  chat_reward_amount = excluded.chat_reward_amount,
  sort_order = excluded.sort_order,
  active = excluded.active,
  metadata = public.chatearn_chat_partners.metadata || excluded.metadata,
  updated_at = now();

insert into public.chatearn_intent_rules (
  intent_key, keywords, priority, description, active
) values
  ('mood_negative', array['not good','rough day','stressed','tired','bad day','feeling down'], 100, 'User reports a difficult mood or day.', true),
  ('mood_positive', array['i am good','i''m good','doing well','great','amazing','fine thanks','good thanks'], 80, 'User reports a positive mood.', true),
  ('mood_neutral', array['i am okay','i''m okay','busy','not bad','alright','okay thanks'], 60, 'User reports a neutral or busy mood.', true),
  ('location_lagos', array['lagos','lekki','ikeja','surulere','yaba'], 100, 'User is in Lagos.', true),
  ('location_abuja', array['abuja','fct','gwarinpa','wuse'], 100, 'User is in Abuja.', true),
  ('location_ogun', array['ogun','abeokuta','ago-iwoye','ijebu'], 100, 'User is in Ogun State.', true),
  ('share_location', array['i am from','i''m from','i live in','i stay in','based in','chatting from'], 40, 'User shares another location.', true),
  ('food_jollof', array['jollof','rice and chicken'], 100, 'User chooses jollof rice.', true),
  ('food_suya', array['suya','grilled meat'], 100, 'User chooses suya.', true),
  ('food_other', array['egusi','pounded yam','amala','efo riro','pepper soup','beans','plantain','food'], 40, 'User names another food.', true),
  ('music_afrobeats', array['afrobeats','burna boy','wizkid','davido','rema','asake','tems'], 100, 'User likes Afrobeats.', true),
  ('music_gospel', array['gospel','worship','choir'], 90, 'User likes gospel music.', true),
  ('music_other', array['hip-hop','hip hop','r&b','rap','pop','music','anything'], 40, 'User likes another music style.', true),
  ('work_student', array['student','school','university','college','studying','course'], 100, 'User is studying.', true),
  ('work_tech', array['tech','developer','programmer','designer','data','computer','online work'], 90, 'User works in technology or digital work.', true),
  ('work_business', array['business','self-employed','self employed','trader','shop','entrepreneur'], 90, 'User runs a business.', true),
  ('work_other', array['i work','my job','office','healthcare','teacher','banking'], 40, 'User describes another job.', true),
  ('hobby_home', array['stay home','at home','movies','netflix','rest','sleep','gaming'], 90, 'User prefers home activities.', true),
  ('hobby_social', array['friends','go out','party','football','road trip','outdoors'], 90, 'User prefers social or outdoor activities.', true),
  ('hobby_creative', array['read','books','write','drawing','photography','create','music'], 70, 'User prefers creative activities.', true),
  ('travel_yes', array['yes i would','i would love','definitely','of course','love to travel'], 90, 'User wants to travel.', true),
  ('travel_maybe', array['maybe','someday','not sure','if i can','hopefully'], 70, 'User may travel later.', true),
  ('travel_no', array['not really','no thanks','prefer nigeria','rather stay','no i'], 90, 'User does not currently want to travel.', true),
  ('culture_music', array['music','afrobeats','artists'], 90, 'User highlights Nigerian music.', true),
  ('culture_food', array['food','jollof','suya'], 90, 'User highlights Nigerian food.', true),
  ('culture_community', array['community','family','friendly','hospitality','people'], 90, 'User highlights community.', true),
  ('culture_ambition', array['hardworking','hustle','ambition','business','creative'], 90, 'User highlights ambition.', true),
  ('ask_partner_work', array['what do you do','your job','where do you work','what is your work'], 120, 'User asks about the partner''s work.', true),
  ('ask_partner_location', array['where do you live','where are you based','where are you from','which city are you'], 120, 'User asks where the partner lives.', true),
  ('ask_partner_music', array['what music do you like','your favourite music','favorite artist','who do you listen to'], 120, 'User asks about the partner''s music.', true),
  ('continue_general', array['tell me more','keep talking','another topic','what else','continue'], 20, 'User wants to continue generally.', true)
on conflict (intent_key) do update set
  keywords = excluded.keywords,
  priority = excluded.priority,
  description = excluded.description,
  active = excluded.active,
  updated_at = now();

insert into public.chatearn_conversation_nodes (
  partner_key, node_key, topic, stage, partner_message,
  default_next_node_key, default_response_prefix, terminal, active, metadata
) values
  ('alexlab102', 'opening', 'greeting', 1,
    'Hey! 👋 I just got matched with you. I''m Alex from Houston. How''s your day going?',
    'location', 'Thanks for telling me.', false, true, '{}'),
  ('alexlab102', 'location', 'location', 2,
    'I''ve wanted to learn more about Nigeria for a while. Which part are you chatting from?',
    'food', 'Nice! I''d like to hear what it is like there.', false, true, '{}'),
  ('alexlab102', 'food', 'food', 3,
    'Okay, serious question 😂 What Nigerian food should I try first?',
    'music', 'That sounds good.', false, true, '{}'),
  ('alexlab102', 'music', 'music', 4,
    'Afrobeats is everywhere in Houston now. Who or what have you been listening to lately?',
    'work', 'Good choice.', false, true, '{}'),
  ('alexlab102', 'work', 'work_and_study', 5,
    'What keeps you busy most days—school, work, or your own business?',
    'free_time', 'Respect. Everyone has their own path.', false, true, '{}'),
  ('alexlab102', 'free_time', 'free_time', 6,
    'When you finally get free time, are you more stay-home or out-with-friends?',
    'travel', 'That sounds like a good way to reset.', false, true, '{}'),
  ('alexlab102', 'travel', 'travel', 7,
    'Would you like to visit the US someday, or is another country first on your list?',
    'culture', 'I understand.', false, true, '{}'),
  ('alexlab102', 'culture', 'culture', 8,
    'What is one thing you wish foreigners understood better about Nigeria?',
    'open_ended', 'That is a useful perspective.', false, true, '{}'),
  ('alexlab102', 'open_ended', 'open_conversation', 9,
    'I''m enjoying this chat 😄 What would you like to ask me?',
    'free_time', 'Sure—let''s keep the conversation going.', false, true, '{}'),

  ('EmiliaCute', 'opening', 'greeting', 1,
    'Hellooo 😊 I''m Emilia from London. It''s lovely to meet you—how are you doing today?',
    'location', 'Thank you for sharing that with me.', false, true, '{}'),
  ('EmiliaCute', 'location', 'location', 2,
    'I''ve met some wonderful Nigerians here in London. Which part of Nigeria are you in?',
    'food', 'That sounds interesting.', false, true, '{}'),
  ('EmiliaCute', 'food', 'food', 3,
    'I have to ask about food now 😄 Which Nigerian dish would you recommend to a first-time visitor?',
    'music', 'You have made that sound delicious.', false, true, '{}'),
  ('EmiliaCute', 'music', 'music', 4,
    'My Nigerian colleagues keep improving my playlist. What music are you enjoying lately?',
    'work', 'I like that choice.', false, true, '{}'),
  ('EmiliaCute', 'work', 'work_and_study', 5,
    'What do you spend most of your week doing—working, studying, or building something yourself?',
    'free_time', 'That sounds meaningful.', false, true, '{}'),
  ('EmiliaCute', 'free_time', 'free_time', 6,
    'What does a relaxing day look like for you?',
    'travel', 'That sounds genuinely relaxing.', false, true, '{}'),
  ('EmiliaCute', 'travel', 'travel', 7,
    'Would you like to visit London one day, even with our unreliable weather? 😂',
    'culture', 'Fair answer.', false, true, '{}'),
  ('EmiliaCute', 'culture', 'culture', 8,
    'What part of Nigerian culture makes you most proud?',
    'open_ended', 'I can understand why that matters.', false, true, '{}'),
  ('EmiliaCute', 'open_ended', 'open_conversation', 9,
    'This has been such a pleasant chat. Is there anything you would like to know about me?',
    'free_time', 'Of course.', false, true, '{}'),

  ('MattJohn', 'opening', 'greeting', 1,
    'Hey there! I''m Matt from Toronto 👋 How are things with you today?',
    'location', 'Thanks for being honest.', false, true, '{}'),
  ('MattJohn', 'location', 'location', 2,
    'Toronto has a big Nigerian community. Which part of Nigeria are you chatting from?',
    'food', 'Nice—that gives me a better picture.', false, true, '{}'),
  ('MattJohn', 'food', 'food', 3,
    'The Nigerian restaurants here are always busy. What meal would you tell me to order?',
    'music', 'That sounds worth trying.', false, true, '{}'),
  ('MattJohn', 'music', 'music', 4,
    'Music travels quickly here. What has been on your playlist recently?',
    'work', 'That is a solid choice.', false, true, '{}'),
  ('MattJohn', 'work', 'work_and_study', 5,
    'Are you currently working, studying, or running something of your own?',
    'free_time', 'That sounds interesting.', false, true, '{}'),
  ('MattJohn', 'free_time', 'free_time', 6,
    'What do you usually do when you have a free evening?',
    'travel', 'That sounds like time well spent.', false, true, '{}'),
  ('MattJohn', 'travel', 'travel', 7,
    'Would Canada be somewhere you would like to visit eventually?',
    'culture', 'That makes sense.', false, true, '{}'),
  ('MattJohn', 'culture', 'culture', 8,
    'What do you think people abroad should appreciate more about Nigeria?',
    'open_ended', 'That is a thoughtful answer.', false, true, '{}'),
  ('MattJohn', 'open_ended', 'open_conversation', 9,
    'I''ve enjoyed learning about your side of the world. What would you like to ask me?',
    'free_time', 'Happy to answer.', false, true, '{}'),

  ('Abi1990', 'opening', 'greeting', 1,
    'Hey 😊 I''m Abi from Atlanta. How has your day been so far?',
    'location', 'Thanks for sharing.', false, true, '{}'),
  ('Abi1990', 'location', 'location', 2,
    'There is a strong Nigerian community in Atlanta. Where in Nigeria are you based?',
    'food', 'That is good to know.', false, true, '{}'),
  ('Abi1990', 'food', 'food', 3,
    'I love discovering new meals. What Nigerian food do you never get tired of?',
    'music', 'That sounds delicious.', false, true, '{}'),
  ('Abi1990', 'music', 'music', 4,
    'What kind of music helps you get through a busy day?',
    'work', 'I can see why you enjoy it.', false, true, '{}'),
  ('Abi1990', 'work', 'work_and_study', 5,
    'What do you do at the moment—work, school, or business?',
    'free_time', 'That takes dedication.', false, true, '{}'),
  ('Abi1990', 'free_time', 'free_time', 6,
    'How do you normally relax when responsibilities finally slow down?',
    'travel', 'That sounds peaceful.', false, true, '{}'),
  ('Abi1990', 'travel', 'travel', 7,
    'If you could travel next year, would you consider visiting the US?',
    'culture', 'I understand your point.', false, true, '{}'),
  ('Abi1990', 'culture', 'culture', 8,
    'What is your favourite thing about the people and culture around you?',
    'open_ended', 'That is something to be proud of.', false, true, '{}'),
  ('Abi1990', 'open_ended', 'open_conversation', 9,
    'I appreciate this conversation 😊 What would you like to know about me?',
    'free_time', 'Good question.', false, true, '{}'),

  ('princess77', 'opening', 'greeting', 1,
    'Hello 😊 I''m based in Berlin. It''s nice to meet you—how are you feeling today?',
    'location', 'Thank you for telling me.', false, true, '{}'),
  ('princess77', 'location', 'location', 2,
    'My flatmate speaks warmly about Nigeria. Which state or city are you from?',
    'food', 'I would like to learn more about that place.', false, true, '{}'),
  ('princess77', 'food', 'food', 3,
    'Food says a lot about a culture. Which Nigerian meal feels most like home to you?',
    'music', 'That sounds special.', false, true, '{}'),
  ('princess77', 'music', 'music', 4,
    'Berlin has every kind of music. What sound or artist do you return to most?',
    'work', 'Interesting choice.', false, true, '{}'),
  ('princess77', 'work', 'work_and_study', 5,
    'What kind of work, study, or personal project are you focused on now?',
    'free_time', 'That sounds worthwhile.', false, true, '{}'),
  ('princess77', 'free_time', 'free_time', 6,
    'What activity helps you feel refreshed after a long week?',
    'travel', 'I can understand that.', false, true, '{}'),
  ('princess77', 'travel', 'travel', 7,
    'Is travelling abroad something you hope to do, or do you prefer exploring close to home?',
    'culture', 'That is a fair way to see it.', false, true, '{}'),
  ('princess77', 'culture', 'culture', 8,
    'What detail about Nigerian life do you think outsiders often miss?',
    'open_ended', 'That gives me something to think about.', false, true, '{}'),
  ('princess77', 'open_ended', 'open_conversation', 9,
    'I''ve enjoyed hearing your perspective. What would you like to ask me?',
    'free_time', 'I am happy to answer.', false, true, '{}'),

  ('CamilaAnders', 'opening', 'greeting', 1,
    'G''day! 😄 I''m Camila from Sydney. How''s everything going with you today?',
    'location', 'Thanks for telling me!', false, true, '{}'),
  ('CamilaAnders', 'location', 'location', 2,
    'Nigeria is a long way from Australia! Which part are you chatting from?',
    'food', 'That sounds like a place with plenty of stories.', false, true, '{}'),
  ('CamilaAnders', 'food', 'food', 3,
    'I love spicy food, so what Nigerian dish should go at the top of my list?',
    'music', 'Now I want to try it 😄', false, true, '{}'),
  ('CamilaAnders', 'music', 'music', 4,
    'Afrobeats is massive here. What song or artist always improves your mood?',
    'work', 'Great pick!', false, true, '{}'),
  ('CamilaAnders', 'work', 'work_and_study', 5,
    'What are you busy with these days—work, study, or a business idea?',
    'free_time', 'That sounds exciting.', false, true, '{}'),
  ('CamilaAnders', 'free_time', 'free_time', 6,
    'When you get a free day, what do you actually enjoy doing?',
    'travel', 'That sounds fun.', false, true, '{}'),
  ('CamilaAnders', 'travel', 'travel', 7,
    'Would you ever take the very long flight to Australia? 😄',
    'culture', 'Fair enough!', false, true, '{}'),
  ('CamilaAnders', 'culture', 'culture', 8,
    'What part of Nigeria would you be most excited to show a visitor?',
    'open_ended', 'That would be great to experience.', false, true, '{}'),
  ('CamilaAnders', 'open_ended', 'open_conversation', 9,
    'This has been fun! What would you like to know about life over here?',
    'free_time', 'Ask away.', false, true, '{}')
on conflict (partner_key, node_key) do update set
  topic = excluded.topic,
  stage = excluded.stage,
  partner_message = excluded.partner_message,
  default_next_node_key = excluded.default_next_node_key,
  default_response_prefix = excluded.default_response_prefix,
  terminal = excluded.terminal,
  active = excluded.active,
  metadata = public.chatearn_conversation_nodes.metadata || excluded.metadata,
  updated_at = now();

with choice_templates (
  node_key, choice_key, label, intent_key, response_prefix,
  next_node_key, display_order
) as (
  values
    ('opening', 'doing_well', 'I''m good, thanks 😊', 'mood_positive', 'Glad to hear that!', 'location', 1),
    ('opening', 'busy_okay', 'A little busy, but I''m okay', 'mood_neutral', 'I understand—busy days can be a lot.', 'location', 2),
    ('opening', 'rough_day', 'It has been a rough day', 'mood_negative', 'I''m sorry today has been rough. I hope things get lighter.', 'location', 3),

    ('location', 'from_lagos', 'I''m from Lagos', 'location_lagos', 'Lagos! I keep hearing about its energy.', 'food', 1),
    ('location', 'from_abuja', 'I''m in Abuja', 'location_abuja', 'Abuja sounds like a beautiful, organised city.', 'food', 2),
    ('location', 'from_ogun', 'I''m from Ogun State', 'location_ogun', 'Ogun State—nice! I''d like to see more of it someday.', 'food', 3),
    ('location', 'another_place', 'I''m from another part of Nigeria', 'share_location', 'Nice! Nigeria has so many different places and cultures.', 'food', 4),

    ('food', 'choose_jollof', 'Jollof rice and chicken', 'food_jollof', 'Jollof is the answer I hear most often 😂', 'music', 1),
    ('food', 'choose_suya', 'You should try suya', 'food_suya', 'Suya sounds perfect—spicy and full of flavour.', 'music', 2),
    ('food', 'choose_other_food', 'I have another favourite meal', 'food_other', 'I''d genuinely like to try that.', 'music', 3),

    ('music', 'choose_afrobeats', 'Mostly Afrobeats', 'music_afrobeats', 'Afrobeats keeps finding new listeners everywhere.', 'work', 1),
    ('music', 'choose_gospel', 'I enjoy gospel music', 'music_gospel', 'Gospel can carry so much feeling and energy.', 'work', 2),
    ('music', 'choose_mixed', 'I listen to a bit of everything', 'music_other', 'A mixed playlist is never boring.', 'work', 3),

    ('work', 'currently_student', 'I''m currently a student', 'work_student', 'That is an important stage—keep going.', 'free_time', 1),
    ('work', 'work_in_tech', 'I work in tech or online', 'work_tech', 'Digital work is opening opportunities everywhere.', 'free_time', 2),
    ('work', 'run_business', 'I run a small business', 'work_business', 'Respect—that takes courage and consistency.', 'free_time', 3),
    ('work', 'other_work', 'I do another kind of work', 'work_other', 'Every honest path has its own challenges.', 'free_time', 4),

    ('free_time', 'relax_home', 'I mostly relax at home', 'hobby_home', 'A quiet day at home can be exactly what you need.', 'travel', 1),
    ('free_time', 'see_friends', 'I like going out with friends', 'hobby_social', 'Good company can make a simple day memorable.', 'travel', 2),
    ('free_time', 'creative_time', 'I enjoy music, books or creative things', 'hobby_creative', 'Creative time is a great way to recharge.', 'travel', 3),

    ('travel', 'would_travel', 'Yes, I''d love to travel someday', 'travel_yes', 'I hope you get the opportunity.', 'culture', 1),
    ('travel', 'maybe_travel', 'Maybe someday—I''m not sure yet', 'travel_maybe', 'There is no rush; plans can grow over time.', 'culture', 2),
    ('travel', 'prefer_home', 'Not really—I prefer being closer to home', 'travel_no', 'That is completely fair. Home has its own value.', 'culture', 3),

    ('culture', 'proud_music', 'Our music and creativity', 'culture_music', 'Nigerian creativity has definitely reached the world.', 'open_ended', 1),
    ('culture', 'proud_food', 'Our food and traditions', 'culture_food', 'Food and tradition can carry so much history.', 'open_ended', 2),
    ('culture', 'proud_people', 'Our people and community', 'culture_community', 'That sense of community is worth protecting.', 'open_ended', 3),
    ('culture', 'proud_ambition', 'Our ambition and hard work', 'culture_ambition', 'That determination is visible far beyond Nigeria.', 'open_ended', 4),

    ('open_ended', 'ask_work', 'What do you do for work?', 'ask_partner_work', 'Good question.', 'free_time', 1),
    ('open_ended', 'ask_location', 'Where exactly are you based?', 'ask_partner_location', 'Of course.', 'travel', 2),
    ('open_ended', 'ask_music', 'What music do you like?', 'ask_partner_music', 'I can answer that.', 'work', 3),
    ('open_ended', 'keep_talking', 'Let''s keep talking 😊', 'continue_general', 'Absolutely.', 'free_time', 4)
)
insert into public.chatearn_conversation_choices (
  partner_key, node_key, choice_key, label, intent_key,
  response_prefix, next_node_key, display_order, active
)
select
  p.partner_key,
  t.node_key,
  t.choice_key,
  t.label,
  t.intent_key,
  t.response_prefix,
  t.next_node_key,
  t.display_order,
  true
from public.chatearn_chat_partners p
cross join choice_templates t
where p.active = true
on conflict (partner_key, node_key, choice_key) do update set
  label = excluded.label,
  intent_key = excluded.intent_key,
  response_prefix = excluded.response_prefix,
  next_node_key = excluded.next_node_key,
  display_order = excluded.display_order,
  active = excluded.active,
  updated_at = now();

create or replace function chatearn_private.normalize_chat_body(p_body text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select left(
    trim(
      regexp_replace(
        regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g'),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    1000
  );
$$;

create or replace function chatearn_private.chat_suggestions(
  p_partner_key text,
  p_node_key text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'choice_key', c.choice_key,
        'label', c.label
      )
      order by c.display_order, c.choice_key
    ),
    '[]'::jsonb
  )
  from public.chatearn_conversation_choices c
  where c.partner_key = p_partner_key
    and c.node_key = p_node_key
    and c.active = true;
$$;

create or replace function chatearn_private.detect_context_intent(
  p_partner_key text,
  p_node_key text,
  p_body text
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_body text := lower(chatearn_private.normalize_chat_body(p_body));
  v_intent text;
begin
  select candidate.intent_key
  into v_intent
  from (
    select
      c.intent_key,
      r.priority,
      c.display_order,
      (
        select count(*)
        from unnest(r.keywords) keyword
        where position(lower(keyword) in v_body) > 0
      ) as match_count
    from public.chatearn_conversation_choices c
    join public.chatearn_intent_rules r on r.intent_key = c.intent_key
    where c.partner_key = p_partner_key
      and c.node_key = p_node_key
      and c.active = true
      and r.active = true
  ) candidate
  where candidate.match_count > 0
  order by
    candidate.match_count desc,
    candidate.priority desc,
    candidate.display_order
  limit 1;

  return coalesce(v_intent, 'general');
end;
$$;

-- Preserve the exact legacy transcript IDs and text client IDs. This is a
-- controlled, idempotent import; it never re-credits a historical message.
create or replace function chatearn_private.backfill_legacy_conversation_messages(
  p_confirmation text
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_rows bigint := 0;
begin
  if p_confirmation is distinct from 'BACKFILL_LEGACY_CHATEARN' then
    raise exception 'legacy backfill confirmation is required'
      using errcode = '22023',
            hint = 'Pass BACKFILL_LEGACY_CHATEARN only during a controlled legacy import.';
  end if;

  if to_regclass('public.chatearn_chat_messages') is null then
    return 0;
  end if;

  perform pg_advisory_xact_lock(43117, 20260717);

  execute $legacy_messages$
    insert into public.chatearn_conversation_messages (
      id,
      user_id,
      partner_key,
      sender,
      body,
      intent_key,
      node_key,
      in_reply_to_message_id,
      client_message_id,
      status,
      eligible_for_reward,
      metadata,
      created_at
    )
    select
      m.id,
      m.user_id,
      p.partner_key,
      case
        when lower(m.sender) = 'user' then 'user'
        when lower(m.sender) = 'partner' then 'partner'
        else 'system'
      end,
      left(coalesce(nullif(btrim(m.body), ''), '[Legacy message]'), 2000),
      'legacy',
      'open_ended',
      null,
      left(
        coalesce(nullif(btrim(m.client_message_id), ''), 'legacy:' || m.id::text),
        160
      ),
      case
        when lower(m.status) in ('sent', 'delivered', 'read', 'failed')
          then lower(m.status)
        else 'delivered'
      end,
      lower(m.sender) = 'user' and coalesce(m.reward, 0) > 0,
      jsonb_build_object(
        'engine', 'legacy_import',
        'legacy_reward', coalesce(m.reward, 0),
        'imported_from', 'chat-earn.xyz'
      ),
      m.created_at
    from public.chatearn_chat_messages m
    join auth.users u on u.id = m.user_id
    join public.chatearn_chat_partners p
      on lower(p.partner_key) = lower(m.partner_key)
    on conflict do nothing
  $legacy_messages$;
  get diagnostics v_rows = row_count;

  with message_summary as (
    select
      m.user_id,
      m.partner_key,
      count(*)::integer as total_message_count,
      count(*) filter (
        where m.sender = 'user' and m.eligible_for_reward
      )::integer as eligible_user_message_count,
      (array_agg(m.id order by m.created_at desc, m.id desc)
        filter (where m.sender = 'partner'))[1] as latest_partner_message_id,
      (array_agg(m.id order by m.created_at desc, m.id desc)
        filter (where m.sender = 'user'))[1] as latest_user_message_id,
      (array_agg(left(m.body, 240) order by m.created_at desc, m.id desc))[1]
        as last_message_preview,
      max(m.created_at) as last_message_at
    from public.chatearn_conversation_messages m
    where m.metadata ->> 'engine' = 'legacy_import'
    group by m.user_id, m.partner_key
  )
  update public.chatearn_conversation_states s
  set current_node_key = 'open_ended',
      latest_partner_message_id = coalesce(
        ms.latest_partner_message_id,
        s.latest_partner_message_id
      ),
      latest_user_message_id = coalesce(
        ms.latest_user_message_id,
        s.latest_user_message_id
      ),
      eligible_user_message_count = greatest(
        s.eligible_user_message_count,
        ms.eligible_user_message_count
      ),
      total_message_count = greatest(s.total_message_count, ms.total_message_count),
      suggested_replies = chatearn_private.chat_suggestions(
        s.partner_key,
        'open_ended'
      ),
      conversation_context = s.conversation_context || jsonb_build_object(
        'engine', 'structured_v1',
        'legacy_transcript_imported', true
      ),
      last_message_preview = coalesce(
        ms.last_message_preview,
        s.last_message_preview
      ),
      last_message_at = coalesce(ms.last_message_at, s.last_message_at),
      updated_at = now()
  from message_summary ms
  where s.user_id = ms.user_id
    and s.partner_key = ms.partner_key
    and (
      s.current_node_key = 'legacy_resume'
      or s.conversation_context ? 'legacy_thread'
    );

  return v_rows;
end;
$$;

-- Extend Module 2's controlled snapshot wrapper so a future cutover imports
-- the old transcript and account state in one operator action.
do $$
begin
  if to_regprocedure(
    'chatearn_private.backfill_legacy_snapshot_account_core(text)'
  ) is null then
    if to_regprocedure(
      'chatearn_private.backfill_legacy_snapshot(text)'
    ) is null then
      raise exception 'Module 2 legacy backfill wrapper is missing';
    end if;
    execute 'alter function chatearn_private.backfill_legacy_snapshot(text) rename to backfill_legacy_snapshot_account_core';
  end if;
end;
$$;

create or replace function chatearn_private.backfill_legacy_snapshot(
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_result jsonb;
  v_messages bigint := 0;
begin
  v_result := chatearn_private.backfill_legacy_snapshot_account_core(
    p_confirmation
  );
  v_messages := chatearn_private.backfill_legacy_conversation_messages(
    p_confirmation
  );
  v_result := coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'conversation_messages_written', v_messages
  );

  update public.chatearn_settings
  set value = jsonb_set(value, '{result}', v_result, true),
      updated_at = now()
  where setting_key = 'legacy_backfill_state';

  return v_result;
end;
$$;

alter table public.chatearn_chat_partners enable row level security;
alter table public.chatearn_conversation_nodes enable row level security;
alter table public.chatearn_intent_rules enable row level security;
alter table public.chatearn_conversation_choices enable row level security;
alter table public.chatearn_conversation_messages enable row level security;

drop policy if exists chatearn_chat_partners_active_read
on public.chatearn_chat_partners;
create policy chatearn_chat_partners_active_read
on public.chatearn_chat_partners for select to authenticated
using (active = true or public.chatearn_current_user_is_admin());

drop policy if exists chatearn_conversation_nodes_admin_read
on public.chatearn_conversation_nodes;
create policy chatearn_conversation_nodes_admin_read
on public.chatearn_conversation_nodes for select to authenticated
using (public.chatearn_current_user_is_admin());

drop policy if exists chatearn_intent_rules_admin_read
on public.chatearn_intent_rules;
create policy chatearn_intent_rules_admin_read
on public.chatearn_intent_rules for select to authenticated
using (public.chatearn_current_user_is_admin());

drop policy if exists chatearn_conversation_choices_admin_read
on public.chatearn_conversation_choices;
create policy chatearn_conversation_choices_admin_read
on public.chatearn_conversation_choices for select to authenticated
using (public.chatearn_current_user_is_admin());

drop policy if exists chatearn_conversation_messages_owner_read
on public.chatearn_conversation_messages;
create policy chatearn_conversation_messages_owner_read
on public.chatearn_conversation_messages for select to authenticated
using (user_id = auth.uid());

drop policy if exists chatearn_conversation_messages_admin_read
on public.chatearn_conversation_messages;
create policy chatearn_conversation_messages_admin_read
on public.chatearn_conversation_messages for select to authenticated
using (public.chatearn_current_user_is_admin());

revoke all on table public.chatearn_chat_partners
from public, anon, authenticated;
revoke all on table public.chatearn_conversation_nodes
from public, anon, authenticated;
revoke all on table public.chatearn_intent_rules
from public, anon, authenticated;
revoke all on table public.chatearn_conversation_choices
from public, anon, authenticated;
revoke all on table public.chatearn_conversation_messages
from public, anon, authenticated;

grant select on table public.chatearn_chat_partners to authenticated;
grant select on table public.chatearn_conversation_messages to authenticated;
grant all on table public.chatearn_chat_partners to service_role;
grant all on table public.chatearn_conversation_nodes to service_role;
grant all on table public.chatearn_intent_rules to service_role;
grant all on table public.chatearn_conversation_choices to service_role;
grant all on table public.chatearn_conversation_messages to service_role;

revoke all on function chatearn_private.normalize_chat_body(text)
from public, anon, authenticated;
revoke all on function chatearn_private.chat_suggestions(text, text)
from public, anon, authenticated;
revoke all on function chatearn_private.detect_context_intent(text, text, text)
from public, anon, authenticated;
revoke all on function chatearn_private.backfill_legacy_conversation_messages(text)
from public, anon, authenticated, service_role;
revoke all on function chatearn_private.backfill_legacy_snapshot_account_core(text)
from public, anon, authenticated, service_role;
revoke all on function chatearn_private.backfill_legacy_snapshot(text)
from public, anon, authenticated;

grant execute on function chatearn_private.backfill_legacy_snapshot(text)
to service_role;

create or replace function chatearn_private.direct_partner_answer(
  p_partner_key text,
  p_body text
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_body text := lower(chatearn_private.normalize_chat_body(p_body));
  v_partner public.chatearn_chat_partners;
begin
  select *
  into v_partner
  from public.chatearn_chat_partners p
  where p.partner_key = p_partner_key
    and p.active = true;

  if not found then
    return null;
  end if;

  if v_body like '%what do you do%'
     or v_body like '%your job%'
     or v_body like '%where do you work%' then
    return format('I work as a %s here.', v_partner.occupation);
  end if;

  if v_body like '%where do you live%'
     or v_body like '%where are you based%'
     or v_body like '%where are you from%'
     or v_body like '%which city are you%' then
    return format('I''m based in %s, %s.', v_partner.city, v_partner.country);
  end if;

  if v_body like '%what music do you like%'
     or v_body like '%your favourite music%'
     or v_body like '%your favorite music%'
     or v_body like '%who do you listen to%' then
    return format('I listen to %s most often.', v_partner.favorite_music);
  end if;

  if v_body like '%how old are you%'
     or v_body like '%what is your age%'
     or v_body like '%what''s your age%' then
    return format('I''m %s.', v_partner.age);
  end if;

  if v_body like '%what food do you like%'
     or v_body like '%your favourite food%'
     or v_body like '%your favorite food%' then
    return format('A favourite of mine is %s.', v_partner.favorite_food);
  end if;

  if v_body like '%how about you%'
     or v_body like '%how are you%'
     or v_body like '%and you%?' then
    return 'I''m doing well, thanks for asking.';
  end if;

  return null;
end;
$$;

create or replace function chatearn_private.ensure_conversation(
  p_user_id uuid,
  p_partner_key text
)
returns public.chatearn_conversation_states
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_opening public.chatearn_conversation_nodes;
  v_state public.chatearn_conversation_states;
  v_opening_message public.chatearn_conversation_messages;
  v_suggestions jsonb;
  v_created boolean := false;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22004';
  end if;

  select n.*
  into v_opening
  from public.chatearn_conversation_nodes n
  join public.chatearn_chat_partners p on p.partner_key = n.partner_key
  where n.partner_key = p_partner_key
    and n.node_key = 'opening'
    and n.active = true
    and p.active = true;

  if not found then
    raise exception 'chat partner is unavailable' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_partner_key, 3)
  );

  v_suggestions := chatearn_private.chat_suggestions(p_partner_key, 'opening');

  insert into public.chatearn_conversation_states (
    user_id,
    partner_key,
    current_node_key,
    eligible_user_message_count,
    total_message_count,
    suggested_replies,
    conversation_context,
    unread_count,
    last_opened_at
  ) values (
    p_user_id,
    p_partner_key,
    'opening',
    0,
    0,
    v_suggestions,
    jsonb_build_object('engine', 'structured_v1'),
    0,
    now()
  )
  on conflict (user_id, partner_key) do nothing
  returning * into v_state;

  v_created := found;

  if v_created then
    insert into public.chatearn_conversation_messages (
      user_id,
      partner_key,
      sender,
      body,
      intent_key,
      node_key,
      client_message_id,
      status,
      eligible_for_reward,
      metadata
    ) values (
      p_user_id,
      p_partner_key,
      'partner',
      v_opening.partner_message,
      'opening',
      'opening',
      gen_random_uuid()::text,
      'delivered',
      false,
      jsonb_build_object('engine', 'structured_v1', 'opening', true)
    )
    returning * into v_opening_message;

    update public.chatearn_conversation_states
    set latest_partner_message_id = v_opening_message.id,
        total_message_count = 1,
        last_message_preview = left(v_opening_message.body, 240),
        last_message_at = v_opening_message.created_at,
        updated_at = now()
    where user_id = p_user_id
      and partner_key = p_partner_key
    returning * into v_state;
  else
    select *
    into v_state
    from public.chatearn_conversation_states s
    where s.user_id = p_user_id
      and s.partner_key = p_partner_key;

    if not exists (
      select 1
      from public.chatearn_conversation_nodes n
      where n.partner_key = p_partner_key
        and n.node_key = v_state.current_node_key
        and n.active = true
    ) then
      update public.chatearn_conversation_states
      set current_node_key = 'open_ended',
          suggested_replies = chatearn_private.chat_suggestions(
            p_partner_key,
            'open_ended'
          ),
          conversation_context = conversation_context || jsonb_build_object(
            'resume_mapping', 'legacy_to_open_ended'
          ),
          updated_at = now()
      where user_id = p_user_id
        and partner_key = p_partner_key
      returning * into v_state;
    end if;
  end if;

  return v_state;
end;
$$;

create or replace function public.chatearn_get_chat_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_partners jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'partner_key', p.partner_key,
        'display_name', p.display_name,
        'age', p.age,
        'city', p.city,
        'country', p.country,
        'flag', p.flag,
        'language_label', p.language_label,
        'personality', p.personality,
        'tone', p.tone,
        'interests', p.interests,
        'avatar_initials', p.avatar_initials,
        'avatar_gradient', p.avatar_gradient,
        'chat_reward_amount', p.chat_reward_amount,
        'last_message_preview', s.last_message_preview,
        'last_message_at', s.last_message_at,
        'unread_count', coalesce(s.unread_count, 0),
        'eligible_user_message_count', coalesce(s.eligible_user_message_count, 0),
        'has_conversation', s.user_id is not null
      )
      order by p.sort_order, p.partner_key
    ),
    '[]'::jsonb
  )
  into v_partners
  from public.chatearn_chat_partners p
  left join public.chatearn_conversation_states s
    on s.user_id = v_user_id
   and s.partner_key = p.partner_key
  where p.active = true;

  return jsonb_build_object(
    'ok', true,
    'server_time', now(),
    'partners', v_partners
  );
end;
$$;

create or replace function public.chatearn_open_conversation(
  p_partner_key text,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 200));
  v_profile public.chatearn_user_profiles;
  v_journey public.chatearn_user_journeys;
  v_partner public.chatearn_chat_partners;
  v_state public.chatearn_conversation_states;
  v_messages jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select *
  into v_profile
  from public.chatearn_user_profiles p
  where p.user_id = v_user_id;

  if not found then
    raise exception 'account bootstrap is required' using errcode = '55000';
  end if;

  select *
  into v_partner
  from public.chatearn_chat_partners p
  where p.partner_key = p_partner_key
    and p.active = true;

  if not found then
    raise exception 'chat partner is unavailable' using errcode = '22023';
  end if;

  v_state := chatearn_private.ensure_conversation(v_user_id, p_partner_key);

  update public.chatearn_conversation_states
  set unread_count = 0,
      last_opened_at = now(),
      updated_at = now()
  where user_id = v_user_id
    and partner_key = p_partner_key
  returning * into v_state;

  update public.chatearn_user_profiles
  set last_seen_at = now(),
      last_page = 'chat',
      last_partner = p_partner_key,
      updated_at = now()
  where user_id = v_user_id;

  update public.chatearn_user_journeys
  set active_partner_key = p_partner_key,
      version = version + 1,
      updated_at = now()
  where user_id = v_user_id
    and active_partner_key is distinct from p_partner_key;

  select *
  into v_journey
  from public.chatearn_user_journeys j
  where j.user_id = v_user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', messages.id,
        'sender', messages.sender,
        'body', messages.body,
        'status', messages.status,
        'client_message_id', messages.client_message_id,
        'intent_key', messages.intent_key,
        'node_key', messages.node_key,
        'eligible_for_reward', messages.eligible_for_reward,
        'created_at', messages.created_at
      )
      order by messages.created_at, messages.id
    ),
    '[]'::jsonb
  )
  into v_messages
  from (
    select m.*
    from public.chatearn_conversation_messages m
    where m.user_id = v_user_id
      and m.partner_key = p_partner_key
    order by m.created_at desc, m.id desc
    limit v_limit
  ) messages;

  return jsonb_build_object(
    'ok', true,
    'partner', jsonb_build_object(
      'partner_key', v_partner.partner_key,
      'display_name', v_partner.display_name,
      'age', v_partner.age,
      'city', v_partner.city,
      'country', v_partner.country,
      'flag', v_partner.flag,
      'language_label', v_partner.language_label,
      'personality', v_partner.personality,
      'tone', v_partner.tone,
      'interests', v_partner.interests,
      'avatar_initials', v_partner.avatar_initials,
      'avatar_gradient', v_partner.avatar_gradient,
      'chat_reward_amount', v_partner.chat_reward_amount
    ),
    'messages', v_messages,
    'state', jsonb_build_object(
      'current_node_key', v_state.current_node_key,
      'eligible_user_message_count', v_state.eligible_user_message_count,
      'total_message_count', v_state.total_message_count,
      'suggested_replies', v_state.suggested_replies,
      'last_message_at', v_state.last_message_at
    ),
    'can_send', v_profile.status = 'active'
      and coalesce(v_journey.journey_state, 'earning_enabled') <> 'suspended',
    'earnings_paused', coalesce(v_journey.earnings_paused, false),
    'sponsored_rewards_paused', coalesce(
      v_journey.sponsored_rewards_paused,
      false
    )
  );
end;
$$;

create or replace function public.chatearn_send_chat_message(
  p_partner_key text,
  p_body text,
  p_client_message_id text,
  p_selected_choice_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := chatearn_private.normalize_chat_body(p_body);
  v_client_message_id text := left(trim(coalesce(p_client_message_id, '')), 160);
  v_profile public.chatearn_user_profiles;
  v_journey public.chatearn_user_journeys;
  v_state public.chatearn_conversation_states;
  v_current_node public.chatearn_conversation_nodes;
  v_next_node public.chatearn_conversation_nodes;
  v_choice public.chatearn_conversation_choices;
  v_existing_user public.chatearn_conversation_messages;
  v_existing_partner public.chatearn_conversation_messages;
  v_user_message public.chatearn_conversation_messages;
  v_partner_message public.chatearn_conversation_messages;
  v_intent text := 'general';
  v_match_method text := 'typed_fallback';
  v_next_node_key text;
  v_response_prefix text;
  v_direct_answer text;
  v_partner_body text;
  v_suggestions jsonb;
  v_repeated_recently boolean := false;
  v_reward_eligible boolean := false;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if nullif(v_client_message_id, '') is null then
    raise exception 'client_message_id is required' using errcode = '22004';
  end if;
  if nullif(v_body, '') is null then
    raise exception 'message body is required' using errcode = '22023';
  end if;

  select *
  into v_profile
  from public.chatearn_user_profiles p
  where p.user_id = v_user_id;

  if not found then
    raise exception 'account bootstrap is required' using errcode = '55000';
  end if;
  if v_profile.status <> 'active' then
    raise exception 'account is not active' using errcode = '55000';
  end if;

  select *
  into v_journey
  from public.chatearn_user_journeys j
  where j.user_id = v_user_id;

  if not found then
    raise exception 'account journey is missing' using errcode = '55000';
  end if;
  if v_journey.journey_state = 'suspended' then
    raise exception 'chat is unavailable for this account' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_partner_key, 3)
  );

  v_state := chatearn_private.ensure_conversation(v_user_id, p_partner_key);

  select *
  into v_existing_user
  from public.chatearn_conversation_messages m
  where m.user_id = v_user_id
    and m.client_message_id = v_client_message_id
    and m.sender = 'user';

  if found then
    if v_existing_user.partner_key <> p_partner_key then
      raise exception 'client_message_id was already used for another conversation'
        using errcode = '23505';
    end if;
    select *
    into v_existing_partner
    from public.chatearn_conversation_messages m
    where m.in_reply_to_message_id = v_existing_user.id
      and m.sender = 'partner'
    order by m.created_at, m.id
    limit 1;

    select *
    into v_state
    from public.chatearn_conversation_states s
    where s.user_id = v_user_id
      and s.partner_key = p_partner_key;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'match_method', coalesce(
        v_existing_user.metadata ->> 'match_method',
        'idempotent_replay'
      ),
      'intent_key', v_existing_user.intent_key,
      'user_message', to_jsonb(v_existing_user) - 'user_id' - 'metadata',
      'partner_message', case
        when v_existing_partner.id is null then null
        else to_jsonb(v_existing_partner) - 'user_id' - 'metadata'
      end,
      'suggested_replies', v_state.suggested_replies,
      'eligible_user_message_count', v_state.eligible_user_message_count,
      'total_message_count', v_state.total_message_count,
      'reward_eligible', v_existing_user.eligible_for_reward,
      'reward', null
    );
  end if;

  if exists (
    select 1
    from public.chatearn_conversation_messages m
    where m.user_id = v_user_id
      and m.partner_key = p_partner_key
      and m.sender = 'user'
      and m.created_at > now() - interval '750 milliseconds'
  ) then
    raise exception 'message sent too quickly' using errcode = '55000';
  end if;

  select *
  into v_current_node
  from public.chatearn_conversation_nodes n
  where n.partner_key = p_partner_key
    and n.node_key = v_state.current_node_key
    and n.active = true;

  if not found then
    raise exception 'conversation state is invalid' using errcode = '55000';
  end if;

  if nullif(trim(coalesce(p_selected_choice_key, '')), '') is not null then
    select *
    into v_choice
    from public.chatearn_conversation_choices c
    where c.partner_key = p_partner_key
      and c.node_key = v_current_node.node_key
      and c.choice_key = trim(p_selected_choice_key)
      and c.active = true;

    if not found then
      raise exception 'suggested reply is no longer valid' using errcode = '22023';
    end if;
    if lower(chatearn_private.normalize_chat_body(v_choice.label)) <> lower(v_body) then
      raise exception 'suggested reply text does not match its choice key'
        using errcode = '22023';
    end if;

    v_intent := v_choice.intent_key;
    v_next_node_key := v_choice.next_node_key;
    v_response_prefix := v_choice.response_prefix;
    v_match_method := 'suggested_reply';
  else
    v_intent := chatearn_private.detect_context_intent(
      p_partner_key,
      v_current_node.node_key,
      v_body
    );

    select *
    into v_choice
    from public.chatearn_conversation_choices c
    where c.partner_key = p_partner_key
      and c.node_key = v_current_node.node_key
      and c.intent_key = v_intent
      and c.active = true
    limit 1;

    if found then
      v_next_node_key := v_choice.next_node_key;
      v_response_prefix := v_choice.response_prefix;
      v_match_method := 'typed_intent';
    else
      v_intent := 'general';
      v_next_node_key := v_current_node.default_next_node_key;
      v_response_prefix := v_current_node.default_response_prefix;
      v_match_method := 'typed_fallback';
    end if;
  end if;

  select *
  into v_next_node
  from public.chatearn_conversation_nodes n
  where n.partner_key = p_partner_key
    and n.node_key = v_next_node_key
    and n.active = true;

  if not found then
    raise exception 'conversation route is unavailable' using errcode = '55000';
  end if;

  v_direct_answer := chatearn_private.direct_partner_answer(
    p_partner_key,
    v_body
  );
  v_partner_body := left(
    concat_ws(
      ' ',
      nullif(v_direct_answer, ''),
      nullif(v_response_prefix, ''),
      v_next_node.partner_message
    ),
    2000
  );
  v_suggestions := chatearn_private.chat_suggestions(
    p_partner_key,
    v_next_node.node_key
  );

  select exists (
    select 1
    from public.chatearn_conversation_messages m
    where m.user_id = v_user_id
      and m.partner_key = p_partner_key
      and m.sender = 'user'
      and lower(m.body) = lower(v_body)
      and m.created_at > now() - interval '30 seconds'
  )
  into v_repeated_recently;

  v_reward_eligible := not v_journey.earnings_paused
    and char_length(v_body) >= 2
    and not v_repeated_recently;

  insert into public.chatearn_conversation_messages (
    user_id,
    partner_key,
    sender,
    body,
    intent_key,
    node_key,
    in_reply_to_message_id,
    client_message_id,
    status,
    eligible_for_reward,
    metadata
  ) values (
    v_user_id,
    p_partner_key,
    'user',
    v_body,
    v_intent,
    v_current_node.node_key,
    v_state.latest_partner_message_id,
    v_client_message_id,
    'delivered',
    v_reward_eligible,
    jsonb_build_object(
      'engine', 'structured_v1',
      'match_method', v_match_method,
      'selected_choice_key', p_selected_choice_key
    )
  )
  returning * into v_user_message;

  insert into public.chatearn_conversation_messages (
    user_id,
    partner_key,
    sender,
    body,
    intent_key,
    node_key,
    in_reply_to_message_id,
    client_message_id,
    status,
    eligible_for_reward,
    metadata
  ) values (
    v_user_id,
    p_partner_key,
    'partner',
    v_partner_body,
    v_intent,
    v_next_node.node_key,
    v_user_message.id,
    gen_random_uuid()::text,
    'delivered',
    false,
    jsonb_build_object(
      'engine', 'structured_v1',
      'match_method', v_match_method
    )
  )
  returning * into v_partner_message;

  update public.chatearn_conversation_states
  set current_node_key = v_next_node.node_key,
      latest_partner_message_id = v_partner_message.id,
      latest_user_message_id = v_user_message.id,
      eligible_user_message_count = eligible_user_message_count
        + case when v_reward_eligible then 1 else 0 end,
      total_message_count = total_message_count + 2,
      suggested_replies = v_suggestions,
      conversation_context = conversation_context || jsonb_build_object(
        'last_intent', v_intent,
        'last_match_method', v_match_method
      ),
      last_message_preview = left(v_partner_body, 240),
      unread_count = 0,
      last_user_intent = v_intent,
      last_message_at = v_partner_message.created_at,
      last_opened_at = now(),
      updated_at = now()
  where user_id = v_user_id
    and partner_key = p_partner_key
  returning * into v_state;

  update public.chatearn_user_profiles
  set last_seen_at = now(),
      last_page = 'chat',
      last_partner = p_partner_key,
      updated_at = now()
  where user_id = v_user_id;

  update public.chatearn_user_journeys
  set active_partner_key = p_partner_key,
      version = version + 1,
      updated_at = now()
  where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'match_method', v_match_method,
    'intent_key', v_intent,
    'user_message', to_jsonb(v_user_message) - 'user_id' - 'metadata',
    'partner_message', to_jsonb(v_partner_message) - 'user_id' - 'metadata',
    'partner_reply_delay_ms', least(
      3200,
      850 + char_length(v_partner_body) * 18
    ),
    'suggested_replies', v_suggestions,
    'eligible_user_message_count', v_state.eligible_user_message_count,
    'total_message_count', v_state.total_message_count,
    'reward_eligible', v_reward_eligible,
    'reward', null,
    'earnings_paused', v_journey.earnings_paused,
    'sponsored_rewards_paused', v_journey.sponsored_rewards_paused
  );
end;
$$;

revoke all on function chatearn_private.direct_partner_answer(text, text)
from public, anon, authenticated;
revoke all on function chatearn_private.ensure_conversation(uuid, text)
from public, anon, authenticated;
revoke all on function public.chatearn_get_chat_list()
from public, anon;
revoke all on function public.chatearn_open_conversation(text, integer)
from public, anon;
revoke all on function public.chatearn_send_chat_message(text, text, text, text)
from public, anon;

grant execute on function public.chatearn_get_chat_list()
to authenticated;
grant execute on function public.chatearn_open_conversation(text, integer)
to authenticated;
grant execute on function public.chatearn_send_chat_message(text, text, text, text)
to authenticated;

commit;
