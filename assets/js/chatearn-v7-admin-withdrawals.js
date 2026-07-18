/* ChatEarn Module 7A: canonical admin withdrawal processing UI. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_MODULE_7A__) return;
  window.__CHAT_EARN_MODULE_7A__ = true;

  const VERSION = '7A.1';
  const state = { loading: false, acting: false, items: [], lastLoadedAt: 0 };
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => '₦' + Number(value || 0).toLocaleString('en-NG');
  const when = value => value ? new Date(value).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) : '—';

  function client() {
    if (window.ceAdminClient?.rpc) return window.ceAdminClient;
    throw new Error('Admin client is unavailable. Sign in again and retry.');
  }

  async function rpc(name, args = {}) {
    const { data, error } = await client().rpc(name, args);
    if (error) throw error;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  function panel() { return byId('ce6-withdrawals') || byId('admin-withdrawals'); }
  function notify(message) { window.showToast ? window.showToast(message) : alert(message); }
  function isTerminal(status) { return ['paid','completed','complete','rejected','declined','cancelled','canceled'].includes(String(status || '').toLowerCase()); }

  function actions(item) {
    const status = String(item.status || '').toLowerCase();
    if (isTerminal(status)) return '<span class="admin-tag">Final</span>';
    if (status === 'processing') {
      return `<button class="admin-action approve" data-ce7-action="pay" data-id="${esc(item.id)}">Mark paid</button><button class="admin-action reject" data-ce7-action="reject" data-id="${esc(item.id)}">Reject & refund</button>`;
    }
    return `<button class="admin-action approve" data-ce7-action="process" data-id="${esc(item.id)}">Start processing</button><button class="admin-action reject" data-ce7-action="reject" data-id="${esc(item.id)}">Reject & refund</button>`;
  }

  function render() {
    const host = panel();
    if (!host) return;
    host.dataset.canonicalWithdrawalAdmin = VERSION;
    host.innerHTML = `
      <div class="ce6-head"><div><h2>Canonical Withdrawal Processing</h2><small>Atomic status transitions · held-fund settlement and refund</small></div><button class="admin-btn" data-ce7-refresh>Refresh</button></div>
      <div class="admin-status-banner"><b>Module 7A:</b> Actions below use the verified V5 withdrawal engine. Account numbers remain masked. Payment can only be completed after processing.</div>
      <div class="admin-list">${state.items.map(item => `
        <div class="admin-row" data-ce7-row="${esc(item.id)}">
          <div class="admin-row-main">
            <div class="admin-row-title">${esc(item.user_name || 'User')} · ${money(item.amount)} <span class="admin-tag">${esc(item.status)}</span></div>
            <div class="admin-row-sub">${esc(item.public_reference || '')} · ${esc(item.provider || 'Payout account')} •••• ${esc(item.account_last4 || '')}<br>${esc(item.account_name || '')} · Submitted ${when(item.submitted_at)}${item.admin_note ? `<br>Admin note: ${esc(item.admin_note)}` : ''}</div>
          </div>
          <div class="admin-head-actions">${actions(item)}</div>
        </div>`).join('') || '<div class="admin-empty">No withdrawal records found.</div>'}</div>`;
  }

  async function load(force = false) {
    if (state.loading) return;
    if (!force && state.items.length && Date.now() - state.lastLoadedAt < 5000) { render(); return; }
    const host = panel();
    if (!host) return;
    state.loading = true;
    host.innerHTML = '<div class="admin-empty">Loading canonical withdrawals…</div>';
    try {
      const data = await rpc('chatearn_admin_list_withdrawals_v5', { p_status: null, p_limit: 100, p_offset: 0 });
      if (!data?.ok || !Array.isArray(data.items)) throw new Error('Invalid withdrawal list response.');
      state.items = data.items;
      state.lastLoadedAt = Date.now();
      render();
    } catch (error) {
      host.innerHTML = `<div class="admin-error" style="display:block">${esc(error.message || String(error))}</div>`;
    } finally {
      state.loading = false;
    }
  }

  async function transition(button) {
    if (state.acting) return;
    const id = button.dataset.id;
    const action = button.dataset.ce7Action;
    const item = state.items.find(row => row.id === id);
    if (!item) return notify('Withdrawal record is no longer available. Refresh the list.');

    const label = action === 'pay' ? 'mark this withdrawal as paid' : action === 'process' ? 'start processing this withdrawal' : 'reject this withdrawal and refund held funds';
    if (!confirm(`Confirm: ${label}?\n\n${item.public_reference || id} · ${money(item.amount)}`)) return;

    const reason = action === 'reject' ? (prompt('Reason for rejection/refund:') || '').trim() : '';
    if (action === 'reject' && !reason) return notify('A rejection reason is required.');
    const adminNote = (prompt('Admin note (optional):') || '').trim();

    state.acting = true;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Working…';
    try {
      const result = await rpc('chatearn_admin_transition_withdrawal_v5', {
        p_withdrawal_id: id,
        p_action: action,
        p_reason: reason || null,
        p_admin_note: adminNote || null,
        p_external_withdrawal_id: null
      });
      if (!result?.ok) throw new Error('Withdrawal transition was not confirmed.');
      notify(result.idempotent ? 'Withdrawal was already in that state.' : `Withdrawal updated to ${result.status}.`);
      await load(true);
    } catch (error) {
      notify(error.message || 'Withdrawal action failed.');
      button.disabled = false;
      button.textContent = original;
    } finally {
      state.acting = false;
    }
  }

  function activeWithdrawalTab() {
    return document.querySelector('[data-ce6-tab="withdrawals"].active, [data-tab="withdrawals"].active');
  }

  function install() {
    const content = byId('adminContent');
    if (!content) return false;

    document.addEventListener('click', event => {
      const tab = event.target.closest('[data-ce6-tab="withdrawals"], [data-tab="withdrawals"]');
      if (tab) setTimeout(() => load(true), 0);
      const refresh = event.target.closest('[data-ce7-refresh]');
      if (refresh) { event.preventDefault(); load(true); }
      const action = event.target.closest('[data-ce7-action]');
      if (action) { event.preventDefault(); transition(action); }
    }, true);

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled || !activeWithdrawalTab()) return;
      const host = panel();
      if (!host || host.dataset.canonicalWithdrawalAdmin === VERSION) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; load(true); }, 0);
    });
    observer.observe(content, { childList: true, subtree: true });

    if (activeWithdrawalTab()) load(true);
    return true;
  }

  const timer = setInterval(() => {
    if (install()) clearInterval(timer);
  }, 250);
  setTimeout(() => clearInterval(timer), 20000);

  window.ChatEarnAdminWithdrawalsV5 = Object.freeze({
    version: VERSION,
    refresh: () => load(true),
    diagnostic: () => ({
      version: VERSION,
      adminClientReady: Boolean(window.ceAdminClient?.rpc),
      panelPresent: Boolean(panel()),
      canonicalPanelActive: panel()?.dataset.canonicalWithdrawalAdmin === VERSION,
      canonicalRpcs: ['chatearn_admin_list_withdrawals_v5','chatearn_admin_transition_withdrawal_v5']
    })
  });

  console.info(`[ChatEarn] Module ${VERSION} canonical admin withdrawal integration loaded`);
})();