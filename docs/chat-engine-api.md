# ChatEarn structured chat engine

Module 3 replaces browser-generated conversation logic with one server-owned,
structured engine. It preserves the live `chat-earn.xyz` partner identities,
rates, black/green interface contract, chat list, and chat-screen journey.

This module does **not** credit money. It only marks whether an accepted user
message may be considered by Module 4. The canonical wallet and reward engine
remain the only financial authority.

## Public RPC contract

All RPCs require an authenticated Supabase session. The frontend must use the
anon key plus the user's access token; it must never use a service-role key.

### `chatearn_get_chat_list()`

Returns the six live partners in the established display order with personality,
location, interests, display styling, current preview, unread count, and resume
metadata.

### `chatearn_open_conversation(partner_key, limit)`

Creates the opening message once, or resumes the existing transcript. It returns:

- the partner profile used by the existing chat header;
- chronological messages;
- the current conversation node and matching suggestions;
- chat availability and server-owned pause flags.

The maximum transcript page is 200 messages. Later frontend work can page older
messages without changing the visible chat design.

### `chatearn_send_chat_message(partner_key, body, client_message_id, selected_choice_key)`

`client_message_id` is the live site's existing text identifier (maximum 160
characters). It is unique per user, so network retries return the same result
instead of storing or rewarding a duplicate.

For a suggested reply, send both its `choice_key` and exact `label`. The server
rejects stale or mismatched choices. For typed text, omit `selected_choice_key`;
the server normalizes the text, maps it to an intent valid for the partner's
latest question, and follows the corresponding branch.

The response contains the stored user message, the corresponding partner reply,
the next matching suggestions, a natural display delay, counters, and
`reward_eligible`. The `reward` field is deliberately `null` until Module 4.

## Conversation guarantees

- Suggestions are loaded only from the latest partner node.
- A selected suggestion has one deterministic intent and next node.
- Typed messages use node-scoped keyword intent matching and a safe fallback.
- Direct questions about the partner's location, work, age, music, or food use
  that partner's persisted facts.
- Both sides of a turn are written atomically.
- One advisory lock serializes simultaneous sends in the same conversation.
- Exact messages repeated within 30 seconds are retained but not reward-eligible.
- Resume state, last preview, counts, and transcript live in the database.

## Legacy compatibility

The controlled snapshot wrapper imports the existing `chatearn_chat_messages`
rows without issuing any new credits. Original message UUIDs, text client IDs,
timestamps, sender, status, and stored legacy reward metadata are retained.
Known live conversations resume at the open-ended structured node.

Nothing in Module 3 deletes the old chat tables or frontend scripts. Those remain
available until the replacement frontend has passed regression testing and the
final cutover explicitly retires them.

## Safe rollback

`rollback_conversation_engine.sql` removes client access and the Module 3 RPCs,
then restores Module 2's legacy wrapper. It intentionally leaves all partner,
node, choice, intent, message, and resume data in place.
