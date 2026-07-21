(() => {
'use strict';

const REFERRAL_STORAGE_KEY = 'chatearn_referral_code';
const INCOMING_REFERRAL_KEY = 'chatearn_incoming_referral';

function simpleHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36).toUpperCase();
}

function findUserSeed() {
  const stateKey = Object.keys(localStorage).find((key) => key.startsWith('chatearn_state_') && key !== 'chatearn_state_guest');
  if (stateKey) return stateKey.replace('chatearn_state_', '');
  return `${navigator.userAgent}|${location.host}`;
}

function getReferralCode() {
  let code = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!code) {
    code = `CE${simpleHash(findUserSeed()).slice(0, 8)}`;
    localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  }
  return code;
}

function getReferralLink() {
  const url = new URL(location.origin);
  url.searchParams.set('ref', getReferralCode());
  return url.toString();
}

function currentBalance() {
  const stateKey = Object.keys(localStorage).find((key) => key.startsWith('chatearn_state_') && key !== 'chatearn_state_guest');
  if (!stateKey) return 0;
  try {
    const state = JSON.parse(localStorage.getItem(stateKey) || '{}');
    return Number(state.balance || 0);
  } catch {
    return 0;
  }
}

function formatMoney(value) {
  return `₦${Number(value || 0).toLocaleString('en-NG')}`;
}

function shareMessage() {
  const balance = currentBalance();
  return [
    'I joined ChatEarn and received access to rewarded automated chats.',
    balance > 0 ? `My current in-app balance is ${formatMoney(balance)}.` : '',
    `Join with my referral link: ${getReferralLink()}`
  ].filter(Boolean).join('\n\n');
}

function notify(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show';
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.className = 'toast'; }, 2600);
}

function shareWhatsApp() {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage())}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function copyReferralLink() {
  const link = getReferralLink();
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    const input = document.createElement('input');
    input.value = link;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
  notify('Referral link copied.');
}

function captureIncomingReferral() {
  const code = new URLSearchParams(location.search).get('ref');
  if (!code) return;
  localStorage.setItem(INCOMING_REFERRAL_KEY, code.trim().slice(0, 40));
}

function mountShareTools() {
  const shareScreen = document.getElementById('sharewall');
  if (!shareScreen || shareScreen.querySelector('[data-referral-tools]')) return;

  const host = document.createElement('div');
  host.dataset.referralTools = 'true';
  host.style.cssText = 'margin:14px 0 18px;padding:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px';

  const title = document.createElement('div');
  title.textContent = 'Your Referral Link';
  title.style.cssText = 'font-size:12px;font-weight:800;margin-bottom:8px';

  const link = document.createElement('div');
  link.textContent = getReferralLink();
  link.style.cssText = 'font-size:11px;color:#aebbb3;word-break:break-all;margin-bottom:10px';

  const actions = document.createElement('div');
  actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';

  const whatsapp = document.createElement('button');
  whatsapp.type = 'button';
  whatsapp.textContent = 'Share on WhatsApp';
  whatsapp.style.cssText = 'border:0;border-radius:11px;padding:12px;background:#00c853;color:#001b0c;font-weight:900';
  whatsapp.addEventListener('click', shareWhatsApp);

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy Link';
  copy.style.cssText = 'border:1px solid rgba(255,255,255,.14);border-radius:11px;padding:12px;background:#1a1f1b;color:#fff;font-weight:800';
  copy.addEventListener('click', copyReferralLink);

  actions.append(whatsapp, copy);
  host.append(title, link, actions);

  const body = shareScreen.querySelector('.sw-body') || shareScreen;
  body.appendChild(host);
}

function boot() {
  captureIncomingReferral();
  mountShareTools();
  new MutationObserver(mountShareTools).observe(document.body, { childList: true, subtree: true });
}

window.ChatEarnReferral = Object.freeze({
  getCode: getReferralCode,
  getLink: getReferralLink,
  shareWhatsApp,
  copyReferralLink,
  incomingCode: () => localStorage.getItem(INCOMING_REFERRAL_KEY)
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
})();
