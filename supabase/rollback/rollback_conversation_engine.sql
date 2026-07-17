-- ChatEarn Module 3 safe rollback.
-- Disables the new chat API while retaining all partner, node, and message data.

begin;

revoke all on function public.chatearn_get_chat_list()
from public, anon, authenticated;
revoke all on function public.chatearn_open_conversation(text, integer)
from public, anon, authenticated;
revoke all on function public.chatearn_send_chat_message(text, text, text, text)
from public, anon, authenticated;

drop function if exists public.chatearn_send_chat_message(text, text, text, text);
drop function if exists public.chatearn_open_conversation(text, integer);
drop function if exists public.chatearn_get_chat_list();

drop function if exists chatearn_private.ensure_conversation(uuid, text);
drop function if exists chatearn_private.direct_partner_answer(text, text);
drop function if exists chatearn_private.detect_context_intent(text, text, text);

revoke all on function chatearn_private.backfill_legacy_snapshot(text)
from public, anon, authenticated, service_role;
drop function if exists chatearn_private.backfill_legacy_snapshot(text);

do $$
begin
  if to_regprocedure(
    'chatearn_private.backfill_legacy_snapshot_account_core(text)'
  ) is not null
     and to_regprocedure(
       'chatearn_private.backfill_legacy_snapshot(text)'
     ) is null then
    execute 'alter function chatearn_private.backfill_legacy_snapshot_account_core(text) rename to backfill_legacy_snapshot';
  end if;
end;
$$;

revoke all on function chatearn_private.backfill_legacy_conversation_messages(text)
from public, anon, authenticated, service_role;
drop function if exists chatearn_private.backfill_legacy_conversation_messages(text);

drop function if exists chatearn_private.chat_suggestions(text, text);
drop function if exists chatearn_private.normalize_chat_body(text);

drop policy if exists chatearn_chat_partners_active_read
on public.chatearn_chat_partners;
drop policy if exists chatearn_conversation_nodes_admin_read
on public.chatearn_conversation_nodes;
drop policy if exists chatearn_intent_rules_admin_read
on public.chatearn_intent_rules;
drop policy if exists chatearn_conversation_choices_admin_read
on public.chatearn_conversation_choices;
drop policy if exists chatearn_conversation_messages_owner_read
on public.chatearn_conversation_messages;
drop policy if exists chatearn_conversation_messages_admin_read
on public.chatearn_conversation_messages;

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

grant execute on function chatearn_private.backfill_legacy_snapshot(text)
to service_role;

commit;
