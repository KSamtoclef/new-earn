/* ChatEarn Module 8: deterministic in-chat offer cards for new and returning users. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_CHAT_ADS__) return;
  window.__CHAT_EARN_CHAT_ADS__ = true;

  const VERSION = '8.1.0';
  const EVERY = 3;
  let earnedMessages = 0;
  let lastShownAt = 0;
  let observer = null;

  const chatBody = () => document.getElementById('chatBody');
  const safeTrack = (name, metadata = {}) => {
    try { if (typeof trackEvent === 'function') trackEvent(name, metadata); } catch (_) {}
  };

  function openOffer(button) {
    safeTrack('chat_ad_clicked', { source: 'chat_inline', message_count: earnedMessages });
    if (typeof window.ceV42OpenNextOffer === 'function') {
      window.ceV42OpenNextOffer('chat_inline', button);
      return;
    }
    const fallback = document.querySelector('a.ce-offer-active[href], a[data-offer-placement][href], a[href*="jikgykm.com"], a[href*="effectivecpmnetwork.com"], a[href*="omg10.com"]');
    if (fallback?.href) window.open(fallback.href, '_blank', 'noopener');
    else if (typeof showToast === 'function') showToast('A fresh sponsored offer is loading. Please try again.');
  }

  function renderAd() {
    const body = chatBody();
    if (!body) return;
    const now = Date.now();
    if (now - lastShownAt < 5000) return;
    lastShownAt = now;

    const card = document.createElement('div');
    card.className = 'ce-chat-inline-ad';
    card.setAttribute('role', 'complementary');
    card.style.cssText = 'margin:14px 0;padding:15px;border:1px solid rgba(0,200,83,.38);border-radius:16px;background:linear-gradient(135deg,rgba(0,200,83,.14),rgba(255,255,255,.035));box-shadow:0 8px 26px rgba(0,0,0,.18);';
    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:11px;">
        <div style="font-size:26px;line-height:1;">🎁</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;letter-spacing:1.1px;text-transform:uppercase;color:#00e676;font-weight:900;margin-bottom:4px;">Sponsored reward</div>
          <div style="font-size:15px;font-weight:900;color:var(--text,#fff);">Unlock a fresh earning opportunity</div>
          <div style="font-size:12px;line-height:1.5;color:var(--muted,#aaa);margin-top:4px;">Open the offer, then return here and continue chatting.</div>
        </div>
      </div>
      <button type="button" style="width:100%;margin-top:12px;padding:12px 14px;border:0;border-radius:12px;background:#00c853;color:#07130b;font-weight:900;font-size:14px;cursor:pointer;">Open sponsored offer →</button>`;
    const button = card.querySelector('button');
    button.addEventListener('click', () => openOffer(button));
    body.appendChild(card);
    body.scrollTop = body.scrollHeight;
    safeTrack('chat_ad_impression', { source: 'chat_inline', message_count: earnedMessages });
  }

  function countEarnedNodes(node) {
    if (!(node instanceof Element)) return 0;
    let count = node.matches('.msg-earn') ? 1 : 0;
    count += node.querySelectorAll?.('.msg-earn').length || 0;
    return count;
  }

  function startObserver() {
    const body = chatBody();
    if (!body) return false;
    observer?.disconnect();
    earnedMessages = 0;
    observer = new MutationObserver(records => {
      let added = 0;
      records.forEach(record => record.addedNodes.forEach(node => { added += countEarnedNodes(node); }));
      if (!added) return;
      for (let i = 0; i < added; i += 1) {
        earnedMessages += 1;
        if (earnedMessages % EVERY === 0) renderAd();
      }
    });
    observer.observe(body, { childList: true, subtree: true });
    return true;
  }

  function wrapOpenChat() {
    const original = window.openChat;
    if (typeof original !== 'function' || original.__ceChatAdsWrapped) return false;
    const wrapped = async function (...args) {
      const result = await original.apply(this, args);
      setTimeout(startObserver, 50);
      return result;
    };
    wrapped.__ceChatAdsWrapped = true;
    wrapped.__ceChatAdsOriginal = original;
    window.openChat = wrapped;
    return true;
  }

  const timer = setInterval(() => {
    wrapOpenChat();
    if (document.getElementById('chat')?.classList.contains('active')) startObserver();
  }, 250);
  setTimeout(() => clearInterval(timer), 20000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && document.getElementById('chat')?.classList.contains('active')) startObserver();
  });

  window.ChatEarnChatAds = Object.freeze({
    version: VERSION,
    interval: EVERY,
    showNow: renderAd,
    diagnostic: () => ({
      version: VERSION,
      every: EVERY,
      earnedMessages,
      observerActive: Boolean(observer),
      routerAvailable: typeof window.ceV42OpenNextOffer === 'function',
      openChatWrapped: Boolean(window.openChat?.__ceChatAdsWrapped)
    })
  });

  wrapOpenChat();
  console.info(`[ChatEarn] In-chat ads ${VERSION} loaded`);
})();