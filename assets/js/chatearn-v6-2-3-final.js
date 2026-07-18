/*
 * ChatEarn legacy V6.2.3 reward client — intentionally disabled.
 *
 * Reason:
 * - It calls the deprecated chatearn_v62_* RPC family.
 * - It maintains a second sponsored-reward state machine in sessionStorage.
 * - It mutates wallet totals directly in the browser after a legacy claim.
 *
 * The canonical Module 4 reward engine now owns chat and sponsored rewards.
 * Keep this compatibility stub until the Module 6 frontend integration removes
 * the old script tag from index.html.
 */
(() => {
  'use strict';
  window.__CE623_VERIFIED_REWARD__ = true;
  window.ChatEarnRewardDiagnostic = () => ({
    version: '6.2.3-disabled',
    loaded: false,
    disabled: true,
    reason: 'Replaced by canonical Module 4 reward engine'
  });
  console.info('[ChatEarn] Legacy V6.2.3 reward client disabled');
})();
