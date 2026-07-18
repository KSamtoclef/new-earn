/*
 * Temporary compatibility bootstrap.
 * index.html still references this historical filename; the implementation now
 * lives in assets/js/chatearn-module7-admin.js.
 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_MODULE7_BOOTSTRAP__) return;
  window.__CHAT_EARN_MODULE7_BOOTSTRAP__ = true;

  window.__CE623_VERIFIED_REWARD__ = true;
  window.ChatEarnRewardDiagnostic = () => ({
    version: 'legacy-reward-disabled',
    loaded: false,
    disabled: true,
    reason: 'Replaced by canonical Module 4 reward engine'
  });

  function loadCanonicalCoordinator() {
    if (window.__CHAT_EARN_MODULE_7_ADMIN_COORDINATOR__ || document.querySelector('script[data-chatearn-module7-coordinator]')) return;
    const script = document.createElement('script');
    script.src = './assets/js/chatearn-module7-admin.js?v=8.1.0';
    script.defer = true;
    script.dataset.chatearnModule7Coordinator = 'true';
    script.onerror = () => console.error('[ChatEarn] Canonical Module 7 admin coordinator failed to load');
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCanonicalCoordinator, { once: true });
  } else {
    loadCanonicalCoordinator();
  }

  console.info('[ChatEarn] Compatibility bootstrap ready for canonical Module 7 coordinator');
})();