/* ChatEarn first-cycle earning gate v1.4.0 */
(()=>{
'use strict';
if(window.__CHAT_EARN_FIRST_CYCLE_TASK_RUNTIME__)return;
window.__CHAT_EARN_FIRST_CYCLE_TASK_RUNTIME__=true;
const MIN_WITHDRAWAL=40000,FIRST_CYCLE_LIMIT=80000;
let state={userId:null,balance:0,unlocked:false,checkedAt:0},sendWrapped=false;
const toast=m=>window.showToast?window.showToast(m):alert(m);
const parseMoney=v=>Number(String(v||'').replace(/[^0-9.]/g,''))||0;
const client=()=>{try{if(typeof supabaseClient!=='undefined'&&supabaseClient?.rpc)return supabaseClient}catch(_){}return window.supabaseClient?.rpc?window.supabaseClient:window.ceAdminClient?.rpc?window.ceAdminClient:null};
function localBalance(){let value=0;try{value=Math.max(value,Number(totalBalance)||0)}catch(_){}return Math.max(value,parseMoney(document.getElementById('earnPageAmount')?.textContent),parseMoney(document.getElementById('dashBalance')?.textContent),parseMoney(document.getElementById('totalEarnBreakdown')?.textContent),parseMoney(document.getElementById('wdAmount')?.textContent))}
async function refreshState(force=false){if(!force&&Date.now()-state.checkedAt<2500)return state;const c=client();if(!c)return state;try{const{data,error}=await c.rpc('chatearn_first_cycle_state');if(error)throw error;const d=typeof data==='string'?JSON.parse(data):data;state={userId:d?.user_id||null,balance:Number(d?.balance||0),unlocked:Boolean(d?.unlocked),checkedAt:Date.now()}}catch(_){state={...state,balance:localBalance(),checkedAt:Date.now()}}return state}
async function isUnlocked(){return Boolean((await refreshState()).unlocked)}
async function shouldBlock(){const s=await refreshState();return Math.max(s.balance,localBalance())>=FIRST_CYCLE_LIMIT&&!s.unlocked}
function clampBalance(){try{if(Number(totalBalance)>FIRST_CYCLE_LIMIT)totalBalance=FIRST_CYCLE_LIMIT}catch(_){}document.querySelectorAll('#earnPageAmount,#dashBalance,#totalEarnBreakdown,#wdAmount').forEach(el=>{const n=parseMoney(el.textContent);if(n>FIRST_CYCLE_LIMIT)el.textContent=FIRST_CYCLE_LIMIT.toLocaleString('en-NG')});try{window.updateBalance?.()}catch(_){}}
function showLimit(){clampBalance();toast('You have reached the ₦80,000 first-withdrawal limit. Complete your withdrawal to continue earning.');const input=document.getElementById('chatInput'),send=document.querySelector('.btn-send');if(input){input.disabled=true;input.placeholder='Withdraw your ₦80,000 to continue earning'}if(send)send.disabled=true;try{window.goScreen?.('withdraw')}catch(_){try{window.goScreen?.('earnings')}catch(__){}}}
async function guardEvent(e){const send=e.target.closest?.('.btn-send,.quick-reply,.quick-replies button');if(!send)return;if(await shouldBlock()){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();showLimit()}}
document.addEventListener('click',guardEvent,true);
document.addEventListener('keydown',async e=>{if(e.key!=='Enter'||e.target?.id!=='chatInput')return;if(await shouldBlock()){e.preventDefault();e.stopPropagation();showLimit()}},true);
function wrapSend(){if(sendWrapped||typeof window.sendMsg!=='function')return false;const original=window.sendMsg;window.sendMsg=async function(...args){if(await shouldBlock()){showLimit();return false}const result=await original.apply(this,args);await refreshState(true);if(await shouldBlock())setTimeout(showLimit,80);return result};window.sendMsg.__ceFirstCycleWrapped=true;sendWrapped=true;return true}
async function refreshInputState(){const input=document.getElementById('chatInput'),send=document.querySelector('.btn-send');if(!input)return;const blocked=await shouldBlock();input.disabled=blocked;if(send)send.disabled=blocked;if(blocked)input.placeholder='Withdraw your ₦80,000 to continue earning';else if(/withdraw your|first withdrawal|place your withdrawal/i.test(input.placeholder))input.placeholder='Type a message...'}
function normalizeFirstCycleCopy(){const roots=['earnings','withdraw','chat','processing'].map(id=>document.getElementById(id)).filter(Boolean);for(const root of roots){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){const old=node.nodeValue||'';const next=old.replace(/₦?65,?000/g,'₦80,000').replace(/minimum\s*withdrawal\s*:?\s*₦?\d[\d,]*/ig,'Minimum withdrawal: ₦40,000');if(next!==old)node.nodeValue=next}}}
const observer=new MutationObserver(()=>{normalizeFirstCycleCopy();wrapSend();refreshInputState()});observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
window.addEventListener('focus',()=>{refreshState(true).then(refreshInputState)});
setInterval(()=>{wrapSend();refreshInputState()},1500);
async function boot(){await refreshState(true);normalizeFirstCycleCopy();wrapSend();refreshInputState();if(await shouldBlock())showLimit()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.ChatEarnFirstCycleTaskRuntime=Object.freeze({version:'1.4.0',minimumWithdrawal:MIN_WITHDRAWAL,firstCycleLimit:FIRST_CYCLE_LIMIT,refreshInputState,isUnlocked,shouldBlock,refreshState,realBalance:localBalance});
})();