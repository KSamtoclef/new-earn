(() => {
'use strict';

const REF_CODE='F6D7539951DB';
const MIN_WITHDRAW=40000;
const FIRST_LIMIT=80000;
const SCREEN_KEY='chatearn_last_screen_v1';
const PARTNER_KEY='chatearn_last_partner_v1';
const SAFE_SCREENS=new Set(['dashboard','chat','earnings','withdraw','sharewall','kyc','processing']);

function byId(id){return document.getElementById(id);}
function currentState(){const key=Object.keys(localStorage).find(k=>k.startsWith('chatearn_state_')&&k!=='chatearn_state_guest');if(!key)return{};try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return{}}}
function money(value){return `₦${Number(value||0).toLocaleString('en-NG')}`;}
function parseMoney(text){return Number(String(text||'').replace(/[^0-9]/g,''))||0;}
function balance(){return parseMoney(byId('dashBalance')?.textContent||byId('earnPageAmount')?.textContent);}
function activeScreen(){return document.querySelector('.screen.active')?.id||'';}
function makeShareText(){const state=currentState();const url=`https://chat-earn.xyz?ref=${REF_CODE}`;return `💰 I just earned ${money(state.balance)} on ChatEarn chatting with foreigners!\n\nThis app pays Nigerians to chat with people from USA 🇺🇸, UK 🇬🇧, Canada 🇨🇦 and more.\n\n✅ Free to join\n✅ Earn ₦8,000–₦15,000 per reply\n✅ Withdraw to OPay/PalmPay\n\nSign up here 👇\n${url}\n${url}\n${url}\n\nI'm withdrawing mine now! 🔥`;}

function cleanEarnings(){const page=byId('earnings');if(!page)return;page.querySelectorAll('a').forEach(link=>link.remove());}
function improveChat(){document.querySelectorAll('#quickReplies button').forEach(button=>button.classList.add('quick-reply'));const input=byId('chatInput');if(input){input.placeholder='Type your reply here...';input.autocomplete='off';}}
function wrapSend(){if(typeof window.sendMsg!=='function'||window.sendMsg.__improved)return;const original=window.sendMsg;const wrapped=function(...args){const status=byId('chatStatus');const result=original.apply(this,args);if(status){status.textContent='typing…';setTimeout(()=>{status.textContent='🟢 Automated chat partner';},760);}return result;};wrapped.__improved=true;window.sendMsg=wrapped;}

function rememberScreen(id){if(SAFE_SCREENS.has(id))localStorage.setItem(SCREEN_KEY,id);}
function installNavigationMemory(){
  const originalGo=window.goScreen;
  if(typeof originalGo==='function'&&!originalGo.__journeyWrapped){const wrapped=function(id){rememberScreen(id);return originalGo(id);};wrapped.__journeyWrapped=true;window.goScreen=wrapped;}
  const originalOpen=window.openChat;
  if(typeof originalOpen==='function'&&!originalOpen.__journeyWrapped){const wrapped=function(index){localStorage.setItem(PARTNER_KEY,String(Number(index)||0));rememberScreen('chat');return originalOpen(index);};wrapped.__journeyWrapped=true;window.openChat=wrapped;}
}

function withdrawalCard(){
  let card=byId('ceInlineWithdraw');if(card)return card;
  card=document.createElement('div');card.id='ceInlineWithdraw';card.style.cssText='margin:14px 12px;padding:15px;border-radius:15px;background:linear-gradient(135deg,rgba(0,200,83,.18),rgba(255,214,0,.08));border:1px solid rgba(0,200,83,.38);box-shadow:0 12px 30px rgba(0,0,0,.24)';
  card.innerHTML='<div style="font-size:9px;font-weight:900;letter-spacing:1.2px;color:#69F0AE;margin-bottom:5px">WITHDRAWAL AVAILABLE</div><div id="ceInlineWithdrawTitle" style="font-size:15px;font-weight:900;line-height:1.35"></div><div id="ceInlineWithdrawText" style="font-size:11px;color:#b5c0b9;line-height:1.55;margin-top:5px"></div><button id="ceInlineWithdrawBtn" type="button" style="width:100%;margin-top:11px;padding:12px;border:0;border-radius:10px;background:#00C853;color:#000;font-size:13px;font-weight:900;cursor:pointer">Withdraw My Earnings →</button>';
  card.querySelector('#ceInlineWithdrawBtn').addEventListener('click',()=>window.goScreen?.('earnings'));
  return card;
}
function updateWithdrawalPrompt(){
  const amount=balance(),body=byId('chatBody');if(!body)return;
  const existing=byId('ceInlineWithdraw');if(amount<MIN_WITHDRAW){existing?.remove();return;}
  const card=withdrawalCard();byId('ceInlineWithdrawTitle').textContent=`You have earned ${money(amount)} so far`;
  byId('ceInlineWithdrawText').textContent=amount>=FIRST_LIMIT?'You have reached the ₦80,000 first-user maximum. Withdraw now to continue your next earning cycle.':'You can withdraw now or continue chatting until the ₦80,000 first-user maximum.';
  if(!card.isConnected)body.appendChild(card);
}

function simplifyShareScreen(){
  const screen=byId('sharewall');if(!screen)return;
  screen.querySelector('.sw-hero')?.style.setProperty('display','none');
  screen.querySelectorAll('.sw-body > div').forEach(element=>{if(!element.classList.contains('sw-progress'))element.style.display='none';});
  screen.querySelector('.sw-note')?.style.setProperty('display','none');
  const button=byId('btnShareWA');if(button){button.style.marginTop='18px';button.querySelector('svg')?.remove();}
}
function improveProcessing(){
  const screen=byId('processing');if(!screen)return;
  const oldButton=screen.querySelector('button');if(oldButton){oldButton.textContent='← Return to Chats & Continue Earning';oldButton.style.background='#00C853';oldButton.style.color='#000';oldButton.onclick=()=>window.openChat?.(Number(localStorage.getItem(PARTNER_KEY)||0));}
  const note=screen.querySelector('.pp-note');if(note)note.textContent='Your request is being processed. You can return to your chats and continue using the platform.';
}
function restoreJourney(){setTimeout(()=>{installNavigationMemory();if(activeScreen()!=='dashboard')return;const saved=localStorage.getItem(SCREEN_KEY);if(!SAFE_SCREENS.has(saved)||saved==='dashboard')return;if(saved==='chat'){window.openChat?.(Number(localStorage.getItem(PARTNER_KEY)||0));return;}window.goScreen?.(saved);},1400);}

function boot(){
  window.ChatEarnShareText=makeShareText;
  window.shareAgain=()=>window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(makeShareText())}`,'_blank','noopener,noreferrer');
  cleanEarnings();improveChat();wrapSend();installNavigationMemory();simplifyShareScreen();improveProcessing();updateWithdrawalPrompt();restoreJourney();
  new MutationObserver(()=>{cleanEarnings();improveChat();wrapSend();installNavigationMemory();simplifyShareScreen();improveProcessing();updateWithdrawalPrompt();}).observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener('beforeunload',()=>rememberScreen(activeScreen()));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();