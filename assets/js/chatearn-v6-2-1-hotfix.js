/* ChatEarn V6.2.1 — reward-card runtime hotfix */
(()=>{
'use strict';

if (window.__CE621_REWARD_HOTFIX__) return;
window.__CE621_REWARD_HOTFIX__ = true;

/* Disable the old small closable popup shown in the screenshot. */
function removeLegacyOffer(){
  const legacy = document.getElementById('ceChatOffer');
  if (legacy) {
    legacy.classList.remove('show');
    legacy.remove();
  }
}

removeLegacyOffer();

const legacyObserver = new MutationObserver(removeLegacyOffer);
legacyObserver.observe(document.documentElement,{childList:true,subtree:true});

/*
The original V6.2 module could miss milestones because it used the user's
all-time profile total. This bridge calculates messages visible in the
currently opened chat and calls the existing lightweight V6.2 RPC.
*/
const state = {
  checking:false,
  seen:new Set(),
  lastCount:-1
};

const milestones = [3,7,12,18,25];

function getSessionId(){
  try {
    if (typeof SESSION_ID !== 'undefined' && SESSION_ID) return SESSION_ID;
  } catch (_) {}
  return sessionStorage.getItem('earn_chat_session_id_v1')
      || sessionStorage.getItem('ce_session_id')
      || 'ce-session-' + Date.now();
}

function getCurrentPartner(){
  try {
    if (typeof currentChatUser !== 'undefined' && currentChatUser?.name) {
      return currentChatUser.name;
    }
  } catch (_) {}
  return document.getElementById('chatName')?.textContent?.trim() || '';
}

function isChatOpen(){
  return document.getElementById('chat')?.classList.contains('active');
}

function countCurrentUserMessages(){
  const host = document.getElementById('chatBody');
  if (!host) return 0;

  /*
  Current ChatEarn user messages render with .msg.user.
  The data-client-id fallback protects compatibility with older builds.
  */
  const nodes = host.querySelectorAll(
    '.msg.user, .msg[data-client-id], .chat-msg.user, [data-sender="user"]'
  );

  const unique = new Set();
  nodes.forEach((el,index)=>{
    unique.add(
      el.getAttribute('data-client-id')
      || el.getAttribute('data-message-id')
      || `dom-${index}`
    );
  });
  return unique.size;
}

async function rpc(name,args){
  if (!window.supabaseClient) throw new Error('Supabase client unavailable');
  const {data,error} = await window.supabaseClient.rpc(name,args||{});
  if (error) throw error;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

function requestOriginalRenderer(op){
  /*
  The original V6.2 runtime owns the card design and claim process.
  Calling its wrapped trackEvent makes it re-check immediately.
  */
  if (!op?.available) return;

  if (typeof window.trackEvent === 'function') {
    window.trackEvent('user_message_sent',{
      source:'v6.2.1-hotfix',
      reward_bridge:true
    });
  }
}

async function checkMilestone(force=false){
  removeLegacyOffer();

  if (state.checking || !isChatOpen()) return;

  const partner = getCurrentPartner();
  const messageCount = countCurrentUserMessages();

  if (!partner || messageCount < 3) return;
  if (!force && messageCount === state.lastCount) return;
  if (!milestones.some(m=>messageCount >= m)) return;

  state.lastCount = messageCount;
  state.checking = true;

  try {
    const result = await rpc('chatearn_v62_next_chat_reward',{
      p_session_id:getSessionId(),
      p_partner_key:partner,
      p_message_count:messageCount
    });

    if (result?.available && result.opportunity_id) {
      /*
      If the original renderer is installed, its own immediate check will fetch
      the same row and render it. The unique DB constraint prevents duplicates.
      */
      requestOriginalRenderer(result);

      /*
      Fallback event lets the original module check even where trackEvent
      was replaced by another later-loaded script.
      */
      window.dispatchEvent(new CustomEvent('ce:v62-reward-due',{
        detail:result
      }));
    }
  } catch (error) {
    console.error('[ChatEarn V6.2.1] Reward check failed:',error);
  } finally {
    state.checking = false;
  }
}

/* Observe completed user-message DOM inserts without polling or admin queries. */
const chatObserver = new MutationObserver(()=>{
  removeLegacyOffer();
  clearTimeout(chatObserver.timer);
  chatObserver.timer = setTimeout(()=>checkMilestone(true),100);
});

function attach(){
  removeLegacyOffer();
  const host = document.getElementById('chatBody');
  if (host) chatObserver.observe(host,{childList:true,subtree:true});
  setTimeout(()=>checkMilestone(true),600);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded',attach,{once:true});
} else {
  attach();
}

window.addEventListener('pageshow',()=>setTimeout(()=>checkMilestone(true),250));
window.addEventListener('focus',()=>setTimeout(()=>checkMilestone(true),250));

/* Public diagnostic command for testing in Safari Web Inspector. */
window.ChatEarnRewardDiagnostic = function(){
  return {
    hotfixLoaded:true,
    originalEngineLoaded:Boolean(window.__CE62_REWARDS__),
    chatOpen:isChatOpen(),
    partner:getCurrentPartner(),
    currentChatMessages:countCurrentUserMessages(),
    legacyPopupPresent:Boolean(document.getElementById('ceChatOffer')),
    supabaseReady:Boolean(window.supabaseClient)
  };
};

console.info('[ChatEarn] V6.2.1 reward hotfix loaded');
})();
