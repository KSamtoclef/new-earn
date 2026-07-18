/* ChatEarn canonical Module 7 coordinator. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_MODULE_7_ADMIN_COORDINATOR__) return;
  window.__CHAT_EARN_MODULE_7_ADMIN_COORDINATOR__=true;
  const VERSION='8F.0';
  const registry=[
    {key:'7A',flag:'__CHAT_EARN_MODULE_7A__',src:'./assets/js/chatearn-v7-admin-withdrawals.js?v=7.1.0'},
    {key:'7C',flag:'__CHAT_EARN_MODULE_7C__',src:'./assets/js/chatearn-v7-admin-kyc.js?v=7.0.1'},
    {key:'8D',flag:'__CHAT_EARN_V8D3_FLOW__',src:'./assets/js/chatearn-v8d-offer-withdrawal-flow.js?v=8.3.0'},
    {key:'8E',flag:'__CHAT_EARN_V8E2_DIRECT_WITHDRAWAL__',src:'./assets/js/chatearn-v8e-direct-withdrawal-flow.js?v=8.2.0'}
  ];
  const failures=new Map();
  window.__CE623_VERIFIED_REWARD__=true;
  window.ChatEarnRewardDiagnostic=()=>({version:'legacy-reward-disabled',loaded:false,disabled:true});
  function load(m){if(window[m.flag]||document.querySelector(`script[data-chatearn-module="${m.key}"]`))return;const s=document.createElement('script');s.src=m.src;s.defer=true;s.dataset.chatearnModule=m.key;s.onload=()=>failures.delete(m.key);s.onerror=()=>failures.set(m.key,'load_failed');document.head.appendChild(s)}
  function boot(){registry.forEach(load)}
  window.ChatEarnModule7Diagnostic=()=>({version:VERSION,coordinatorReady:true,withdrawal:window.ChatEarnAdminWithdrawalsV5?.diagnostic?.()||null,kyc:window.ChatEarnAdminKyc?.diagnostic?.()||null,adsAndSharing:window.ChatEarnV8DFlow?.diagnostic?.()||null,directWithdrawal:window.ChatEarnV8EDirectWithdrawal?.diagnostic?.()||null,failures:Object.fromEntries(failures)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  console.info(`[ChatEarn] Module coordinator ${VERSION} loaded`);
})();