-- ChatEarn legacy compatibility layer
-- This migration only installs the controlled backfill function.
-- It does not copy data until an operator explicitly calls the function.

begin;

create or replace function chatearn_private.backfill_legacy_snapshot(
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, chatearn_private
as $$
declare
  v_already_completed boolean := false;
  v_profiles bigint := 0;
  v_wallet_credits bigint := 0;
  v_wallet_debits bigint := 0;
  v_journeys bigint := 0;
  v_withdrawal_journeys bigint := 0;
  v_conversations bigint := 0;
  v_kyc bigint := 0;
  v_opportunities bigint := 0;
  v_balance_mismatches bigint := 0;
  v_balance_difference numeric := 0;
  v_result jsonb;
begin
  if p_confirmation is distinct from 'BACKFILL_LEGACY_CHATEARN' then
    raise exception 'legacy backfill confirmation is required'
      using errcode = '22023',
            hint = 'Pass BACKFILL_LEGACY_CHATEARN only during a controlled, write-frozen snapshot import.';
  end if;

  select coalesce((value ->> 'completed')::boolean, false)
  into v_already_completed
  from public.chatearn_settings
  where setting_key = 'legacy_backfill_state';

  if v_already_completed then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_completed',
      'message', 'The legacy snapshot was already backfilled and verified.'
    );
  end if;

  if to_regclass('public.chatearn_profiles') is null
     or to_regclass('public.chatearn_reward_ledger') is null
     or to_regclass('public.chatearn_withdrawals') is null
     or to_regclass('public.chatearn_kyc') is null
     or to_regclass('public.chatearn_chat_threads') is null
     or to_regclass('public.chatearn_chat_messages') is null
     or to_regclass('public.chatearn_v3_share_events') is null
     or to_regclass('public.chatearn_events') is null then
    raise exception 'required legacy ChatEarn tables are not present'
      using errcode = '42P01',
            hint = 'Import the frozen legacy snapshot into staging before calling this function.';
  end if;

  -- One backfill at a time. The source application must also be in maintenance mode.
  perform pg_advisory_xact_lock(43117, 20260717);

  execute 'select count(*) from public.chatearn_profiles'
    into v_profiles;

  execute $sql$
    insert into public.chatearn_admin_roles (user_id, role, granted_at)
    select p.user_id, 'admin', coalesce(p.registered_at, now())
    from public.chatearn_profiles p
    join auth.users u on u.id = p.user_id
    where p.is_admin = true
    on conflict (user_id) do nothing
  $sql$;

  execute $sql$
    insert into public.chatearn_wallet_ledger (
      user_id,
      direction,
      amount,
      entry_type,
      idempotency_key,
      source_table,
      source_id,
      balance_after,
      metadata,
      created_at
    )
    select
      r.user_id,
      'credit',
      r.amount,
      r.reward_type,
      'legacy_reward:' || r.id::text,
      'chatearn_reward_ledger',
      r.id::text,
      null,
      coalesce(r.metadata, '{}'::jsonb) || jsonb_build_object(
        'legacy_unique_key', r.unique_key,
        'legacy_partner_key', r.partner_key,
        'imported_from', 'chat-earn.xyz'
      ),
      r.created_at
    from public.chatearn_reward_ledger r
    join auth.users u on u.id = r.user_id
    where r.amount > 0
    on conflict (user_id, idempotency_key) do nothing
  $sql$;
  get diagnostics v_wallet_credits = row_count;

  execute $sql$
    insert into public.chatearn_wallet_ledger (
      user_id,
      direction,
      amount,
      entry_type,
      idempotency_key,
      source_table,
      source_id,
      balance_after,
      metadata,
      created_at
    )
    select
      w.user_id,
      'debit',
      w.amount,
      'withdrawal',
      'legacy_withdrawal:' || w.id::text,
      'chatearn_withdrawals',
      w.id::text,
      null,
      jsonb_build_object(
        'legacy_status', w.status,
        'legacy_requested_at', w.requested_at,
        'legacy_reviewed_at', w.reviewed_at,
        'imported_from', 'chat-earn.xyz'
      ),
      coalesce(w.reviewed_at, w.requested_at)
    from public.chatearn_withdrawals w
    join auth.users u on u.id = w.user_id
    where w.status = 'approved'
      and w.amount > 0
    on conflict (user_id, idempotency_key) do nothing
  $sql$;
  get diagnostics v_wallet_debits = row_count;

  execute $sql$
    with wallet_totals as (
      select user_id, coalesce(sum(signed_amount), 0)::numeric as ledger_balance
      from public.chatearn_wallet_ledger
      group by user_id
    ), compared as (
      select
        p.user_id,
        p.balance::numeric as profile_balance,
        coalesce(w.ledger_balance, 0) as ledger_balance
      from public.chatearn_profiles p
      join auth.users u on u.id = p.user_id
      left join wallet_totals w on w.user_id = p.user_id
    )
    select
      count(*) filter (where profile_balance <> ledger_balance),
      coalesce(sum(abs(profile_balance - ledger_balance))
        filter (where profile_balance <> ledger_balance), 0)
    from compared
  $sql$
  into v_balance_mismatches, v_balance_difference;

  if v_balance_mismatches <> 0 then
    raise exception 'wallet reconciliation failed for % users', v_balance_mismatches
      using errcode = '23514',
            detail = format('Combined absolute difference: NGN %s', v_balance_difference),
            hint = 'Keep the legacy source read-only, refresh the snapshot, and rerun. Do not create balancing credits automatically.';
  end if;

  execute $sql$
    with ranked_withdrawals as (
      select
        w.*,
        row_number() over (
          partition by w.user_id
          order by w.requested_at desc, w.id desc
        ) as row_number
      from public.chatearn_withdrawals w
    ), latest_withdrawal as (
      select * from ranked_withdrawals where row_number = 1
    ), ranked_kyc as (
      select
        k.*,
        row_number() over (
          partition by k.user_id
          order by k.created_at desc, k.id desc
        ) as row_number
      from public.chatearn_kyc k
    ), latest_kyc as (
      select * from ranked_kyc where row_number = 1
    ), processing as (
      select user_id, max(created_at) as reached_at
      from public.chatearn_events
      where event_name = 'processing_reached'
        and user_id is not null
      group by user_id
    ), sharing as (
      select user_id, max(created_at) as completed_at
      from public.chatearn_v3_share_events
      where event_type = 'completed'
        and user_id is not null
      group by user_id
    ), source as (
      select
        w.*,
        k.id as kyc_id,
        k.status as kyc_status,
        k.reviewed_at as kyc_reviewed_at,
        pr.reached_at as processing_reached_at,
        sh.completed_at as sharing_completed_at
      from latest_withdrawal w
      left join latest_kyc k on k.user_id = w.user_id
      left join processing pr on pr.user_id = w.user_id
      left join sharing sh on sh.user_id = w.user_id
    ), classified as (
      select
        source.*,
        case
          when status = 'approved' then 'approved'
          when status = 'rejected' then 'correction_required'
          when processing_reached_at is not null or kyc_status = 'approved' then 'processing'
          when kyc_status = 'pending' then 'kyc_pending'
          when sharing_completed_at is not null then 'kyc_required'
          else 'sharing_required'
        end as mapped_state
      from source
    )
    insert into public.chatearn_withdrawal_journeys (
      user_id,
      external_withdrawal_id,
      journey_state,
      requested_amount,
      share_required_count,
      share_completed_count,
      earning_access_restored_at,
      processing_reached_at,
      completed_at,
      metadata,
      created_at,
      updated_at
    )
    select
      c.user_id,
      c.id,
      c.mapped_state,
      c.amount,
      5,
      case when c.sharing_completed_at is null then 0 else 5 end,
      case
        when c.mapped_state in ('processing', 'approved')
          then coalesce(c.processing_reached_at, c.kyc_reviewed_at, c.reviewed_at, c.requested_at)
        else null
      end,
      case
        when c.mapped_state = 'processing'
          then coalesce(c.processing_reached_at, c.kyc_reviewed_at)
        else null
      end,
      case when c.mapped_state = 'approved' then coalesce(c.reviewed_at, c.requested_at) else null end,
      jsonb_build_object(
        'legacy_status', c.status,
        'legacy_session_id', c.session_id,
        'legacy_kyc_id', c.kyc_id,
        'imported_from', 'chat-earn.xyz'
      ),
      c.requested_at,
      coalesce(c.reviewed_at, c.requested_at)
    from classified c
    join auth.users u on u.id = c.user_id
    where c.amount > 0
    on conflict (external_withdrawal_id) do update set
      journey_state = excluded.journey_state,
      share_completed_count = excluded.share_completed_count,
      earning_access_restored_at = excluded.earning_access_restored_at,
      processing_reached_at = excluded.processing_reached_at,
      completed_at = excluded.completed_at,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  $sql$;
  get diagnostics v_withdrawal_journeys = row_count;

  execute $sql$
    with ranked_withdrawals as (
      select
        w.*,
        row_number() over (
          partition by w.user_id
          order by w.requested_at desc, w.id desc
        ) as row_number
      from public.chatearn_withdrawals w
    ), latest_withdrawal as (
      select * from ranked_withdrawals where row_number = 1
    ), ranked_kyc as (
      select
        k.*,
        row_number() over (
          partition by k.user_id
          order by k.created_at desc, k.id desc
        ) as row_number
      from public.chatearn_kyc k
    ), latest_kyc as (
      select * from ranked_kyc where row_number = 1
    ), processing as (
      select user_id, max(created_at) as reached_at
      from public.chatearn_events
      where event_name = 'processing_reached'
        and user_id is not null
      group by user_id
    ), sharing as (
      select user_id, max(created_at) as completed_at
      from public.chatearn_v3_share_events
      where event_type = 'completed'
        and user_id is not null
      group by user_id
    ), minimum as (
      select coalesce((
        select (value #>> '{}')::bigint
        from public.chatearn_settings
        where setting_key = 'first_withdrawal_minimum'
      ), 40000) as amount
    ), resolved as (
      select
        p.*,
        w.id as withdrawal_id,
        w.status as withdrawal_status,
        k.id as kyc_id,
        k.status as kyc_status,
        pr.reached_at as processing_reached_at,
        sh.completed_at as sharing_completed_at,
        minimum.amount as minimum_amount
      from public.chatearn_profiles p
      join auth.users u on u.id = p.user_id
      cross join minimum
      left join latest_withdrawal w on w.user_id = p.user_id
      left join latest_kyc k on k.user_id = p.user_id
      left join processing pr on pr.user_id = p.user_id
      left join sharing sh on sh.user_id = p.user_id
    ), classified as (
      select
        r.*,
        case
          when coalesce(r.status, 'active') <> 'active' then 'suspended'
          when r.kyc_id is not null and r.withdrawal_id is null then 'correction_required'
          when r.withdrawal_status = 'approved' then 'completed'
          when r.withdrawal_status = 'rejected' then 'correction_required'
          when r.processing_reached_at is not null or r.kyc_status = 'approved' then 'processing'
          when r.kyc_status = 'pending' then 'kyc_pending'
          when r.sharing_completed_at is not null then 'kyc_required'
          when r.withdrawal_id is not null then 'sharing_required'
          when r.balance >= r.minimum_amount then 'withdrawal_required'
          else 'earning_enabled'
        end as mapped_state
      from resolved r
    )
    insert into public.chatearn_user_journeys (
      user_id,
      journey_state,
      first_withdrawal_gate_passed,
      earnings_paused,
      sponsored_rewards_paused,
      active_withdrawal_id,
      active_partner_key,
      processing_reached_at,
      created_at,
      updated_at
    )
    select
      c.user_id,
      c.mapped_state,
      c.mapped_state in ('processing', 'completed'),
      c.mapped_state in (
        'withdrawal_required', 'sharing_required', 'kyc_required',
        'kyc_pending', 'correction_required', 'suspended'
      ),
      c.mapped_state in (
        'withdrawal_required', 'sharing_required', 'kyc_required',
        'kyc_pending', 'correction_required', 'suspended'
      ),
      c.withdrawal_id,
      c.last_partner,
      c.processing_reached_at,
      c.registered_at,
      coalesce(c.updated_at, c.registered_at)
    from classified c
    on conflict (user_id) do nothing
  $sql$;
  get diagnostics v_journeys = row_count;

  execute $sql$
    with message_counts as (
      select
        m.user_id,
        m.partner_key,
        count(*) filter (where m.sender = 'user')::integer as eligible_user_message_count,
        count(*)::integer as total_message_count,
        (array_agg(m.id order by m.created_at desc, m.id desc)
          filter (where m.sender = 'partner'))[1] as latest_partner_message_id,
        (array_agg(m.id order by m.created_at desc, m.id desc)
          filter (where m.sender = 'user'))[1] as latest_user_message_id,
        max(m.created_at) as latest_message_at
      from public.chatearn_chat_messages m
      group by m.user_id, m.partner_key
    )
    insert into public.chatearn_conversation_states (
      user_id,
      partner_key,
      current_node_key,
      latest_partner_message_id,
      latest_user_message_id,
      eligible_user_message_count,
      total_message_count,
      suggested_replies,
      conversation_context,
      last_message_at,
      created_at,
      updated_at
    )
    select
      t.user_id,
      t.partner_key,
      'legacy_resume',
      mc.latest_partner_message_id,
      mc.latest_user_message_id,
      coalesce(mc.eligible_user_message_count, 0),
      greatest(coalesce(mc.total_message_count, 0), t.message_count),
      '[]'::jsonb,
      jsonb_build_object(
        'legacy_thread', true,
        'last_message_preview', t.last_message_preview,
        'legacy_unread_count', t.unread_count
      ),
      coalesce(mc.latest_message_at, t.last_message_at),
      t.opened_at,
      coalesce(mc.latest_message_at, t.last_message_at, t.opened_at)
    from public.chatearn_chat_threads t
    join auth.users u on u.id = t.user_id
    left join message_counts mc
      on mc.user_id = t.user_id and mc.partner_key = t.partner_key
    on conflict (user_id, partner_key) do update set
      latest_partner_message_id = coalesce(
        excluded.latest_partner_message_id,
        public.chatearn_conversation_states.latest_partner_message_id
      ),
      latest_user_message_id = coalesce(
        excluded.latest_user_message_id,
        public.chatearn_conversation_states.latest_user_message_id
      ),
      eligible_user_message_count = greatest(
        excluded.eligible_user_message_count,
        public.chatearn_conversation_states.eligible_user_message_count
      ),
      total_message_count = greatest(
        excluded.total_message_count,
        public.chatearn_conversation_states.total_message_count
      ),
      conversation_context = excluded.conversation_context,
      last_message_at = greatest(
        excluded.last_message_at,
        public.chatearn_conversation_states.last_message_at
      ),
      updated_at = excluded.updated_at
  $sql$;
  get diagnostics v_conversations = row_count;

  execute $sql$
    insert into public.chatearn_kyc_submissions (
      user_id,
      withdrawal_journey_id,
      external_kyc_id,
      full_name,
      phone,
      identification_type,
      identification_number_last4,
      status,
      submitted_at,
      reviewed_at,
      reviewed_by,
      review_note,
      created_at,
      updated_at
    )
    select
      k.user_id,
      wj.id,
      k.id,
      coalesce(nullif(trim(p.full_name), ''), 'User'),
      null,
      'legacy_external',
      null,
      case
        when k.status = 'approved' then 'approved'
        when k.status = 'pending' then 'submitted'
        when k.status = 'rejected' then 'rejected'
        else 'resubmit'
      end,
      k.created_at,
      k.reviewed_at,
      k.reviewed_by,
      k.review_note,
      k.created_at,
      coalesce(k.reviewed_at, k.created_at)
    from public.chatearn_kyc k
    join auth.users u on u.id = k.user_id
    left join public.chatearn_profiles p on p.user_id = k.user_id
    left join public.chatearn_withdrawal_journeys wj
      on wj.external_withdrawal_id = k.withdrawal_id
    on conflict (external_kyc_id) do nothing
  $sql$;
  get diagnostics v_kyc = row_count;

  if to_regclass('public.chatearn_v62_reward_opportunities') is not null then
    execute $sql$
      insert into public.chatearn_sponsored_opportunities (
        id,
        user_id,
        cycle_number,
        slot_number,
        partner_key,
        reward_amount,
        offer_key,
        status,
        presented_at,
        opened_at,
        returned_at,
        verified_at,
        credited_at,
        credit_ledger_id,
        verification_data,
        created_at,
        updated_at
      )
      select
        o.id,
        o.user_id,
        1,
        o.slot_number,
        o.partner_key,
        o.reward_amount,
        o.offer_key,
        case
          when o.status = 'shown' then 'presented'
          when o.status = 'opened' then 'opened'
          when o.status = 'credited' then 'credited'
          when o.status = 'expired' then 'expired'
          else 'rejected'
        end,
        o.shown_at,
        o.opened_at,
        case when o.status = 'credited' then o.credited_at else null end,
        case when o.status = 'credited' then o.credited_at else null end,
        o.credited_at,
        (
          select wl.id
          from public.chatearn_wallet_ledger wl
          where wl.user_id = o.user_id
            and wl.metadata ->> 'opportunity_id' = o.id::text
          order by wl.created_at desc
          limit 1
        ),
        coalesce(o.metadata, '{}'::jsonb) || jsonb_build_object(
          'legacy_session_id', o.session_id,
          'legacy_seconds_away', o.seconds_away,
          'legacy_offer_url', o.offer_url,
          'imported_from', 'chat-earn.xyz'
        ),
        o.shown_at,
        coalesce(o.credited_at, o.opened_at, o.shown_at)
      from public.chatearn_v62_reward_opportunities o
      join auth.users u on u.id = o.user_id
      where o.reward_amount > 0
      on conflict do nothing
    $sql$;
    get diagnostics v_opportunities = row_count;
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'status', 'completed',
    'completed_at', now(),
    'source_profiles', v_profiles,
    'wallet_credits_inserted', v_wallet_credits,
    'wallet_debits_inserted', v_wallet_debits,
    'wallet_reconciliation_mismatches', v_balance_mismatches,
    'wallet_reconciliation_difference', v_balance_difference,
    'user_journeys_written', v_journeys,
    'withdrawal_journeys_written', v_withdrawal_journeys,
    'conversation_states_written', v_conversations,
    'kyc_records_written', v_kyc,
    'sponsored_opportunities_written', v_opportunities
  );

  insert into public.chatearn_settings (
    setting_key, value, description, is_public, updated_at
  ) values (
    'legacy_backfill_state',
    jsonb_build_object(
      'completed', true,
      'completed_at', now(),
      'result', v_result
    ),
    'Controlled compatibility backfill status.',
    false,
    now()
  )
  on conflict (setting_key) do update set
    value = excluded.value,
    description = excluded.description,
    is_public = false,
    updated_at = now();

  insert into public.chatearn_audit_log (
    actor_id, action, target_type, target_id, details
  ) values (
    auth.uid(),
    'legacy_snapshot_backfilled',
    'migration',
    'chat-earn.xyz',
    v_result
  );

  return v_result;
end;
$$;

revoke all on function chatearn_private.backfill_legacy_snapshot(text)
from public, anon, authenticated;
grant execute on function chatearn_private.backfill_legacy_snapshot(text)
to service_role;

commit;
