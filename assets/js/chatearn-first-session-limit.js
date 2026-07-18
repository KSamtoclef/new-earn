/* ChatEarn Module 8: first earning session limit and withdrawal guidance. */
(() => {
  'use strict';
  if (window.__CE_FIRST_SESSION_LIMIT__) return;
  window.__CE_FIRST_SESSION_LIMIT__ = true;

  const VERSION = '8.0.1';
  const WITHDRAW_AT = 40000;
  const SESSION_LIMIT = 80000;
  const money = value => '₦' + Number(value || 0).toLocaleString('en-NG');

  function balance() {
    try { return Number(totalBalance || 0); } catch (_) { return 0; }
  }

  function ensureNotice() {
    const chat = document.getElementById('chat');
    const quickReplies = document.getElementById('quickReplies');
    const inputWrap = chat?.querySelector('.chat-input-wrap');
    if (!chat || (!quickReplies && !inputWrap)) return null;

    let notice = document.getElementById('ceFirstSessionNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'ceFirstSessionNotice';
      notice.style.cssText = 'display:none;margin:10px 16px 8px;padding:14px;border:1px solid rgba(0,200,83,.5);border-radius:15px;background:#142019;box-shadow:0 8px 24px rgba(0,0,0,.22);position:relative;z-index:6;';
      notice.innerHTML = '<div id="ceFirstSessionTitle" style="font-size:14px;font-weight:900;color:#00e676;margin-bottom:4px;"></div><div id="ceFirstSessionText" style="font-size:12px;line-height:1.5;color:#d4ddd7;margin-bottom:10px;"></div><button type="button" id="ceFirstSessionWithdraw" style="width:100%;border:0;border-radius:11px;padding:12px 14px;background:#00c853;color:#04130a;font-size:14px;font-weight:900;cursor:pointer;">Continue to withdrawal →</button>';
      (quickReplies || inputWrap).insertAdjacentElement('beforebegin', notice);
      notice.querySelector('#ceFirstSessionWithdraw')?.addEventListener('click', () => {
        try { window.trackEvent?.('first_session_withdraw_clicked', { balance: balance(), session_limit: SESSION_LIMIT }); } catch (_) {}
        if (typeof goScreen === 'function') goScreen('earnings');
      });
    }
    return notice;
  }

  function render() {
    const notice = ensureNotice();
    if (!notice) return;
    const amount = balance();
    const reachedLimit = amount >= SESSION_LIMIT;
    const eligible = amount >= WITHDRAW_AT;
    notice.style.display = eligible ? 'block' : 'none';
    if (!eligible) return;

    const title = notice.querySelector('#ceFirstSessionTitle');
    const text = notice.querySelector('#ceFirstSessionText');
    const button = notice.querySelector('#ceFirstSessionWithdraw');
    if (reachedLimit) {
      if (title) title.textContent = 'First earning session complete';
      if (text) text.textContent = `${money(amount)} earned. Continue to withdrawal before starting another earning session.`;
      if (button) button.textContent = `Withdraw ${money(amount)} →`;
    } else {
      if (title) title.textContent = 'Withdrawal available';
      if (text) text.textContent = `${money(amount)} is available. You can withdraw now or continue earning up to ${money(SESSION_LIMIT)} in this first session.`;
      if (button) button.textContent = `Withdraw ${money(amount)} →`;
    }
  }

  const timer = setInterval(render, 500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();

  window.ChatEarnFirstSessionLimit = Object.freeze({
    version: VERSION,
    withdrawalThreshold: WITHDRAW_AT,
    sessionLimit: SESSION_LIMIT,
    diagnostic: () => ({ version: VERSION, balance: balance(), eligible: balance() >= WITHDRAW_AT, reachedLimit: balance() >= SESSION_LIMIT })
  });
})();