/* ChatEarn Module 8: persistent in-chat withdrawal CTA. */
(() => {
  'use strict';
  if (window.__CE_CHAT_WITHDRAW_CTA__) return;
  window.__CE_CHAT_WITHDRAW_CTA__ = true;

  const MINIMUM = 40000;
  const money = value => '₦' + Number(value || 0).toLocaleString('en-NG');

  function balance() {
    try { return Number(totalBalance || 0); } catch (_) { return 0; }
  }

  function ensureCta() {
    const chat = document.getElementById('chat');
    const body = document.getElementById('chatBody');
    if (!chat || !body) return null;

    let cta = document.getElementById('ceChatWithdrawCta');
    if (!cta) {
      cta = document.createElement('div');
      cta.id = 'ceChatWithdrawCta';
      cta.style.cssText = 'display:none;margin:10px 16px 8px;padding:14px;border:1px solid rgba(0,200,83,.45);border-radius:14px;background:rgba(0,200,83,.12);box-shadow:0 8px 24px rgba(0,0,0,.2);position:relative;z-index:5;';
      cta.innerHTML = '<div style="font-size:14px;font-weight:900;color:#00E676;margin-bottom:4px;">Withdrawal unlocked</div><div id="ceChatWithdrawText" style="font-size:12px;color:var(--text);line-height:1.45;margin-bottom:10px;"></div><button type="button" id="ceChatWithdrawBtn" style="width:100%;border:0;border-radius:11px;padding:12px 14px;background:#00C853;color:#04130a;font-size:14px;font-weight:900;cursor:pointer;">Withdraw now →</button>';
      const inputWrap = chat.querySelector('.chat-input-wrap');
      const quickReplies = document.getElementById('quickReplies');
      (quickReplies || inputWrap)?.insertAdjacentElement('beforebegin', cta);
      cta.querySelector('#ceChatWithdrawBtn')?.addEventListener('click', () => {
        if (typeof trackEvent === 'function') trackEvent('chat_withdraw_cta_clicked', { balance: balance() });
        if (typeof goScreen === 'function') goScreen('earnings');
      });
    }
    return cta;
  }

  function render() {
    const cta = ensureCta();
    if (!cta) return;
    const amount = balance();
    const visible = amount >= MINIMUM;
    cta.style.display = visible ? 'block' : 'none';
    if (visible) {
      const text = cta.querySelector('#ceChatWithdrawText');
      const btn = cta.querySelector('#ceChatWithdrawBtn');
      if (text) text.textContent = `${money(amount)} is available for withdrawal. You may continue chatting or withdraw now.`;
      if (btn) btn.textContent = `Withdraw ${money(amount)} →`;
    }
  }

  const previousUpdateBalance = window.updateBalance;
  if (typeof previousUpdateBalance === 'function') {
    window.updateBalance = function (...args) {
      const result = previousUpdateBalance.apply(this, args);
      render();
      return result;
    };
  }

  const previousGoScreen = window.goScreen;
  if (typeof previousGoScreen === 'function') {
    window.goScreen = function (id, ...args) {
      const result = previousGoScreen.call(this, id, ...args);
      if (id === 'chat') setTimeout(render, 0);
      return result;
    };
  }

  const observer = new MutationObserver(render);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(render, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})();