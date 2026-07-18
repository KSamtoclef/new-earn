/* ChatEarn V8F — final UI, admin and offer stabilizer. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_V8F_STABILIZER__) return;
  window.__CHAT_EARN_V8F_STABILIZER__ = true;

  const VERSION = '8F.0';
  const byId = id => document.getElementById(id);
  const getClient = () => {
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient?.rpc) return supabaseClient; } catch (_) {}
    return window.supabaseClient?.rpc ? window.supabaseClient : null;
  };

  function cleanEarningsPage() {
    const page = byId('earnings');
    if (!page) return;
    const primary = page.querySelector('.btn-withdraw');
    if (!primary) return;
    const container = primary.parentElement;
    [...container.querySelectorAll('a,button')].forEach(node => {
      if (node !== primary) node.remove();
    });
  }

  function cleanWithdrawalLegacyUi() {
    const page = byId('withdraw');
    if (!page) return;
    const direct = byId('ceDirectWithdrawalForm');
    if (!direct) return;
    page.querySelectorAll('.bank-options, #wdAccNo, #wdAccName, #bankVerifyStatus, .btn-place-wd').forEach(node => {
      const group = node.closest('.form-group');
      if (group) group.style.display = 'none';
      else node.style.display = 'none';
    });
  }

  function improveOfferManager() {
    const panel = byId('admin-offer-manager');
    if (!panel || byId('ceV8FOfferGuide')) return;
    const guide = document.createElement('div');
    guide.id = 'ceV8FOfferGuide';
    guide.className = 'admin-status-banner';
    guide.innerHTML = '<b>Rotating offer system:</b> add several active offer URLs below. ChatEarn rotates fresh destinations between native chat cards, bottom banners and half-screen sheets as conversations continue. One active URL will naturally repeat if it is the only available destination.';
    panel.prepend(guide);
    window.ChatEarnV8DFlow?.enhanceAdmin?.();
  }

  function refreshCanonicalAdmin(tabName) {
    if (tabName === 'withdrawals') window.ChatEarnAdminWithdrawalsV5?.refresh?.();
    if (tabName === 'kyc') window.ChatEarnAdminKyc?.refresh?.();
    if (tabName === 'offer-manager') setTimeout(improveOfferManager, 50);
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-tab]');
    if (tab) setTimeout(() => refreshCanonicalAdmin(tab.dataset.tab), 40);
  }, true);

  const observer = new MutationObserver(records => {
    let relevant = false;
    for (const record of records) {
      if (record.addedNodes.length || record.removedNodes.length) { relevant = true; break; }
    }
    if (!relevant) return;
    queueMicrotask(() => {
      cleanEarningsPage();
      cleanWithdrawalLegacyUi();
      improveOfferManager();
    });
  });

  function boot() {
    cleanEarningsPage();
    cleanWithdrawalLegacyUi();
    improveOfferManager();
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  window.ChatEarnV8FDiagnostic = () => ({
    version: VERSION,
    extraEarningsButtons: Math.max(0, (byId('earnings')?.querySelectorAll('.btn-withdraw ~ a, .btn-withdraw ~ button').length || 0)),
    directWithdrawalVisible: Boolean(byId('ceDirectWithdrawalForm')),
    adminWithdrawalReady: Boolean(window.ChatEarnAdminWithdrawalsV5),
    adminKycReady: Boolean(window.ChatEarnAdminKyc),
    offerManagerReady: Boolean(byId('admin-offer-manager')),
    clientReady: Boolean(getClient())
  });
  console.info(`[ChatEarn] V8F stabilizer ${VERSION} loaded`);
})();