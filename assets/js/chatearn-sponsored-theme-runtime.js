/* ChatEarn sponsored theme runtime v1.0.0 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_SPONSORED_THEME_RUNTIME__) return;
  window.__CHAT_EARN_SPONSORED_THEME_RUNTIME__ = true;

  const DEFAULTS = { accent: '#22c55e', background: '#071b12', text: '#f0fdf4' };
  const latest = new Map();
  const safe = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;

  function installWrapper() {
    const current = window.ChatEarnSponsoredAds;
    if (!current?.getNextOffer || current.__creativeThemeWrapped) return false;
    const wrapped = {
      ...current,
      __creativeThemeWrapped: true,
      async getNextOffer(placement) {
        const offer = await current.getNextOffer(placement);
        if (offer) latest.set(placement, offer);
        return offer;
      }
    };
    window.ChatEarnSponsoredAds = Object.freeze(wrapped);
    return true;
  }

  function applyTheme(node, placement) {
    if (!node || node.dataset.ceThemeApplied === '1') return;
    const offer = latest.get(placement);
    if (!offer) return;
    const accent = safe(offer.accent, DEFAULTS.accent);
    const background = safe(offer.background, DEFAULTS.background);
    const text = safe(offer.text, DEFAULTS.text);
    node.dataset.ceThemeApplied = '1';
    node.style.background = `linear-gradient(145deg, ${background}, #050505)`;
    node.style.borderColor = accent;
    node.style.color = text;
    node.querySelectorAll('div,p,h3,b').forEach(el => { if (!el.closest('button')) el.style.color = text; });
    const label = [...node.querySelectorAll('div,small')].find(el => /SPONSORED/i.test(el.textContent || ''));
    if (label) label.style.color = accent;
    const button = node.querySelector('.open');
    if (button) {
      button.style.background = accent;
      button.style.color = '#08110b';
    }
  }

  function scan() {
    installWrapper();
    document.querySelectorAll('[data-ce-native-sponsored="1"]').forEach(node => applyTheme(node, 'chat_native'));
    applyTheme(document.getElementById('ceAdaptiveOffer'), 'chat_banner');
    const sheet = document.getElementById('ceAdaptiveOfferSheet');
    applyTheme(sheet?.querySelector('section') || sheet, 'chat_half_screen');
  }

  new MutationObserver(() => setTimeout(scan, 20)).observe(document.documentElement, { childList: true, subtree: true });
  const timer = setInterval(() => { if (installWrapper()) clearInterval(timer); }, 150);
  setTimeout(() => clearInterval(timer), 10000);
  scan();

  window.ChatEarnSponsoredThemeRuntime = Object.freeze({ version: '1.0.0', scan });
})();
