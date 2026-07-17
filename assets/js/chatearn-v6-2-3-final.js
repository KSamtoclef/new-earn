/* ChatEarn V6.2.3 — VERIFIED SINGLE REPLACEMENT
   Built against the actual ChatEarn markup:
   #chatBody, .msg.outgoing, currentChatUser.name, currentScreen === 'chat'.
*/
(()=>{
'use strict';

if (window.__CE623_VERIFIED_REWARD__) return;
window.__CE623_VERIFIED_REWARD__ = true;

const state = {
  checking: false,
  claiming: false,
  pending: null,
  rendered: new Set(),
  observer: null,
  debounce: null
};

const templates = [
  {icon:'🎉',kicker:'CHAT REWARD UNLOCKED',title:'You unlocked a sponsored reward',copy:'Complete the sponsored activity and return to this chat. Your reward will be calculated securely.',cta:'COMPLETE TASK & CLAIM REWARD'},
  {icon:'⭐',kicker:'NEW CHAT MISSION',title:'Your next earning stage is ready',copy:'Open the sponsored activity, complete the required step and return to this conversation.',cta:'START MISSION'},
  {icon:'💰',kicker:'EARNING PROGRESS',title:'Continue your earning progress',copy:'This sponsored activity is linked to your current chat milestone.',cta:'FINISH THIS STEP'},
  {icon:'🔥',kicker:'CHAT STREAK REWARD',title:'Your active chat streak unlocked this task',copy:'Complete the sponsored activity and return to receive the assigned reward.',cta:'KEEP MY STREAK'},
  {icon:'🎁',kicker:'SESSION REWARD',title:'Another sponsored reward is available',copy:'Complete this task and return to the same chat for automatic reward calculation.',cta:'OPEN REWARD TASK'}
];

const $ = id => document.getElementById(id);
const formatMoney = n => '₦' + Number(n || 0).toLocaleString('en-NG');

function getClient() {
  return window.supabaseClient || null;
}

function getSessionId() {
  try {
    if (typeof SESSION_ID !== 'undefined' && SESSION_ID) return String(SESSION_ID);
  } catch (_) {}

  let id = sessionStorage.getItem('ce623_session_id');
  if (!id) {
    id = 'ce623-' + Date.now() + '-' + Math.random().toString(36).slice(2,10);
    sessionStorage.setItem('ce623_session_id', id);
  }
  return id;
}

function getPartnerKey() {
  try {
    if (typeof currentChatUser !== 'undefined' && currentChatUser?.name) {
      return String(currentChatUser.name).trim();
    }
  } catch (_) {}
  return String($('chatName')?.textContent || '').trim();
}

function isChatOpen() {
  try {
    if (typeof currentScreen !== 'undefined') return currentScreen === 'chat';
  } catch (_) {}
  return $('chat')?.classList.contains('active') || false;
}

function currentChatMessageCount() {
  const host = $('chatBody');
  if (!host) return 0;

  // This is the exact class used by renderStoredMessage() in chatearn-app.js.
  return host.querySelectorAll('.msg.outgoing').length;
}

function removeOldOffer() {
  const old = $('ceChatOffer');
  if (old) old.remove();
}

async function rpc(name, args) {
  const client = getClient();
  if (!client?.rpc) throw new Error('Supabase is not ready');
  const {data,error} = await client.rpc(name,args);
  if (error) throw error;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

function cardId(id) {
  return 'ce623-card-' + id;
}

function renderCard(op) {
  if (!op?.opportunity_id) return false;

  const host = $('chatBody');
  const id = String(op.opportunity_id);

  if (!host || state.rendered.has(id) || $(cardId(id))) return false;

  const slot = Math.max(1,Math.min(5,Number(op.slot_number || 1)));
  const t = templates[slot - 1];

  const card = document.createElement('section');
  card.id = cardId(id);
  card.className = 'ce623-reward-card';
  card.dataset.opportunityId = id;

  card.innerHTML = `
    <div class="ce623-reward-top">
      <div class="ce623-reward-icon">${t.icon}</div>
      <div class="ce623-reward-kicker">${t.kicker}</div>
      <div class="ce623-reward-title">${t.title}</div>
      <p class="ce623-reward-copy">${t.copy}</p>
      <div class="ce623-reward-amount">${formatMoney(op.reward_amount)}</div>
      <div class="ce623-reward-label">Credited after a verified return</div>
    </div>
    <div class="ce623-reward-bottom">
      <button type="button" class="ce623-reward-btn">${t.cta}</button>
      <div class="ce623-reward-note">One secure credit per completed opportunity</div>
      <div class="ce623-reward-status" aria-live="polite"></div>
    </div>
  `;

  card.querySelector('.ce623-reward-btn')
    .addEventListener('click',()=>openOpportunity(op,card));

  host.appendChild(card);
  state.rendered.add(id);

  requestAnimationFrame(()=>{
    host.scrollTop = host.scrollHeight;
    card.scrollIntoView({behavior:'smooth',block:'center'});
  });

  try {
    window.trackEvent?.('chat_reward_impression',{
      opportunity_id:id,
      slot,
      reward:Number(op.reward_amount || 0),
      partner:getPartnerKey()
    });
  } catch (_) {}

  return true;
}

async function checkReward() {
  removeOldOffer();

  if (state.checking || !isChatOpen()) return;

  const client = getClient();
  const partner = getPartnerKey();
  const count = currentChatMessageCount();

  if (!client?.rpc || !partner || count < 3) return;

  state.checking = true;

  try {
    const result = await rpc('chatearn_v62_next_chat_reward',{
      p_session_id:getSessionId(),
      p_partner_key:partner,
      p_message_count:count
    });

    if (result?.available) {
      renderCard(result);
    } else {
      console.info('[ChatEarn V6.2.3] No reward due:',result?.reason || 'unknown');
    }
  } catch (error) {
    console.error('[ChatEarn V6.2.3] Reward check failed:',error);
  } finally {
    state.checking = false;
  }
}

async function openOpportunity(op,card) {
  if (state.claiming) return;

  const button = card.querySelector('.ce623-reward-btn');
  const status = card.querySelector('.ce623-reward-status');

  state.claiming = true;
  button.disabled = true;
  button.textContent = 'OPENING TASK…';

  try {
    const result = await rpc('chatearn_v62_open_chat_reward',{
      p_opportunity_id:op.opportunity_id,
      p_session_id:getSessionId()
    });

    if (!result?.ok) throw new Error(result?.message || 'Task is unavailable');

    if (result.already_credited) {
      completeCard(card,{
        reward_amount:result.reward_amount,
        balance:result.balance
      });
      return;
    }

    if (!result.url) throw new Error('Task URL is unavailable');

    state.pending = {
      id:String(op.opportunity_id),
      url:result.url
    };

    sessionStorage.setItem(
      'ce623_pending_reward',
      JSON.stringify(state.pending)
    );

    status.className = 'ce623-reward-status show';
    status.textContent = 'Task opened. Complete it and return to this chat.';

    button.textContent = 'TASK OPENED';

    const opened = window.open(result.url,'_blank','noopener,noreferrer');
    if (!opened) window.location.assign(result.url);

  } catch (error) {
    button.disabled = false;
    button.textContent = 'TRY AGAIN';
    status.className = 'ce623-reward-status show warn';
    status.textContent = error?.message || 'The task could not be opened.';
  } finally {
    state.claiming = false;
  }
}

function restorePending() {
  if (state.pending?.id) return state.pending;
  try {
    const saved = JSON.parse(
      sessionStorage.getItem('ce623_pending_reward') || 'null'
    );
    if (saved?.id) state.pending = saved;
  } catch (_) {}
  return state.pending;
}

function completeCard(card,result) {
  if (!card) return;

  card.classList.add('complete');
  card.querySelector('.ce623-reward-title').textContent =
    'Reward calculated and credited';
  card.querySelector('.ce623-reward-amount').textContent =
    '+' + formatMoney(result.reward_amount);

  const button = card.querySelector('.ce623-reward-btn');
  button.disabled = true;
  button.textContent = 'REWARD CREDITED';

  const status = card.querySelector('.ce623-reward-status');
  status.className = 'ce623-reward-status show ok';
  status.textContent =
    'New balance: ' + formatMoney(result.balance) +
    '. Continue chatting to unlock the next reward.';
}

async function handleReturn() {
  if (state.claiming || document.hidden) return;

  const pending = restorePending();
  if (!pending?.id) return;

  state.claiming = true;

  const card = $(cardId(pending.id));
  const status = card?.querySelector('.ce623-reward-status');
  const button = card?.querySelector('.ce623-reward-btn');

  if (status) {
    status.className = 'ce623-reward-status show';
    status.textContent = 'Checking the task and calculating your reward…';
  }

  try {
    const result = await rpc('chatearn_v62_claim_chat_reward',{
      p_opportunity_id:pending.id,
      p_session_id:getSessionId()
    });

    if (!result?.ok) {
      if (result?.code === 'too_soon') {
        if (status) {
          status.className = 'ce623-reward-status show warn';
          status.textContent =
            'Remain on the sponsored activity for ' +
            Number(result.remaining_seconds || 1) +
            ' more seconds, then return.';
        }
        if (button) {
          button.disabled = false;
          button.textContent = 'RETURN TO TASK';
          button.onclick = ()=>{
            const w = window.open(pending.url,'_blank','noopener,noreferrer');
            if (!w) window.location.assign(pending.url);
          };
        }
        return;
      }
      throw new Error(result?.message || 'Reward verification failed');
    }

    sessionStorage.removeItem('ce623_pending_reward');
    state.pending = null;

    completeCard(card,result);

    if (Number.isFinite(Number(result.balance))) {
      try {
        totalBalance = Number(result.balance);
        chatEarnings = Math.max(
          0,
          totalBalance - Number(
            typeof SIGNUP_BONUS !== 'undefined' ? SIGNUP_BONUS : 10000
          )
        );
        updateBalance?.();
      } catch (_) {}
    }

    try {
      showEarnToast?.(
        '+' + formatMoney(result.reward_amount) + ' Earned! 💰'
      );
      window.trackEvent?.('chat_reward_credited',{
        opportunity_id:pending.id,
        reward:Number(result.reward_amount),
        balance:Number(result.balance),
        slot:Number(result.slot_number)
      });
    } catch (_) {}

  } catch (error) {
    if (status) {
      status.className = 'ce623-reward-status show warn';
      status.textContent =
        error?.message || 'The reward could not be verified yet.';
    }
    if (button) {
      button.disabled = false;
      button.textContent = 'RETURN TO TASK';
    }
  } finally {
    state.claiming = false;
  }
}

function scheduleCheck(delay=180) {
  clearTimeout(state.debounce);
  state.debounce = setTimeout(checkReward,delay);
}

function attachObserver() {
  const host = $('chatBody');
  if (!host) return;

  state.observer?.disconnect();

  state.observer = new MutationObserver(mutations=>{
    removeOldOffer();

    const userMessageAdded = mutations.some(mutation=>
      [...mutation.addedNodes].some(node=>
        node.nodeType === 1 &&
        (
          node.matches?.('.msg.outgoing') ||
          node.querySelector?.('.msg.outgoing')
        )
      )
    );

    if (userMessageAdded) scheduleCheck(120);
  });

  state.observer.observe(host,{childList:true,subtree:true});
}

function init() {
  removeOldOffer();
  attachObserver();
  scheduleCheck(700);
  setTimeout(handleReturn,800);

  window.addEventListener('focus',()=>setTimeout(handleReturn,180));
  window.addEventListener('pageshow',()=>setTimeout(handleReturn,220));
  document.addEventListener('visibilitychange',()=>{
    if (!document.hidden) setTimeout(handleReturn,180);
  });

  // Covers chat changes because openChat() replaces #chatBody contents.
  document.addEventListener('click',event=>{
    if (
      event.target.closest('.conversation-card') ||
      event.target.closest('[onclick*="openChat"]')
    ) {
      setTimeout(()=>{
        attachObserver();
        scheduleCheck(500);
      },250);
    }
  },true);

  console.info('[ChatEarn] V6.2.3 verified reward engine loaded');
}

window.ChatEarnRewardDiagnostic = function() {
  return {
    version:'6.2.3',
    loaded:true,
    chatOpen:isChatOpen(),
    partner:getPartnerKey(),
    currentChatMessages:currentChatMessageCount(),
    supabaseReady:Boolean(getClient()?.rpc),
    oldPopupPresent:Boolean($('ceChatOffer')),
    renderedCards:document.querySelectorAll('.ce623-reward-card').length,
    pending:restorePending()
  };
};

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded',init,{once:true})
  : init();

})();
