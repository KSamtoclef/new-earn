/* ChatEarn canonical runtime coordinator. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_CANONICAL_RUNTIME_COORDINATOR__) return;
  window.__CHAT_EARN_CANONICAL_RUNTIME_COORDINATOR__ = true;

  window.SUPABASE_URL = 'https://cqnovqvmxwmfngupgtov.supabase.co';
  window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbm92cXZteHdtZm5ndXBndG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODA0NzQsImV4cCI6MjA5OTg1NjQ3NH0.ZamXPTmqVsdHu1pD1EZLxPeSqWemBsj28Y1f-NOCEZs';

  const VERSION = 'canonical-1.5.3';
  const failures = new Map();
  const loaded = new Set();
  const registry = [
    { key: 'sponsored-ads', flag: '__CHAT_EARN_SPONSORED_ADS_MANAGER__', src: './assets/js/chatearn-sponsored-ads-admin.js?v=1.1.0' },
    { key: 'v6-sponsored-ads-ui', flag: '__CHAT_EARN_V6_SPONSORED_ADS_UI__', src: './assets/js/chatearn-v6-sponsored-ads-ui.js?v=1.3.0' },
    { key: 'sponsored-ads-stability', flag: '__CHAT_EARN_SPONSORED_ADS_STABILITY__', src: './assets/js/chatearn-sponsored-ads-stability.js?v=1.4.0' },
    { key: 'honest-analytics', flag: '__CHAT_EARN_HONEST_ANALYTICS__', src: './assets/js/chatearn-admin-honest-analytics.js?v=1.0.0' },
    { key: 'first-cycle-cap', flag: '__CHAT_EARN_FIRST_CYCLE_TASK_RUNTIME__', src: './assets/js/chatearn-first-cycle-and-task-runtime.js?v=1.2.0' },
    { key: 'offers-sharing', flag: '__CHAT_EARN_V8D12_FLOW__', src: './assets/js/chatearn-v8d-offer-withdrawal-flow.js?v=8.14.0' },
    { key: 'withdrawal', flag: '__CHAT_EARN_V8E13_DIRECT_WITHDRAWAL__', src: './assets/js/chatearn-v8e-direct-withdrawal-flow.js?v=8.14.0' },
    { key: 'admin-withdrawals', flag: '__CHAT_EARN_MODULE_7B3__', src: './assets/js/chatearn-v7-admin-withdrawals.js?v=7.3.0' },
    { key: 'admin-kyc', flag: '__CHAT_EARN_MODULE_7C2__', src: './assets/js/chatearn-v7-admin-kyc.js?v=7.2.0' }
  ];

  window.__CE623_VERIFIED_REWARD__ = false;
  window.ChatEarnRewardDiagnostic = () => ({ version: 'retired-compatibility-runtime', loaded: false, disabled: true });

  function loadOne(module) {
    return new Promise((resolve, reject) => {
      if (window[module.flag] || loaded.has(module.key)) {
        loaded.add(module.key);
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = module.src;
      script.async = false;
      script.dataset.chatearnModule = module.key;
      script.onload = () => { loaded.add(module.key); failures.delete(module.key); resolve(); };
      script.onerror = () => { failures.set(module.key, 'load_failed'); reject(new Error(module.key + '_load_failed')); };
      document.head.appendChild(script);
    });
  }

  async function boot() {
    for (const module of registry) {
      try { await loadOne(module); }
      catch (error) { console.error('[ChatEarn] Runtime module failed:', module.key, error); }
    }
  }

  window.ChatEarnModule7Diagnostic = () => ({
    version: VERSION,
    coordinatorReady: true,
    supabaseProject: new URL(window.SUPABASE_URL).hostname.split('.')[0],
    loaded: Array.from(loaded),
    failures: Object.fromEntries(failures),
    sponsoredAds: window.ChatEarnSponsoredAds?.version || null,
    v6SponsoredAdsUI: window.ChatEarnV6SponsoredAdsUI?.version || null,
    sponsoredAdsStability: Boolean(window.__CHAT_EARN_SPONSORED_ADS_STABILITY__),
    honestAnalytics: window.ChatEarnHonestAnalytics?.version || null,
    firstCycleCap: window.ChatEarnFirstCycleTaskRuntime?.version || null,
    offersAndSharing: window.ChatEarnV8DFlow?.diagnostic?.() || null,
    directWithdrawal: window.ChatEarnV8EDirectWithdrawal?.diagnostic?.() || null,
    adminWithdrawals: window.ChatEarnAdminWithdrawalsV5?.diagnostic?.() || null,
    adminKyc: window.ChatEarnAdminKyc?.diagnostic?.() || null
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();