/* ChatEarn Chat Task Admin v1.0.0 */
(()=>{
'use strict';
if(window.__CHAT_EARN_CHAT_TASK_ADMIN__)return;
window.__CHAT_EARN_CHAT_TASK_ADMIN__=true;
const VERSION='1.0.0';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parse=v=>typeof v==='string'?JSON.parse(v):v;
const toast=m=>window.showToast?window.showToast(m):alert(m);
async function rpc(name,args={}){const c=window.ceAdminClient;if(!c?.rpc)throw new Error('Admin connection is still loading.');const{data,error}=await c.rpc(name,args);if(error)throw error;return parse(data)}
function preferredTask(tasks=[]){return tasks.find(t=>t.task_key==='quick_earning_task')||tasks.find(t=>t.task_type==='offer'&&t.active)||tasks.find(t=>t.task_type==='chat_continue'&&t.active)||tasks[0]||null}
function offerLabel(o){return `${o.name||o.offer_key}${o.active?'':' (paused)'}`}
async function render(){
 const panel=$('ce6-offers');
 if(!panel||!panel.classList.contains('active'))return;
 let host=$('ceChatTaskSettings');
 if(!host){host=document.createElement('section');host.id='ceChatTaskSettings';host.style.cssText='margin:22px 0;padding:18px;border:1px solid rgba(0,200,83,.35);border-radius:18px;background:rgba(0,200,83,.035)';const editor=$('ce6SponsoredEditor');(editor?.parentNode||panel).insertBefore(host,editor?editor.nextSibling:panel.firstChild)}
 host.innerHTML='<div class="admin-empty">Loading chat task settings…</div>';
 try{
  const data=await rpc('chatearn_v6_admin_manager_inventory',{});
  const offers=(data.offers||[]).filter(o=>!o.archived_at);
  const tasks=(data.tasks||[]).filter(t=>!t.archived_at);
  const task=preferredTask(tasks)||{};
  host.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h3 style="margin:0 0 6px">Chat Task Settings</h3><small style="color:var(--muted)">Control the “Quick earning task” card and choose exactly which sponsored ad its button opens.</small></div><button type="button" class="admin-btn" id="ceTaskSettingsRefresh">Refresh</button></div>
  <form id="ceChatTaskForm" class="ce6-form" style="margin-top:16px">
   <input type="hidden" name="key" value="${esc(task.task_key||'quick_earning_task')}">
   <input class="wide" name="title" maxlength="90" placeholder="Task headline" value="${esc(task.title||'Quick earning task')}" required>
   <textarea class="wide" name="subtitle" maxlength="220" placeholder="Task description" required>${esc(task.subtitle||'Complete this short task, then return and continue earning.')}</textarea>
   <input name="button" maxlength="40" placeholder="CTA button text" value="${esc(task.button_text||'Start quick task')}" required>
   <select name="linkedOffer" required><option value="">Select the sponsored ad to open</option>${offers.map(o=>`<option value="${esc(o.offer_key)}" ${task.linked_offer_key===o.offer_key?'selected':''}>${esc(offerLabel(o))}</option>`).join('')}</select>
   <label style="display:flex;align-items:center;gap:8px"><input name="active" type="checkbox" ${task.active!==false?'checked':''}> Show this task inside chat</label>
   <button class="admin-btn primary" type="submit">Save Chat Task</button>
   <div id="ceChatTaskStatus" class="wide" style="min-height:20px;font-size:13px;color:var(--muted)"></div>
  </form>`;
 }catch(e){host.innerHTML=`<div class="admin-empty">${esc(e.message||e)}</div>`}
}
async function save(form){
 const status=$('ceChatTaskStatus'),button=form.querySelector('button[type="submit"]'),old=button.textContent;
 button.disabled=true;button.textContent='Saving…';status.textContent='Saving chat task settings…';
 try{
  const f=new FormData(form),linked=String(f.get('linkedOffer')||'').trim();if(!linked)throw new Error('Select the sponsored ad this task should open.');
  await rpc('chatearn_v6_admin_save_task',{
   p_task_key:String(f.get('key')||'quick_earning_task'),p_title:String(f.get('title')||'').trim(),p_subtitle:String(f.get('subtitle')||'').trim(),p_button_text:String(f.get('button')||'').trim(),p_task_type:'offer',p_required_count:1,p_reward_amount:0,p_min_visit:1,p_display_order:1,p_active:f.get('active')==='on',p_cooldown_hours:0,p_max_daily_completions:100,p_linked_offer_key:linked,p_notes:'Managed from Sponsored Ads → Chat Task Settings'
  });
  status.textContent='Chat task saved. Its button will open the selected sponsored ad.';toast('Chat task settings saved.');
 }catch(e){status.textContent=e.message||'Unable to save chat task.';toast(status.textContent)}finally{button.disabled=false;button.textContent=old}
}
document.addEventListener('click',e=>{if(e.target.closest('[data-ce6-tab="offers"]'))setTimeout(render,250);if(e.target.closest('#ceTaskSettingsRefresh'))render()},true);
document.addEventListener('submit',e=>{if(e.target.id!=='ceChatTaskForm')return;e.preventDefault();e.stopImmediatePropagation();save(e.target)},true);
const observer=new MutationObserver(()=>{if(document.querySelector('#ce6-offers.active')&&!$('ceChatTaskSettings'))setTimeout(render,120)});observer.observe(document.documentElement,{childList:true,subtree:true});
window.ChatEarnChatTaskAdmin=Object.freeze({version:VERSION,render});
})();