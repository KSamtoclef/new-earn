/* ChatEarn canonical Module 7 coordinator. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_MODULE_7_ADMIN_COORDINATOR__) return;
  window.__CHAT_EARN_MODULE_7_ADMIN_COORDINATOR__ = true;
  const VERSION = '8F.2';
  const registry = [
    { key:'7B', flag:'__CHAT_EARN_MODULE_7B2__', src:'./assets/js/chatearn-v7-admin-withdrawals.js?v=7.2.0' },
    { key:'7C', flag:'__CHAT_EARN_MODULE_7C2__', src:'./assets/js/chatearn-v7-admin-kyc.js?v=7.2.0' },
    { key:'8D', flag:'__CHAT_EARN_V8D3_FLOW__', src:'./assets/js/chatearn-v8d-offer-withdrawal-flow.js?v=8.3.1' },
    { key:'8E', flag:'__CHAT_EARN_V8E3_DIRECT_WITHDRAWAL__', src:'./assets/js/chatearn-v8e-direct-withdrawal-flow.js?v=8.3.0' },
    { key:'8F', flag:'__CHAT_EARN_V8F_STABILIZER__', src:'./assets/js/chatearn-v8f-final-stabilizer.js?v=8.0.0' }
  ];
  const failures = new Map();
  window.__CE623_VERIFIED_REWARD__ = true;
  window.ChatEarnRewardDiagnostic = () => ({ version:'legacy-reward-disabled', loaded:false, disabled:true });
  function load(module) {
    if (window[module.flag] || document.querySelector(`script[data-chatearn-module="${module.key}"]`)) return;
    const script = document.createElement('script');
    script.src = module.src;
    script.defer = true;
    script.dataset.chatearnModule = module.key;
    script.onload = () => failures.delete(module.key);
    script.onerror = () => failures.set(module.key, 'load_failed');
    document.head.appendChild(script);
  }
  function boot() { registry.forEach(load); }
  window.ChatEarnModule7Diagnostic = () => ({version:VERSION,coordinatorReady:true,withdrawal:window.ChatEarnAdminWithdrawalsV5?.diagnostic?.()||null,kyc:window.ChatEarnAdminKyc?.diagnostic?.()||null,adsAndSharing:window.ChatEarnV8DFlow?.diagnostic?.()||null,directWithdrawal:window.ChatEarnV8EDirectWithdrawal?.diagnostic?.()||null,stabilizer:window.ChatEarnV8FDiagnostic?.()||null,failures:Object.fromEntries(failures)});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  console.info(`[ChatEarn] Module coordinator ${VERSION} loaded`);
})();