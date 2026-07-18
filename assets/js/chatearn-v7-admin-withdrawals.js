/* ChatEarn Module 7B: canonical admin withdrawal processing UI. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_MODULE_7B__) return;
  window.__CHAT_EARN_MODULE_7B__ = true;

  const VERSION = '7B.1';
  const state = {
    loading: false,
    acting: false,
    items: [],
    filter: 'all',
    search: '',
    selectedId: null,
    lastLoadedAt: 0
  };
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
  function terminal(status) { return ['paid','completed','complete','rejected','declined','cancelled','canceled'].includes(String(status || '').toLowerCase()); }

  function actions(item) {
    const status = String(item.status || '').toLowerCase();
    if (terminal(status)) return '<span class="admin-tag">Final</span>';
    if (status === 'processing') {
      return `<button class="admin-action approve" data-ce7-action="pay" data-id="${esc(item.id)}">Mark paid</button><button class="admin-action reject" data-ce7-action="reject" data-id="${esc(item.id)}">Reject & refund</button>`;
    }
    return `<button class="admin-action approve" data-ce7-action="process" data-id="${esc(item.id)}">Start processing</button><button class="admin-action reject" data-ce7-action="reject" data-id="${esc(item.id)}">Reject & refund</button>`;
  }

  function visibleItems() {
    const query = state.search.trim().toLowerCase();
    return state.items.filter(item => {
      const status = String(item.status || '').toLowerCase();
      if (state.filter !== 'all' && status !== state.filter) return false;
      if (!query) return true;
      return [item.user_name, item.public_reference, item.provider, item.account_name, item.account_last4, item.status]
        .some(value => String(value || '').toLowerCase().includes(query));
    });
  }

  function detail(item) {
    if (!item) return '';
    return `<div class="admin-status-banner" data-ce7-detail>
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div><b>${esc(item.public_reference || 'Withdrawal record')}</b><br><span>${esc(item.user_name || 'User')} · ${money(item.amount)}</span></div>
        <button class="admin-btn" data-ce7-close-detail>Close</button>
      </div>
      <div style="margin-top:10px;line-height:1.7;">
        Status: <b>${esc(item.status || '')}</b><br>
        Payout account: ${esc(item.provider || 'Payout account')} •••• ${esc(item.account_last4 || '')}<br>
        Account name: ${esc(item.account_name || '—')}<br>
        Submitted: ${when(item.submitted_at)}<br>
        Processing started: ${when(item.processing_at)}<br>
        Paid: ${when(item.paid_at)}<br>
        Cancelled/rejected: ${when(item.cancelled_at)}
        ${item.user_note ? `<br>User note: ${esc(item.user_note)}` : ''}
        ${item.admin_note ? `<br>Admin note: ${esc(item.admin_note)}` : ''}
        ${item.external_withdrawal_id ? `<br>External reference: ${esc(item.external_withdrawal_id)}` : ''}
      </div>
    </div>`;
  }

  function render() {
    const host = panel();
    if (!host) return;
    const rows = visibleItems();
    const selected = state.items.find(item => item.id === state.selectedId);
    host.dataset.canonicalWithdrawalAdmin = VERSION;
    host.innerHTML = `
      <div class="ce6-head"><div><h2>Canonical Withdrawal Processing</h2><small>Atomic status transitions · masked payout records</small></div><button class="admin-btn" data-ce7-refresh>Refresh</button></div>
      <div class="admin-status-banner"><b>Module 7B:</b> Filter, inspect and process canonical withdrawal records. Financial transitions remain enforced by the verified V5 backend.</div>
      <div class="admin-filter-row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <select data-ce7-filter style="min-width:160px;">
          ${['all','submitted','sharing_required','kyc_required','under_review','needs_action','processing','paid','completed','rejected','declined','cancelled'].map(status => `<option value="${status}" ${state.filter===status?'selected':''}>${status.replaceAll('_',' ')}</option>`).join('')}
        </select>
        <input data-ce7-search value="${esc(state.search)}" placeholder="Search user, reference or account" style="flex:1;min-width:220px;">
        <button class="admin-btn" data-ce7-clear>Clear</button>
      </div>
      ${detail(selected)}
      <div class="admin-list">${rows.map(item => `
        <div class="admin-row" data-ce7-row="${esc(item.id)}">
          <div class="admin-row-main" data-ce7-open="${esc(item.id)}" style="cursor:pointer;">
            <div class="admin-row-title">${esc(item.user_name || 'User')} · ${money(item.amount)} <span class="admin-tag">${esc(item.status)}</span></div>
            <div class="admin-row-sub">${esc(item.public_reference || '')} · ${esc(item.provider || 'Payout account')} •••• ${esc(item.account_last4 || '')}<br>${esc(item.account_name || '')} · Submitted ${when(item.submitted_at)}${item.admin_note ? `<br>Admin note: ${esc(item.admin_note)}` : ''}</div>
          </div>
          <div class="admin-head-actions">${actions(item)}</div>
        </div>`).join('') || '<div class="admin-empty">No withdrawal records match this filter.</div>'}</div>`;
  }

  async function load(force = false) {
    if (state.loading) return;
    if (!force && state.items.length && Date.now() - state.lastLoadedAt < 5000) { render(); return; }
    const host = panel();
    if (!host) return;
    state.loading = true;
    host.innerHTML = '<div class="admin-empty">Loading canonical withdrawals…</div>';
    try {
      const data = await rpc('chatearn_admin_list_withdrawals_v5', { p_status: null, p_limit: 200, p_offset: 0 });
      if (!data?.ok || !Array.isArray(data.items)) throw new Error('Invalid withdrawal list response.');
      state.items = data.items;
      state.lastLoadedAt = Date.now();
      if (state.selectedId && !state.items.some(item => item.id === state.selectedId)) state.selectedId = null;
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
      state.selectedId = id;
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
    if (!content || content.dataset.ce7Installed === '1') return Boolean(content);
    content.dataset.ce7Installed = '1';

    document.addEventListener('click', event => {
      const tab = event.target.closest('[data-ce6-tab="withdrawals"], [data-tab="withdrawals"]');
      if (tab) setTimeout(() => load(true), 0);
      const refresh = event.target.closest('[data-ce7-refresh]');
      if (refresh) { event.preventDefault(); load(true); return; }
      const clear = event.target.closest('[data-ce7-clear]');
      if (clear) { state.filter='all'; state.search=''; state.selectedId=null; render(); return; }
      const close = event.target.closest('[data-ce7-close-detail]');
      if (close) { state.selectedId=null; render(); return; }
      const open = event.target.closest('[data-ce7-open]');
      if (open) { state.selectedId=open.dataset.ce7Open; render(); return; }
      const action = event.target.closest('[data-ce7-action]');
      if (action) { event.preventDefault(); transition(action); }
    }, true);

    document.addEventListener('change', event => {
      const filter = event.target.closest('[data-ce7-filter]');
      if (filter) { state.filter=filter.value; state.selectedId=null; render(); }
    }, true);

    document.addEventListener('input', event => {
      const search = event.target.closest('[data-ce7-search]');
      if (search) { state.search=search.value; state.selectedId=null; render(); }
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

  const timer = setInterval(() => { if (install()) clearInterval(timer); }, 250);
  setTimeout(() => clearInterval(timer), 20000);

  window.ChatEarnAdminWithdrawalsV5 = Object.freeze({
    version: VERSION,
    refresh: () => load(true),
    diagnostic: () => ({
      version: VERSION,
      adminClientReady: Boolean(window.ceAdminClient?.rpc),
      panelPresent: Boolean(panel()),
      canonicalPanelActive: panel()?.dataset.canonicalWithdrawalAdmin === VERSION,
      filtersReady: Boolean(panel()?.querySelector('[data-ce7-filter]')),
      detailsReady: Boolean(state.selectedId),
      canonicalRpcs: ['chatearn_admin_list_withdrawals_v5','chatearn_admin_transition_withdrawal_v5']
    })
  });

  console.info(`[ChatEarn] Module ${VERSION} canonical admin withdrawal integration loaded`);
})();