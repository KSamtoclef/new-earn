# Existing source disposition audit

This audit covers the 25 files at live-source commit `4f48987`. Module 1 does not delete or rewrite any of them. The disposition below controls later modules.

| Existing file | Disposition | Reason / destination |
|---|---|---|
| `index.html` | Preserve structure; rewrite integrations carefully | Exact live visual and journey reference. Duplicate versioned includes will be replaced only after parity tests. |
| `assets/css/chatearn.css` | Preserve | Baseline brand, layout, colors, and mobile identity. It becomes the visual source of truth. |
| `assets/css/chatearn-v3.css` | Merge then remove | Versioned overrides conflict with the final no-version stylesheet rule. |
| `assets/css/chatearn-v4-2.css` | Merge verified live rules then remove | Keep only rules required for visual parity. |
| `assets/css/chatearn-v4-returning.css` | Merge then remove | Returning-user styling moves into the screen/component stylesheet without changing appearance. |
| `assets/css/chatearn-v5-admin-final.css` | Merge then remove | Duplicate admin cascade. |
| `assets/css/chatearn-v5-admin.css` | Merge then remove | Duplicate admin cascade. |
| `assets/css/chatearn-v6-2-rewards.css` | Rewrite then remove | Floating/versioned reward UI is replaced by large inline chat cards. |
| `assets/css/chatearn-v6-admin.css` | Merge then remove | Final admin styling will have one owner. |
| `assets/js/chatearn-app.js` | Rewrite into modules | Preserve working UX behavior, remove global state and duplicate listeners. |
| `assets/js/chatearn-v3.js` | Retire after behavior mapping | Competing flow/reward implementation. |
| `assets/js/chatearn-v4-2.js` | Retire after behavior mapping | Competing flow and server-call ownership. |
| `assets/js/chatearn-v4-admin.js` | Rewrite into admin modules | Preserve concepts; add lazy tab loading and pagination. |
| `assets/js/chatearn-v4-returning.js` | Rewrite into journey/state module | Returning state becomes server-owned and survives devices. |
| `assets/js/chatearn-v5-admin.js` | Retire after admin parity | Duplicate admin implementation. |
| `assets/js/chatearn-v6-2-1-hotfix.js` | Remove | Hotfix layer and duplicate listener/reward risk. |
| `assets/js/chatearn-v6-2-3-final.js` | Remove | Conflicting “final” reward layer. |
| `assets/js/chatearn-v6-2-5-final.js` | Remove | Conflicting reward and event layer. |
| `assets/js/chatearn-v6-2-rewards.js` | Replace | One server reward engine and inline-card controller take ownership. |
| `assets/js/chatearn-v6-admin.js` | Rewrite into admin modules | Preserve current capabilities without monolithic startup queries. |
| `assets/js/chatearn-webpushr.js` | Isolate and review | Keep only if notifications remain approved and consent/security checks pass. |
| `assets/js/clarity.js` | Isolate and review | Analytics may remain only with one loader and documented consent behavior. |
| `assets/js/push-legacy.js` | Remove | Obsolete competing push path. |
| `database/chatearn_v4.sql` | Archive; never rerun | Historical schema only. Canonical migrations are in `supabase/migrations`. |
| `webpushr-sw.js` | Preserve until notification review | Existing service worker behavior must not be broken during chat/reward cleanup. |

## Planned clean runtime layout

The final runtime has non-versioned owners:

```text
index.html
admin.html
assets/
  css/
    app.css
    admin.css
  js/
    app.js
    core/
    features/
    services/
supabase/
  migrations/
  rollback/
  verification/
docs/
```

Files are removed only after their required live behavior is mapped to a named module and automated parity tests pass. No old script is deleted merely because its filename looks obsolete.

## Data compatibility commitment

- Existing Auth UUIDs remain unchanged.
- Current balances are accepted only when they reconcile to credits minus approved withdrawals.
- Chat messages and thread resume state are preserved.
- Withdrawal, sharing, KYC, processing, and admin history remain queryable.
- Existing ambiguous records are routed to explicit correction review; they are not discarded or silently fixed.
- Legacy tables remain read-only during the rollback window.
