/* ChatEarn Module 7C: admin KYC review integration using the existing verified admin RPC boundary. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_MODULE_7C__) return;
  window.__CHAT_EARN_MODULE_7C__ = true;

  const VERSION = '7C.1';
  const state = { loading: false, acting: false, items: [], filter: 'pending', search: '', lastLoadedAt: 0 };
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

  function panel() { return byId('ce6-kyc') || byId('admin-kyc'); }
  function notify(message) { window.showToast ? window.showToast(message) : alert(message); }
  function normalizedStatus(item) { return String(item.status || 'pending').toLowerCase(); }

  function filteredItems() {
    const q = state.search.trim().toLowerCase();
    return state.items.filter(item => {
      const statusMatch = state.filter === 'all' || normalizedStatus(item) === state.filter;
      if (!statusMatch) return false;
      if (!q) return true;
      return [item.full_name, item.email, item.reference, item.public_reference, item.provider, item.external_url]
        .some(value => String(value || '').toLowerCase().includes(q));
    });
  }

  function render() {
    const host = panel();
    if (!host) return;
    host.dataset.canonicalKycAdmin = VERSION;
    const rows = filteredItems();
    host.innerHTML = `
      <div class="ce6-head"><div><h2>KYC Review</h2><small>Admin-only review through the existing protected KYC queue</small></div><button class="admin-btn" data-ce7c-refresh>Refresh</button></div>
      <div class="admin-status-banner"><b>Module 7C:</b> Review decisions are sent through the existing admin RPC boundary. No KYC record is edited directly from the browser.</div>
      <div class="ce6-user-tools" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
        <select data-ce7c-filter>
          ${['pending','approved','rejected','all'].map(status => `<option value="${status}" ${state.filter===status?'selected':''}>${status[0].toUpperCase()+status.slice(1)}</option>`).join('')}
        </select>
        <input data-ce7c-search placeholder="Search name, email or reference" value="${esc(state.search)}">
        <button class="admin-btn" data-ce7c-apply>Apply</button>
        <button class="admin-btn" data-ce7c-clear>Clear</button>
      </div>
      <div class="admin-list">${rows.map(item => {
        const status = normalizedStatus(item);
        const pending = status === 'pending';
        return `<div class="admin-row" data-ce7c-row="${esc(item.id)}">
          <div class="admin-row-main">
            <div class="admin-row-title">${esc(item.full_name || item.account_name || 'User')} <span class="admin-tag">${esc(status)}</span></div>
            <div class="admin-row-sub">${esc(item.email || '')}${item.public_reference || item.reference ? ` · ${esc(item.public_reference || item.reference)}` : ''}<br>${item.external_opened ? 'External verification opened' : 'External verification not opened'} · Created ${when(item.created_at || item.submitted_at)}${item.admin_note ? `<br>Admin note: ${esc(item.admin_note)}` : ''}</div>
          </div>
          <div class="admin-head-actions">${pending ? `<button class="admin-action approve" data-ce7c-action="approved" data-id="${esc(item.id)}">Approve</button><button class="admin-action reject" data-ce7c-action="rejected" data-id="${esc(item.id)}">Reject</button>` : '<span class="admin-tag">Reviewed</span>'}</div>
        </div>`;
      }).join('') || '<div class="admin-empty">No matching KYC records.</div>'}</div>`;
  }

  async function load(force = false) {
    if (state.loading) return;
    if (!force && state.items.length && Date.now() - state.lastLoadedAt < 5000) { render(); return; }
    const host = panel();
    if (!host) return;
    state.loading = true;
    host.innerHTML = '<div class="admin-empty">Loading KYC records…</div>';
    try {
      const status = state.filter === 'all' ? null : state.filter;
      const data = await rpc('chatearn_v6_admin_queue', { p_kind: 'kyc', p_status: status, p_limit: 100, p_offset: 0 });
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      state.items = rows;
      state.lastLoadedAt = Date.now();
      render();
    } catch (error) {
      host.innerHTML = `<div class="admin-error" style="display:block">${esc(error.message || String(error))}</div>`;
    } finally {
      state.loading = false;
    }
  }

  async function review(button) {
    if (state.acting) return;
    const id = button.dataset.id;
    const status = button.dataset.ce7cAction;
    const item = state.items.find(row => String(row.id) === String(id));
    if (!item) return notify('KYC record is no longer available. Refresh the list.');
    if (!confirm(`${status === 'approved' ? 'Approve' : 'Reject'} this KYC record?\n\n${item.full_name || item.email || id}`)) return;
    const note = (prompt(status === 'rejected' ? 'Reason for rejection:' : 'Admin note (optional):') || '').trim();
    if (status === 'rejected' && !note) return notify('A rejection reason is required.');

    state.acting = true;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Working…';
    try {
      const result = await rpc('chatearn_v6_admin_bulk_review', {
        p_kind: 'kyc', p_ids: [id], p_status: status, p_note: note || null
      });
      const failed = Number(result?.failed || 0);
      if (failed) throw new Error(result?.message || 'KYC review was not completed.');
      notify(`KYC ${status}.`);
      await load(true);
    } catch (error) {
      notify(error.message || 'KYC review failed.');
      button.disabled = false;
      button.textContent = original;
    } finally {
      state.acting = false;
    }
  }

  function activeTab() { return document.querySelector('[data-ce6-tab="kyc"].active, [data-tab="kyc"].active'); }

  function install() {
    const content = byId('adminContent');
    if (!content || window.__CHAT_EARN_MODULE_7C_INSTALLED__) return Boolean(content);
    window.__CHAT_EARN_MODULE_7C_INSTALLED__ = true;
    document.addEventListener('click', event => {
      const tab = event.target.closest('[data-ce6-tab="kyc"], [data-tab="kyc"]');
      if (tab) setTimeout(() => load(true), 0);
      if (event.target.closest('[data-ce7c-refresh]')) { event.preventDefault(); load(true); }
      if (event.target.closest('[data-ce7c-apply]')) {
        event.preventDefault();
        state.filter = document.querySelector('[data-ce7c-filter]')?.value || 'pending';
        state.search = document.querySelector('[data-ce7c-search]')?.value || '';
        load(true);
      }
      if (event.target.closest('[data-ce7c-clear]')) {
        event.preventDefault(); state.filter = 'pending'; state.search = ''; load(true);
      }
      const action = event.target.closest('[data-ce7c-action]');
      if (action) { event.preventDefault(); review(action); }
    }, true);

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled || !activeTab()) return;
      const host = panel();
      if (!host || host.dataset.canonicalKycAdmin === VERSION) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; load(true); }, 0);
    });
    observer.observe(content, { childList: true, subtree: true });
    if (activeTab()) load(true);
    return true;
  }

  const timer = setInterval(() => { if (install()) clearInterval(timer); }, 250);
  setTimeout(() => clearInterval(timer), 20000);

  window.ChatEarnAdminKyc = Object.freeze({
    version: VERSION,
    refresh: () => load(true),
    diagnostic: () => ({
      version: VERSION,
      adminClientReady: Boolean(window.ceAdminClient?.rpc),
      panelPresent: Boolean(panel()),
      protectedQueueRpc: 'chatearn_v6_admin_queue',
      protectedReviewRpc: 'chatearn_v6_admin_bulk_review',
      directTableMutation: false
    })
  });

  console.info(`[ChatEarn] Module ${VERSION} admin KYC integration loaded`);
})();
