/*
 * ChatEarn Module 8C temporary compatibility bootstrap.
 * index.html still references this historical filename. The active implementation
 * lives in assets/js/chatearn-module7-admin.js and this file performs no reward,
 * wallet, withdrawal, KYC, chat, or authentication work.
 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_MODULE7_BOOTSTRAP__) return;
  window.__CHAT_EARN_MODULE7_BOOTSTRAP__ = true;

  const VERSION = '8C.1';
  const CANONICAL_SRC = './assets/js/chatearn-module7-admin.js?v=8.2.0';
  let loadFailed = false;

  window.__CE623_VERIFIED_REWARD__ = true;
  window.ChatEarnRewardDiagnostic = () => ({
    version: 'legacy-reward-disabled',
    loaded: false,
    disabled: true,
    reason: 'Replaced by canonical Module 4 reward engine'
  });

  function existingCoordinatorScript() {
    return document.querySelector('script[data-chatearn-module7-coordinator]');
  }

  function loadCanonicalCoordinator() {
    if (window.__CHAT_EARN_MODULE_7_ADMIN_COORDINATOR__ || existingCoordinatorScript()) return;
    const script = document.createElement('script');
    script.src = CANONICAL_SRC;
    script.defer = true;
    script.dataset.chatearnModule7Coordinator = 'true';
    script.onload = () => { loadFailed = false; };
    script.onerror = () => {
      loadFailed = true;
      console.error('[ChatEarn] Canonical Module 7 admin coordinator failed to load');
    };
    document.head.appendChild(script);
  }

  window.ChatEarnModule8CCompatibilityDiagnostic = () => ({
    version: VERSION,
    compatibilityBootstrapLoaded: true,
    legacyRewardDisabled: window.ChatEarnRewardDiagnostic?.().disabled === true,
    canonicalCoordinatorFlag: Boolean(window.__CHAT_EARN_MODULE_7_ADMIN_COORDINATOR__),
    coordinatorScriptCount: document.querySelectorAll('script[data-chatearn-module7-coordinator]').length,
    historicalIndexReferenceStillRequired: true,
    loadFailed,
    removableAfterIndexReplacement: !loadFailed
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCanonicalCoordinator, { once: true });
  } else {
    loadCanonicalCoordinator();
  }

  console.info(`[ChatEarn] Module ${VERSION} compatibility bootstrap ready`);
})();
