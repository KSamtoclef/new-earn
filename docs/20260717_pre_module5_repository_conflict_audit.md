# Pre-Module 5 Repository Conflict Audit

Branch: `module-4-reward-engine`

## Immediate blockers found

### 1. Legacy V6.2.3 reward client

File: `assets/js/chatearn-v6-2-3-final.js`

Risk:
- Called deprecated `chatearn_v62_*` RPCs.
- Maintained a second sponsored reward state machine.
- Updated browser-side wallet totals after legacy reward claims.
- Could duplicate or conflict with the canonical Module 4 reward engine.

Action taken: replaced with a disabled compatibility stub.

### 2. Legacy V4.1 returning-user reward and withdrawal client

File: `assets/js/chatearn-v4-returning.js`

Risk:
- Called legacy return-task reward RPCs.
- Updated balances directly in the browser.
- Displayed and modified legacy withdrawal flow state.
- Could interfere with Module 5 withdrawal orchestration.

Action taken: replaced with a disabled compatibility stub.

## Remaining code that must be migrated carefully

### `assets/js/chatearn-app.js`

Still uses legacy application state and tables, including browser variables such as `totalBalance`, `chatEarnings`, and `replyCount`. It also reads legacy profile/chat tables. Do not delete it yet because it currently owns authentication, navigation, chat rendering, and other live UI behavior.

Module 6 must split this file into canonical API clients and UI controllers.

### `assets/js/chatearn-v3.js`

Contains visit tracking, offer routing, return cards, and other UI enhancements. Some behavior overlaps later versions and legacy offer infrastructure. Keep temporarily because it also owns non-reward UX. Remove only after Module 6 maps every still-used feature.

### `assets/js/chatearn-v4-2.js`

Intercepts monetization links and manages legacy unique offers and return tasks. It does not directly perform the same wallet credit as the disabled reward clients, but it overlaps the new sponsored-opportunity architecture. Keep temporarily until the canonical sponsored frontend is connected, then retire its task/reward portions.

### Versioned CSS files

Multiple CSS generations are loaded simultaneously. They are not a backend blocker, but they can cause specificity conflicts and unused payload. Consolidate during Module 6 after the corresponding legacy JavaScript and markup are removed.

## Safe state before Module 5

The two code paths capable of creating duplicate reward/withdrawal orchestration have been disabled. Existing live UI remains loadable because the original script paths still resolve to harmless stubs.

Module 5 can proceed without the known legacy reward clients issuing competing RPC calls.
