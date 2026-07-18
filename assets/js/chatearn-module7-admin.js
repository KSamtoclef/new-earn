/* ChatEarn canonical runtime coordinator. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_CANONICAL_RUNTIME_COORDINATOR__) return;
  window.__CHAT_EARN_CANONICAL_RUNTIME_COORDINATOR__ = true;

  const VERSION = 'canonical-1.2.4';
  const failures = new Map();
  const loaded = new Set();
  const registry = [
    { key: 'offers-sharing', flag: '__CHAT_EARN_V8D8_FLOW__', src: './assets/js/chatearn-v8d-offer-withdrawal-flow.js?v=8.8.0' },
    { key: 'withdrawal', flag: '__CHAT_EARN_V8E12_DIRECT_WITHDRAWAL__', src: './assets/js/chatearn-v8e-direct-withdrawal-flow.js?v=8.12.0' },
    { key: 'admin-withdrawals', flag: '__CHAT_EARN_MODULE_7B3__', src: './assets/js/chatearn-v7-admin-withdrawals.js?v=7.3.0' },
    { key: 'admin-kyc', flag: '__CHAT_EARN_MODULE_7C2__', src: './assets/js/chatearn-v7-admin-kyc.js?v=7.2.0' }
  ];

  window.__CE623_VERIFIED_REWARD__ = false;
  window.ChatEarnRewardDiagnostic = () => ({ version: 'retired-compatibility-runtime', loaded: false, disabled: true });

  function loadOne(module) {
    return new Promise((resolve, reject) => {
      if (window[module.flag] || loaded.has(module.key)) { loaded.add(module.key); resolve(); return; }
      const selector = 'script[data-chatearn-module="' + module.key + '"]';
      const existing = document.querySelector(selector);
      if (existing) {
        existing.addEventListener('load', () => { loaded.add(module.key); failures.delete(module.key); resolve(); }, { once: true });
        existing.addEventListener('error', () => { failures.set(module.key, 'load_failed'); reject(new Error(module.key + '_load_failed')); }, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = module.src;script.async = false;script.dataset.chatearnModule = module.key;
      script.onload = () => { loaded.add(module.key); failures.delete(module.key); resolve(); };
      script.onerror = () => { failures.set(module.key, 'load_failed'); reject(new Error(module.key + '_load_failed')); };
      document.head.appendChild(script);
    });
  }

  async function boot() { for (const module of registry) { try { await loadOne(module); } catch (error) { console.error('[ChatEarn] Runtime module failed:', module.key, error); } } }

  window.ChatEarnModule7Diagnostic = () => ({
    version: VERSION,coordinatorReady: true,loaded: Array.from(loaded),failures: Object.fromEntries(failures),
    portalProvider: window.ChatEarnWithdrawalV5?.diagnostic?.() || null,
    offersAndSharing: window.ChatEarnV8DFlow?.diagnostic?.() || null,
    directWithdrawal: window.ChatEarnV8EDirectWithdrawal?.diagnostic?.() || null,
    adminWithdrawals: window.ChatEarnAdminWithdrawalsV5?.diagnostic?.() || null,
    adminKyc: window.ChatEarnAdminKyc?.diagnostic?.() || null
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();