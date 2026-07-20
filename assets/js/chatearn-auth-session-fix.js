(() => {
'use strict';

const MIN_WITHDRAW = 40000;
const REF_CODE = 'F6D7539951DB';
const PARTNER_KEY = 'chatearn_last_partner_v1';

function byId(id){ return document.getElementById(id); }
function money(value){ return `₦${Number(value || 0).toLocaleString('en-NG')}`; }
function currentState(){
  const key = Object.keys(localStorage).find(item => item.startsWith('chatearn_state_') && item !== 'chatearn_state_guest');
  if(!key) return {};
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function currentBalance(){
  const state = currentState();
  if(Number.isFinite(Number(state.balance))) return Number(state.balance);
  return Number(String(byId('dashBalance')?.textContent || byId('earnPageAmount')?.textContent || '0').replace(/[^0-9]/g,'')) || 0;
}
function shareText(){
  const url = `https://chat-earn.xyz?ref=${REF_CODE}`;
  return `💰 I just earned ${money(currentBalance())} on ChatEarn chatting with foreigners!\n\nThis app pays Nigerians to chat with people from USA 🇺🇸, UK 🇬🇧, Canada 🇨🇦 and more.\n\n✅ Free to join\n✅ Earn ₦8,000–₦15,000 per reply\n✅ Withdraw to OPay/PalmPay\n\nSign up here 👇\n${url}\n${url}\n${url}\n\nIt's real — I'm withdrawing mine now! 🔥`;
}
function openWhatsApp(){
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText())}`,'_blank','noopener,noreferrer');
}

function installStyles(){
  if(byId('ceUxStyles')) return;
  const style = document.createElement('style');
  style.id = 'ceUxStyles';
  style.textContent = `
    #chat{background:#101010!important;min-height:100dvh}
    #chat .chat-header{padding:14px 18px!important;background:#1c1c1c!important;min-height:76px}
    #chat .ch-av{width:46px!important;height:46px!important;background:#2f8fe5!important;color:#050505!important;font-size:0!important;font-weight:900!important}
    #chat .ch-av::after{content:attr(data-initials);font-size:15px}
    #chat .ch-info{min-width:0}
    #chat .ch-name{font-size:16px!important}
    #chat .ch-status{font-size:11px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #chat .chat-body{padding:22px 16px 150px!important;min-height:calc(100dvh - 76px)!important;overflow-y:auto!important}
    #chat .chat-day{display:block;text-align:center;color:#606060;font-size:11px;margin:6px 0 22px}
    #chat .msg-row{display:flex;flex-direction:column;align-items:flex-start;margin:0 0 18px;width:100%}
    #chat .msg-row.mine{align-items:flex-end}
    #chat .msg-bubble{display:block;max-width:78%!important;padding:13px 15px!important;border-radius:18px!important;font-size:14px!important;line-height:1.55!important;word-break:break-word}
    #chat .msg-theirs{background:#202020!important;color:#f5f5f5!important;border-bottom-left-radius:5px!important}
    #chat .msg-mine{background:#00c853!important;color:#050505!important;border-bottom-right-radius:5px!important}
    #chat .msg-meta{font-size:10px;color:#646464;margin-top:5px;font-family:'DM Mono',monospace}
    #chat .msg-row.mine .msg-meta::after{content:'  ✓✓';color:#00e676}
    #chat .msg-earned{display:block!important;background:transparent!important;color:#00c853!important;font-size:11px!important;font-weight:800!important;margin:6px 3px 0!important;padding:0!important}
    #chat .msg-reactions{display:flex;gap:7px;margin-top:7px}
    #chat .msg-reactions span{border:1px solid rgba(255,255,255,.11);background:#222;border-radius:999px;padding:4px 10px;font-size:12px}
    #chat #quickReplies{position:fixed!important;left:0;right:0;bottom:82px!important;z-index:105!important;max-width:480px;margin:auto;padding:8px 13px 9px!important;display:flex!important;gap:8px!important;overflow-x:auto!important;background:linear-gradient(180deg,transparent 0%,#161616 40%)!important;scrollbar-width:none}
    #chat #quickReplies::-webkit-scrollbar{display:none}
    #chat #quickReplies button{flex:0 0 auto!important;white-space:nowrap!important;border:1px solid rgba(0,200,83,.42)!important;background:#1d1d1d!important;color:#69f0ae!important;border-radius:22px!important;padding:9px 15px!important;font-size:12px!important;font-weight:750!important}
    #chat .chat-input-wrap{bottom:0!important;min-height:82px!important;padding:12px 16px calc(15px + env(safe-area-inset-bottom))!important;background:#1b1b1b!important;z-index:110!important}
    #chat .chat-input{height:48px!important;background:#151515!important;padding:0 17px!important;font-size:14px!important}
    #chat .btn-send{width:48px!important;height:48px!important}
    #processing .ce-continue-btn{width:100%;max-width:360px;padding:16px;border:0;border-radius:14px;background:#00c853;color:#000;font-size:16px;font-weight:900;cursor:pointer;margin-top:16px}
    #processing .ce-processing-guide{max-width:360px;color:#b0b0b0;font-size:13px;line-height:1.6;margin-top:14px}
    .login-error.show{display:block!important}
  `;
  document.head.appendChild(style);
}

function decorateChat(){
  const body = byId('chatBody');
  if(!body) return;
  if(!body.querySelector('.chat-day')){
    const day = document.createElement('div');
    day.className = 'chat-day';
    day.textContent = 'Today';
    body.prepend(day);
  }
  body.querySelectorAll('.msg-row').forEach(row => {
    if(row.dataset.decorated === '1') return;
    row.dataset.decorated = '1';
    const bubble = row.querySelector('.msg-bubble');
    if(!bubble) return;
    const earned = bubble.querySelector('.msg-earned');
    if(earned) row.appendChild(earned);
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    row.appendChild(meta);
    if(!row.classList.contains('mine')){
      const reactions = document.createElement('div');
      reactions.className = 'msg-reactions';
      reactions.innerHTML = '<span>👍</span><span>❤️</span>';
      row.appendChild(reactions);
    }
  });
  body.scrollTop = body.scrollHeight;
}

function improveHeader(){
  const avatar = byId('chatAv');
  const name = byId('chatName')?.textContent || '';
  if(avatar){
    const initials = name.replace(/[^a-z0-9]/gi,'').slice(0,2).toUpperCase() || 'CE';
    avatar.dataset.initials = initials;
  }
}

function fixWithdrawalButtons(){
  document.addEventListener('click', event => {
    const withdraw = event.target.closest('.btn-withdraw');
    if(withdraw){
      event.preventDefault();
      event.stopImmediatePropagation();
      if(currentBalance() < MIN_WITHDRAW){
        window.alert(`You need ${money(MIN_WITHDRAW - currentBalance())} more before withdrawal.`);
        return;
      }
      window.goScreen?.('withdraw');
      return;
    }
    const teaser = event.target.closest('#wdTeaserBtn');
    if(teaser && currentBalance() >= MIN_WITHDRAW){
      event.preventDefault();
      event.stopImmediatePropagation();
      window.goScreen?.('earnings');
    }
  }, true);
}

function fixAuthFeedback(){
  document.addEventListener('click', event => {
    if(event.target.closest('#regSubmitBtn')){
      const name = byId('regName')?.value.trim();
      const email = byId('regEmail')?.value.trim();
      const password = byId('regPass')?.value || '';
      if(!name || !email || password.length < 6){
        event.preventDefault();
        event.stopImmediatePropagation();
        window.alert('Enter your full name, a valid email and a password of at least 6 characters.');
      }
    }
    if(event.target.closest('#loginBtn')){
      const email = byId('loginEmail')?.value.trim();
      const password = byId('loginPass')?.value || '';
      if(!email || !password){
        event.preventDefault();
        event.stopImmediatePropagation();
        const box = byId('loginError');
        if(box){ box.textContent = 'Enter your email and password.'; box.classList.add('show'); }
      }
    }
  }, true);
}

function fixShareActions(){
  const original = window.doShareWA;
  if(typeof original === 'function' && !original.__dynamicShare){
    const wrapped = function(){
      const realOpen = window.open;
      window.open = function(url,target,features){
        window.open = realOpen;
        if(String(url).includes('api.whatsapp.com/send')) return realOpen(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText())}`,target,features);
        return realOpen(url,target,features);
      };
      try { return original(); } finally { setTimeout(() => { window.open = realOpen; }, 0); }
    };
    wrapped.__dynamicShare = true;
    window.doShareWA = wrapped;
  }
  window.shareAgain = openWhatsApp;
  window.ChatEarnShareText = shareText;
}

function improveProcessing(){
  const screen = byId('processing');
  if(!screen) return;
  const oldShare = screen.querySelector('button');
  if(oldShare && !oldShare.classList.contains('ce-continue-btn')){
    oldShare.className = 'ce-continue-btn';
    oldShare.textContent = '← Return to Chats & Continue Earning';
    oldShare.onclick = () => {
      const partner = Number(localStorage.getItem(PARTNER_KEY) || 0);
      if(typeof window.openChat === 'function') window.openChat(partner);
      else window.goScreen?.('dashboard');
    };
  }
  if(!screen.querySelector('.ce-processing-guide')){
    const guide = document.createElement('p');
    guide.className = 'ce-processing-guide';
    guide.textContent = 'Your withdrawal is being processed. You can return to your chats now and continue earning while you wait.';
    screen.appendChild(guide);
  }
  const note = screen.querySelector('.pp-note');
  if(note) note.textContent = 'Your withdrawal remains in processing while you continue chatting.';
}

function rememberPartner(){
  if(typeof window.openChat !== 'function' || window.openChat.__remembered) return;
  const original = window.openChat;
  const wrapped = function(index){
    localStorage.setItem(PARTNER_KEY, String(Number(index) || 0));
    const result = original(index);
    setTimeout(() => { improveHeader(); decorateChat(); }, 20);
    return result;
  };
  wrapped.__remembered = true;
  window.openChat = wrapped;
}

function boot(){
  installStyles();
  fixWithdrawalButtons();
  fixAuthFeedback();
  rememberPartner();
  fixShareActions();
  improveProcessing();
  improveHeader();
  decorateChat();

  const chatBody = byId('chatBody');
  if(chatBody){
    new MutationObserver(() => decorateChat()).observe(chatBody,{childList:true,subtree:true});
  }
  const processing = byId('processing');
  if(processing){
    new MutationObserver(() => improveProcessing()).observe(processing,{childList:true,subtree:true});
  }
  setInterval(() => { rememberPartner(); fixShareActions(); improveHeader(); }, 1200);
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();