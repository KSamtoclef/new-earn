# ChatEarn Module 6 Frontend Conflict Audit

Date: 2026-07-17
Branch: `module-4-reward-engine`

## Scope

This audit covers the public withdrawal journey after Modules 5A–5C and the Module 6 frontend integration.

Reviewed active frontend assets:

- `index.html`
- `assets/js/chatearn-app.js`
- `assets/js/chatearn-v4-returning.js`
- `assets/js/chatearn-v6-2-3-final.js`

## Canonical withdrawal boundary

The browser withdrawal controller now uses only:

- `chatearn_get_withdrawal_portal_v5`
- `chatearn_get_payout_accounts_v5`
- `chatearn_submit_withdrawal_v5`

The controller does not accept raw bank account numbers or account names. It submits a verified payout account ID, the server-provided available amount and an idempotency key.

## Blocking conflict checks

| Check | Result | Notes |
|---|---|---|
| Raw account-number field active | PASS | Removed from the live DOM by the canonical controller. |
| Raw account-name field active | PASS | Removed from the live DOM by the canonical controller. |
| Fake bank verification active | PASS | Legacy handler is neutralized. |
| Legacy withdrawal submit controls form | PASS | Inline handler is removed and replaced with one canonical listener. |
| Duplicate submit possible from repeated taps | PASS | In-memory submission lock plus server idempotency key. |
| Multiple active withdrawals allowed by UI | PASS | Active withdrawal disables submission. Backend remains authoritative. |
| Full account number displayed | PASS | Only masked verified account data is rendered. |
| Legacy V6.2.3 reward client active | PASS | File itself is a disabled compatibility stub and its active document node is retired. |
| Withdrawal portal load rejection leaks | PASS | Navigation uses a safe loader that absorbs handled RPC failures. |
| Duplicate canonical event listener possible | PASS | Listener installation is guarded by `data-canonical-listener`. |
| Controller works if loaded after DOM ready | PASS | Initialization handles both loading and already-ready documents. |

## Preserved journeys

No intentional changes were made to:

- registration and login
- chat partner selection
- guided chat and quick replies
- canonical reward posting
- earnings page navigation
- share journey
- KYC journey
- processing page
- admin shell
- offer routing

## Known cleanup debt

The physical `index.html` source still references the disabled V6.2.3 reward script and stylesheet, and the old withdrawal markup still exists in source. Module 6E removes or rebuilds those elements at runtime before the user interacts with withdrawal.

This is safe as a compatibility phase because:

1. `chatearn-v6-2-3-final.js` is an intentionally disabled stub.
2. The canonical controller replaces all withdrawal interaction boundaries.
3. Backend RPC privilege and mutation boundaries were verified in Modules 5A–5C.

A later asset-consolidation module should physically remove those source references and rename `chatearn-v4-returning.js` to a withdrawal-specific production filename. That cleanup should be performed only with a complete, reviewable `index.html` replacement to avoid damaging unrelated journeys.

## Runtime diagnostic

In the deployed browser console, the canonical controller exposes:

```js
ChatEarnWithdrawalV5.diagnostic()
```

Expected top-level result:

```js
{
  version: '6E.1',
  passed: true,
  checks: {
    controllerInitialized: true,
    canonicalMarkupReady: true,
    canonicalPortalRpcConfigured: true,
    canonicalAccountsRpcConfigured: true,
    canonicalSubmitRpcConfigured: true,
    legacyRawAccountInputsAbsent: true,
    legacyRewardScriptInactive: true,
    legacyRewardStylesheetInactive: true,
    legacyInlineSubmitAbsent: true,
    duplicateSubmissionGuardPresent: true,
    idempotencyKeyPresent: true
  }
}
```

`selectedAccountMasked` may be false before payout accounts finish loading or when the user has no verified payout account. That condition is not a controller failure.

## Conclusion

Module 6 frontend integration is conflict-hardened and ready to proceed. The canonical database remains authoritative for eligibility, payout accounts, active withdrawal state, amount and submission.