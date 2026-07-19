/* ChatEarn Sponsored Ads Runtime v1.3.0 — public display only */
(() => {
  'use strict';
  if (window.__CHAT_EARN_SPONSORED_ADS_MANAGER__) return;
  window.__CHAT_EARN_SPONSORED_ADS_MANAGER__ = true;

  const VERSION = '1.3.0';
  const client = () => {
    if (window.ceAdminClient?.rpc) return window.ceAdminClient;
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient?.rpc) return supabaseClient; } catch (_) {}
    return window.supabaseClient?.rpc ? window.supabaseClient : null;
  };

  const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
  const decodeMeta = name => {
    try {
      const raw = String(name || '');
      if (raw.startsWith('CEAD1:')) {
        return JSON.parse(decodeURIComponent(escape(atob(raw.slice(6)))));
      }
    } catch (_) {}
    return {
      headline: String(name || 'Sponsored opportunity'),
      description: 'Open this sponsored opportunity to continue.',
      cta: 'Open Now'
    };
  };

  async function rpc(name, args = {}) {
    const c = client();
    if (!c) throw new Error('Sponsored connection is still loading.');
    const { data, error } = await c.rpc(name, args);
    if (error) throw error;
    return parse(data);
  }

  async function getNextOffer(placement = 'chat_banner') {
    try {
      const offer = await rpc('chatearn_v4_get_unique_offer', {
        p_placement: placement,
        p_visitor_id: localStorage.getItem('ce_visitor_id'),
        p_session_id: sessionStorage.getItem('ce_session_id')
      });
      if (!offer?.available || !offer.url) return null;
      return { ...offer, ...decodeMeta(offer.name) };
    } catch (error) {
      console.warn('Sponsored ad load:', error?.message || error);
      return null;
    }
  }

  function openOffer(offer, placement = 'chat_banner') {
    const url = String(offer?.url || '').trim();
    if (!/^https:\/\//i.test(url)) {
      window.showToast?.('This sponsored link is unavailable.');
      return false;
    }

    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = url;

    void rpc('chatearn_v3_track_offer_event', {
      p_offer_key: offer.offer_key,
      p_event_type: 'open',
      p_visitor_id: localStorage.getItem('ce_visitor_id'),
      p_session_id: sessionStorage.getItem('ce_session_id'),
      p_placement: placement,
      p_visit_number: Number(window.ceVisitInfo?.visit_number || 1),
      p_messages_before: Number(window.replyCount || 0),
      p_seconds_away: null,
      p_metadata: { source: 'sponsored_ads_runtime' }
    }).catch(() => {});

    return false;
  }

  async function personalizePlacement(node) {
    if (!node || node.dataset.ceManagedCreative === '1') return;
    const placement = node.id === 'ceAdaptiveOfferSheet' ? 'chat_half_screen' : 'chat_banner';
    const offer = await getNextOffer(placement);
    if (!offer) return;

    node.dataset.ceManagedCreative = '1';
    const title = node.querySelector('h3,b');
    const description = node.querySelector('p,div[style*="font-size:12px"]');
    const button = node.querySelector('.open');

    if (title) title.textContent = offer.headline || 'Sponsored opportunity';
    if (description) description.textContent = offer.description || 'Open this sponsored opportunity to continue.';
    if (button) {
      button.textContent = `${offer.cta || 'Open Now'} →`;
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        openOffer(offer, placement);
      };
    }
  }

  function watchPlacements() {
    new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.id === 'ceAdaptiveOffer' || node.id === 'ceAdaptiveOfferSheet') {
            void personalizePlacement(node);
          }
          node.querySelectorAll?.('#ceAdaptiveOffer,#ceAdaptiveOfferSheet')
            .forEach(item => void personalizePlacement(item));
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchPlacements, { once: true });
  } else {
    watchPlacements();
  }

  window.ChatEarnSponsoredAds = Object.freeze({
    version: VERSION,
    getNextOffer,
    openOffer,
    decodeMeta
  });
})();
