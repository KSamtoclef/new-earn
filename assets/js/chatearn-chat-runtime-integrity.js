/* ChatEarn Module 8: single chat runtime controller for tasks, withdrawal and first-session limit. */
(() => {
  'use strict';
  if (window.__CE_CHAT_RUNTIME_V860__) return;
  window.__CE_CHAT_RUNTIME_V860__ = true;

  const VERSION = '8.6.0';
  const TASK_EVERY = 3;
  const WITHDRAW_AT = 40000;
  const SESSION_LIMIT = 80000;
  let observer = null;
  let observedBody = null;
  let lastSignature = '';

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

  function ensureTask(body, milestone, anchor) {
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
    track('chat_native_task_impression', { partner: partnerKey(), milestone });
  }

  function ensureWithdrawal(body, amount) {
    let card = body.querySelector('#ceRuntimeWithdrawalCard');
    if (amount < WITHDRAW_AT) {
      card?.remove();
      return;
    }
    if (!card) {
      card = document.createElement('div');
      card.id = 'ceRuntimeWithdrawalCard';
      card.style.cssText = 'margin:16px 0;padding:15px;border:1px solid rgba(0,200,83,.48);border-radius:18px;background:linear-gradient(135deg,rgba(0,200,83,.16),rgba(20,32,25,.96));box-shadow:0 10px 28px rgba(0,0,0,.22);';
      card.innerHTML = '<div style="font-size:15px;font-weight:900;color:#00e676;margin-bottom:5px;">Withdrawal unlocked</div><div class="ce-runtime-withdraw-text" style="font-size:12px;line-height:1.5;color:#d4ddd7;margin-bottom:11px;"></div><button type="button" style="width:100%;padding:12px 14px;border:0;border-radius:12px;background:#00c853;color:#04130a;font-size:14px;font-weight:900;cursor:pointer;">Withdraw now →</button>';
      card.querySelector('button').addEventListener('click', () => {
        track('chat_withdraw_cta_clicked', { balance: balance() });
        if (typeof goScreen === 'function') goScreen('earnings');
      });
      body.appendChild(card);
    }
    const reached = amount >= SESSION_LIMIT;
    card.querySelector('.ce-runtime-withdraw-text').textContent = reached
      ? `${money(amount)} earned. Your first earning session is complete. Withdraw before starting another session.`
      : `${money(amount)} is available. You may withdraw now or continue earning up to ${money(SESSION_LIMIT)}.`;
    card.querySelector('button').textContent = `Withdraw ${money(amount)} →`;
  }

  function enforceLimit(amount) {
    const input = document.getElementById('chatInput');
    const send = document.querySelector('.chat-send-btn, #sendBtn');
    if (amount >= SESSION_LIMIT) {
      if (input) {
        input.disabled = true;
        input.placeholder = 'Withdraw to begin another earning session';
      }
      if (send) {
        send.disabled = true;
        send.setAttribute('aria-label', 'Withdrawal required before continuing');
      }
    } else {
      if (input) input.disabled = false;
      if (send) send.disabled = false;
    }
  }

  function reconcile(force = false) {
    const body = chatBody();
    if (!body) return;
    const successful = successfulMessages(body);
    const amount = balance();
    const signature = `${partnerKey()}|${successful.length}|${amount}|${body.querySelectorAll('.msg.outgoing.failed').length}`;
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    for (let count = TASK_EVERY; count <= successful.length; count += TASK_EVERY) {
      ensureTask(body, count / TASK_EVERY, successful[count - 1]);
    }
    ensureWithdrawal(body, amount);
    enforceLimit(amount);
    requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }

  function observe() {
    const body = chatBody();
    if (!body) return false;
    if (observer && observedBody === body) return true;
    observer?.disconnect();
    observedBody = body;
    observer = new MutationObserver(() => queueMicrotask(() => reconcile(false)));
    observer.observe(body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    reconcile(true);
    return true;
  }

  const timer = setInterval(() => {
    observe();
    reconcile(false);
  }, 1000);

  window.ChatEarnRuntimeIntegrity = Object.freeze({
    version: VERSION,
    diagnostic: () => ({
      version: VERSION,
      partner: partnerKey(),
      successfulMessages: chatBody() ? successfulMessages(chatBody()).length : 0,
      taskCards: chatBody()?.querySelectorAll('.ce-chat-native-task').length || 0,
      withdrawalCard: Boolean(chatBody()?.querySelector('#ceRuntimeWithdrawalCard')),
      balance: balance(),
      withdrawalAvailable: balance() >= WITHDRAW_AT,
      sessionLimitReached: balance() >= SESSION_LIMIT,
      observerActive: Boolean(observer),
      timerActive: Boolean(timer)
    })
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
  window.addEventListener('online', () => reconcile(true));
  window.addEventListener('pageshow', () => setTimeout(() => reconcile(true), 80));
  console.info(`[ChatEarn] Unified chat runtime ${VERSION} loaded`);
})();