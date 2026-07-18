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
    script.src = './assets/js/chatearn-v7-admin-withdrawals.js?v=7.0.1';
    script.defer = true;
    script.dataset.chatearnModule = '7A';
    script.onerror = () => console.error('[ChatEarn] Module 7A admin withdrawal integration failed to load');
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadModule7A, { once: true });
  } else {
    loadModule7A();
  }

  console.info('[ChatEarn] Legacy V6.2.3 reward client disabled; Module 7A loader ready');
})();