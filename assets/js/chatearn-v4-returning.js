/* ChatEarn withdrawal portal state provider.
 * The historical filename is retained temporarily so index.html does not change during cleanup.
 * This module owns portal/account reads only. The direct withdrawal controller owns the UI and submission.
 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_WITHDRAWAL_PORTAL_PROVIDER__) return;
  window.__CHAT_EARN_WITHDRAWAL_PORTAL_PROVIDER__ = true;

  const VERSION = '7.0.0-provider';
  const state = {
    portal: null,
    accounts: [],
    loading: false,
    initialized: false,
    lastLoadedAt: 0,
    lastError: null
  };

  function client() {
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient?.rpc) return supabaseClient;
    } catch (_) {}
    if (window.supabaseClient?.rpc) return window.supabaseClient;
    throw new Error('connection_unavailable');
  }

  function unwrap(data) {
    if (!data || typeof data !== 'object') return {};
    return data.data && typeof data.data === 'object' ? data.data : data;
  }

  async function loadPortal(force = false) {
    if (state.loading) return state.portal;
    if (!force && state.portal && Date.now() - state.lastLoadedAt < 10000) return state.portal;

    state.loading = true;
    state.lastError = null;
    try {
      const [{ data: portalData, error: portalError }, { data: accountData, error: accountError }] = await Promise.all([
        client().rpc('chatearn_get_withdrawal_portal_v5'),
        client().rpc('chatearn_get_payout_accounts_v5')
      ]);
      if (portalError) throw portalError;
      if (accountError) throw accountError;

      state.portal = unwrap(portalData);
      const accountPayload = unwrap(accountData);
      state.accounts = Array.isArray(accountPayload)
        ? accountPayload
        : (accountPayload.accounts || accountPayload.payout_accounts || []);
      state.lastLoadedAt = Date.now();
      window.dispatchEvent(new CustomEvent('chatearn:withdrawal-portal-updated', {
        detail: { portal: state.portal, accounts: [...state.accounts] }
      }));
      return state.portal;
    } catch (error) {
      state.lastError = error?.message || String(error);
      console.warn('[ChatEarn] withdrawal portal refresh failed', state.lastError);
      return null;
    } finally {
      state.loading = false;
    }
  }

  function getState() {
    return {
      ...state,
      accounts: [...state.accounts]
    };
  }

  function diagnostic() {
    return {
      version: VERSION,
      role: 'read_only_portal_provider',
      initialized: state.initialized,
      portalLoaded: Boolean(state.portal),
      accountCount: state.accounts.length,
      lastLoadedAt: state.lastLoadedAt,
      lastError: state.lastError,
      ownsUi: false,
      ownsSubmission: false,
      rpcs: [
        'chatearn_get_withdrawal_portal_v5',
        'chatearn_get_payout_accounts_v5'
      ]
    };
  }

  window.ChatEarnWithdrawalV5 = Object.freeze({
    version: VERSION,
    load: loadPortal,
    refresh: () => loadPortal(true),
    getState,
    diagnostic
  });

  function initialize() {
    if (state.initialized) return;
    state.initialized = true;
    loadPortal(false);
    console.info(`[ChatEarn] Withdrawal portal provider ${VERSION} initialized`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();