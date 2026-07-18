/*
 * ChatEarn Module 7D compatibility coordinator.
 * The legacy V6.2.3 reward client remains disabled; this file only loads the
 * isolated canonical Module 7 admin integrations until index.html consolidation.
 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_MODULE_7D_COORDINATOR__) return;
  window.__CHAT_EARN_MODULE_7D_COORDINATOR__ = true;

  const VERSION = '7D.1';
  const registry = [
    {
      key: '7A',
      flag: '__CHAT_EARN_MODULE_7A__',
      src: './assets/js/chatearn-v7-admin-withdrawals.js?v=7.1.0'
    },
    {
      key: '7C',
      flag: '__CHAT_EARN_MODULE_7C__',
      src: './assets/js/chatearn-v7-admin-kyc.js?v=7.0.1'
    }
  ];
  const failures = new Map();

  window.__CE623_VERIFIED_REWARD__ = true;
  window.ChatEarnRewardDiagnostic = () => ({
    version: '6.2.3-disabled',
    loaded: false,
    disabled: true,
    reason: 'Replaced by canonical Module 4 reward engine'
  });

  function loadModule(module) {
    if (window[module.flag] || document.querySelector(`script[data-chatearn-module="${module.key}"]`)) return;
    const script = document.createElement('script');
    script.src = module.src;
    script.defer = true;
    script.dataset.chatearnModule = module.key;
    script.onload = () => failures.delete(module.key);
    script.onerror = () => {
      failures.set(module.key, 'load_failed');
      console.error(`[ChatEarn] Module ${module.key} failed to load`);
    };
    document.head.appendChild(script);
  }

  function loadAdminModules() {
    registry.forEach(loadModule);
  }

  window.ChatEarnModule7Diagnostic = () => {
    const withdrawal = window.ChatEarnAdminWithdrawalsV5?.diagnostic?.() || null;
    const kyc = window.ChatEarnAdminKyc?.diagnostic?.() || null;
    const duplicateScripts = registry.filter(module =>
      document.querySelectorAll(`script[data-chatearn-module="${module.key}"]`).length > 1
    ).map(module => module.key);
    const result = {
      version: VERSION,
      coordinatorReady: true,
      legacyRewardDisabled: window.ChatEarnRewardDiagnostic?.().disabled === true,
      withdrawal,
      kyc,
      duplicateScripts,
      failures: Object.fromEntries(failures),
      passed: Boolean(
        window.ChatEarnRewardDiagnostic?.().disabled === true &&
        withdrawal?.canonicalRpcs?.includes('chatearn_admin_transition_withdrawal_v5') &&
        kyc?.directTableMutation === false &&
        duplicateScripts.length === 0 &&
        failures.size === 0
      )
    };
    return result;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAdminModules, { once: true });
  } else {
    loadAdminModules();
  }

  console.info(`[ChatEarn] Module ${VERSION} admin coordinator loaded`);
})();
