/* ChatEarn first-cycle earning cap v1.2.0 */
(()=>{
'use strict';
if(window.__CHAT_EARN_FIRST_CYCLE_TASK_RUNTIME__)return;
window.__CHAT_EARN_FIRST_CYCLE_TASK_RUNTIME__=true;
const MIN_WITHDRAWAL=40000, FIRST_CYCLE_LIMIT=80000;
const FLOW_KEY='ce_withdrawal_flow_v8e', FIRST_CYCLE_DONE_KEY='ce_first_withdrawal_cycle_completed';
let userId=null;
const toast=m=>window.showToast?window.showToast(m):alert(m);
const parseMoney=v=>Number(String(v||'').replace(/[^0-9.]/g,''))||0;
const loadFlow=()=>{try{return JSON.parse(localStorage.getItem(FLOW_KEY)||'{}')||{}}catch(_){return{}}};
async function currentUserId(){if(userId)return userId;try{const client=typeof supabaseClient!=='undefined'?supabaseClient:window.supabaseClient;const{data}=await client.auth.getSession();userId=data?.session?.user?.id||null}catch(_){}return userId}
async function unlockKey(){const id=await currentUserId();return id?`ce_first_cycle_unlocked:${id}`:null}
async function isUnlocked(){const flow=loadFlow();if(localStorage.getItem(FIRST_CYCLE_DONE_KEY)==='1'||localStorage.getItem('ce_returning_user')==='1'||flow.first_cycle_completed===true||flow.stage==='processing')return true;const key=await unlockKey();return !!(key&&localStorage.getItem(key)==='1')}
async function persistUnlock(){localStorage.setItem(FIRST_CYCLE_DONE_KEY,'1');localStorage.setItem('ce_returning_user','1');const key=await unlockKey();if(key)localStorage.setItem(key,'1')}
function visibleBalance(){return Math.max(parseMoney(document.getElementById('earnPageAmount')?.textContent),parseMoney(document.getElementById('dashBalance')?.textContent),parseMoney(document.getElementById('totalEarnBreakdown')?.textContent),parseMoney(document.getElementById('wdAmount')?.textContent))}
async function shouldBlock(){return visibleBalance()>=FIRST_CYCLE_LIMIT&&!(await isUnlocked())}
function showLimit(){toast('You have reached the ₦80,000 first-withdrawal limit. Complete your withdrawal to continue earning.');try{window.goScreen?.('earnings')}catch(_){}const input=document.getElementById('chatInput');if(input){input.disabled=true;input.placeholder='Complete your first withdrawal to continue earning'}}
async function guardEvent(e){const send=e.target.closest?.('.btn-send,.quick-reply');if(!send)return;if(await shouldBlock()){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();showLimit()}}
document.addEventListener('click',guardEvent,true);
document.addEventListener('keydown',async e=>{if(e.key!=='Enter'||e.target?.id!=='chatInput')return;if(await shouldBlock()){e.preventDefault();e.stopPropagation();showLimit()}},true);
async function refreshInputState(){const input=document.getElementById('chatInput'),send=document.querySelector('.btn-send');if(!input)return;const blocked=await shouldBlock();input.disabled=blocked;if(send)send.disabled=blocked;if(blocked)input.placeholder='Complete your first withdrawal to continue earning';else if(input.placeholder.includes('first withdrawal'))input.placeholder='Type a message...'}
function normalizeFirstCycleCopy(){const roots=['earnings','withdraw','chat','processing'].map(id=>document.getElementById(id)).filter(Boolean);for(const root of roots){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){const old=node.nodeValue||'';const next=old.replace(/₦?65,?000/g,'₦80,000').replace(/minimum\s*withdrawal\s*:?\s*₦?\d[\d,]*/ig,'Minimum withdrawal: ₦40,000');if(next!==old)node.nodeValue=next}}}
document.addEventListener('click',async e=>{const cont=e.target.closest?.('button,a');if(!cont||!/continue earning/i.test(cont.textContent||''))return;await persistUnlock();setTimeout(refreshInputState,100)},true);
const observer=new MutationObserver(()=>{normalizeFirstCycleCopy();refreshInputState()});observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
window.addEventListener('focus',refreshInputState);
setInterval(refreshInputState,1200);
async function boot(){if(await isUnlocked())await persistUnlock();normalizeFirstCycleCopy();refreshInputState()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.ChatEarnFirstCycleTaskRuntime=Object.freeze({version:'1.2.0',minimumWithdrawal:MIN_WITHDRAWAL,firstCycleLimit:FIRST_CYCLE_LIMIT,refreshInputState,unlockForCurrentUser:persistUnlock,isUnlocked});
})();