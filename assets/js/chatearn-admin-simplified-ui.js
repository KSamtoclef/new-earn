/* ChatEarn admin stability loader v1.6.0 */
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
    // One V6 admin owns the interface. Support modules may enhance forms,
    // but they must never rebuild tabs or panels.
    loadModule('./assets/js/chatearn-sponsored-theme-runtime.js?v=1.0.1', '__CHAT_EARN_SPONSORED_THEME_RUNTIME__');
    loadModule('./assets/js/chatearn-admin-stability-mode.js?v=1.1.0', '__CHAT_EARN_ADMIN_STABILITY_MODE__');
    loadModule('./assets/js/chatearn-live-manager-editor.js?v=1.0.1', '__CHAT_EARN_LIVE_MANAGER_EDITOR__');
    document.body.dataset.ceAdminStabilityMode = '1';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.ChatEarnSimplifiedAdmin = Object.freeze({
    version: '1.6.0',
    mode: 'single-manager',
    init
  });
})();
