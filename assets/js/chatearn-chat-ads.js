/* ChatEarn Module 8: deterministic native in-chat sponsored tasks. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_CHAT_ADS_V83__) return;
  window.__CHAT_EARN_CHAT_ADS_V83__ = true;

  const VERSION = '8.3.0';
  const EVERY = 3;
  let paidReplies = 0;
  let currentPartnerKey = '';
  let lastRenderedReply = 0;
  let observer = null;
  let observedBody = null;
  const countedEarnNodes = new WeakSet();

  const chatBody = () => document.getElementById('chatBody');
  const chatActive = () => document.getElementById('chat')?.classList.contains('active');
  const partnerKey = () => { try { return currentChatUser?.name || ''; } catch (_) { return ''; } };
  const track = (name, metadata = {}) => { try { window.trackEvent?.(name, metadata); } catch (_) {} };

  function openTask(button) {
    track('chat_sponsored_task_clicked', { paid_replies: paidReplies, partner: partnerKey() });
    if (typeof window.ceV42OpenNextOffer === 'function') {
      window.ceV42OpenNextOffer('chat_inline_task', button);
      return;
    }
    const fallback = document.querySelector('a.ce-offer-active[href],a[data-offer-placement][href],a[href*="jikgykm.com"],a[href*="effectivecpmnetwork.com"],a[href*="omg10.com"]');
    if (fallback?.href) window.open(fallback.href, '_blank', 'noopener');
    else window.showToast?.('Your next earning task is loading. Please tap again.');
  }

  function renderTask() {
    const body = chatBody();
    if (!body || !chatActive() || paidReplies <= lastRenderedReply) return false;
    const card = document.createElement('div');
    card.className = 'ce-chat-native-task';
    card.dataset.reply = String(paidReplies);
    card.style.cssText = 'margin:16px 0;padding:14px;border:1px solid rgba(0,200,83,.42);border-radius:18px;background:#171b18;box-shadow:0 10px 28px rgba(0,0,0,.22);';
    card.innerHTML = `<div style="display:flex;gap:12px;align-items:flex-start;"><div style="width:42px;height:42px;border-radius:14px;background:rgba(0,200,83,.14);display:flex;align-items:center;justify-content:center;font-size:22px;flex:none;">⚡</div><div style="min-width:0;flex:1;"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;"><div style="font-size:15px;font-weight:900;color:#fff;">Quick earning task</div><span style="font-size:9px;letter-spacing:.7px;text-transform:uppercase;color:#8b9a90;border:1px solid #334039;border-radius:999px;padding:3px 7px;white-space:nowrap;">Sponsored</span></div><div style="font-size:12px;line-height:1.45;color:#aeb8b1;margin-top:5px;">Open this short task, then return here to continue your conversation and earnings.</div></div></div><button type="button" style="width:100%;margin-top:12px;padding:12px 14px;border:0;border-radius:13px;background:#00c853;color:#06120a;font-size:14px;font-weight:900;cursor:pointer;">Start quick task →</button>`;
    card.querySelector('button').addEventListener('click', e => openTask(e.currentTarget));
    body.appendChild(card);
    body.scrollTop = body.scrollHeight;
    lastRenderedReply = paidReplies;
    track('chat_sponsored_task_impression', { paid_replies: paidReplies, partner: partnerKey() });
    return true;
  }

  function countEarnNode(node) {
    if (!(node instanceof Element)) return 0;
    const nodes = [];
    if (node.matches('.msg-earn')) nodes.push(node);
    node.querySelectorAll?.('.msg-earn').forEach(n => nodes.push(n));
    let fresh = 0;
    for (const earn of nodes) {
      if (countedEarnNodes.has(earn)) continue;
      countedEarnNodes.add(earn);
      fresh += 1;
    }
    return fresh;
  }

  function registerPaidReplies(amount, source) {
    if (!amount || !chatActive()) return;
    const key = partnerKey();
    if (key !== currentPartnerKey) {
      currentPartnerKey = key;
      paidReplies = 0;
      lastRenderedReply = 0;
    }
    for (let i = 0; i < amount; i += 1) {
      paidReplies += 1;
      track('chat_paid_reply_counted', { source, paid_replies: paidReplies, partner: key });
      if (paidReplies % EVERY === 0) setTimeout(renderTask, 120);
    }
  }

  function observeChat() {
    const body = chatBody();
    if (!body) return false;
    if (observer && observedBody === body) return true;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver(records => {
      let fresh = 0;
      records.forEach(record => record.addedNodes.forEach(node => { fresh += countEarnNode(node); }));
      registerPaidReplies(fresh, 'earn_dom');
    });
    observer.observe(body, { childList: true, subtree: true });
    return true;
  }

  function resetForChat() {
    currentPartnerKey = partnerKey();
    paidReplies = 0;
    lastRenderedReply = 0;
    setTimeout(observeChat, 40);
  }

  function wrapOpenChat() {
    const original = window.openChat;
    if (typeof original !== 'function' || original.__ceNativeTaskWrapped) return false;
    window.openChat = async function (...args) {
      const result = await original.apply(this, args);
      resetForChat();
      return result;
    };
    window.openChat.__ceNativeTaskWrapped = true;
    return true;
  }

  const timer = setInterval(() => {
    wrapOpenChat();
    if (chatActive()) observeChat();
  }, 150);
  setTimeout(() => clearInterval(timer), 30000);

  window.ChatEarnChatAds = Object.freeze({
    version: VERSION,
    interval: EVERY,
    showNow: () => { paidReplies = Math.max(paidReplies, lastRenderedReply + 1); return renderTask(); },
    diagnostic: () => ({ version: VERSION, paidReplies, lastRenderedReply, chatActive: chatActive(), observerActive: Boolean(observer), openChatWrapped: Boolean(window.openChat?.__ceNativeTaskWrapped), routerAvailable: typeof window.ceV42OpenNextOffer === 'function' })
  });

  wrapOpenChat();
  if (chatActive()) observeChat();
  console.info(`[ChatEarn] Native sponsored tasks ${VERSION} loaded`);
})();