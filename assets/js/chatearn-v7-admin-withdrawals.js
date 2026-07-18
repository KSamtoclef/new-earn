/* ChatEarn Module 7B.2: stable admin withdrawal processing with bulk actions. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_MODULE_7B2__) return;
  window.__CHAT_EARN_MODULE_7B2__ = true;

  const VERSION='7B.2';
  const state={loading:false,acting:false,items:[],filter:'all',search:'',selected:new Set(),lastLoadedAt:0};
  const byId=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>'₦'+Number(v||0).toLocaleString('en-NG');
  const when=v=>v?new Date(v).toLocaleString('en-NG',{timeZone:'Africa/Lagos'}):'—';
  const panel=()=>byId('ce6-withdrawals')||byId('admin-withdrawals');
  const client=()=>{if(window.ceAdminClient?.rpc)return window.ceAdminClient;throw new Error('Admin session is still loading. Refresh and try again.')};
  const rpc=async(name,args={})=>{const{data,error}=await client().rpc(name,args);if(error)throw error;return typeof data==='string'?JSON.parse(data):data};
  const terminal=s=>['paid','completed','rejected','declined','cancelled','canceled'].includes(String(s||'').toLowerCase());
  const visible=()=>state.items.filter(i=>{const s=String(i.status||'').toLowerCase(),q=state.search.trim().toLowerCase();if(state.filter!=='all'&&s!==state.filter)return false;return !q||[i.user_name,i.public_reference,i.provider,i.account_name,i.account_last4,i.status].some(v=>String(v||'').toLowerCase().includes(q))});
  const notify=m=>window.showToast?.(m)||alert(m);

  function actionButtons(item){const s=String(item.status||'').toLowerCase();if(terminal(s))return '<span class="admin-tag">Final</span>';if(s==='processing')return `<button class="admin-action approve" data-wd-action="pay" data-id="${esc(item.id)}">Mark paid</button><button class="admin-action reject" data-wd-action="reject" data-id="${esc(item.id)}">Reject</button>`;return `<button class="admin-action approve" data-wd-action="process" data-id="${esc(item.id)}">Process</button><button class="admin-action reject" data-wd-action="reject" data-id="${esc(item.id)}">Reject</button>`}

  function render(){const host=panel();if(!host)return;const rows=visible();host.dataset.canonicalWithdrawalAdmin=VERSION;host.innerHTML=`
    <div class="ce6-head"><div><h2>Withdrawals</h2><small>Review and process withdrawal requests</small></div><button class="admin-btn" data-wd-refresh>Refresh</button></div>
    <div class="ce6-user-tools" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <select data-wd-filter>${['all','submitted','sharing_required','kyc_required','under_review','processing','paid','rejected','cancelled'].map(s=>`<option value="${s}" ${state.filter===s?'selected':''}>${s.replaceAll('_',' ')}</option>`).join('')}</select>
      <input data-wd-search value="${esc(state.search)}" placeholder="Search name, reference or bank" style="flex:1;min-width:210px">
      <button class="admin-btn" data-wd-select-all>Select all</button><button class="admin-btn" data-wd-clear-selection>Clear</button>
    </div>
    <div class="admin-status-banner" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b>${state.selected.size} selected</b><button class="admin-btn" data-wd-bulk="process">Start processing</button><button class="admin-btn" data-wd-bulk="pay">Mark paid</button><button class="admin-btn" data-wd-bulk="reject">Reject & refund</button></div>
    <div class="admin-list">${rows.map(item=>`<div class="admin-row"><input type="checkbox" data-wd-check="${esc(item.id)}" ${state.selected.has(String(item.id))?'checked':''} style="margin-right:10px"><div class="admin-row-main"><div class="admin-row-title">${esc(item.user_name||'User')} · ${money(item.amount)} <span class="admin-tag">${esc(item.status||'')}</span></div><div class="admin-row-sub">${esc(item.public_reference||'')} · ${esc(item.provider||'Bank')} •••• ${esc(item.account_last4||'')}<br>${esc(item.account_name||'')} · ${when(item.submitted_at)}</div></div><div class="admin-head-actions">${actionButtons(item)}</div></div>`).join('')||'<div class="admin-empty">No withdrawal records found.</div>'}</div>`}

  async function load(force=false){if(state.loading)return;const host=panel();if(!host)return;if(!force&&state.items.length&&Date.now()-state.lastLoadedAt<5000)return render();state.loading=true;host.innerHTML='<div class="admin-empty">Loading withdrawals…</div>';try{const data=await rpc('chatearn_admin_list_withdrawals_v5',{p_status:null,p_limit:200,p_offset:0});const rows=Array.isArray(data?.items)?data.items:Array.isArray(data?.rows)?data.rows:Array.isArray(data)?data:[];state.items=rows;state.lastLoadedAt=Date.now();state.selected=new Set([...state.selected].filter(id=>rows.some(r=>String(r.id)===id)));render()}catch(e){host.innerHTML=`<div class="admin-error" style="display:block"><b>Withdrawals could not load.</b><br>${esc(e.message||e)}<br><button class="admin-btn" data-wd-refresh style="margin-top:10px">Retry</button></div>`}finally{state.loading=false}}

  async function transition(ids,action){if(state.acting||!ids.length)return;const reason=action==='reject'?(prompt('Reason for rejection/refund:')||'').trim():'';if(action==='reject'&&!reason)return notify('A reason is required.');if(!confirm(`${action==='pay'?'Mark paid':action==='process'?'Start processing':'Reject'} ${ids.length} withdrawal(s)?`))return;state.acting=true;let ok=0,failed=0;for(const id of ids){try{const r=await rpc('chatearn_admin_transition_withdrawal_v5',{p_withdrawal_id:id,p_action:action,p_reason:reason||null,p_admin_note:null,p_external_withdrawal_id:null});if(r?.ok)ok++;else failed++}catch(_){failed++}}state.acting=false;state.selected.clear();notify(`${ok} updated${failed?`, ${failed} failed`:''}.`);await load(true)}

  function install(){if(window.__CHAT_EARN_MODULE_7B2_INSTALLED__)return;window.__CHAT_EARN_MODULE_7B2_INSTALLED__=true;document.addEventListener('click',e=>{if(e.target.closest('[data-ce6-tab="withdrawals"],[data-tab="withdrawals"]'))setTimeout(()=>load(true),60);if(e.target.closest('[data-wd-refresh]'))load(true);if(e.target.closest('[data-wd-select-all]')){visible().forEach(i=>state.selected.add(String(i.id)));render()}if(e.target.closest('[data-wd-clear-selection]')){state.selected.clear();render()}const one=e.target.closest('[data-wd-action]');if(one)transition([one.dataset.id],one.dataset.wdAction);const bulk=e.target.closest('[data-wd-bulk]');if(bulk)transition([...state.selected],bulk.dataset.wdBulk)},true);document.addEventListener('change',e=>{const f=e.target.closest('[data-wd-filter]');if(f){state.filter=f.value;render()}const c=e.target.closest('[data-wd-check]');if(c){c.checked?state.selected.add(c.dataset.wdCheck):state.selected.delete(c.dataset.wdCheck);render()}},true);document.addEventListener('input',e=>{const q=e.target.closest('[data-wd-search]');if(q){state.search=q.value;render()}},true)}
  install();
  window.ChatEarnAdminWithdrawalsV5=Object.freeze({version:VERSION,refresh:()=>load(true),diagnostic:()=>({version:VERSION,items:state.items.length,selected:state.selected.size,adminClientReady:Boolean(window.ceAdminClient?.rpc)})});
  console.info(`[ChatEarn] Admin withdrawals ${VERSION} loaded`);
})();