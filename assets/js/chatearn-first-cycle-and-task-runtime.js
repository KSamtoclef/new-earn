/* ChatEarn first-cycle earning cap v1.1.0 */
(()=>{
'use strict';
if(window.__CHAT_EARN_FIRST_CYCLE_TASK_RUNTIME__)return;
window.__CHAT_EARN_FIRST_CYCLE_TASK_RUNTIME__=true;
const LIMIT=80000;
let userId=null;
const toast=m=>window.showToast?window.showToast(m):alert(m);
const parseMoney=v=>Number(String(v||'').replace(/[^0-9.]/g,''))||0;
async function currentUserId(){if(userId)return userId;try{const client=typeof supabaseClient!=='undefined'?supabaseClient:window.supabaseClient;const{data}=await client.auth.getSession();userId=data?.session?.user?.id||null}catch(_){}return userId}
async function unlockKey(){const id=await currentUserId();return id?`ce_first_cycle_unlocked:${id}`:null}
async function isUnlocked(){const key=await unlockKey();return !!(key&&localStorage.getItem(key)==='1')}
function visibleBalance(){return Math.max(parseMoney(document.getElementById('earnPageAmount')?.textContent),parseMoney(document.getElementById('dashBalance')?.textContent),parseMoney(document.getElementById('totalEarnBreakdown')?.textContent),parseMoney(document.getElementById('wdAmount')?.textContent))}
async function shouldBlock(){return visibleBalance()>=LIMIT&&!(await isUnlocked())}
function showLimit(){toast('You have reached the ₦80,000 first-withdrawal limit. Complete your withdrawal to continue earning.');try{window.goScreen?.('earnings')}catch(_){}const input=document.getElementById('chatInput');if(input){input.disabled=true;input.placeholder='Complete your first withdrawal to continue earning'}}
async function guardEvent(e){const send=e.target.closest?.('.btn-send,.quick-reply');if(!send)return;if(await shouldBlock()){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();showLimit()}}
document.addEventListener('click',guardEvent,true);
document.addEventListener('keydown',async e=>{if(e.key!=='Enter'||e.target?.id!=='chatInput')return;if(await shouldBlock()){e.preventDefault();e.stopPropagation();showLimit()}},true);
async function refreshInputState(){const input=document.getElementById('chatInput'),send=document.querySelector('.btn-send');if(!input)return;const blocked=await shouldBlock();input.disabled=blocked;if(send)send.disabled=blocked;if(blocked)input.placeholder='Complete your first withdrawal to continue earning';else if(input.placeholder.includes('first withdrawal'))input.placeholder='Type a message...'}
document.addEventListener('click',async e=>{const cont=e.target.closest?.('button,a');if(!cont||!/continue earning/i.test(cont.textContent||''))return;const key=await unlockKey();if(key)localStorage.setItem(key,'1');localStorage.setItem('ce_returning_user','1');setTimeout(refreshInputState,100)},true);
const observer=new MutationObserver(refreshInputState);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
window.addEventListener('focus',refreshInputState);
setInterval(refreshInputState,1200);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshInputState,{once:true});else refreshInputState();
window.ChatEarnFirstCycleTaskRuntime=Object.freeze({version:'1.1.0',refreshInputState,unlockForCurrentUser:async()=>{const key=await unlockKey();if(key)localStorage.setItem(key,'1')}});
})();