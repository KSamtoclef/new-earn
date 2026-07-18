/*
 * ChatEarn legacy V4.1 returning-user reward/withdrawal client — disabled.
 *
 * This file previously called chatearn_v4_get_return_experience and
 * chatearn_v4_claim_return_task, then updated browser-side balances and legacy
 * withdrawal messaging. That creates a second reward and withdrawal path beside
 * the canonical Module 4/5 engines.
 *
 * The script tag is temporarily left in index.html as a harmless compatibility
 * stub. Module 6 will remove the tag and related legacy markup/styles.
 */
(() => {
  'use strict';
  window.__CE_V4_RETURNING__ = true;
  window.ChatEarnReturningDiagnostic = () => ({
    version: '4.1-disabled',
    loaded: false,
    disabled: true,
    reason: 'Legacy reward and withdrawal orchestration retired'
  });
  console.info('[ChatEarn] Legacy V4.1 returning reward client disabled');
})();
