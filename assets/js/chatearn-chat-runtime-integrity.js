/* ChatEarn Module 8: consolidated chat runtime integrity controller. */
(() => {
  'use strict';
  if (window.__CE_CHAT_RUNTIME_INTEGRITY__) return;
  window.__CE_CHAT_RUNTIME_INTEGRITY__ = true;

  const VERSION = '8.5.0';
  const TASK_EVERY = 3;
  const WITHDRAW_AT = 40000;
  const SESSION_LIMIT = 80000;
  const retryAttempts = new WeakMap();
  let observer = null;
  let observedBody = null;

  const chatBody = () => document.getElementById('chatBody');
  const partnerKey = () => {
    try { return currentChatUser?.name || document.getElementById('chatName')?.textContent?.trim() || 'unknown'; }
    catch (_) { return document.getElementById('chatName')?.textContent?.trim() || 'unknown'; }
  };
  const balance = () => { try { return Number(totalBalance || 0); } catch (_) { return 0; } };
  const money = value => '₦' + Number(value || 0).toLocaleString('en-NG');
  const track = (name, metadata = {}) => { try { window.trackEvent?.(name, metadata); } catch (_) {} };

  function successfulMessages(body) {
    return [...body.querySelectorAll('.msg.outgoing')].filter(message => {
      if (message.classList.contains('failed')) return false;
      const reward = message.querySelector('.msg-earn');
      const status = message.querySelector('.msg-status')?.textContent || '';
      return Boolean(reward || status.includes('✓✓'));
    });
  }

  function openOffer(button) {
    track('chat_native_task_clicked', { partner: partnerKey() });
    if (typeof window.ceV42OpenNextOffer === 'function') {
      window.ceV42OpenNextOffer('chat_native_task', button);
      return;
    }
    const fallback = document.querySelector('a.ce-offer-active[href],a[data-offer-placement][href],a[href*="jikgykm.com"],a[href*="effectivecpmnetwork.com"],a[href*="omg10.com"]');
    if (fallback?.href) window.open(fallback.href, '_blank', 'noopener');
    else window.showToast?.('Your earning task is loading. Tap again in a moment.');
  }

  function ensureTask(milestone, anchor) {
    const body = chatBody();
    if (!body || milestone < 1) return;
    const key = `${partnerKey()}:${milestone}`;
    if (body.querySelector(`.ce-chat-native-task[data-runtime-key="${CSS.escape(key)}"]`)) return;

    const card = document.createElement('div');
    card.className = 'ce-chat-native-task';
    card.dataset.runtimeKey = key;
    card.style.cssText = 'margin:16px 0;padding:14px;border:1px solid rgba(0,200,83,.42);border-radius:18px;background:#171b18;box-shadow:0 10px 28px rgba(0,0,0,.22);';
    card.innerHTML = '<div style="display:flex;gap:12px;align-items:flex-start;"><div style="width:42px;height:42px;border-radius:14px;background:rgba(0,200,83,.14);display:flex;align-items:center;justify-content:center;font-size:22px;flex:none;">⚡</div><div style="min-width:0;flex:1;"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;"><div style="font-size:15px;font-weight:900;color:#fff;">Quick earning task</div><span style="font-size:9px;letter-spacing:.7px;text-transform:uppercase;color:#8b9a90;border:1px solid #334039;border-radius:999px;padding:3px 7px;white-space:nowrap;">Sponsored</span></div><div style="font-size:12px;line-height:1.45;color:#aeb8b1;margin-top:5px;">Complete this short task, then return to continue chatting and earning.</div></div></div><button type="button" style="width:100%;margin-top:12px;padding:12px 14px;border:0;border-radius:13px;background:#00c853;color:#06120a;font-size:14px;font-weight:900;cursor:pointer;">Start quick task →</button>';
    card.querySelector('button').addEventListener('click', event => openOffer(event.currentTarget));
    (anchor || body.lastElementChild)?.insertAdjacentElement('afterend', card);
    if (!card.isConnected) body.appendChild(card);
    body.scrollTop = body.scrollHeight;
    track('chat_native_task_impression', { partner: partnerKey(), milestone });
  }

  function repairSuccessfulRetry(message) {
    const status = message.querySelector('.msg-status')?.textContent || '';
    if (message.querySelector('.msg-earn') || status.includes('✓✓')) {
      message.classList.remove('failed');
      message.querySelectorAll('.msg-retry').forEach(node => node.remove());
    }
  }

  function scheduleTransientRetry(message) {
    if (!message.classList.contains('failed') || !navigator.onLine) return;
    const retry = message.querySelector('.msg-retry');
    if (!retry || retryAttempts.get(message)) return;
    retryAttempts.set(message, 1);
    setTimeout(() => {
      if (!message.isConnected || !message.classList.contains('failed') || !navigator.onLine) return;
      try { retry.click(); track('chat_message_auto_retry', { partner: partnerKey() }); } catch (_) {}
    }, 1800);
  }

  function reconcile() {
    const body = chatBody();
    if (!body) return;

    const outgoing = [...body.querySelectorAll('.msg.outgoing')];
    outgoing.forEach(message => {
      repairSuccessfulRetry(message);
      scheduleTransientRetry(message);
    });

    const successful = successfulMessages(body);
    for (let count = TASK_EVERY; count <= successful.length; count += TASK_EVERY) {
      const milestone = count / TASK_EVERY;
      ensureTask(milestone, successful[count - 1]);
    }

    const amount = balance();
    const withdrawCta = document.getElementById('ceChatWithdrawCta');
    if (withdrawCta) withdrawCta.style.display = amount >= WITHDRAW_AT ? 'block' : 'none';
    const limitNotice = document.getElementById('ceFirstSessionNotice');
    if (limitNotice) limitNotice.style.display = amount >= WITHDRAW_AT ? 'block' : 'none';

    if (amount >= SESSION_LIMIT) {
      const input = document.getElementById('chatInput');
      const send = document.querySelector('.chat-send-btn, #sendBtn');
      if (input) input.placeholder = 'Withdraw to begin another earning session';
      if (send) send.setAttribute('aria-label', 'Withdrawal required before continuing');
    }
  }

  function observe() {
    const body = chatBody();
    if (!body) return false;
    if (observer && observedBody === body) return true;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver(() => queueMicrotask(reconcile));
    observer.observe(body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    reconcile();
    return true;
  }

  function guardDuplicateOpening() {
    const original = window.deliverReply;
    if (typeof original !== 'function' || original.__ceOpeningGuard) return;
    const wrapped = function (text, isOpening = false, ...rest) {
      const body = chatBody();
      if (isOpening && body && body.querySelector('.msg.incoming, .msg.outgoing')) return;
      return original.call(this, text, isOpening, ...rest);
    };
    wrapped.__ceOpeningGuard = true;
    window.deliverReply = wrapped;
  }

  const timer = setInterval(() => {
    guardDuplicateOpening();
    observe();
    reconcile();
  }, 350);

  window.ChatEarnRuntimeIntegrity = Object.freeze({
    version: VERSION,
    diagnostic: () => ({
      version: VERSION,
      partner: partnerKey(),
      successfulMessages: chatBody() ? successfulMessages(chatBody()).length : 0,
      taskCards: chatBody()?.querySelectorAll('.ce-chat-native-task').length || 0,
      failedMessages: chatBody()?.querySelectorAll('.msg.outgoing.failed').length || 0,
      balance: balance(),
      withdrawalAvailable: balance() >= WITHDRAW_AT,
      sessionLimitReached: balance() >= SESSION_LIMIT,
      observerActive: Boolean(observer)
    })
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
  window.addEventListener('online', reconcile);
  window.addEventListener('pageshow', () => setTimeout(reconcile, 80));
  console.info(`[ChatEarn] Runtime integrity ${VERSION} loaded`);
})();
