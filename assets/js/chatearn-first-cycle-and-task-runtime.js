/* ChatEarn first-cycle cap + linked task runtime v1.0.0 */
(()=>{
'use strict';
if(window.__CHAT_EARN_FIRST_CYCLE_TASK_RUNTIME__)return;
window.__CHAT_EARN_FIRST_CYCLE_TASK_RUNTIME__=true;
const LIMIT=80000;
const URL='https://dtjxcgzpwemdgdeinkcl.supabase.co';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0anhjZ3pwd2VtZGdkZWlua2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDg0ODQsImV4cCI6MjA5MzQ4NDQ4NH0.kGjtOZfK7onzr-3FVMuSljiJ3emllxtGdepxrFVUPPM';
const client=window.supabase?.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sb-dtjxcgzpwemdgdeinkcl-auth-token'}});
let userId=null,task=null,lastFetch=0;
const toast=m=>window.showToast?window.showToast(m):alert(m);
const parseMoney=v=>Number(String(v||'').replace(/[^0-9.]/g,''))||0;
async function currentUserId(){if(userId)return userId;try{const{data}=await client.auth.getSession();userId=data?.session?.user?.id||null}catch(_){}return userId}
async function unlockKey(){const id=await currentUserId();return id?`ce_first_cycle_unlocked:${id}`:null}
async function isUnlocked(){const key=await unlockKey();return !!(key&&localStorage.getItem(key)==='1')}
function visibleBalance(){return Math.max(parseMoney(document.getElementById('earnPageAmount')?.textContent),parseMoney(document.getElementById('dashBalance')?.textContent),parseMoney(document.getElementById('totalEarnBreakdown')?.textContent),parseMoney(document.getElementById('wdAmount')?.textContent))}
async function shouldBlock(){return visibleBalance()>=LIMIT&&!(await isUnlocked())}
function showLimit(){toast('You have reached the ₦80,000 first-withdrawal limit. Complete your withdrawal to continue earning.');try{window.goScreen?.('earnings')}catch(_){}const input=document.getElementById('chatInput');if(input){input.disabled=true;input.placeholder='Complete your first withdrawal to continue earning'}}
async function guardEvent(e){const send=e.target.closest?.('.btn-send,.quick-reply');if(!send)return;if(await shouldBlock()){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();showLimit()}}
document.addEventListener('click',guardEvent,true);
document.addEventListener('keydown',async e=>{if(e.key!=='Enter'||e.target?.id!=='chatInput')return;if(await shouldBlock()){e.preventDefault();e.stopPropagation();showLimit()}},true);
async function refreshInputState(){const input=document.getElementById('chatInput'),send=document.querySelector('.btn-send');if(!input)return;const blocked=await shouldBlock();input.disabled=blocked;if(send)send.disabled=blocked;if(blocked)input.placeholder='Complete your first withdrawal to continue earning';else if(input.placeholder.includes('first withdrawal'))input.placeholder='Type a message...'}
async function fetchTask(force=false){if(!force&&task&&Date.now()-lastFetch<30000)return task;lastFetch=Date.now();try{const{data,error}=await client.rpc('chatearn_get_chat_task_config');if(error)throw error;task=typeof data==='string'?JSON.parse(data):data}catch(_){task=null}return task}
function taskCard(){return [...document.querySelectorAll('#chatBody *')].find(el=>/Quick earning task/i.test(el.textContent||'')&&el.querySelector?.('button,a'))?.closest('div[style],article,section')||null}
async function hydrateTask(){const cfg=await fetchTask();if(!cfg?.active)return;const candidates=[...document.querySelectorAll('#chatBody button,#chatBody a')].filter(el=>/quick task|start quick|earning task/i.test(el.textContent||''));for(const btn of candidates){btn.dataset.ceLinkedTask='1';btn.style.cursor='pointer';btn.disabled=false;btn.onclick=null;btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!cfg.url)return toast('This task does not have a sponsored ad linked yet.');window.open(cfg.url,'_blank','noopener,noreferrer')},{once:false});const card=btn.closest('div[style],article,section');if(card){const text=[...card.querySelectorAll('div,p,h1,h2,h3,b,strong')];const title=text.find(x=>/Quick earning task/i.test(x.textContent||''));if(title)title.textContent=cfg.title||'Quick earning task';const desc=text.find(x=>/Complete this short task/i.test(x.textContent||''));if(desc)desc.textContent=cfg.description||desc.textContent;btn.textContent=(cfg.cta||'Start quick task')+' →'}}}
const observer=new MutationObserver(()=>{refreshInputState();hydrateTask()});observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
document.addEventListener('click',async e=>{const cont=e.target.closest?.('[onclick*="continue" i],button');if(!cont||!/continue earning/i.test(cont.textContent||''))return;const key=await unlockKey();if(key)localStorage.setItem(key,'1');localStorage.setItem('ce_returning_user','1');setTimeout(refreshInputState,100)},true);
window.addEventListener('focus',()=>{fetchTask(true).then(hydrateTask);refreshInputState()});
setInterval(refreshInputState,1500);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{refreshInputState();hydrateTask()},{once:true});else{refreshInputState();hydrateTask()}
window.ChatEarnFirstCycleTaskRuntime=Object.freeze({version:'1.0.0',refreshInputState,hydrateTask,unlockForCurrentUser:async()=>{const key=await unlockKey();if(key)localStorage.setItem(key,'1')}});
})();