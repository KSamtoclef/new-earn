/* ChatEarn admin stability loader v1.5.0 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_SIMPLIFIED_ADMIN_UI__) return;
  window.__CHAT_EARN_SIMPLIFIED_ADMIN_UI__ = true;

  function loadModule(src, flag) {
    if (window[flag] || document.querySelector(`script[src^="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  function init() {
    // Stability first: do not remove V6 panels or intercept its tab lifecycle.
    // The previous override removed Overview while the V6 admin still loaded it,
    // causing the null-panel crash shown on mobile.
    loadModule('./assets/js/chatearn-sponsored-theme-runtime.js?v=1.0.0', '__CHAT_EARN_SPONSORED_THEME_RUNTIME__');
    loadModule('./assets/js/chatearn-admin-stability-mode.js?v=1.0.0', '__CHAT_EARN_ADMIN_STABILITY_MODE__');
    document.body.dataset.ceAdminStabilityMode = '1';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.ChatEarnSimplifiedAdmin = Object.freeze({
    version: '1.5.0',
    mode: 'stability',
    init
  });
})();
