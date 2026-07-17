# ChatEarn data compatibility and migration

## Safety rule

The live database remains authoritative until cutover. Module 1 creates new, prefixed canonical tables and never renames, truncates, drops, or updates a legacy table.

The installed compatibility function does nothing by itself. It runs only when an operator calls:

```sql
select chatearn_private.backfill_legacy_snapshot('BACKFILL_LEGACY_CHATEARN');
```

That call is reserved for a complete staging snapshot taken during a controlled source write freeze. It must not be called against a moving production dataset.

## Audit baseline

The July 17, 2026 audit observed:

| Area | Count / amount |
|---|---:|
| Auth users and current profiles | 1,203 / 1,203 |
| Persisted chat threads | 2,261 |
| User messages | 25,534 |
| Partner messages | 27,748 |
| Legacy reward-ledger rows | 28,351 |
| Legacy reward-ledger credits | ₦348,182,200 |
| Displayed profile balances | ₦269,715,000 |
| Approved current withdrawals | ₦78,467,200 |
| Wallet reconciliation mismatches | 0 |
| Current withdrawals | 78 approved, 908 pending, 3 rejected |
| KYC | 163 approved, 861 pending |
| Legacy withdrawal archive | 26,079 rows |
| Analytics events | 224,233 |

These are audit observations, not cutover constants. The live project changed while it was being inspected, so final counts must come from one frozen snapshot.

## Mapping

| Existing source | Canonical destination | Compatibility rule |
|---|---|---|
| `auth.users` | `auth.users` | Preserve UUIDs and validate identities before application data |
| `chatearn_profiles.balance` | Derived wallet balance | Never imported as a free-standing credit; used only for reconciliation |
| `chatearn_reward_ledger` | `chatearn_wallet_ledger` credits | Preserve amount, type, time, partner metadata, and source ID |
| Approved `chatearn_withdrawals` | `chatearn_wallet_ledger` debits | One debit per approved current withdrawal |
| Latest current withdrawal per user | `chatearn_withdrawal_journeys` | Preserve external ID, amount, timestamps, and mapped journey state |
| `chatearn_kyc` | `chatearn_kyc_submissions` | Preserve all records and review state; mark external-provider records explicitly |
| `chatearn_chat_threads` and messages | `chatearn_conversation_states` | Preserve partner, counts, last message IDs, and resume marker |
| `chatearn_v62_reward_opportunities` | `chatearn_sponsored_opportunities` | Preserve only unique, valid rows; never create a second credit |
| `chatearn_profiles.is_admin` | `chatearn_admin_roles` | Preserve authenticated administrators only |
| `chatearn_v3_share_events` and processing events | Journey state | Use server records to map sharing, KYC, processing, and restored access |

The large `chatearn_withdrawals_legacy` archive remains an immutable archive. It is not debited from current wallets because the audited wallet equation uses current approved withdrawals only.

## Journey mapping

Mapping priority is deterministic:

1. Non-active profile → `suspended`.
2. KYC without a withdrawal → `correction_required`.
3. Approved withdrawal → `completed`.
4. Rejected withdrawal → `correction_required`.
5. Processing event or approved KYC → `processing`, earning restored.
6. Pending KYC → `kyc_pending`.
7. Completed sharing → `kyc_required`.
8. Pending withdrawal → `sharing_required`.
9. Balance at or above the configured minimum → `withdrawal_required`.
10. Otherwise → `earning_enabled`.

Ambiguous records are never silently credited. They stay paused in `correction_required` for an admin to review.

## Controlled migration procedure

1. Apply both Module 1 migrations to the new staging project.
2. Run the verification file. Before importing data, the legacy compatibility check may report “not applicable”; every other blocking check must pass.
3. Take tested backups of the live database and Auth data.
4. Enter a short maintenance window that stops registration, chat credits, sponsored credits, withdrawals, sharing writes, and KYC writes.
5. Export one consistent snapshot, including Auth identities and the listed ChatEarn tables.
6. Restore that snapshot into staging while preserving every Auth user UUID.
7. Call the guarded backfill function once.
8. Run the verification file again. Wallet mismatches, missing journeys, duplicate idempotency keys, duplicate sponsored slots, and public KYC storage must all be zero/false as expected.
9. Compare representative existing users in each state: earning, threshold, sharing, KYC, processing, approved, rejected, and returning conversation.
10. Run application flow and concurrency tests against staging.
11. Point a preview deployment at staging and perform mobile visual regression against `chat-earn.xyz`.
12. Cut over only after sign-off. Keep the previous deployment and database read-only for the rollback window.

## Reconciliation invariant

For every user:

```text
canonical wallet balance
= all imported legacy credits
- all approved current-withdrawal debits
```

This result must equal the current profile balance at the frozen snapshot. The backfill raises an exception and rolls itself back if even one user differs. It never invents a balancing credit.

## Existing anomalies retained for review

- 249 pending withdrawals had an amount different from the later displayed balance. The stored request amount remains fixed; it is not automatically increased.
- 26 users had multiple current withdrawal rows. Only the newest row drives the active journey; all source rows remain available for audit.
- 163 users had multiple KYC records. All are retained; the latest drives the state mapping.
- 2 KYC records were not linked to a withdrawal and map to correction review.
- 11 sharing events could not be tied directly to an authenticated user and cannot unlock a journey automatically.
- 11 unrestricted policies existed on unrelated legacy tables. They are not copied into the canonical security model.

## Rollback

The safe rollback disables canonical client access and leaves all copied data intact. Because Module 1 is additive, the original frontend continues using its existing tables. Permanent table deletion is intentionally not automated.
