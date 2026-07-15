/*
 ChatEarn V4.0.2 Admin Performance Patch
 Add this script AFTER the existing ChatEarn V3.2 scripts and before </body>.
 Requires chatearn_v4_phase1.sql to be installed first.
 Public-site screens and marketing copy are untouched.
*/
(() => {
  'use strict';

  if (window.__CE_V4_ADMIN_PATCH__) return;
  window.__CE_V4_ADMIN_PATCH__ = '4.0.2';

  // V3 keeps its admin client private inside an IIFE, so V4 creates its own
  // isolated client using the same admin-session storage key.
  const v4AdminClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'chatearn-admin-v3-auth'
    }
  });
  window.ceAdminClient = v4AdminClient;

  const MIN_SILENT_BOOTSTRAP_MS = 15000;
  let lastBootstrapAt = 0;

  const SECTION_MAP = {
    funnel: ['analytics'],
    pages: ['analytics'],
    chats: ['analytics', 'chats', 'chat_messages'],
    shares: ['analytics', 'shares', 'referrals'],
    offers: ['offers'],
    push: ['analytics'],
    propush: ['analytics'],
    activity: ['activity'],
    withdrawals: ['withdrawals', 'users'],
    kyc: ['kyc', 'users'],
    users: ['users'],
    insights: ['analytics', 'offers', 'shares']
  };

  const STORE_KEY = {
    analytics: 'events',
    activity: 'events',
    users: 'profiles',
    withdrawals: 'withdrawals',
    kyc: 'kyc',
    chats: 'threads',
    chat_messages: 'chat_messages',
    ledger: 'ledger',
    offers: 'offer_events',
    shares: 'share_events',
    referrals: 'referrals'
  };

  const loaded = new Map();
  let bootstrapInFlight = null;
  let sectionInFlight = new Map();

  const parsePayload = value => typeof value === 'string' ? JSON.parse(value) : value;
  const safeArray = value => Array.isArray(value) ? value : [];

  async function rpcWithAuth(name, args) {
    let response = await v4AdminClient.rpc(name, args || {});
    if (response.error && /jwt|auth|session/i.test(response.error.message || '')) {
      await v4AdminClient.auth.refreshSession();
      response = await v4AdminClient.rpc(name, args || {});
    }
    if (response.error) throw response.error;
    return parsePayload(response.data);
  }

  function ensureAdminShape() {
    const keys = [
      'events','profiles','presence','withdrawals','kyc','threads','ledger',
      'share_attempts','bank_checks','public_activity','visits','offers',
      'offer_events','share_events','referrals','chat_messages'
    ];
    keys.forEach(key => {
      if (!Array.isArray(adminData[key])) adminData[key] = [];
    });
  }

  function mergeRows(existing, incoming, keyFn) {
    const map = new Map();
    safeArray(existing).forEach(row => map.set(keyFn(row), row));
    safeArray(incoming).forEach(row => map.set(keyFn(row), row));
    return [...map.values()];
  }

  function rowKey(row) {
    return String(
      row?.id ??
      row?.user_id ??
      row?.session_id ??
      `${row?.visitor_id || ''}:${row?.event_name || row?.event_type || ''}:${row?.created_at || ''}`
    );
  }

  function renderForSection(section) {
    switch (section) {
      case 'overview': renderOverview(); break;
      case 'live': renderLive(); break;
      case 'funnel': renderFunnel(); break;
      case 'pages': renderPages(); break;
      case 'chats': renderChats(); break;
      case 'shares': renderShares(); break;
      case 'offers':
        if (typeof ceRenderOffersAdmin === 'function') ceRenderOffersAdmin();
        break;
      case 'push':
      case 'propush':
        renderPush();
        break;
      case 'activity': renderActivity(); break;
      case 'withdrawals': renderWithdrawals(); break;
      case 'kyc': renderKyc(); break;
      case 'users': renderAdminUsers(); break;
      case 'insights':
        renderInsights();
        if (typeof ceExtendAdminInsights === 'function') ceExtendAdminInsights();
        break;
    }
  }

  async function loadBootstrap({silent = false, force = false} = {}) {
    if (bootstrapInFlight) return bootstrapInFlight;
    if (silent && !force && Date.now() - lastBootstrapAt < MIN_SILENT_BOOTSTRAP_MS) return;

    bootstrapInFlight = (async () => {
      const button = document.getElementById('adminRefreshBtn');
      if (button && !silent) {
        button.disabled = true;
        button.textContent = 'Refreshing…';
      }

      try {
        const payload = await rpcWithAuth('chatearn_v4_admin_bootstrap');
        if (!payload?.ok || !payload?.data) throw new Error('Invalid V4 bootstrap response');
        lastBootstrapAt = Date.now();

        ensureAdminShape();
        const data = payload.data;
        adminData.presence = safeArray(data.presence);
        adminData.events = safeArray(data.events);
        adminData.withdrawals = safeArray(data.withdrawals);
        adminData.kyc = safeArray(data.kyc);
        adminData.offers = safeArray(data.offers);

        adminHasLoaded = true;
        renderOverview();
        renderLive();
        if (typeof ceRenderOffersAdmin === 'function') ceRenderOffersAdmin();

        putText('adminLastUpdated', `Updated ${formatLagos(payload.generated_at || Date.now())} WAT · lightweight V4`);
        setAdminRealtimeState(
          adminRealtimeReady ? 'connected' : 'connecting',
          adminRealtimeReady ? 'Realtime connected · lightweight V4' : 'V4 loaded · connecting realtime'
        );
        clearAdminError();
      } catch (error) {
        setAdminRealtimeState('disconnected', adminHasLoaded ? 'Refresh failed · last valid figures kept' : 'V4 admin unavailable');
        showAdminError(error.message || String(error), true);
        throw error;
      } finally {
        if (button && !silent) {
          button.disabled = false;
          button.textContent = 'Refresh';
        }
        bootstrapInFlight = null;
      }
    })();

    return bootstrapInFlight;
  }

  async function loadSection(dataset, {force = false, limit = 700, offset = 0} = {}) {
    const cacheKey = `${dataset}:${offset}`;
    if (!force && loaded.has(cacheKey) && Date.now() - loaded.get(cacheKey) < 120000) return;
    if (sectionInFlight.has(cacheKey)) return sectionInFlight.get(cacheKey);

    const promise = (async () => {
      const payload = await rpcWithAuth('chatearn_v4_admin_section', {
        p_section: dataset,
        p_limit: limit,
        p_offset: offset
      });
      if (!payload?.ok || !Array.isArray(payload.rows)) throw new Error(`Invalid V4 ${dataset} response`);

      ensureAdminShape();
      const target = STORE_KEY[dataset];
      if (!target) return;

      if (offset === 0) {
        adminData[target] = payload.rows;
      } else {
        adminData[target] = mergeRows(adminData[target], payload.rows, rowKey);
      }
      loaded.set(cacheKey, Date.now());
    })().finally(() => sectionInFlight.delete(cacheKey));

    sectionInFlight.set(cacheKey, promise);
    return promise;
  }

  async function loadTab(section, force = false) {
    const datasets = SECTION_MAP[section] || [];
    if (!datasets.length) {
      renderForSection(section);
      return;
    }

    try {
      await Promise.all(datasets.map(dataset => loadSection(dataset, {force})));
      renderForSection(section);
      putText('adminLastUpdated', `Updated ${formatLagos(Date.now())} WAT · ${section} loaded`);
    } catch (error) {
      showAdminError(error.message || String(error), true);
    }
  }

  // Replace the expensive all-data refresh with the small bootstrap.
  window.refreshAdmin = options => loadBootstrap({...(options || {}), force: !(options && options.silent)});

  // Keep the original tab UI, then load only the selected section's data.
  // The production app exposes adminSwitchTab globally while setAdminTab is
  // private, so hook adminSwitchTab directly. This also works for the Offers
  // tab that V3 creates dynamically.
  const originalAdminSwitchTab = window.adminSwitchTab;
  if (typeof originalAdminSwitchTab === 'function') {
    window.adminSwitchTab = function(event, section, element) {
      const result = originalAdminSwitchTab(event, section, element);
      queueMicrotask(() => loadTab(section));
      return result;
    };
  } else {
    document.addEventListener('click', event => {
      const tab = event.target.closest('.admin-tab[data-tab]');
      if (tab) loadTab(tab.dataset.tab);
    }, true);
  }

  // Correctly use the isolated admin client and V3 review RPCs.
  window.reviewWithdrawal = async function(id, status, button) {
    if (!confirm(status === 'approved' ? 'Approve and mark this withdrawal as paid?' : 'Reject this withdrawal request?')) return;
    const note = status === 'rejected' ? (prompt('Reason for rejection (optional):') || '').trim() : '';
    if (button) {
      button.disabled = true;
      button.textContent = status === 'approved' ? 'Approving…' : 'Rejecting…';
    }
    try {
      const { error } = await v4AdminClient.rpc('chatearn_v3_admin_review_withdrawal', {
        p_withdrawal_id: id,
        p_status: status,
        p_note: note || null
      });
      if (error) throw error;
      showToast(status === 'approved' ? 'Withdrawal approved' : 'Withdrawal rejected');
      loaded.delete('withdrawals:0');
      await loadSection('withdrawals', {force: true});
      renderWithdrawals();
      renderOverview();
    } catch (error) {
      showAdminError(error.message || String(error));
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = status === 'approved' ? 'Approve Paid' : 'Reject';
      }
    }
  };

  window.reviewKyc = async function(id, status, button) {
    if (!confirm(status === 'approved' ? 'Approve this KYC record?' : 'Reject this KYC record?')) return;
    const note = status === 'rejected' ? (prompt('Reason for rejection (optional):') || '').trim() : '';
    if (button) {
      button.disabled = true;
      button.textContent = status === 'approved' ? 'Approving…' : 'Rejecting…';
    }
    try {
      const { error } = await v4AdminClient.rpc('chatearn_v3_admin_review_kyc', {
        p_kyc_id: id,
        p_status: status,
        p_note: note || null
      });
      if (error) throw error;
      showToast(status === 'approved' ? 'KYC approved' : 'KYC rejected');
      loaded.delete('kyc:0');
      await loadSection('kyc', {force: true});
      renderKyc();
      renderOverview();
    } catch (error) {
      showAdminError(error.message || String(error));
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = status === 'approved' ? 'Approve' : 'Reject';
      }
    }
  };

  // Realtime policy: patch local live rows; mark heavy tabs stale instead of
  // downloading the entire database snapshot after every change.
  window.ceScheduleFullRefresh = function() {
    loaded.clear();
  };

  // Reduce browser work: the legacy clock re-rendered Overview and Live every
  // few seconds even when no data changed. V4 updates only the status text.
  window.updateAdminLiveClock = function() {
    const element = document.getElementById('adminAutoRefreshText');
    if (!element) return;
    const realtimeText = adminRealtimeReady
      ? (adminLastRealtimeAt ? `Realtime event ${ago(adminLastRealtimeAt)}` : 'Realtime connected')
      : 'Realtime connecting';
    element.textContent = `${realtimeText} · lightweight backup refresh`;
  };

  window.startAdminLiveLoop = function() {
    stopAdminLiveLoop();
    adminNextPollAt = Date.now() + 120000;
    updateAdminLiveClock();
    adminPollHandle = setInterval(() => {
      if (!adminPanelIsOpen() || document.hidden) return;
      adminNextPollAt = Date.now() + 120000;
      loadBootstrap({silent: true}).catch(() => {});
    }, 120000);
    adminTickerHandle = setInterval(updateAdminLiveClock, 5000);
  };

  // Refresh bootstrap only while the admin is open and visible.
  setInterval(() => {
    if (
      typeof adminPanelIsOpen === 'function' &&
      adminPanelIsOpen() &&
      document.visibilityState === 'visible'
    ) {
      loadBootstrap({silent: true}).catch(() => {});
    }
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' &&
        typeof adminPanelIsOpen === 'function' &&
        adminPanelIsOpen()) {
      loadBootstrap({silent: true}).catch(() => {});
    }
  });
})();
