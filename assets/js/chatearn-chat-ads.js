/* ChatEarn Module 8: deterministic native in-chat sponsored tasks. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_CHAT_ADS_V84__) return;
  window.__CHAT_EARN_CHAT_ADS_V84__ = true;

  const VERSION = '8.4.0';
  const EVERY = 3;
  let currentBody = null;
  let baselineOutgoing = 0;
  let countedOutgoing = 0;
  let lastRenderedMilestone = 0;
  let lastPartner = '';
  let observer = null;

  const body = () => document.getElementById('chatBody');
  const partner = () => {
    try { return currentChatUser?.name || document.getElementById('chatName')?.textContent?.trim() || ''; }
    catch (_) { return document.getElementById('chatName')?.textContent?.trim() || ''; }
  };
  const track = (name, metadata = {}) => { try { window.trackEvent?.(name, metadata); } catch (_) {} };

  function successfulOutgoingCount(chat) {
    if (!chat) return 0;
    return [...chat.querySelectorAll('.msg.outgoing')].filter(message => {
      const status = message.querySelector('.msg-status')?.textContent || '';
      return message.querySelector('.msg-earn') || status.includes('✓');
    }).length;
  }

  function openTask(button) {
    track('chat_sponsored_task_clicked', { milestone: lastRenderedMilestone, partner: partner() });
    if (typeof window.ceV42OpenNextOffer === 'function') {
      window.ceV42OpenNextOffer('chat_inline_task', button);
      return;
    }
    const fallback = document.querySelector('a.ce-offer-active[href],a[data-offer-placement][href],a[href*="jikgykm.com"],a[href*="effectivecpmnetwork.com"],a[href*="omg10.com"]');
    if (fallback?.href) window.open(fallback.href, '_blank', 'noopener');
    else window.showToast?.('Your next earning task is loading. Please tap again.');
  }

  function renderTask(milestone) {
    const chat = body();
    if (!chat || milestone <= lastRenderedMilestone) return false;
    lastRenderedMilestone = milestone;

    const card = document.createElement('div');
    card.className = 'ce-chat-native-task';
    card.dataset.milestone = String(milestone);
    card.style.cssText = 'margin:16px 0;padding:14px;border:1px solid rgba(0,200,83,.42);border-radius:18px;background:#171b18;box-shadow:0 10px 28px rgba(0,0,0,.22);';
    card.innerHTML = `<div style="display:flex;gap:12px;align-items:flex-start;"><div style="width:42px;height:42px;border-radius:14px;background:rgba(0,200,83,.14);display:flex;align-items:center;justify-content:center;font-size:22px;flex:none;">⚡</div><div style="min-width:0;flex:1;"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;"><div style="font-size:15px;font-weight:900;color:#fff;">Quick earning task</div><span style="font-size:9px;letter-spacing:.7px;text-transform:uppercase;color:#8b9a90;border:1px solid #334039;border-radius:999px;padding:3px 7px;white-space:nowrap;">Sponsored</span></div><div style="font-size:12px;line-height:1.45;color:#aeb8b1;margin-top:5px;">Open this short task, then return here to continue your conversation and earnings.</div></div></div><button type="button" style="width:100%;margin-top:12px;padding:12px 14px;border:0;border-radius:13px;background:#00c853;color:#06120a;font-size:14px;font-weight:900;cursor:pointer;">Start quick task →</button>`;
    card.querySelector('button').addEventListener('click', event => openTask(event.currentTarget));
    chat.appendChild(card);
    requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
    track('chat_sponsored_task_impression', { milestone, partner: partner() });
    return true;
  }

  function establishBaseline(force = false) {
    const chat = body();
    if (!chat) return false;
    const key = partner();
    if (force || chat !== currentBody || key !== lastPartner) {
      currentBody = chat;
      lastPartner = key;
      baselineOutgoing = successfulOutgoingCount(chat);
      countedOutgoing = baselineOutgoing;
      lastRenderedMilestone = 0;
    }
    return true;
  }

  function scan() {
    const chat = body();
    if (!chat) return;
    establishBaseline(false);
    const total = successfulOutgoingCount(chat);
    if (total < countedOutgoing) {
      baselineOutgoing = total;
      countedOutgoing = total;
      lastRenderedMilestone = 0;
      return;
    }
    countedOutgoing = total;
    const freshReplies = Math.max(0, total - baselineOutgoing);
    const milestone = Math.floor(freshReplies / EVERY);
    if (milestone > lastRenderedMilestone) renderTask(milestone);
  }

  function observe() {
    const chat = body();
    if (!chat) return false;
    if (observer && currentBody === chat) return true;
    observer?.disconnect();
    establishBaseline(true);
    observer = new MutationObserver(() => queueMicrotask(scan));
    observer.observe(chat, { childList: true, subtree: true, characterData: true });
    return true;
  }

  const timer = setInterval(() => {
    const chat = body();
    if (!chat) return;
    if (chat !== currentBody || partner() !== lastPartner) observe();
    scan();
  }, 300);

  window.ChatEarnChatAds = Object.freeze({
    version: VERSION,
    interval: EVERY,
    showNow: () => renderTask(lastRenderedMilestone + 1),
    diagnostic: () => ({
      version: VERSION,
      every: EVERY,
      partner: lastPartner,
      baselineOutgoing,
      countedOutgoing,
      freshReplies: Math.max(0, countedOutgoing - baselineOutgoing),
      lastRenderedMilestone,
      observerActive: Boolean(observer),
      routerAvailable: typeof window.ceV42OpenNextOffer === 'function'
    })
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
  window.addEventListener('pageshow', () => setTimeout(observe, 50));
  console.info(`[ChatEarn] Native sponsored tasks ${VERSION} loaded`);
})();