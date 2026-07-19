/* ChatEarn first-cycle earning gate v1.3.0 */
(()=>{
'use strict';
if(window.__CHAT_EARN_FIRST_CYCLE_TASK_RUNTIME__)return;
window.__CHAT_EARN_FIRST_CYCLE_TASK_RUNTIME__=true;
const MIN_WITHDRAWAL=40000,FIRST_CYCLE_LIMIT=80000;
const FLOW_KEY='ce_withdrawal_flow_v8e',FIRST_CYCLE_DONE_KEY='ce_first_withdrawal_cycle_completed';
let userId=null,sendWrapped=false;
const toast=m=>window.showToast?window.showToast(m):alert(m);
const parseMoney=v=>Number(String(v||'').replace(/[^0-9.]/g,''))||0;
const loadFlow=()=>{try{return JSON.parse(localStorage.getItem(FLOW_KEY)||'{}')||{}}catch(_){return{}}};
async function currentUserId(){if(userId)return userId;try{const client=typeof supabaseClient!=='undefined'?supabaseClient:window.supabaseClient;const{data}=await client.auth.getSession();userId=data?.session?.user?.id||null}catch(_){}return userId}
async function unlockKey(){const id=await currentUserId();return id?`ce_first_cycle_unlocked:${id}`:null}
async function isUnlocked(){const flow=loadFlow();if(localStorage.getItem(FIRST_CYCLE_DONE_KEY)==='1'||localStorage.getItem('ce_returning_user')==='1'||flow.first_cycle_completed===true||flow.stage==='processing')return true;const key=await unlockKey();return !!(key&&localStorage.getItem(key)==='1')}
async function persistUnlock(){localStorage.setItem(FIRST_CYCLE_DONE_KEY,'1');localStorage.setItem('ce_returning_user','1');const key=await unlockKey();if(key)localStorage.setItem(key,'1')}
function realBalance(){let value=0;try{value=Math.max(value,Number(totalBalance)||0)}catch(_){}return Math.max(value,parseMoney(document.getElementById('earnPageAmount')?.textContent),parseMoney(document.getElementById('dashBalance')?.textContent),parseMoney(document.getElementById('totalEarnBreakdown')?.textContent),parseMoney(document.getElementById('wdAmount')?.textContent))}
function clampBalance(){try{if(Number(totalBalance)>FIRST_CYCLE_LIMIT)totalBalance=FIRST_CYCLE_LIMIT}catch(_){}document.querySelectorAll('#earnPageAmount,#dashBalance,#totalEarnBreakdown,#wdAmount').forEach(el=>{const n=parseMoney(el.textContent);if(n>FIRST_CYCLE_LIMIT)el.textContent=FIRST_CYCLE_LIMIT.toLocaleString('en-NG')});try{window.updateBalance?.()}catch(_){}}
async function shouldBlock(){return realBalance()>=FIRST_CYCLE_LIMIT&&!(await isUnlocked())}
function showLimit(){clampBalance();toast('You have reached the ₦80,000 first-withdrawal limit. Complete your withdrawal to continue earning.');const input=document.getElementById('chatInput'),send=document.querySelector('.btn-send');if(input){input.disabled=true;input.placeholder='Withdraw your ₦80,000 to continue earning'}if(send)send.disabled=true;try{window.goScreen?.('withdraw')}catch(_){try{window.goScreen?.('earnings')}catch(__){}}setTimeout(()=>window.ChatEarnV8EDirectWithdrawal?.ensureDirectForm?.(),120)}
async function guardEvent(e){const send=e.target.closest?.('.btn-send,.quick-reply,.quick-replies button');if(!send)return;if(await shouldBlock()){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();showLimit()}}
document.addEventListener('click',guardEvent,true);
document.addEventListener('keydown',async e=>{if(e.key!=='Enter'||e.target?.id!=='chatInput')return;if(await shouldBlock()){e.preventDefault();e.stopPropagation();showLimit()}},true);
function wrapSend(){if(sendWrapped||typeof window.sendMsg!=='function')return false;const original=window.sendMsg;window.sendMsg=async function(...args){if(await shouldBlock()){showLimit();return false}const before=realBalance();const result=await original.apply(this,args);if(!(await isUnlocked())&&realBalance()>=FIRST_CYCLE_LIMIT){clampBalance();setTimeout(showLimit,80)}else if(!(await isUnlocked())&&before<FIRST_CYCLE_LIMIT&&realBalance()>FIRST_CYCLE_LIMIT){clampBalance();setTimeout(showLimit,80)}return result};window.sendMsg.__ceFirstCycleWrapped=true;sendWrapped=true;return true}
async function refreshInputState(){const input=document.getElementById('chatInput'),send=document.querySelector('.btn-send');if(!input)return;const blocked=await shouldBlock();input.disabled=blocked;if(send)send.disabled=blocked;if(blocked)input.placeholder='Withdraw your ₦80,000 to continue earning';else if(/withdraw your|first withdrawal/i.test(input.placeholder))input.placeholder='Type a message...'}
function normalizeFirstCycleCopy(){const roots=['earnings','withdraw','chat','processing'].map(id=>document.getElementById(id)).filter(Boolean);for(const root of roots){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){const old=node.nodeValue||'';const next=old.replace(/₦?65,?000/g,'₦80,000').replace(/minimum\s*withdrawal\s*:?\s*₦?\d[\d,]*/ig,'Minimum withdrawal: ₦40,000');if(next!==old)node.nodeValue=next}}}
document.addEventListener('click',async e=>{const cont=e.target.closest?.('button,a');if(!cont||!/continue earning/i.test(cont.textContent||''))return;await persistUnlock();setTimeout(refreshInputState,100)},true);
const observer=new MutationObserver(()=>{normalizeFirstCycleCopy();wrapSend();refreshInputState()});observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
window.addEventListener('focus',refreshInputState);
setInterval(()=>{wrapSend();refreshInputState()},1200);
async function boot(){if(await isUnlocked())await persistUnlock();normalizeFirstCycleCopy();wrapSend();refreshInputState();if(await shouldBlock())showLimit()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.ChatEarnFirstCycleTaskRuntime=Object.freeze({version:'1.3.0',minimumWithdrawal:MIN_WITHDRAWAL,firstCycleLimit:FIRST_CYCLE_LIMIT,refreshInputState,unlockForCurrentUser:persistUnlock,isUnlocked,realBalance});
})();