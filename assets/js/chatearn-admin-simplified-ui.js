/* ChatEarn simplified admin navigation v1.1.0 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_SIMPLIFIED_ADMIN_UI__) return;
  window.__CHAT_EARN_SIMPLIFIED_ADMIN_UI__ = true;

  const KEEP = new Set(['live', 'offers', 'withdrawals', 'kyc', 'users']);
  const LABELS = {
    live: 'Live',
    offers: 'Sponsored Ads & Tasks',
    withdrawals: 'Withdrawals',
    kyc: 'KYC',
    users: 'Registrations'
  };

  function loadModule(src, flag) {
    if (window[flag] || document.querySelector(`script[src^="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  function loadSupportModules() {
    loadModule('./assets/js/chatearn-sponsored-creative-editor.js?v=1.0.0', '__CHAT_EARN_SPONSORED_CREATIVE_EDITOR__');
    loadModule('./assets/js/chatearn-sponsored-theme-runtime.js?v=1.0.0', '__CHAT_EARN_SPONSORED_THEME_RUNTIME__');
  }

  function simplify() {
    const tabs = document.getElementById('adminTabs');
    const content = document.getElementById('adminContent');
    if (!tabs || !content) return false;

    const buttons = [...tabs.querySelectorAll('[data-ce6-tab]')];
    if (!buttons.length) return false;

    buttons.forEach(button => {
      const key = button.dataset.ce6Tab;
      if (!KEEP.has(key)) {
        button.remove();
        return;
      }
      button.textContent = LABELS[key] || button.textContent;
    });

    [...content.querySelectorAll(':scope > .admin-panel[id^="ce6-"]')].forEach(panel => {
      const key = panel.id.replace('ce6-', '');
      if (!KEEP.has(key)) panel.remove();
    });

    const liveButton = tabs.querySelector('[data-ce6-tab="live"]');
    const activeButton = tabs.querySelector('[data-ce6-tab].active');
    if (!activeButton || !KEEP.has(activeButton.dataset.ce6Tab)) liveButton?.click();

    const usersPanel = document.getElementById('ce6-users');
    const title = usersPanel?.querySelector('.ce6-head h2');
    if (title) title.textContent = 'Registrations';

    document.body.dataset.ceSimplifiedAdmin = '1';
    return true;
  }

  let attempts = 0;
  function boot() {
    loadSupportModules();
    attempts += 1;
    if (simplify() || attempts >= 40) return;
    setTimeout(boot, 150);
  }

  const observer = new MutationObserver(() => simplify());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.ChatEarnSimplifiedAdmin = Object.freeze({
    version: '1.1.0',
    simplify,
    sections: [...KEEP]
  });
})();
