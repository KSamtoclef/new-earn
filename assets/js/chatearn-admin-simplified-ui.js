/* ChatEarn active admin navigation v1.4.0 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_SIMPLIFIED_ADMIN_UI__) return;
  window.__CHAT_EARN_SIMPLIFIED_ADMIN_UI__ = true;

  const KEEP_LABELS = new Map([
    ['live', 'Live'],
    ['performance', 'Performance'],
    ['sponsored ads', 'Sponsored Ads'],
    ['offers', 'Sponsored Ads'],
    ['withdrawals', 'Withdrawals'],
    ['kyc', 'KYC'],
    ['users', 'Registrations'],
    ['registrations', 'Registrations']
  ]);

  const REMOVE_LABELS = new Set(['overview', 'journeys', 'system']);

  function normalise(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function tabKey(button) {
    return normalise(
      button?.dataset?.ce6Tab ||
      button?.dataset?.tab ||
      button?.dataset?.adminTab ||
      button?.getAttribute?.('aria-controls')?.replace(/^ce6-/, '') ||
      button?.textContent
    );
  }

  function loadModule(src, flag) {
    if (window[flag] || document.querySelector(`script[src^="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }

  function loadSupportModules() {
    loadModule('./assets/js/chatearn-sponsored-theme-runtime.js?v=1.0.0', '__CHAT_EARN_SPONSORED_THEME_RUNTIME__');
    loadModule('./assets/js/chatearn-admin-premium-performance.js?v=1.0.0', '__CHAT_EARN_PREMIUM_ADMIN_OVERRIDE__');
    loadModule('./assets/js/chatearn-live-manager-editor.js?v=1.0.0', '__CHAT_EARN_LIVE_MANAGER_EDITOR__');
  }

  function findTabContainers() {
    const direct = [
      document.getElementById('adminTabs'),
      document.querySelector('.admin-tabs'),
      document.querySelector('[role="tablist"]')
    ].filter(Boolean);

    if (direct.length) return [...new Set(direct)];

    return [...document.querySelectorAll('nav, .tabs, .admin-nav')].filter(node =>
      /sponsored ads/i.test(node.textContent || '') && /withdrawals/i.test(node.textContent || '')
    );
  }

  function simplifyTabs() {
    let changed = false;

    for (const tabs of findTabContainers()) {
      const buttons = [...tabs.querySelectorAll('button, a, [role="tab"]')];

      for (const button of buttons) {
        const key = tabKey(button);
        if (!key) continue;

        const removable = [...REMOVE_LABELS].some(label => key === label || key.includes(label));
        if (removable) {
          button.remove();
          changed = true;
          continue;
        }

        const mapped = [...KEEP_LABELS.entries()].find(([label]) => key === label || key.includes(label));
        if (mapped) {
          const wanted = mapped[1];
          if (normalise(button.textContent) !== normalise(wanted)) button.textContent = wanted;
        }
      }
    }

    return changed;
  }

  function simplifyPanels() {
    const selectors = [
      '#ce6-overview', '#ce6-journeys', '#ce6-system',
      '[data-panel="overview"]', '[data-panel="journeys"]', '[data-panel="system"]',
      '[data-admin-panel="overview"]', '[data-admin-panel="journeys"]', '[data-admin-panel="system"]'
    ];

    selectors.forEach(selector => document.querySelectorAll(selector).forEach(node => node.remove()));

    document.querySelectorAll('.admin-panel, [role="tabpanel"]').forEach(panel => {
      const key = normalise(panel.id || panel.dataset?.panel || panel.dataset?.adminPanel || panel.querySelector('h1,h2')?.textContent);
      if ([...REMOVE_LABELS].some(label => key === label || key.endsWith(`-${label}`))) panel.remove();
    });
  }

  function renameUsers() {
    document.querySelectorAll('button, a, [role="tab"], h1, h2').forEach(node => {
      if (normalise(node.textContent) === 'users') node.textContent = 'Registrations';
    });
  }

  function ensureValidActiveTab() {
    const visibleTabs = findTabContainers()
      .flatMap(tabs => [...tabs.querySelectorAll('button, a, [role="tab"]')])
      .filter(node => node.isConnected && getComputedStyle(node).display !== 'none');

    const active = visibleTabs.find(node => node.classList.contains('active') || node.getAttribute('aria-selected') === 'true');
    if (active && ![...REMOVE_LABELS].some(label => tabKey(active).includes(label))) return;

    const preferred = visibleTabs.find(node => /live/i.test(node.textContent || '')) ||
      visibleTabs.find(node => /performance/i.test(node.textContent || '')) ||
      visibleTabs[0];
    preferred?.click();
  }

  function simplify() {
    loadSupportModules();
    simplifyTabs();
    simplifyPanels();
    renameUsers();
    ensureValidActiveTab();
    document.body.dataset.ceSimplifiedAdmin = '1';
    return true;
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      simplify();
    }, 80);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', simplify, { once: true });
  } else {
    simplify();
  }

  window.ChatEarnSimplifiedAdmin = Object.freeze({
    version: '1.4.0',
    simplify,
    sections: ['live', 'performance', 'sponsored ads', 'withdrawals', 'kyc', 'registrations']
  });
})();