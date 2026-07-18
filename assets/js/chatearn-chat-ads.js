/* ChatEarn Module 8: native in-chat sponsored tasks for new and returning users. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_CHAT_ADS_V82__) return;
  window.__CHAT_EARN_CHAT_ADS_V82__ = true;

  const VERSION = '8.2.0';
  const EVERY = 3;
  let paidReplies = 0;
  let lastRenderedReply = 0;
  let lastRenderedAt = 0;
  let currentPartnerKey = '';
  let observer = null;
  let observedBody = null;

  const body = () => document.getElementById('chatBody');
  const isChatActive = () => document.getElementById('chat')?.classList.contains('active');
  const partnerKey = () => {
    try { return currentChatUser?.name || ''; } catch (_) { return ''; }
  };
  const track = (name, metadata = {}) => {
    try { if (typeof window.trackEvent === 'function') window.trackEvent(name, metadata); } catch (_) {}
  };

  function openTask(button) {
    track('chat_sponsored_task_clicked', { source: 'chat_inline', paid_replies: paidReplies, partner: partnerKey() });
    if (typeof window.ceV42OpenNextOffer === 'function') {
      window.ceV42OpenNextOffer('chat_inline_task', button);
      return;
    }
    const fallback = document.querySelector('a.ce-offer-active[href],a[data-offer-placement][href],a[href*="jikgykm.com"],a[href*="effectivecpmnetwork.com"],a[href*="omg10.com"]');
    if (fallback?.href) window.open(fallback.href, '_blank', 'noopener');
    else window.showToast?.('Your next earning task is loading. Please tap again.');
  }

  function renderTask(force = false) {
    const chat = body();
    if (!chat || !isChatActive()) return false;
    const now = Date.now();
    if (!force && (paidReplies <= lastRenderedReply || now - lastRenderedAt < 2500)) return false;

    const old = chat.querySelector('.ce-chat-native-task[data-active="1"]');
    if (old) old.dataset.active = '0';

    const card = document.createElement('div');
    card.className = 'ce-chat-native-task';
    card.dataset.active = '1';
    card.dataset.reply = String(paidReplies);
    card.setAttribute('role', 'complementary');
    card.style.cssText = 'margin:16px 0;padding:14px;border:1px solid rgba(0,200,83,.42);border-radius:18px;background:#171b18;box-shadow:0 10px 28px rgba(0,0,0,.22);';
    card.innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <div style="width:42px;height:42px;border-radius:14px;background:rgba(0,200,83,.14);display:flex;align-items:center;justify-content:center;font-size:22px;flex:none;">⚡</div>
        <div style="min-width:0;flex:1;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div style="font-size:15px;font-weight:900;color:#fff;">Quick earning task</div>
            <span style="font-size:9px;letter-spacing:.7px;text-transform:uppercase;color:#8b9a90;border:1px solid #334039;border-radius:999px;padding:3px 7px;white-space:nowrap;">Sponsored</span>
          </div>
          <div style="font-size:12px;line-height:1.45;color:#aeb8b1;margin-top:5px;">Open this short task, then return here to continue your conversation and earnings.</div>
        </div>
      </div>
      <button type="button" style="width:100%;margin-top:12px;padding:12px 14px;border:0;border-radius:13px;background:#00c853;color:#06120a;font-size:14px;font-weight:900;cursor:pointer;">Start quick task →</button>`;
    card.querySelector('button').addEventListener('click', event => openTask(event.currentTarget));
    chat.appendChild(card);
    chat.scrollTop = chat.scrollHeight;
    lastRenderedReply = paidReplies;
    lastRenderedAt = now;
    track('chat_sponsored_task_impression', { source: 'chat_inline', paid_replies: paidReplies, partner: partnerKey() });
    return true;
  }

  function registerPaidReply(source = 'event') {
    if (!isChatActive()) return;
    const key = partnerKey();
    if (key !== currentPartnerKey) {
      currentPartnerKey = key;
      paidReplies = 0;
      lastRenderedReply = 0;
    }
    paidReplies += 1;
    if (paidReplies % EVERY === 0) setTimeout(() => renderTask(), 180);
    track('chat_paid_reply_counted', { source, paid_replies: paidReplies, partner: key });
  }

  function wrapTrackEvent() {
    const original = window.trackEvent;
    if (typeof original !== 'function' || original.__ceChatTaskWrapped) return false;
    const wrapped = function (name, metadata = {}) {
      const result = original.apply(this, arguments);
      if (name === 'user_message_sent') registerPaidReply('track_event');
      return result;
    };
    wrapped.__ceChatTaskWrapped = true;
    wrapped.__ceChatTaskOriginal = original;
    window.trackEvent = wrapped;
    return true;
  }

  function countEarnNodes(node) {
    if (!(node instanceof Element)) return 0;
    return (node.matches('.msg-earn') ? 1 : 0) + (node.querySelectorAll?.('.msg-earn').length || 0);
  }

  function startFallbackObserver() {
    const chat = body();
    if (!chat) return false;
    if (observer && observedBody === chat) return true;
    observer?.disconnect();
    observedBody = chat;
    observer = new MutationObserver(records => {
      let added = 0;
      records.forEach(record => record.addedNodes.forEach(node => { added += countEarnNodes(node); }));
      if (!added) return;
      // Only use DOM counting when the event wrapper did not count the same reply.
      if (!window.trackEvent?.__ceChatTaskWrapped) {
        for (let i = 0; i < added; i += 1) registerPaidReply('dom_fallback');
      }
    });
    observer.observe(chat, { childList: true, subtree: true });
    return true;
  }

  function wrapOpenChat() {
    const original = window.openChat;
    if (typeof original !== 'function' || original.__ceChatTaskOpenWrapped) return false;
    const wrapped = async function (...args) {
      const result = await original.apply(this, args);
      currentPartnerKey = partnerKey();
      paidReplies = 0;
      lastRenderedReply = 0;
      setTimeout(startFallbackObserver, 80);
      return result;
    };
    wrapped.__ceChatTaskOpenWrapped = true;
    wrapped.__ceChatTaskOpenOriginal = original;
    window.openChat = wrapped;
    return true;
  }

  const installTimer = setInterval(() => {
    wrapTrackEvent();
    wrapOpenChat();
    if (isChatActive()) startFallbackObserver();
    if (window.trackEvent?.__ceChatTaskWrapped && window.openChat?.__ceChatTaskOpenWrapped && observer) clearInterval(installTimer);
  }, 100);
  setTimeout(() => clearInterval(installTimer), 20000);

  window.ChatEarnChatAds = Object.freeze({
    version: VERSION,
    interval: EVERY,
    showNow: () => renderTask(true),
    diagnostic: () => ({
      version: VERSION,
      every: EVERY,
      paidReplies,
      lastRenderedReply,
      active: isChatActive(),
      eventHookInstalled: Boolean(window.trackEvent?.__ceChatTaskWrapped),
      openChatHookInstalled: Boolean(window.openChat?.__ceChatTaskOpenWrapped),
      observerActive: Boolean(observer),
      routerAvailable: typeof window.ceV42OpenNextOffer === 'function'
    })
  });

  wrapTrackEvent();
  wrapOpenChat();
  if (isChatActive()) startFallbackObserver();
  console.info(`[ChatEarn] Native sponsored tasks ${VERSION} loaded`);
})();