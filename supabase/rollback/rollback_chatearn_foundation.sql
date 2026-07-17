-- ChatEarn Module 1 safe rollback
-- This intentionally preserves every table and every copied user/financial record.
-- The legacy frontend ignores these additive objects, so disabling access is enough.

begin;

update public.chatearn_settings
set value = '"legacy"'::jsonb,
    updated_at = now()
where setting_key = 'platform_mode';

revoke execute on function public.chatearn_get_public_settings()
from anon, authenticated;
revoke execute on function public.chatearn_get_my_foundation_state()
from authenticated;
revoke execute on function public.chatearn_current_user_is_admin()
from authenticated;

revoke select on public.chatearn_settings from anon, authenticated;
revoke select on
  public.chatearn_admin_roles,
  public.chatearn_wallet_ledger,
  public.chatearn_user_journeys,
  public.chatearn_withdrawal_journeys,
  public.chatearn_conversation_states,
  public.chatearn_sponsored_slots,
  public.chatearn_sponsored_opportunities,
  public.chatearn_kyc_submissions,
  public.chatearn_kyc_documents,
  public.chatearn_audit_log
from authenticated;

drop policy if exists chatearn_kyc_storage_owner_read on storage.objects;
drop policy if exists chatearn_kyc_storage_owner_upload on storage.objects;

-- The private bucket remains private and its objects remain intact.
update storage.buckets
set public = false
where id = 'chatearn-kyc';

insert into public.chatearn_audit_log (
  actor_id, action, target_type, target_id, details
) values (
  auth.uid(),
  'foundation_access_disabled',
  'deployment',
  'module_1',
  jsonb_build_object(
    'rollback_type', 'non_destructive',
    'data_preserved', true,
    'disabled_at', now()
  )
);

commit;

-- Re-running the foundation migration restores grants and bucket policies.
-- Permanent deletion is deliberately excluded from this rollback file.
