-- ChatEarn Module 2 safe rollback
-- Disables Module 2 behavior but deliberately retains profile and ledger data.

begin;

drop trigger if exists chatearn_auth_user_created on auth.users;

revoke all on function public.chatearn_bootstrap_account(text)
from public, anon, authenticated;
revoke all on function public.chatearn_get_app_state()
from public, anon, authenticated;
revoke all on table public.chatearn_user_profiles
from public, anon, authenticated;

drop function if exists public.chatearn_bootstrap_account(text);
drop function if exists public.chatearn_get_app_state();

-- Restore Module 1's original guarded legacy backfill entry point.
drop function if exists chatearn_private.backfill_legacy_snapshot(text);
do $$
begin
  if to_regprocedure('chatearn_private.backfill_legacy_snapshot_core(text)') is not null
     and to_regprocedure('chatearn_private.backfill_legacy_snapshot(text)') is null then
    execute 'alter function chatearn_private.backfill_legacy_snapshot_core(text) rename to backfill_legacy_snapshot';
  end if;
end;
$$;

revoke all on function chatearn_private.backfill_legacy_snapshot(text)
from public, anon, authenticated;
grant execute on function chatearn_private.backfill_legacy_snapshot(text)
to service_role;

drop function if exists chatearn_private.backfill_legacy_account_profiles(text);
drop function if exists chatearn_private.ensure_signup_credit(uuid);
drop function if exists chatearn_private.handle_auth_user_created();
drop function if exists chatearn_private.initialize_account_base(
  uuid,
  text,
  text,
  timestamptz,
  jsonb
);
drop function if exists chatearn_private.normalized_display_name(text, text);

-- Financial rows are immutable. Any signup credit created before rollback stays
-- in the ledger and must be corrected only with an explicit compensating entry.
-- Canonical profile rows also remain for audit and a safe forward migration.

commit;
