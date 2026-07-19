(() => {
  'use strict';
  if (window.__CE_PUBLIC_TASK_AD_SYNC__) return;
  window.__CE_PUBLIC_TASK_AD_SYNC__ = true;
  if (!window.__CE_WITHDRAWAL_LOCK_UI__) {
    const s = document.createElement('script');
    s.src = './assets/js/chatearn-withdrawal-lock-ui.js?v=1.0.0';
    s.defer = true;
    document.head.appendChild(s);
  }
  const CANONICAL_REF = 'cqnovqvmxwmfngupgtov';
  let config = null;
  const client = () => {
    if (window.ceAdminClient?.rpc) return window.ceAdminClient;
    const diag = window.ChatEarnSupabaseDiagnostic?.();
    if (diag?.projectRef !== CANONICAL_REF) return null;
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient?.rpc) return supabaseClient; } catch (_) {}
    return window.supabaseClient?.rpc ? window.supabaseClient : null;
  };
  const okMessages = () => [...document.querySelectorAll('#chatBody .msg.outgoing')]
    .filter(x => !x.classList.contains('failed') && (x.querySelector('.msg-earn') || x.querySelector('.msg-status')?.textContent?.includes('✓✓')));
  async function readConfig() {
    const c = client();
    if (!c?.rpc) return null;
    const { data, error } = await c.rpc('chatearn_get_chat_task_config');
    if (error) { console.warn('Task config load:', error.message || error); return null; }
    config = typeof data === 'string' ? JSON.parse(data) : data;
    return config;
  }
  function element(tag, text, css) {
    const x = document.createElement(tag);
    x.textContent = text;
    if (css) x.style.cssText = css;
    return x;
  }
  function card(id, title, description, buttonText, click) {
    if (document.getElementById(id)) return null;
    const c = element('div', '', 'margin:16px 0;padding:16px;border:1px solid rgba(0,200,83,.42);border-radius:18px;background:#111a15');
    c.id = id;
    c.append(element('div', title, 'font-weight:900;color:#fff'));
    c.append(element('p', description, 'font-size:12px;color:#aeb8b1;margin:8px 0 12px'));
    const b = element('button', buttonText + ' →', 'width:100%;padding:12px;border:0;border-radius:13px;background:#00c853;font-weight:900');
    b.type = 'button'; b.onclick = click; c.append(b);
    return c;
  }
  async function run() {
    document.querySelectorAll('#chatBody .ce-chat-native-task').forEach(x => x.remove());
    const body = document.getElementById('chatBody');
    if (!body) return;
    const cfg = config || await readConfig();
    const list = okMessages();
    const taskEvery = Math.max(1, Number(cfg?.trigger_message_count || 3));
    for (let i = 1; i <= list.length; i += 1) {
      if (cfg?.available && i % taskEvery === 0) {
        const node = card('ceTask' + i, '⚡ ' + (cfg.title || 'Quick earning task'), cfg.description || 'Complete this task and continue earning.', cfg.cta || 'Start task', () => window.ceV42OpenNextOffer?.('chat_native_task'));
        if (node) list[i - 1].insertAdjacentElement('afterend', node);
      }
      if (i % 4 === 0) {
        const offer = await window.ChatEarnSponsoredAds?.getNextOffer?.('chat_native');
        if (offer) {
          const node = card('ceAd' + i, offer.headline || offer.name || 'Sponsored opportunity', offer.description || 'Open this sponsored opportunity.', offer.cta || 'Open Now', () => window.ChatEarnSponsoredAds?.openOffer?.(offer, 'chat_native'));
          if (node) { node.dataset.ceNativeSponsored = '1'; list[i - 1].insertAdjacentElement('afterend', node); }
        }
      }
    }
  }
  const observer = new MutationObserver(() => setTimeout(run, 80));
  function boot() { const b = document.getElementById('chatBody'); if (b) observer.observe(b, { childList:true, subtree:true }); readConfig().then(run); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  window.ChatEarnPublicTaskAdSync = { refresh: async () => { config = null; await readConfig(); await run(); } };
})();