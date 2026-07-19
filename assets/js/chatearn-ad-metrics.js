(() => {
  'use strict';
  if (window.__CE_AD_METRICS__) return;
  window.__CE_AD_METRICS__ = true;

  let busy = false;

  function numberFrom(offer, keys) {
    for (const key of keys) {
      const value = Number(offer?.[key]);
      if (Number.isFinite(value)) return value;
    }
    return 0;
  }

  async function refreshMetrics() {
    const list = document.getElementById('ceAdsList');
    const client = window.ceAdminClient;
    if (!list || !client?.rpc || busy) return;
    busy = true;
    try {
      const { data, error } = await client.rpc('chatearn_v6_admin_manager_inventory');
      if (error) throw error;
      const payload = typeof data === 'string' ? JSON.parse(data) : data;
      const offers = Array.isArray(payload?.offers) ? payload.offers : [];

      for (const offer of offers) {
        const edit = [...list.querySelectorAll('[data-edit]')]
          .find(button => button.dataset.edit === String(offer.offer_key));
        const card = edit?.closest('.ce-card');
        if (!card) continue;

        const views = numberFrom(offer, ['impressions', 'views', 'ad_views', 'presented']);
        const clicks = numberFrom(offer, ['opens', 'clicks', 'ad_clicks']);
        let metrics = card.querySelector('[data-ad-metrics]');
        if (!metrics) {
          metrics = document.createElement('div');
          metrics.dataset.adMetrics = '1';
          metrics.className = 'ce-ad-metrics';
          card.querySelector('small')?.insertAdjacentElement('afterend', metrics);
        }
        metrics.innerHTML = `<span>Views <b>${views.toLocaleString()}</b></span><span>Clicks <b>${clicks.toLocaleString()}</b></span>`;
      }
    } catch (_) {
      // Keep the ads manager usable when totals are unavailable.
    } finally {
      busy = false;
    }
  }

  const style = document.createElement('style');
  style.textContent = '.ce-ad-metrics{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.ce-ad-metrics span{padding:7px 10px;border:1px solid #244833;border-radius:999px;font-size:12px;color:#aab5ae}.ce-ad-metrics b{color:#fff}';
  document.head.appendChild(style);

  new MutationObserver(() => setTimeout(refreshMetrics, 80))
    .observe(document.documentElement, { childList: true, subtree: true });

  setInterval(refreshMetrics, 5000);
  void refreshMetrics();
})();
