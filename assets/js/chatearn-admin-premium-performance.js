/* ChatEarn premium admin performance override v1.0.0 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_PREMIUM_ADMIN_OVERRIDE__) return;
  window.__CHAT_EARN_PREMIUM_ADMIN_OVERRIDE__ = true;

  const MAX_ROWS = 50;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

  function installStyle() {
    if ($('#cePremiumAdminStyle')) return;
    const style = document.createElement('style');
    style.id = 'cePremiumAdminStyle';
    style.textContent = `
      #adminModal{background:linear-gradient(180deg,#f7f9fc 0%,#eef3f8 100%)!important;color:#142033!important}
      #adminModal .admin-sheet,#adminModal .admin-card,#adminModal .admin-panel{color:#142033}
      #adminModal .admin-topbar{background:#ffffff!important;border-bottom:1px solid #dce5ef!important;box-shadow:0 10px 30px rgba(31,48,73,.08)}
      #adminModal .admin-tabs{background:#ffffff!important;border:1px solid #dce5ef!important;border-radius:16px!important;padding:6px!important;gap:6px!important}
      #adminModal .admin-tab{background:transparent!important;color:#5a687a!important;border:0!important;border-radius:11px!important;font-weight:800!important}
      #adminModal .admin-tab.active{background:#1264e8!important;color:#fff!important;box-shadow:0 8px 20px rgba(18,100,232,.24)}
      #adminModal .admin-panel{background:transparent!important}
      #adminModal .ce6-head h2,#adminModal h1,#adminModal h2,#adminModal h3{color:#142033!important}
      #adminModal .ce6-head small,#adminModal .admin-row-sub,#adminModal small,#adminModal p{color:#6d7a8b!important}
      #adminModal .admin-row,#adminModal .ce6-manager-card,#adminModal .ce6-card,#adminModal .ce6-two>div,#adminModal .admin-table-wrap{background:#fff!important;border:1px solid #dfe7f0!important;box-shadow:0 8px 24px rgba(31,48,73,.06)!important;border-radius:16px!important}
      #adminModal .admin-btn.primary,#adminModal .ce6-manager-actions .primary{background:#1264e8!important;color:#fff!important;border-color:#1264e8!important}
      #adminModal .admin-btn,#adminModal button{font-weight:800}
      #adminModal .ce6-manager-note,#adminModal .legacy-explainer{display:none!important}
      #adminModal .ce6-grid{grid-template-columns:repeat(auto-fit,minmax(145px,1fr))!important}
      #adminModal .ce6-card b{color:#142033!important}
      #adminModal .ce6-card span{color:#6d7a8b!important}
      #adminModal .ce-real-performance-list{display:grid;gap:10px;margin-top:14px}
      #adminModal .ce-real-user{background:#fff;border:1px solid #dfe7f0;border-radius:16px;padding:14px;box-shadow:0 8px 24px rgba(31,48,73,.05)}
      #adminModal .ce-real-user-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      #adminModal .ce-real-user b{color:#142033}
      #adminModal .ce-real-user small{display:block;margin-top:3px;color:#7b8797}
      #adminModal .ce-real-user-time{white-space:nowrap;color:#1264e8;font-weight:900}
      #adminModal .ce-real-steps{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
      #adminModal .ce-real-step{font-size:11px;padding:6px 9px;border-radius:999px;background:#eef4ff;color:#31547b;font-weight:800}
      #adminModal .ce-real-step.done{background:#e8f8ef;color:#16724a}
      #adminModal .ce-real-step.muted{background:#f1f3f6;color:#8a95a3}
      @media(max-width:640px){#adminModal .ce6-two{grid-template-columns:1fr!important}#adminModal .admin-tabs{overflow-x:auto!important;flex-wrap:nowrap!important}}
    `;
    document.head.appendChild(style);
  }

  function removeLongCopy() {
    $$('p,div', $('#adminModal') || document).forEach(node => {
      const text = clean(node.textContent);
      if (/^Simple meaning:/i.test(text) || /^Period performance:/i.test(text)) {
        node.classList.add('legacy-explainer');
      }
    });
  }

  function capRenderedRows() {
    ['#ce6-live .admin-row', '#ce6-performance .ce-real-user', '#ce6-users .admin-row'].forEach(selector => {
      $$(selector).slice(MAX_ROWS).forEach(node => node.remove());
    });
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Number(seconds || 0));
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  }

  function step(label, done) {
    return `<span class="ce-real-step ${done ? 'done' : 'muted'}">${label}</span>`;
  }

  async function loadRealPerformance() {
    const panel = $('#ce6-performance');
    const client = window.ceAdminClient;
    if (!panel || !client?.rpc || panel.dataset.ceRealLoading === '1') return;
    panel.dataset.ceRealLoading = '1';

    try {
      const { data, error } = await client.rpc('chatearn_v6_admin_recent_performance', { p_limit: MAX_ROWS });
      if (error) throw error;
      const rows = Array.isArray(data?.rows) ? data.rows.slice(0, MAX_ROWS) : [];
      const list = `<section><div class="ce6-head"><div><h2>Recent User Performance</h2><small>Latest 50 real users only</small></div></div><div class="ce-real-performance-list">${rows.map(r => `
        <article class="ce-real-user">
          <div class="ce-real-user-top"><div><b>${clean(r.display_name || r.email || 'Anonymous visitor')}</b><small>${clean(r.email || r.visitor_id || '')}</small></div><span class="ce-real-user-time">${formatDuration(r.total_seconds)} total</span></div>
          <div class="ce-real-steps">
            ${step('Registered', r.registered)}
            ${step('Chatted', Number(r.messages || 0) > 0)}
            ${step('Ad shown', Number(r.ad_views || 0) > 0)}
            ${step('Ad opened', Number(r.ad_clicks || 0) > 0)}
            ${step('Shared', r.shared)}
            ${step('KYC', r.kyc_reached)}
            ${step('Processing', r.processing_reached)}
            ${step('Returned', r.returned_after_processing)}
          </div>
          <small>${Number(r.sessions || 0)} session${Number(r.sessions || 0) === 1 ? '' : 's'} · ${Number(r.messages || 0)} messages · ${Number(r.ad_views || 0)} ad views · ${Number(r.ad_clicks || 0)} ad opens</small>
        </article>`).join('') || '<div class="admin-empty">No recorded user journeys yet.</div>'}</div></section>`;
      panel.innerHTML = list;
    } catch (_) {
      // Keep the built-in performance panel when the lightweight RPC is not installed yet.
    } finally {
      panel.dataset.ceRealLoading = '0';
    }
  }

  function scan() {
    installStyle();
    removeLongCopy();
    capRenderedRows();
    const activePerformance = $('#adminTabs [data-ce6-tab="performance"].active');
    if (activePerformance) loadRealPerformance();
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest?.('[data-ce6-tab="performance"]');
    if (tab) setTimeout(loadRealPerformance, 100);
  });

  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; scan(); }, 100);
  }).observe(document.documentElement, { childList: true, subtree: true });

  scan();
  window.ChatEarnPremiumAdmin = Object.freeze({ version: '1.0.0', maxRows: MAX_ROWS, scan, loadRealPerformance });
})();
