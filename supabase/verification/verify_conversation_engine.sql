-- ChatEarn Module 3 verification.
-- Read-only against permanent data. Every blocking row must pass before use.

begin;

create temporary table chatearn_chat_verification_results (
  check_name text not null,
  passed boolean not null,
  observed text not null,
  expected text not null,
  severity text not null check (severity in ('blocking', 'warning'))
) on commit drop;

insert into chatearn_chat_verification_results
select
  'canonical chat tables exist',
  count(*) = 5,
  count(*)::text,
  '5',
  'blocking'
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'chatearn_chat_partners',
    'chatearn_conversation_nodes',
    'chatearn_intent_rules',
    'chatearn_conversation_choices',
    'chatearn_conversation_messages'
  );

insert into chatearn_chat_verification_results
select
  'canonical chat tables have RLS enabled',
  count(*) = 5 and bool_and(c.relrowsecurity),
  format(
    'tables=%s all_rls=%s',
    count(*),
    coalesce(bool_and(c.relrowsecurity), false)
  ),
  'tables=5 all_rls=true',
  'blocking'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'chatearn_chat_partners',
    'chatearn_conversation_nodes',
    'chatearn_intent_rules',
    'chatearn_conversation_choices',
    'chatearn_conversation_messages'
  );

insert into chatearn_chat_verification_results
select
  'no client mutation grants on canonical chat tables',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'chatearn_chat_partners',
    'chatearn_conversation_nodes',
    'chatearn_intent_rules',
    'chatearn_conversation_choices',
    'chatearn_conversation_messages'
  )
  and grantee in ('anon', 'authenticated', 'PUBLIC')
  and privilege_type in (
    'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES'
  );

insert into chatearn_chat_verification_results
select
  'canonical chat RLS policies do not allow client mutations',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from pg_policies
where schemaname = 'public'
  and tablename in (
    'chatearn_chat_partners',
    'chatearn_conversation_nodes',
    'chatearn_intent_rules',
    'chatearn_conversation_choices',
    'chatearn_conversation_messages'
  )
  and cmd <> 'SELECT';

insert into chatearn_chat_verification_results
select
  'exact live partner identities are preserved',
  count(*) = 6
    and array_agg(partner_key order by sort_order) = array[
      'alexlab102', 'EmiliaCute', 'MattJohn',
      'Abi1990', 'princess77', 'CamilaAnders'
    ]::text[],
  format(
    'count=%s partners=%s',
    count(*),
    array_agg(partner_key order by sort_order)
  ),
  'count=6 partners={alexlab102,EmiliaCute,MattJohn,Abi1990,princess77,CamilaAnders}',
  'blocking'
from public.chatearn_chat_partners
where active = true;

insert into chatearn_chat_verification_results
select
  'active partner profiles are complete and adult',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from public.chatearn_chat_partners p
where p.active = true
  and (
    p.age < 18
    or nullif(btrim(p.city), '') is null
    or nullif(btrim(p.country), '') is null
    or nullif(btrim(p.personality), '') is null
    or nullif(btrim(p.tone), '') is null
    or jsonb_array_length(p.interests) = 0
  );

insert into chatearn_chat_verification_results
select
  'each active partner has nine conversation nodes',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from (
  select p.partner_key
  from public.chatearn_chat_partners p
  left join public.chatearn_conversation_nodes n
    on n.partner_key = p.partner_key and n.active = true
  where p.active = true
  group by p.partner_key
  having count(n.node_key) <> 9
) incomplete_partners;

insert into chatearn_chat_verification_results
select
  'each active node has at least three matching suggestions',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from (
  select n.partner_key, n.node_key
  from public.chatearn_conversation_nodes n
  left join public.chatearn_conversation_choices c
    on c.partner_key = n.partner_key
   and c.node_key = n.node_key
   and c.active = true
  where n.active = true
  group by n.partner_key, n.node_key
  having count(c.id) < 3
) incomplete_nodes;

insert into chatearn_chat_verification_results
select
  'all default conversation routes resolve',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from public.chatearn_conversation_nodes n
left join public.chatearn_conversation_nodes next_node
  on next_node.partner_key = n.partner_key
 and next_node.node_key = n.default_next_node_key
 and next_node.active = true
where n.active = true
  and next_node.node_key is null;

insert into chatearn_chat_verification_results
select
  'all choice intents have active rules',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from public.chatearn_conversation_choices c
left join public.chatearn_intent_rules r
  on r.intent_key = c.intent_key and r.active = true
where c.active = true
  and r.intent_key is null;

insert into chatearn_chat_verification_results
select
  'chat RPC privilege boundary',
  has_function_privilege(
    'authenticated',
    'public.chatearn_get_chat_list()',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.chatearn_open_conversation(text,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.chatearn_send_chat_message(text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.chatearn_get_chat_list()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.chatearn_open_conversation(text,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.chatearn_send_chat_message(text,text,text,text)',
    'EXECUTE'
  ),
  format(
    'authenticated=%s/%s/%s anon=%s/%s/%s',
    has_function_privilege('authenticated', 'public.chatearn_get_chat_list()', 'EXECUTE'),
    has_function_privilege('authenticated', 'public.chatearn_open_conversation(text,integer)', 'EXECUTE'),
    has_function_privilege('authenticated', 'public.chatearn_send_chat_message(text,text,text,text)', 'EXECUTE'),
    has_function_privilege('anon', 'public.chatearn_get_chat_list()', 'EXECUTE'),
    has_function_privilege('anon', 'public.chatearn_open_conversation(text,integer)', 'EXECUTE'),
    has_function_privilege('anon', 'public.chatearn_send_chat_message(text,text,text,text)', 'EXECUTE')
  ),
  'authenticated=true/true/true anon=false/false/false',
  'blocking';

insert into chatearn_chat_verification_results
select
  'private chat helpers are not client executable',
  not has_function_privilege(
    'authenticated',
    'chatearn_private.ensure_conversation(uuid,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'chatearn_private.backfill_legacy_conversation_messages(text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'chatearn_private.ensure_conversation(uuid,text)',
    'EXECUTE'
  ),
  format(
    'authenticated_ensure=%s authenticated_backfill=%s anon_ensure=%s',
    has_function_privilege('authenticated', 'chatearn_private.ensure_conversation(uuid,text)', 'EXECUTE'),
    has_function_privilege('authenticated', 'chatearn_private.backfill_legacy_conversation_messages(text)', 'EXECUTE'),
    has_function_privilege('anon', 'chatearn_private.ensure_conversation(uuid,text)', 'EXECUTE')
  ),
  'authenticated_ensure=false authenticated_backfill=false anon_ensure=false',
  'blocking';

insert into chatearn_chat_verification_results
select
  'message client identifiers are unique per user',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from (
  select user_id, client_message_id
  from public.chatearn_conversation_messages
  group by user_id, client_message_id
  having count(*) > 1
) duplicate_messages;

insert into chatearn_chat_verification_results
select
  'known partner states resolve to active nodes',
  count(*) = 0,
  count(*)::text,
  '0',
  'blocking'
from public.chatearn_conversation_states s
join public.chatearn_chat_partners p
  on p.partner_key = s.partner_key and p.active = true
left join public.chatearn_conversation_nodes n
  on n.partner_key = s.partner_key
 and n.node_key = s.current_node_key
 and n.active = true
where n.node_key is null;

insert into chatearn_chat_verification_results
select
  'chat RPC does not issue wallet credits',
  count(*) = 1
    and bool_and(
      position('append_wallet_entry' in lower(p.prosrc)) = 0
      and position('chatearn_wallet_ledger' in lower(p.prosrc)) = 0
      and position('chatearn_reward_ledger' in lower(p.prosrc)) = 0
    ),
  format(
    'functions=%s wallet_writer_references=%s',
    count(*),
    count(*) filter (
      where position('append_wallet_entry' in lower(p.prosrc)) > 0
         or position('chatearn_wallet_ledger' in lower(p.prosrc)) > 0
         or position('chatearn_reward_ledger' in lower(p.prosrc)) > 0
    )
  ),
  'functions=1 wallet_writer_references=0',
  'blocking'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'chatearn_send_chat_message';

do $$
declare
  v_completed boolean := false;
  v_missing bigint := 0;
begin
  select coalesce((s.value ->> 'completed')::boolean, false)
  into v_completed
  from public.chatearn_settings s
  where s.setting_key = 'legacy_backfill_state';

  if to_regclass('public.chatearn_chat_messages') is not null and v_completed then
    execute $legacy_check$
      select count(*)
      from public.chatearn_chat_messages legacy
      join auth.users u on u.id = legacy.user_id
      join public.chatearn_chat_partners p
        on lower(p.partner_key) = lower(legacy.partner_key)
      left join public.chatearn_conversation_messages canonical
        on canonical.id = legacy.id
      where canonical.id is null
    $legacy_check$ into v_missing;

    insert into chatearn_chat_verification_results values (
      'completed legacy transcript is fully imported',
      v_missing = 0,
      v_missing::text,
      '0',
      'blocking'
    );
  else
    insert into chatearn_chat_verification_results values (
      'legacy transcript compatibility',
      true,
      'legacy backfill not completed in this environment',
      'not applicable before controlled snapshot backfill',
      'warning'
    );
  end if;
end;
$$;

select
  severity,
  check_name,
  passed,
  observed,
  expected
from chatearn_chat_verification_results
order by
  case severity when 'blocking' then 0 else 1 end,
  passed,
  check_name;

rollback;
