/* ChatEarn Chat Task Admin v2.0.0 */
(()=>{
'use strict';
if(window.__CHAT_EARN_CHAT_TASK_ADMIN__)return;
window.__CHAT_EARN_CHAT_TASK_ADMIN__=true;
const VERSION='2.0.0';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parse=v=>typeof v==='string'?JSON.parse(v):v;
const toast=m=>window.showToast?window.showToast(m):alert(m);
async function rpc(name,args={}){const c=window.ceAdminClient;if(!c?.rpc)throw new Error('Admin connection is still loading.');const{data,error}=await c.rpc(name,args);if(error)throw error;return parse(data)}
function offerLabel(o){return `${o.name||o.offer_key}${o.active?'':' (paused)'}`}
async function render(){
 const panel=$('ce6-offers');if(!panel||!panel.classList.contains('active'))return;
 let host=$('ceChatTaskSettings');if(!host){host=document.createElement('section');host.id='ceChatTaskSettings';host.style.cssText='margin:18px 0 24px;padding:18px;border:1px solid rgba(255,193,7,.45);border-radius:18px;background:linear-gradient(145deg,rgba(255,193,7,.08),rgba(0,0,0,.12))';panel.insertBefore(host,panel.firstChild)}
 host.innerHTML='<div class="admin-empty">Loading chat task control…</div>';
 try{
  const [data,current]=await Promise.all([rpc('chatearn_v6_admin_manager_inventory',{}),rpc('chatearn_get_chat_task_config',{}).catch(()=>null)]);
  const offers=(data.offers||[]).filter(o=>!o.archived_at);
  const cfg=current||{};
  host.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h3 style="margin:0 0 5px">⚡ Chat Task Button</h3><small style="color:var(--muted)">This directly controls the clickable task card shown between chat messages.</small></div><button type="button" class="admin-btn" id="ceTaskSettingsRefresh">Refresh</button></div>
  <form id="ceChatTaskForm" class="ce6-form" style="margin-top:16px">
   <input class="wide" name="title" maxlength="90" placeholder="Task headline" value="${esc(cfg.title||'Quick earning task')}" required>
   <textarea class="wide" name="description" maxlength="220" placeholder="Task description" required>${esc(cfg.description||'Complete this short task, then return and continue earning.')}</textarea>
   <input name="cta" maxlength="40" placeholder="Button text" value="${esc(cfg.cta||'Start quick task')}" required>
   <select name="linkedOffer" required><option value="">Choose the sponsored ad this button opens</option>${offers.map(o=>`<option value="${esc(o.offer_key)}" ${cfg.offer_key===o.offer_key?'selected':''}>${esc(offerLabel(o))}</option>`).join('')}</select>
   <label style="display:flex;align-items:center;gap:8px"><input name="active" type="checkbox" ${cfg.active!==false?'checked':''}> Show clickable task inside chat</label>
   <button class="admin-btn primary" type="submit" style="min-height:54px;font-size:16px">Save & Activate Chat Task</button>
   <button class="admin-btn" type="button" id="ceTestChatTask">Test selected task link</button>
   <div id="ceChatTaskStatus" class="wide" style="min-height:20px;font-size:13px;color:var(--muted)"></div>
  </form>`;
 }catch(e){host.innerHTML=`<div class="admin-empty">${esc(e.message||e)}. Run the latest chat-task SQL migration in Supabase first.</div>`}
}
async function save(form){const status=$('ceChatTaskStatus'),button=form.querySelector('button[type="submit"]'),old=button.textContent;button.disabled=true;button.textContent='Saving…';status.textContent='Saving clickable chat task…';try{const f=new FormData(form),linked=String(f.get('linkedOffer')||'').trim();if(!linked)throw new Error('Choose the sponsored ad this task should open.');await rpc('chatearn_admin_save_chat_task_config',{p_title:String(f.get('title')||'').trim(),p_description:String(f.get('description')||'').trim(),p_cta:String(f.get('cta')||'').trim(),p_linked_offer_key:linked,p_active:f.get('active')==='on'});status.textContent='Saved. The chat task is now clickable and opens the selected sponsored ad.';toast('Clickable chat task activated.')}catch(e){status.textContent=e.message||'Unable to save chat task.';toast(status.textContent)}finally{button.disabled=false;button.textContent=old}}
async function testLink(){const form=$('ceChatTaskForm'),status=$('ceChatTaskStatus');if(!form)return;try{const f=new FormData(form),key=String(f.get('linkedOffer')||'');if(!key)throw new Error('Choose a sponsored ad first.');const d=await rpc('chatearn_v6_admin_manager_inventory',{}),offer=(d.offers||[]).find(o=>o.offer_key===key);if(!offer?.url)throw new Error('The selected sponsored ad has no URL.');window.open(offer.url,'_blank','noopener,noreferrer');status.textContent='Test link opened in a new tab.'}catch(e){status.textContent=e.message||String(e)}}
document.addEventListener('click',e=>{if(e.target.closest('[data-ce6-tab="offers"]'))setTimeout(render,250);if(e.target.closest('#ceTaskSettingsRefresh'))render();if(e.target.closest('#ceTestChatTask'))testLink()},true);
document.addEventListener('submit',e=>{if(e.target.id!=='ceChatTaskForm')return;e.preventDefault();e.stopImmediatePropagation();save(e.target)},true);
const observer=new MutationObserver(()=>{if(document.querySelector('#ce6-offers.active')&&!$('ceChatTaskSettings'))setTimeout(render,120)});observer.observe(document.documentElement,{childList:true,subtree:true});
window.ChatEarnChatTaskAdmin=Object.freeze({version:VERSION,render});
})();