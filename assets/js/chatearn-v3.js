(() => {
'use strict';

const REF_CODE='F6D7539951DB';

function currentState(){
  const key=Object.keys(localStorage).find(k=>k.startsWith('chatearn_state_')&&k!=='chatearn_state_guest');
  if(!key)return {};
  try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}
}
function money(value){return `₦${Number(value||0).toLocaleString('en-NG')}`;}
function makeShareText(){
  const state=currentState();
  const url=`https://chat-earn.xyz?ref=${REF_CODE}`;
  return `💰 I just earned ${money(state.balance)} on ChatEarn chatting with foreigners!\n\nThis app pays Nigerians to chat with people from USA 🇺🇸, UK 🇬🇧, Canada 🇨🇦 and more.\n\n✅ Free to join\n✅ Earn ₦8,000–₦15,000 per reply\n✅ Withdraw to OPay/PalmPay\n\nSign up here 👇\n${url}\n${url}\n${url}\n\nI'm withdrawing mine now! 🔥`;
}
function cleanEarnings(){
  const page=document.getElementById('earnings');
  if(!page)return;
  page.querySelectorAll('a').forEach(link=>link.remove());
}
function improveChat(){
  document.querySelectorAll('#quickReplies button').forEach(button=>button.classList.add('quick-reply'));
  const input=document.getElementById('chatInput');
  if(input){input.placeholder='Type your reply here...';input.autocomplete='off';}
}
function wrapSend(){
  if(typeof window.sendMsg!=='function'||window.sendMsg.__improved)return;
  const original=window.sendMsg;
  const wrapped=function(...args){
    const status=document.getElementById('chatStatus');
    const result=original.apply(this,args);
    if(status){status.textContent='typing…';setTimeout(()=>{status.textContent='🟢 Automated chat partner';},760);}
    return result;
  };
  wrapped.__improved=true;
  window.sendMsg=wrapped;
}
function boot(){
  window.ChatEarnShareText=makeShareText;
  window.shareAgain=()=>window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(makeShareText())}`,'_blank','noopener,noreferrer');
  cleanEarnings();
  improveChat();
  wrapSend();
  new MutationObserver(()=>{cleanEarnings();improveChat();wrapSend();}).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();