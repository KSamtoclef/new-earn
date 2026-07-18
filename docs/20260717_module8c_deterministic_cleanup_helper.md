# Module 8C deterministic index cleanup helper

A guarded local helper now exists at:

`node scripts/module8c-rewrite-index.mjs`

The helper performs only these two transformations in `index.html`:

1. Removes the obsolete `chatearn-v6-2-rewards.css` compatibility reference.
2. Replaces `chatearn-v6-2-3-final.js` with the canonical `chatearn-module7-admin.js` reference.

Safety behavior:

- Requires each historical reference to occur exactly once.
- Refuses to run if the canonical coordinator is already referenced.
- Refuses to write if any historical reference remains afterward.
- Requires exactly one canonical coordinator reference after transformation.
- Does not modify application markup, wallet logic, authentication, chat, withdrawals, KYC, sharing, WebPushr, or admin markup.

After the transformed `index.html` is committed and verified, the following compatibility files can be removed:

- `assets/js/chatearn-v6-2-3-final.js`
- `assets/css/chatearn-v6-2-rewards.css`

No GitHub Actions or alternate verification workflow was introduced.
