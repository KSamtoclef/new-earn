(() => {
  'use strict';
  if (window.__CHAT_EARN_ADMIN_METRICS__) return;
  window.__CHAT_EARN_ADMIN_METRICS__ = true;
  const client = window.ChatEarn?.client;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function readMetrics() {
    const attempts = [
      () => client.from('offer_events').select('offer_key,event_type'),
      () => client.from('chatearn_offer_events').select('offer_key,event_type')
    ];
    for (const query of attempts) {
      const { data, error } = await query();
      if (!error) return data || [];
    }
    return [];
  }

  async function render() {
    const root = document.getElementById('offerManager');
    if (!root || root.dataset.metricsReady === '1') return;
    const admin = await client.rpc('chatearn_v3_admin_is_admin');
    if (admin.error || admin.data !== true) return;
    root.dataset.metricsReady = '1';
    const box = document.createElement('div');
    box.id = 'offerMetrics';
    box.style.cssText = 'margin-top:14px';
    box.innerHTML = '<h4>Campaign performance</h4><div id="offerMetricsRows">Loading…</div>';
    root.appendChild(box);
    await refresh();
  }

  async function refresh() {
    const target = document.getElementById('offerMetricsRows');
    if (!target) return;
    const [{ data: offers, error }, events] = await Promise.all([
      client.from('offers').select('id,name,targeting').is('archived_at', null),
      readMetrics()
    ]);
    if (error) { target.textContent = error.message; return; }
    const counts = new Map();
    for (const event of events) {
      const key = String(event.offer_key || '');
      if (!counts.has(key)) counts.set(key, { views: 0, clicks: 0 });
      const row = counts.get(key);
      const type = String(event.event_type || '').toLowerCase();
      if (['view','impression','shown'].includes(type)) row.views += 1;
      if (['open','click','clicked'].includes(type)) row.clicks += 1;
    }
    target.innerHTML = (offers || []).map(offer => {
      const key = String(offer.targeting?.offer_key || offer.id);
      const count = counts.get(key) || { views: 0, clicks: 0 };
      return `<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)"><span>${esc(offer.name || key)}</span><b>${count.views} views · ${count.clicks} clicks</b></div>`;
    }).join('') || '<p>No campaigns.</p>';
  }

  function boot() {
    if (!client) return;
    new MutationObserver(() => render().catch(() => {})).observe(document.body, { childList: true, subtree: true });
    render().catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();