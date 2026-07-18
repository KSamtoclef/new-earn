/* ChatEarn V4.2 — unified unique-offer router and admin offer/task manager */
(() => {
  'use strict';
  if (window.__CE_V42__) return;
  window.__CE_V42__ = true;

  const monetizationHosts = new Set(['omg10.com','jikgykm.com','www.effectivecpmnetwork.com','effectivecpmnetwork.com']);
  const returnKey = 'ce_v42_offer_open';
  let adminLoaded = false;

  const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const getVisit = () => Number(window.ceVisitInfo?.visit_number || 1);
  const getMessages = () => {
    try { if (typeof replyCount !== 'undefined') return Number(replyCount || 0); } catch (_) {}
    return Number(window.replyCount || window.ceSessionMessageCount || 0);
  };
  const getSessionId = () => {
    try { if (typeof SESSION_ID !== 'undefined') return SESSION_ID; } catch (_) {}
    return window.SESSION_ID || sessionStorage.getItem('ce_session_id') || null;
  };
  const getVisitorId = () => {
    try { if (typeof VISITOR_ID !== 'undefined') return VISITOR_ID; } catch (_) {}
    return window.VISITOR_ID || localStorage.getItem('ce_visitor_id') || null;
  };
  const getClient = preferred => {
    if (preferred?.rpc) return preferred;
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient?.rpc) return supabaseClient; } catch (_) {}
    if (window.supabaseClient?.rpc) return window.supabaseClient;
    return null;
  };

  function isMonetizationAnchor(anchor) {
    if (!anchor || anchor.tagName !== 'A' || anchor.dataset.ceV42Ignore === '1') return false;
    try { return monetizationHosts.has(new URL(anchor.href, location.href).hostname); } catch (_) { return false; }
  }

  async function rpc(name, args = {}, preferredClient = null) {
    const client = getClient(preferredClient);
    if (!client) throw new Error('Secure connection is still loading. Please try again.');
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return parse(data);
  }

  async function trackOffer(offer, type, placement, secondsAway = null, metadata = {}) {
    try {
      await rpc('chatearn_v3_track_offer_event', {
        p_offer_key: offer.offer_key,
        p_event_type: type,
        p_visitor_id: getVisitorId(),
        p_session_id: getSessionId(),
        p_placement: placement,
        p_visit_number: getVisit(),
        p_messages_before: getMessages(),
        p_seconds_away: secondsAway,
        p_metadata: metadata
      });
    } catch (error) { console.warn('V4.2 offer event:', error?.message || error); }
  }

  async function openNextOffer(placement = 'dynamic_link', sourceElement = null) {
    if (sourceElement?.classList.contains('ce-v42-loading')) return false;
    sourceElement?.classList.add('ce-v42-loading');
    try {
      const offer = await rpc('chatearn_v4_get_unique_offer', {
        p_placement: placement,
        p_visitor_id: getVisitorId(),
        p_session_id: getSessionId()
      });
      if (!offer?.available || !offer.url) {
        window.showToast?.('No fresh sponsored activity is available yet. Continue chatting.');
        return false;
      }
      const openedAt = Date.now();
      sessionStorage.setItem(returnKey, JSON.stringify({ offer_key: offer.offer_key, placement, opened_at: openedAt, visit_number: offer.visit_number }));
      await trackOffer(offer, 'open', placement, null, { source: 'v4_2_router', remaining: offer.remaining });
      const popup = window.open(offer.url, '_blank', 'noopener');
      if (!popup) {
        await trackOffer(offer, 'error', placement, null, { source: 'v4_2_router', reason: 'popup_blocked' });
        window.showToast?.('Allow pop-ups, then tap again.');
      }
      return false;
    } catch (error) {
      console.warn('V4.2 router:', error?.message || error);
      window.showToast?.(error?.message || 'This activity could not open. Please try again.');
      return false;
    } finally { sourceElement?.classList.remove('ce-v42-loading'); }
  }
  window.ceV42OpenNextOffer = openNextOffer;

  document.addEventListener('click', event => {
    const anchor = event.target.closest('a');
    if (!isMonetizationAnchor(anchor)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const legacy = anchor.getAttribute('onclick') || '';
    let placement = anchor.dataset.offerPlacement || 'external_card';
    const match = legacy.match(/trackClick\(['"]([^'"]+)/);
    if (match?.[1]) placement = match[1];
    openNextOffer(placement, anchor);
  }, true);

  async function handleReturn() {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(returnKey) || 'null'); } catch (_) {}
    if (!saved?.offer_key || !saved.opened_at) return;
    const seconds = Math.round((Date.now() - Number(saved.opened_at)) / 1000);
    if (seconds < 2) return;
    sessionStorage.removeItem(returnKey);
    await trackOffer(saved, 'return', saved.placement || 'dynamic_link', seconds, { source: 'v4_2_router' });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') handleReturn(); });
  window.addEventListener('focus', handleReturn);

  function ensureAdminPanel() {
    if (document.getElementById('admin-offer-manager')) return;
    const tabs = document.getElementById('adminTabs');
    const content = document.getElementById('adminContent');
    if (!tabs || !content) return;
    const tab = document.createElement('button');
    tab.type = 'button'; tab.className = 'admin-tab'; tab.dataset.tab = 'offer-manager'; tab.textContent = 'Offers & Tasks';
    tab.onclick = event => {
      event.preventDefault();
      if (typeof window.adminSwitchTab === 'function') window.adminSwitchTab(event, 'offer-manager', tab);
      else if (typeof window.setAdminTab === 'function') window.setAdminTab('offer-manager', tab);
      loadAdminManager(); return false;
    };
    tabs.appendChild(tab);
    const panel = document.createElement('div');
    panel.className = 'admin-panel'; panel.id = 'admin-offer-manager';
    panel.innerHTML = `
      <div class="admin-status-banner">Add, rotate and pause offer links here. Users receive active links they have not already opened.</div>
      <div class="admin-two"><div><div class="admin-section-title">Add or update offer</div>
      <form id="ceV42OfferForm" class="ce-v42-admin-form">
        <input id="ceV42OfferKey" placeholder="offer_key" required><input id="ceV42OfferName" placeholder="Internal name" required>
        <input id="ceV42OfferUrl" class="wide" type="url" placeholder="https://..." required>
        <input id="ceV42OfferOrder" type="number" min="1" max="100" value="10" placeholder="Order">
        <select id="ceV42OfferAudience"><option value="all">All users</option><option value="new">New users</option><option value="returning">Returning users</option></select>
        <input id="ceV42OfferPlacements" class="wide" value="all" placeholder="Placements: all or chat_native,chat_banner,chat_half_screen">
        <button class="admin-btn primary wide" type="submit">Save Offer</button></form></div>
      <div><div class="admin-section-title">Add or update return task</div>
      <form id="ceV42TaskForm" class="ce-v42-admin-form">
        <input id="ceV42TaskKey" placeholder="task_key" required><select id="ceV42TaskType"><option value="chat_continue">Continue chat</option><option value="chat_new">New chat</option><option value="chat_sprint">Chat sprint</option><option value="share">Share</option><option value="offer">Offer</option></select>
        <input id="ceV42TaskTitle" class="wide" placeholder="Task title" required><textarea id="ceV42TaskSubtitle" class="wide" placeholder="Task description"></textarea>
        <input id="ceV42TaskButton" placeholder="Button text" required><input id="ceV42TaskRequired" type="number" min="1" max="100" value="1" placeholder="Required count">
        <input id="ceV42TaskReward" type="number" min="0" value="0" placeholder="Reward amount"><input id="ceV42TaskMinVisit" type="number" min="1" value="2" placeholder="Minimum visit">
        <input id="ceV42TaskOrder" type="number" min="1" max="100" value="10" placeholder="Order"><button class="admin-btn primary wide" type="submit">Save Task</button>
      </form></div></div>
      <div class="admin-toolbar"><div class="admin-section-title">Offer inventory</div><button class="admin-btn" id="ceV42ManagerRefresh">Refresh</button></div>
      <div class="admin-list" id="ceV42OfferList"></div><div class="admin-section-title">Returning task inventory</div><div class="admin-list" id="ceV42TaskList"></div>`;
    content.appendChild(panel);
    document.getElementById('ceV42OfferForm').addEventListener('submit', saveOffer);
    document.getElementById('ceV42TaskForm').addEventListener('submit', saveTask);
    document.getElementById('ceV42ManagerRefresh').addEventListener('click', loadAdminManager);
  }

  async function adminRpc(name, args = {}) { return rpc(name, args, window.ceAdminClient || getClient()); }
  async function saveOffer(event) {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    try {
      await adminRpc('chatearn_v4_admin_save_offer', {
        p_offer_key: document.getElementById('ceV42OfferKey').value.trim(), p_name: document.getElementById('ceV42OfferName').value.trim(),
        p_url: document.getElementById('ceV42OfferUrl').value.trim(), p_display_order: Number(document.getElementById('ceV42OfferOrder').value || 10),
        p_audience: document.getElementById('ceV42OfferAudience').value, p_placements: document.getElementById('ceV42OfferPlacements').value.split(',').map(v => v.trim()).filter(Boolean), p_active: true
      });
      event.target.reset(); window.showToast?.('Offer saved'); await loadAdminManager();
    } catch (error) { window.showAdminError?.(error.message || String(error), true); } finally { button.disabled = false; }
  }
  async function saveTask(event) {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    try {
      await adminRpc('chatearn_v4_admin_save_task', {
        p_task_key: document.getElementById('ceV42TaskKey').value.trim(), p_title: document.getElementById('ceV42TaskTitle').value.trim(),
        p_subtitle: document.getElementById('ceV42TaskSubtitle').value, p_button_text: document.getElementById('ceV42TaskButton').value,
        p_task_type: document.getElementById('ceV42TaskType').value, p_required_count: Number(document.getElementById('ceV42TaskRequired').value || 1),
        p_reward_amount: Number(document.getElementById('ceV42TaskReward').value || 0), p_min_visit: Number(document.getElementById('ceV42TaskMinVisit').value || 2),
        p_display_order: Number(document.getElementById('ceV42TaskOrder').value || 10), p_active: true
      });
      event.target.reset(); window.showToast?.('Task saved'); await loadAdminManager();
    } catch (error) { window.showAdminError?.(error.message || String(error), true); } finally { button.disabled = false; }
  }
  window.ceV42ToggleOffer = async (key, active) => { await adminRpc('chatearn_v4_admin_toggle_offer', { p_offer_key:key, p_active:active }); await loadAdminManager(); };
  window.ceV42ToggleTask = async (key, active) => { await adminRpc('chatearn_v4_admin_toggle_task', { p_task_key:key, p_active:active }); await loadAdminManager(); };

  async function loadAdminManager() {
    const offerList = document.getElementById('ceV42OfferList'); const taskList = document.getElementById('ceV42TaskList');
    if (!offerList || !taskList) return;
    offerList.innerHTML = '<div class="admin-empty">Loading offers…</div>'; taskList.innerHTML = '<div class="admin-empty">Loading tasks…</div>';
    try {
      const data = await adminRpc('chatearn_v4_admin_offer_manager');
      offerList.innerHTML = (data.offers || []).map(o => `<div class="admin-row"><div class="admin-row-main"><div class="admin-row-title">${esc(o.name)} <span class="admin-tag ${o.active?'':'bad'}">${o.active?'Active':'Paused'}</span></div><div class="admin-row-sub ce-v42-url">${esc(o.offer_key)} · ${esc(o.url)}</div><div><span class="ce-v42-stat">Impressions ${Number(o.impressions||0)}</span><span class="ce-v42-stat">Opens ${Number(o.opens||0)}</span><span class="ce-v42-stat">Returns ${Number(o.returns||0)}</span><span class="ce-v42-stat">Unique ${Number(o.unique_openers||0)}</span></div></div><button class="admin-action ${o.active?'reject':'approve'}" onclick="ceV42ToggleOffer('${esc(o.offer_key)}',${!o.active})">${o.active?'Pause':'Activate'}</button></div>`).join('') || '<div class="admin-empty">No offers found.</div>';
      taskList.innerHTML = (data.tasks || []).map(t => `<div class="admin-row"><div class="admin-row-main"><div class="admin-row-title">${esc(t.title)} <span class="admin-tag ${t.active?'':'bad'}">${t.active?'Active':'Paused'}</span></div><div class="admin-row-sub">${esc(t.task_key)} · ${esc(t.task_type)} · Required ${Number(t.required_count||1)} · Reward ₦${Number(t.reward_amount||0).toLocaleString()}</div></div><button class="admin-action ${t.active?'reject':'approve'}" onclick="ceV42ToggleTask('${esc(t.task_key)}',${!t.active})">${t.active?'Pause':'Activate'}</button></div>`).join('') || '<div class="admin-empty">No tasks found.</div>';
      adminLoaded = true;
    } catch (error) { offerList.innerHTML = `<div class="admin-empty">${esc(error.message || error)}</div>`; taskList.innerHTML = ''; }
  }

  function bootAdmin() { ensureAdminPanel(); if (location.hash === '#admin' && !adminLoaded) setTimeout(ensureAdminPanel, 500); }
  document.addEventListener('DOMContentLoaded', bootAdmin); window.addEventListener('hashchange', bootAdmin); setTimeout(bootAdmin, 800);
})();