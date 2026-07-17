# ChatEarn architecture

## Product boundary

`chat-earn.xyz` is the product reference. Its black-and-green mobile interface, brand, page hierarchy, authentication screens, chat list, chat screen, wallet, withdrawal, sharing, KYC, processing, and admin concepts are preserved.

The rejected generic deployment is not a design source and is not part of this branch.

Module 1 is database-only and additive. It does not change `index.html`, any live stylesheet, any live script, the current Vercel deployment, or the production Supabase project.

## Required journey

The server-owned journey is:

1. Register and receive one idempotent signup credit.
2. Open a realistic conversation.
3. Send an eligible user message and receive a server-calculated chat credit.
4. Present large sponsored cards inline at configured milestones.
5. Verify sponsored impression, open, return, and completion before one credit.
6. Pause chat and sponsored earnings at the first-withdrawal gate.
7. Complete withdrawal details, sharing, and KYC.
8. Reach processing and immediately restore earning access.
9. Keep the financial withdrawal under admin review without locking the user out of chat.
10. Resume the exact conversation and remaining sponsored cycle.

## Source of truth

| Concern | Canonical source | Client authority |
|---|---|---|
| Wallet balance | Sum of signed rows in `chatearn_wallet_ledger` | Read only |
| Reward amount | Server rule or locked sponsored opportunity | None |
| Duplicate prevention | `(user_id, idempotency_key)` and source uniqueness | Supplies a request id only |
| Withdrawal gate | `chatearn_user_journeys` | Read only |
| Sharing progress | Withdrawal journey records and verified events | Requests an action only |
| KYC state | `chatearn_kyc_submissions` | Uploads and submits only |
| Conversation resume | Messages plus `chatearn_conversation_states` | Renders returned state |
| Sponsored progress | `chatearn_sponsored_opportunities` | Renders inline card and reports events |
| Admin permissions | `chatearn_admin_roles` and server checks | None |

There is one balance engine: the immutable signed wallet ledger. Credits and debits are new rows. Existing rows cannot be edited or deleted. Corrections are compensating entries with their own idempotency keys and audit records.

## Module ownership

| Module | Owns | Does not own |
|---|---|---|
| Authentication | Session, registration bootstrap, logout | Balance calculations |
| Conversation | Intent match, node transition, messages, suggestions | Reward amounts |
| Reward | Eligibility and wallet entry | UI rendering |
| Sponsored | Slot selection, event state, verification | Floating popups |
| Journey | First-withdrawal pause/resume state | Bank review decision |
| Withdrawal | Request and payment status | Chat transcript |
| Sharing | Required progress and verified events | KYC review |
| KYC | Submission, private documents, review | Public file URLs |
| Admin | Paginated operational commands and audit | Bulk startup queries |

## Server transaction pattern

Every financial command follows the same pattern:

1. Authenticate the user.
2. Acquire a per-user transaction lock.
3. Lock and read current journey eligibility.
4. Check the idempotency key again inside the lock.
5. Calculate the amount from server-controlled data.
6. Append one immutable ledger row.
7. Update the related message, opportunity, or withdrawal state in the same transaction.
8. Return the authoritative balance and journey state.

The browser never increments a balance, trusts a displayed amount as a credit amount, or decides that a task has passed verification.

## Journey state contract

| State | Chat rewards | Sponsored rewards | Meaning |
|---|---:|---:|---|
| `earning_enabled` | On | On | Normal chat-first experience |
| `withdrawal_required` | Off | Off | Threshold reached; show the large inline withdrawal card |
| `sharing_required` | Off | Off | Withdrawal details exist; sharing remains |
| `kyc_required` | Off | Off | Sharing finished; KYC must start |
| `kyc_pending` | Off | Off | KYC submitted or awaiting correction |
| `processing` | On | On | Processing page reached; user may return to chat |
| `completed` | On | On | First journey and review are complete |
| `correction_required` | Off | Off | User action is required before processing |
| `suspended` | Off | Off | Administrative account restriction |

Database constraints require pause flags to match this table. Processing deliberately restores earnings even while the payment remains pending.

## Sponsored reward lifecycle

Each opportunity is unique per user, milestone cycle, and slot. Its lifecycle is:

`presented → opened → returned → verified → credited`

`expired` and `rejected` are terminal alternatives. The reward amount is copied from the configured slot when the opportunity is created, then remains fixed. A credited opportunity links to its unique wallet entry.

The default database configuration is:

| Slot | Eligible user message | Reward |
|---:|---:|---:|
| 1 | 3 | ₦20,000 |
| 2 | 7 | ₦22,000 |
| 3 | 12 | ₦25,000 |
| 4 | 18 | ₦27,000 |
| 5 | 25 | ₦30,000 |

## Security boundary

- Only the Supabase project URL and anon key may be shipped to the browser.
- Financial writers remain in the private schema and are not executable by `anon` or `authenticated`.
- Canonical tables use RLS and expose client reads only.
- The KYC bucket is private, limited to approved image/PDF types and 10 MB per object.
- Sensitive identification numbers are encrypted outside the public schema; only the last four characters may appear in the user-readable record.
- Admin checks occur inside security-definer functions and every mutation will create an immutable audit entry.
- Production service-role credentials must live only in protected server/CI secrets.

## Performance contract

- Chat state loads with one bootstrap RPC, followed by paginated message reads.
- Admin tabs load only when opened and use indexed cursor pagination.
- Realtime is limited to state that benefits from it; there is no blanket polling loop.
- Event listeners are registered once by module ownership and removed when a screen unmounts.
- Sponsored verification is event-driven and idempotent; page focus and `pageshow` do not create credits.

## Delivery sequence

1. Additive foundation, compatibility function, rollback, and verification.
2. Server RPCs for registration, chat, wallet, sponsored rewards, and journey transitions.
3. Conversation content and deterministic intent engine.
4. Frontend modularization while holding the UI contract exactly.
5. Withdrawal, sharing, KYC, processing, and admin integration.
6. Automated flow, mobile, security, concurrency, and performance tests.
7. Staging preview, frozen data migration, reconciliation, and controlled cutover.

No production cutover occurs until every blocking verification passes and visual regression confirms parity with `chat-earn.xyz`.
