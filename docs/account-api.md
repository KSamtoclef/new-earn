# Account bootstrap and application-state contract

Module 2 adds the authenticated account boundary without changing the existing
ChatEarn interface. The live black-and-green registration, login, dashboard,
chat list, and chat screens remain the visual contract.

## Registration ownership

Supabase Auth remains the identity source of truth. After Auth creates a user,
the database trigger creates only:

- one `chatearn_user_profiles` row;
- one `chatearn_user_journeys` row in `earning_enabled` state.

The Auth trigger never writes money. This keeps user imports and administrative
Auth creation from accidentally receiving a new-user credit.

## Authenticated bootstrap RPC

The frontend calls this once an authenticated session exists:

```js
const { data, error } = await supabase.rpc('chatearn_bootstrap_account', {
  p_full_name: fullName
});
```

If email confirmation is enabled and registration returns no session, the call
waits until the first confirmed login. The RPC:

1. verifies `auth.uid()`;
2. normalizes the display name from trusted Auth data and the supplied name;
3. ensures the profile and journey exist;
4. returns an existing signup credit or creates exactly one canonical credit;
5. returns the server-calculated wallet balance.

Repeated calls are safe. The database uses both a user-scoped idempotency key
and the immutable ledger's uniqueness constraints. The browser never adds the
signup amount to a local balance.

If a frozen legacy profile exists but its wallet has not been backfilled yet,
the RPC refuses to create money. After the guarded backfill imports the original
signup entry, bootstrap returns that entry instead of creating another one.

## Initial application state

After bootstrap, and on later authenticated page loads, the frontend calls:

```js
const { data, error } = await supabase.rpc('chatearn_get_app_state');
```

The response contains the minimum state required to resume the existing UI:

- canonical profile and admin flag;
- server-calculated wallet balance and the latest 50 wallet entries;
- current journey and active withdrawal journey;
- up to 50 conversation resume states;
- the current inline sponsored opportunity;
- active sponsored slots and public settings;
- server time.

This is a single startup snapshot, not a polling endpoint. Feature-specific RPCs
in later modules will update chat, rewards, withdrawals, sharing, and KYC.

## Security boundary

- Only `authenticated` may execute the two public RPCs.
- `anon` cannot bootstrap accounts or read application state.
- Direct profile mutations are denied; clients have owner-scoped read access
  only.
- Private profile and wallet functions are not executable by browser roles.
- Only the public anon key belongs in frontend code.
- Wallet totals are derived from the canonical signed ledger on the server.

## Existing-user compatibility

The migration creates profile and journey rows for Auth users already present,
but it does not issue them money. During a controlled legacy snapshot import,
the guarded Module 1 backfill is wrapped so legacy profile fields are copied
before wallet and journey reconciliation. Untouched default journey rows created
during Auth import are replaced inside the same transaction so the legacy
withdrawal, sharing, KYC, and processing states are classified correctly. A
legacy `signup_bonus` ledger entry is recognized as the user's one signup credit,
preventing a duplicate.

Run the legacy backfill only during the documented write-frozen migration. It is
not part of normal registration or login.

## Rollback behavior

The rollback removes the Auth trigger and public Module 2 RPCs and restores the
Module 1 legacy-backfill entry point. It retains canonical profiles and immutable
ledger entries so rollback never deletes user identity or financial history.
