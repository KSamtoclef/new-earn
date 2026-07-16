/* ChatEarn V6.1 — standalone operational admin */
(() => {
  'use strict';
  if (window.__CHAT_EARN_V6_1_ADMIN__) return;
  window.__CHAT_EARN_V6_1_ADMIN__ = true;

  const SUPA_URL = window.SUPABASE_URL || 'https://dtjxcgzpwemdgdeinkcl.supabase.co';
  const SUPA_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0anhjZ3pwd2VtZGdkZWlua2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDg0ODQsImV4cCI6MjA5MzQ4NDQ4NH0.kGjtOZfK7onzr-3FVMuSljiJ3emllxtGdepxrFVUPPM';
  const client = supabase.createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'chatearn-admin-v6-auth' }
  });
  window.ceAdminClient = client;

  const state = {
    tab: 'overview', range: 'today', journeyOffset: 0, userOffset: 0,
    selected: { withdrawals: new Set(), kyc: new Set() },
    cache: new Map(), shellReady: false, loading: false
  };

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Number(n || 0).toLocaleString();
  const pct = n => `${Math.max(0, Math.min(100, Number(n || 0))).toFixed(1).replace('.0','')}%`;
  const dur = n => {
    const s = Math.max(0, Number(n || 0));
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.floor(s/60)}m ${Math.round(s%60)}s`;
    return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
  };
  const time = v => v ? new Date(v).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) : '—';
  const notify = msg => window.showToast ? window.showToast(msg) : alert(msg);

  async function rpc(name, args = {}) {
    let result = await client.rpc(name, args);
    if (result.error && /jwt|session|auth/i.test(result.error.message || '')) {
      await client.auth.refreshSession();
      result = await client.rpc(name, args);
    }
    if (result.error) throw result.error;
    return typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
  }

  function showError(message = '') {
    const el = $('adminError');
    if (!el) return;
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
  }

  function setStatus(text, mode = 'connected') {
    const t = $('adminRealtimeText');
    const d = $('adminRealtimeDot');
    if (t) t.textContent = text;
    if (d) d.className = `admin-live-dot ${mode}`;
    const u = $('adminLastUpdated');
    if (u) u.textContent = `Updated ${new Date().toLocaleTimeString('en-NG',{timeZone:'Africa/Lagos'})} WAT`;
  }

  function ranges() {
    return `<div class="ce6-ranges">${[
      ['today','Today'],['yesterday','Yesterday'],['7d','Last 7 Days'],['30d','Last 30 Days']
    ].map(([k,l]) => `<button data-range="${k}" class="${state.range===k?'active':''}">${l}</button>`).join('')}</div>`;
  }

  function head(title, withRange = true) {
    return `<div class="ce6-head"><div><h2>${esc(title)}</h2><small>Real database activity · Africa/Lagos</small></div>${withRange?ranges():''}</div>`;
  }

  function card(value, label, sub = '') {
    return `<div class="ce6-card"><b>${esc(value)}</b><span>${esc(label)}</span>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
  }

  function qualityLabel(score) {
    const n = Number(score || 0);
    if (n >= 80) return ['Excellent','excellent'];
    if (n >= 65) return ['Strong','strong'];
    if (n >= 45) return ['Developing','developing'];
    return ['Needs data','weak'];
  }

  function buildShell() {
    if (state.shellReady) return true;
    const tabs = $('adminTabs');
    const content = $('adminContent');
    if (!tabs || !content) return false;

    tabs.innerHTML = [
      ['overview','Overview'],['live','Live'],['journeys','Journeys'],['performance','Performance'],
      ['offers','Offers & Tasks'],['withdrawals','Withdrawals'],['kyc','KYC'],['users','Users'],['system','System']
    ].map(([k,l],i) => `<button type="button" class="admin-tab ${i===0?'active':''}" data-ce6-tab="${k}">${l}</button>`).join('');

    content.querySelectorAll('.admin-panel').forEach(p => p.remove());
    content.insertAdjacentHTML('beforeend', [
      'overview','live','journeys','performance','offers','withdrawals','kyc','users','system'
    ].map((k,i) => `<section class="admin-panel ${i===0?'active':''}" id="ce6-${k}"></section>`).join(''));

    tabs.addEventListener('click', e => {
      const button = e.target.closest('[data-ce6-tab]');
      if (!button) return;
      switchTab(button.dataset.ce6Tab, button);
    });

    content.addEventListener('click', handleClick);
    content.addEventListener('change', handleChange);
    content.addEventListener('submit', handleSubmit);
    state.shellReady = true;
    return true;
  }

  function panel(name) { return $(`ce6-${name}`); }

  async function switchTab(name, button) {
    state.tab = name;
    document.querySelectorAll('[data-ce6-tab]').forEach(b => b.classList.toggle('active', b === button));
    document.querySelectorAll('#adminContent .admin-panel').forEach(p => p.classList.remove('active'));
    panel(name)?.classList.add('active');
    await load(name);
  }

  async function load(name = state.tab) {
    if (state.loading) return;
    state.loading = true;
    showError('');
    setStatus('Loading current data…','connecting');
    try {
      if (name === 'overview') await loadOverview();
      else if (name === 'live') await loadLive();
      else if (name === 'journeys') await loadJourneys();
      else if (name === 'performance') await loadPerformance();
      else if (name === 'offers') await loadOffers();
      else if (name === 'withdrawals' || name === 'kyc') await loadQueue(name);
      else if (name === 'users') await loadUsers();
      else if (name === 'system') await loadSystem();
      setStatus('Live · V6.1 lightweight','connected');
    } catch (error) {
      showError(error.message || String(error));
      setStatus('Refresh failed','disconnected');
    } finally {
      state.loading = false;
    }
  }

  async function loadOverview() {
    const d = await rpc('chatearn_v6_admin_overview',{p_range:state.range});
    const k = d.kpis || {}, x = d.detail || {}, c = d.conversion || {}, q = d.v6 || {};
    const [qlabel,qclass] = qualityLabel(q.engagement_quality_score);
    panel('overview').innerHTML = head('Overview') + `
      <div class="ce6-quality-hero ${qclass}">
        <div><small>ENGAGEMENT QUALITY</small><strong>${fmt(q.engagement_quality_score)}/100</strong><span>${qlabel}</span></div>
        <div class="ce6-quality-grid">
          ${card(dur(q.median_away_seconds),'Median away')}
          ${card(fmt(q.meaningful_stays),'Meaningful stays')}
          ${card(fmt(q.completed_cycles),'Completed cycles')}
          ${card(fmt(q.offer_returns),'Offer returns')}
        </div>
      </div>
      <div class="ce6-grid">
        ${card(fmt(k.online_now),'Online now')}
        ${card(fmt(k.unique_browsers),'Unique browsers')}
        ${card(fmt(k.sessions),'Sessions')}
        ${card(fmt(k.site_entries),'Site entries')}
        ${card(fmt(k.registrations),'Registrations')}
        ${card(fmt(k.returning_browsers),'Returning browsers')}
        ${card(fmt(k.messages),'User messages')}
        ${card(fmt(k.offer_opens),'Offer opens')}
        ${card(fmt(k.offer_returns),'Offer returns')}
        ${card(fmt(k.share_opens),'WhatsApp opens')}
        ${card(fmt(k.withdrawals),'Withdrawals')}
        ${card(fmt(k.processing_reached),'Processing reached')}
      </div>
      <h3 class="ce6-section-title">Activity quality</h3>
      <div class="ce6-grid detail">
        ${card(fmt(x.new_browsers),'New browsers',`${fmt(x.returning_seen)} previously seen`)}
        ${card(fmt(x.registered_users),'Unique registrations',`${fmt(x.registration_starts)} started`)}
        ${card(fmt(x.chat_users),'Active chat users',`${fmt(x.avg_messages_per_chatter)} avg messages`)}
        ${card(fmt(x.unique_offer_openers),'Unique offer openers',`${fmt(x.offer_impressions)} impressions`)}
        ${card(fmt(x.share_users),'WhatsApp users',`${fmt(x.share_returns)} returns`)}
        ${card(fmt(x.withdrawal_users),'Withdrawal users',`${fmt(x.processing_users)} processing`)}
        ${card(dur(x.avg_session_seconds),'Average session span',`${fmt(x.sessions_over_60s)} over 1 min`)}
        ${card(fmt(x.active_registered_users),'Active registered',`${fmt(x.anonymous_active_users)} anonymous`)}
      </div>
      <h3 class="ce6-section-title">Conversion</h3>
      <div class="ce6-conversions">
        ${Object.entries(c).map(([key,value]) => `<div><b>${pct(value)}</b><span>${esc(key.replaceAll('_',' → '))}</span></div>`).join('')}
      </div>`;
  }

  async function loadLive() {
    const d = await rpc('chatearn_v6_admin_live',{p_limit:120});
    panel('live').innerHTML = head('Live Visitors',false) + `<div class="admin-list">${
      (d.rows || []).map(r => `<div class="admin-row"><div><b>${esc(r.display_name)}</b> <span class="admin-tag ${r.is_visible?'':'warn'}">${r.is_visible?'Visible':'Away'}</span>
      <div class="admin-row-sub">${esc(r.page||'unknown')} · ${esc(r.device||'')} ${esc(r.browser||'')} · ${dur(r.session_seconds)} session · heartbeat ${dur(r.heartbeat_age)} ago</div></div></div>`).join('')
      || '<div class="admin-empty">Nobody active in the last 10 minutes.</div>'
    }</div>`;
  }

  function journeyText(r) {
    const a = [];
    if (r.registrations) a.push('Registered');
    if (r.chat_opens) a.push(`Opened chat ${fmt(r.chat_opens)}×`);
    if (r.messages) a.push(`Sent ${fmt(r.messages)} messages`);
    if (r.offer_opens) a.push(`Opened ${fmt(r.offer_opens)} offers`);
    if (r.offer_returns) a.push(`Returned ${fmt(r.offer_returns)}×`);
    if (r.share_opens) a.push(`Opened WhatsApp ${fmt(r.share_opens)}×`);
    if (r.withdrawal_submitted) a.push('Submitted withdrawal');
    if (r.kyc_clicked) a.push('Opened KYC');
    if (r.processing_reached) a.push('Reached processing');
    return a.join(' → ') || 'Viewed the site';
  }

  async function loadJourneys() {
    const d = await rpc('chatearn_v6_admin_journeys',{p_range:state.range,p_limit:25,p_offset:state.journeyOffset});
    panel('journeys').innerHTML = head('User Journeys') + `<div class="admin-list">${
      (d.rows || []).map(r => `<button class="ce6-journey" data-journey="${esc(r.identity_key)}"><div><b>${esc(r.display_name)}</b><small>${esc(r.email||r.visitor_id||'')}</small></div><p>${esc(journeyText(r))}</p><span>${dur(r.activity_span_seconds)} activity span · Open timeline →</span></button>`).join('')
      || '<div class="admin-empty">No meaningful journeys.</div>'
    }</div><div class="ce6-pager"><button data-page="prev" ${state.journeyOffset===0?'disabled':''}>Previous</button><button data-page="next" ${(d.rows||[]).length<25?'disabled':''}>Next</button></div><div id="ce6JourneyModal"></div>`;
  }

  async function openJourney(identity) {
    const box = $('ce6JourneyModal');
    if (!box) return;
    box.innerHTML = '<div class="ce6-modal"><p>Loading timeline…</p></div>';
    const d = await rpc('chatearn_v6_admin_journey_detail',{p_identity:identity,p_range:state.range});
    box.innerHTML = `<div class="ce6-modal"><button data-close-modal>×</button><h3>Detailed Journey</h3>${
      (d.timeline||[]).map(x => `<div class="ce6-event"><time>${time(x.at)}</time><b>${esc(x.action)}</b><span>${esc(x.page||x.placement||'')}${x.seconds_away!=null?` · away ${dur(x.seconds_away)}`:''}</span></div>`).join('')
      || '<p>No events.</p>'
    }</div>`;
  }

  async function loadPerformance() {
    const [d,m] = await Promise.all([
      rpc('chatearn_v6_admin_performance',{p_range:state.range}),
      rpc('chatearn_v6_admin_offer_task_manager',{p_range:state.range})
    ]);
    panel('performance').innerHTML = head('Performance') + `
      <div class="ce6-two">
        <div><h3>Funnel</h3>${(d.funnel||[]).map((x,i,a)=>`<div class="ce6-funnel"><b>${esc(x.stage)}</b><span>${fmt(x.value)}</span><i style="width:${a[0]?.value?Math.max(2,100*x.value/a[0].value):0}%"></i></div>`).join('')}</div>
        <div><h3>Pages</h3>${(d.pages||[]).map(x=>`<div class="admin-row"><b>${esc(x.page)}</b><span>${fmt(x.views)} views · ${fmt(x.unique_visitors)} unique</span></div>`).join('')}</div>
      </div>
      <h3 class="ce6-section-title">Offer engagement quality</h3>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Offer</th><th>Quality</th><th>Unique CTR</th><th>Return</th><th>Meaningful</th><th>Median away</th><th>Cycles</th></tr></thead><tbody>
      ${(m.offers||[]).map(o=>`<tr><td>${esc(o.name)}</td><td><b>${fmt(o.quality_score)}/100</b></td><td>${pct(o.unique_ctr)}</td><td>${pct(o.return_rate)}</td><td>${pct(o.meaningful_rate)}</td><td>${dur(o.median_away_seconds)}</td><td>${fmt(o.completed_cycles)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  function offerForm(o={}) {
    return `<form class="ce6-form" id="ce6OfferForm">
      <input name="key" placeholder="offer_key" value="${esc(o.offer_key||'')}" ${o.offer_key?'readonly':''} required>
      <input name="name" placeholder="Internal name" value="${esc(o.name||'')}" required>
      <input name="url" type="url" placeholder="https://..." value="${esc(o.url||'')}" required>
      <input name="order" type="number" min="1" max="100" value="${Number(o.display_order||10)}" title="Display order">
      <select name="audience"><option value="all">All users</option><option value="new">New users</option><option value="returning">Returning users</option></select>
      <input name="placements" value="${esc((o.placements||['all']).join(','))}" placeholder="all,dashboard,returning">
      <input name="threshold" type="number" min="1" max="3600" value="${Number(o.quality_threshold_seconds||30)}" placeholder="Quality seconds">
      <input name="maxExposure" type="number" min="1" max="100" value="${Number(o.max_exposures_per_user||1)}" placeholder="Max/user">
      <input name="cooldown" type="number" min="0" max="720" value="${Number(o.cooldown_hours||0)}" placeholder="Cooldown hours">
      <textarea name="notes" placeholder="Internal notes">${esc(o.notes||'')}</textarea>
      <label><input name="active" type="checkbox" ${o.active!==false?'checked':''}> Active</label>
      <button class="admin-btn primary">Save offer</button>
      <button type="button" class="admin-btn" data-cancel-form>Cancel</button>
    </form>`;
  }

  function taskForm(t={}) {
    return `<form class="ce6-form" id="ce6TaskForm">
      <input name="key" placeholder="task_key" value="${esc(t.task_key||'')}" ${t.task_key?'readonly':''} required>
      <input name="title" placeholder="Task title" value="${esc(t.title||'')}" required>
      <input name="subtitle" placeholder="Description" value="${esc(t.subtitle||'')}">
      <input name="button" placeholder="Button text" value="${esc(t.button_text||'Continue')}" required>
      <select name="type">${['chat_continue','chat_new','chat_sprint','share','offer'].map(x=>`<option value="${x}" ${t.task_type===x?'selected':''}>${x}</option>`).join('')}</select>
      <input name="required" type="number" min="1" max="100" value="${Number(t.required_count||1)}">
      <input name="reward" type="number" min="0" value="${Number(t.reward_amount||0)}">
      <input name="minvisit" type="number" min="1" value="${Number(t.min_visit||2)}">
      <input name="order" type="number" min="1" max="100" value="${Number(t.display_order||10)}">
      <input name="cooldown" type="number" min="0" max="720" value="${Number(t.cooldown_hours||0)}" placeholder="Cooldown hours">
      <input name="maxDaily" type="number" min="1" max="100" value="${Number(t.max_daily_completions||1)}" placeholder="Daily max">
      <input name="linkedOffer" value="${esc(t.linked_offer_key||'')}" placeholder="Optional linked offer key">
      <textarea name="notes" placeholder="Internal notes">${esc(t.notes||'')}</textarea>
      <label><input name="active" type="checkbox" ${t.active!==false?'checked':''}> Active</label>
      <button class="admin-btn primary">Save task</button>
      <button type="button" class="admin-btn" data-cancel-form>Cancel</button>
    </form>`;
  }

  async function loadOffers() {
    const d = await rpc('chatearn_v6_admin_offer_task_manager',{p_range:state.range});
    state.cache.set('manager',d);
    panel('offers').innerHTML = head('Offers & Tasks') + `
      <div class="ce6-manager-actions"><button class="admin-btn primary" data-add-offer>Add offer</button><button class="admin-btn primary" data-add-task>Add task</button></div>
      <div id="ce6Editor"></div>
      <h3 class="ce6-section-title">Offers</h3>
      <div class="ce6-manager-list">${(d.offers||[]).map(o=>{
        const [label,cls]=qualityLabel(o.quality_score);
        return `<article class="ce6-manager-card ${o.archived_at?'archived':''}">
          <div class="ce6-manager-top"><div><b>${esc(o.name)}</b><small>${esc(o.offer_key)} · ${o.active?'Active':'Paused'}${o.archived_at?' · Archived':''}</small></div><span class="ce6-score ${cls}">${fmt(o.quality_score)}/100 ${label}</span></div>
          <p>${esc(o.url)}</p>
          <div class="ce6-metrics"><span>${pct(o.unique_ctr)} CTR</span><span>${pct(o.return_rate)} return</span><span>${pct(o.meaningful_rate)} meaningful</span><span>${dur(o.median_away_seconds)} median</span><span>${fmt(o.completed_cycles)} cycles</span></div>
          <div class="ce6-card-actions">
            <button data-edit-offer="${esc(o.offer_key)}">Edit</button>
            <button data-offer-action="${o.active?'pause':'resume'}" data-key="${esc(o.offer_key)}">${o.active?'Pause':'Resume'}</button>
            <button data-offer-action="duplicate" data-key="${esc(o.offer_key)}">Duplicate</button>
            <button data-offer-action="move_up" data-key="${esc(o.offer_key)}">↑</button>
            <button data-offer-action="move_down" data-key="${esc(o.offer_key)}">↓</button>
            <button data-offer-action="${o.archived_at?'restore':'archive'}" data-key="${esc(o.offer_key)}">${o.archived_at?'Restore':'Archive'}</button>
            <button class="danger" data-offer-action="delete" data-key="${esc(o.offer_key)}">Delete</button>
          </div>
        </article>`;
      }).join('')||'<div class="admin-empty">No offers.</div>'}</div>
      <h3 class="ce6-section-title">Tasks</h3>
      <div class="ce6-manager-list">${(d.tasks||[]).map(t=>`<article class="ce6-manager-card ${t.archived_at?'archived':''}">
        <div class="ce6-manager-top"><div><b>${esc(t.title)}</b><small>${esc(t.task_key)} · ${esc(t.task_type)} · ${t.active?'Active':'Paused'}${t.archived_at?' · Archived':''}</small></div><span>${pct(t.completion_rate)} complete</span></div>
        <p>${esc(t.subtitle||'')}</p>
        <div class="ce6-metrics"><span>${fmt(t.assignments)} assignments</span><span>${fmt(t.completions)} completed</span><span>₦${fmt(t.reward_amount)} reward</span><span>${fmt(t.required_count)} required</span></div>
        <div class="ce6-card-actions">
          <button data-edit-task="${esc(t.task_key)}">Edit</button>
          <button data-task-action="${t.active?'pause':'resume'}" data-key="${esc(t.task_key)}">${t.active?'Pause':'Resume'}</button>
          <button data-task-action="duplicate" data-key="${esc(t.task_key)}">Duplicate</button>
          <button data-task-action="move_up" data-key="${esc(t.task_key)}">↑</button>
          <button data-task-action="move_down" data-key="${esc(t.task_key)}">↓</button>
          <button data-task-action="${t.archived_at?'restore':'archive'}" data-key="${esc(t.task_key)}">${t.archived_at?'Restore':'Archive'}</button>
          <button class="danger" data-task-action="delete" data-key="${esc(t.task_key)}">Delete</button>
        </div>
      </article>`).join('')||'<div class="admin-empty">No tasks.</div>'}</div>`;
  }

  async function loadQueue(kind) {
    const d = await rpc('chatearn_v6_admin_queue',{p_kind:kind,p_status:'pending',p_limit:50,p_offset:0});
    state.selected[kind].clear();
    panel(kind).innerHTML = head(kind==='kyc'?'KYC Queue':'Withdrawal Queue',false) + `
      <div class="ce6-bulk"><label><input type="checkbox" data-select-all="${kind}"> Select page</label><span id="ce6Selected-${kind}">0 selected</span><button data-bulk="${kind}" data-status="approved">Approve</button><button class="danger" data-bulk="${kind}" data-status="rejected">Reject</button></div>
      <div class="admin-list">${(d.rows||[]).map(r=>`<label class="admin-row ce6-select"><input type="checkbox" data-select="${kind}" value="${r.id}"><div><b>${esc(r.full_name||r.account_name||'User')}${kind==='withdrawals'?` · ₦${fmt(r.amount)}`:''}</b><div class="admin-row-sub">${esc(r.email||'')}${kind==='withdrawals'?` · ${esc(r.bank||'')} ${esc(r.masked_account||'')}`:` · ${r.external_opened?'External opened':'Not opened'}`}</div></div></label>`).join('')||'<div class="admin-empty">No pending records.</div>'}</div>`;
  }

  async function loadUsers() {
    const search = $('ce6UserSearch')?.value || '';
    const d = await rpc('chatearn_v6_admin_users',{p_search:search||null,p_limit:50,p_offset:state.userOffset});
    panel('users').innerHTML = head('Users',false) + `<div class="ce6-user-tools"><input id="ce6UserSearch" placeholder="Search name or email" value="${esc(search)}"><button data-user-search>Search</button></div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>User</th><th>Balance</th><th>Messages</th><th>Visits</th><th>Last active</th></tr></thead><tbody>${(d.rows||[]).map(u=>`<tr><td>${esc(u.full_name)}<br><small>${esc(u.email)}</small></td><td>₦${fmt(u.balance)}</td><td>${fmt(u.total_messages)}</td><td>${fmt(u.visit_count)}</td><td>${time(u.last_seen_at)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  async function loadSystem() {
    const d = await rpc('chatearn_v6_admin_system',{p_range:state.range,p_limit:150});
    panel('system').innerHTML = head('System') + `<div class="admin-list">${(d.rows||[]).map(x=>`<div class="admin-row"><div><b>${esc(x.event_name||'System event')}</b><div class="admin-row-sub">${time(x.created_at)} · ${esc(x.page||'')}<br>${esc(JSON.stringify(x.metadata||{})).slice(0,500)}</div></div></div>`).join('')||'<div class="admin-empty">No system events.</div>'}</div>`;
  }

  async function bulk(kind,status) {
    const ids = [...state.selected[kind]];
    if (!ids.length) return alert('Select at least one record.');
    if (ids.length > 500) return alert('Maximum 500 records.');
    if (!confirm(`${status==='approved'?'Approve':'Reject'} ${ids.length} ${kind}?`)) return;
    const note = status==='rejected' ? (prompt('Reason (optional):')||'') : '';
    const d = await rpc('chatearn_v6_admin_bulk_review',{p_kind:kind,p_ids:ids,p_status:status,p_note:note||null});
    notify(`${d.processed} processed${d.failed?` · ${d.failed} failed`:''}`);
    await loadQueue(kind);
  }

  function updateSelected(kind) {
    const el = $(`ce6Selected-${kind}`);
    if (el) el.textContent = `${state.selected[kind].size} selected`;
  }

  async function handleClick(e) {
    const range = e.target.closest('[data-range]');
    if (range) { state.range=range.dataset.range; state.journeyOffset=0; await load(state.tab); return; }
    const tabJourney = e.target.closest('[data-journey]');
    if (tabJourney) { await openJourney(tabJourney.dataset.journey); return; }
    if (e.target.closest('[data-close-modal]')) { $('ce6JourneyModal').innerHTML=''; return; }
    const page = e.target.closest('[data-page]');
    if (page) { state.journeyOffset=Math.max(0,state.journeyOffset+(page.dataset.page==='next'?25:-25)); await loadJourneys(); return; }
    const bulkBtn = e.target.closest('[data-bulk]');
    if (bulkBtn) { await bulk(bulkBtn.dataset.bulk,bulkBtn.dataset.status); return; }
    if (e.target.closest('[data-add-offer]')) { $('ce6Editor').innerHTML=offerForm(); return; }
    if (e.target.closest('[data-add-task]')) { $('ce6Editor').innerHTML=taskForm(); return; }
    if (e.target.closest('[data-cancel-form]')) { $('ce6Editor').innerHTML=''; return; }
    const eo = e.target.closest('[data-edit-offer]');
    if (eo) { const d=state.cache.get('manager'); const o=(d.offers||[]).find(x=>x.offer_key===eo.dataset.editOffer); $('ce6Editor').innerHTML=offerForm(o); return; }
    const et = e.target.closest('[data-edit-task]');
    if (et) { const d=state.cache.get('manager'); const t=(d.tasks||[]).find(x=>x.task_key===et.dataset.editTask); $('ce6Editor').innerHTML=taskForm(t); return; }
    const oa = e.target.closest('[data-offer-action]');
    if (oa) {
      const action=oa.dataset.offerAction,key=oa.dataset.key;
      if (['delete','archive'].includes(action) && !confirm(`${action} offer ${key}?`)) return;
      await rpc('chatearn_v6_admin_offer_action',{p_offer_key:key,p_action:action}); notify(`Offer ${action} completed`); await loadOffers(); return;
    }
    const ta = e.target.closest('[data-task-action]');
    if (ta) {
      const action=ta.dataset.taskAction,key=ta.dataset.key;
      if (['delete','archive'].includes(action) && !confirm(`${action} task ${key}?`)) return;
      await rpc('chatearn_v6_admin_task_action',{p_task_key:key,p_action:action}); notify(`Task ${action} completed`); await loadOffers(); return;
    }
    if (e.target.closest('[data-user-search]')) { state.userOffset=0; await loadUsers(); }
  }

  function handleChange(e) {
    const all = e.target.dataset.selectAll;
    if (all) {
      panel(all).querySelectorAll(`[data-select="${all}"]`).forEach(c => {
        c.checked=e.target.checked;
        c.checked?state.selected[all].add(c.value):state.selected[all].delete(c.value);
      });
      updateSelected(all);
    }
    const kind = e.target.dataset.select;
    if (kind) {
      e.target.checked?state.selected[kind].add(e.target.value):state.selected[kind].delete(e.target.value);
      updateSelected(kind);
    }
  }

  async function handleSubmit(e) {
    if (e.target.id === 'ce6OfferForm') {
      e.preventDefault();
      const f = new FormData(e.target);
      await rpc('chatearn_v6_admin_save_offer',{
        p_offer_key:f.get('key'),p_name:f.get('name'),p_url:f.get('url'),
        p_display_order:Number(f.get('order')||10),p_audience:f.get('audience'),
        p_placements:String(f.get('placements')||'all').split(',').map(x=>x.trim()).filter(Boolean),
        p_active:f.get('active')==='on',p_quality_threshold_seconds:Number(f.get('threshold')||30),
        p_max_exposures_per_user:Number(f.get('maxExposure')||1),p_cooldown_hours:Number(f.get('cooldown')||0),
        p_notes:f.get('notes')||null
      });
      notify('Offer saved'); $('ce6Editor').innerHTML=''; await loadOffers();
    } else if (e.target.id === 'ce6TaskForm') {
      e.preventDefault();
      const f = new FormData(e.target);
      await rpc('chatearn_v6_admin_save_task',{
        p_task_key:f.get('key'),p_title:f.get('title'),p_subtitle:f.get('subtitle')||'',
        p_button_text:f.get('button'),p_task_type:f.get('type'),
        p_required_count:Number(f.get('required')||1),p_reward_amount:Number(f.get('reward')||0),
        p_min_visit:Number(f.get('minvisit')||2),p_display_order:Number(f.get('order')||10),
        p_active:f.get('active')==='on',p_cooldown_hours:Number(f.get('cooldown')||0),
        p_max_daily_completions:Number(f.get('maxDaily')||1),p_linked_offer_key:f.get('linkedOffer')||null,
        p_notes:f.get('notes')||null
      });
      notify('Task saved'); $('ce6Editor').innerHTML=''; await loadOffers();
    }
  }

  window.openAdmin = async function() {
    const shell = $('adminShell');
    if (!shell) return;
    shell.classList.add('show');
    document.body.style.overflow='hidden';
    buildShell();
    const {data} = await client.auth.getSession();
    $('adminLoginBox').style.display=data?.session?'none':'block';
    $('adminContent').style.display=data?.session?'block':'none';
    if (data?.session) await load('overview');
  };

  window.closeAdmin = function() {
    $('adminShell')?.classList.remove('show');
    document.body.style.overflow='';
    if (location.hash==='#admin') history.replaceState(null,'',location.pathname+location.search);
  };

  window.adminLogin = async function() {
    const email=$('adminEmail')?.value.trim(),password=$('adminPass')?.value||'',button=$('adminLoginBtn');
    if (!email || !password) return showError('Enter administrator email and password.');
    button.disabled=true; button.textContent='Signing in…';
    try {
      const {error}=await client.auth.signInWithPassword({email,password});
      if (error) throw error;
      await rpc('chatearn_v3_admin_is_admin');
      $('adminLoginBox').style.display='none'; $('adminContent').style.display='block';
      buildShell(); await load('overview');
    } catch(error) {
      await client.auth.signOut();
      showError(error.message||String(error));
    } finally { button.disabled=false; button.textContent='Open Admin Panel'; }
  };

  window.adminLogout = async function() {
    await client.auth.signOut();
    $('adminContent').style.display='none'; $('adminLoginBox').style.display='block';
  };

  window.refreshAdmin = () => load(state.tab);
  window.adminSwitchTab = (event,name,button) => { event?.preventDefault(); switchTab(name,button); return false; };

  function init() {
    const version=document.querySelector('.admin-brand small');
    if(version)version.textContent='v6.1';
    if(location.hash==='#admin') setTimeout(window.openAdmin,100);
    window.addEventListener('hashchange',()=>{if(location.hash==='#admin')window.openAdmin();});
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
