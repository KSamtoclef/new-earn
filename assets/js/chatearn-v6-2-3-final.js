/*
 * ChatEarn legacy V6.2.3 reward client — intentionally disabled.
 * Compatibility loader retained until the final index.html consolidation pass.
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

  function loadModule7A() {
    if (window.__CHAT_EARN_MODULE_7A__ || document.querySelector('script[data-chatearn-module="7A"]')) return;
    const script = document.createElement('script');
    script.src = './assets/js/chatearn-v7-admin-withdrawals.js?v=7.1.0';
    script.defer = true;
    script.dataset.chatearnModule = '7A';
    script.onerror = () => console.error('[ChatEarn] Module 7A failed to load');
    document.head.appendChild(script);
  }

  function loadModule7C() {
    if (window.__CHAT_EARN_MODULE_7C__ || document.querySelector('script[data-chatearn-module="7C"]')) return;
    const script = document.createElement('script');
    script.src = './assets/js/chatearn-v7-admin-kyc.js?v=7.0.1';
    script.defer = true;
    script.dataset.chatearnModule = '7C';
    script.onerror = () => console.error('[ChatEarn] Module 7C failed to load');
    document.head.appendChild(script);
  }

  function loadAdminModules() {
    loadModule7A();
    loadModule7C();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAdminModules, { once: true });
  } else {
    loadAdminModules();
  }

  console.info('[ChatEarn] Legacy reward client disabled; Module 7 admin loaders ready');
})();
