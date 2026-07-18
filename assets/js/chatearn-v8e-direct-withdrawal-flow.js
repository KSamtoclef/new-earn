/* ChatEarn V8E.9 — canonical direct withdrawal UI and submission controller. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_V8E9_DIRECT_WITHDRAWAL__) return;
  window.__CHAT_EARN_V8E9_DIRECT_WITHDRAWAL__ = true;

  const VERSION='8E.9',DRAFT_KEY='ce_withdrawal_draft_v8e',FLOW_KEY='ce_withdrawal_flow_v8e',IDEMPOTENCY_KEY='ce_direct_withdrawal_key';
  const byId=id=>document.getElementById(id);
  const getClient=()=>{try{if(typeof supabaseClient!=='undefined'&&supabaseClient?.rpc)return supabaseClient}catch(_){}if(window.supabaseClient?.rpc)return window.supabaseClient;throw new Error('connection_unavailable')};
  const rpc=async(name,args={})=>{const{data,error}=await getClient().rpc(name,args);if(error)throw error;return typeof data==='string'?JSON.parse(data):data};
  const loadDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch(_){return{}}};
  const saveDraft=d=>localStorage.setItem(DRAFT_KEY,JSON.stringify(d));
  const loadFlow=()=>{try{return JSON.parse(localStorage.getItem(FLOW_KEY)||'null')}catch(_){return null}};
  const saveFlow=f=>localStorage.setItem(FLOW_KEY,JSON.stringify({...f,updated_at:Date.now()}));
  const BANKS=[['opay','OPay'],['palmpay','PalmPay'],['kuda','Kuda Bank'],['moniepoint','Moniepoint'],['gtbank','GTBank'],['access','Access Bank'],['firstbank','First Bank'],['uba','UBA'],['zenith','Zenith Bank'],['fcmb','FCMB'],['fidelity','Fidelity Bank'],['sterling','Sterling Bank'],['wema','Wema Bank / ALAT'],['union','Union Bank'],['stanbic','Stanbic IBTC'],['ecobank','Ecobank'],['polaris','Polaris Bank'],['keystone','Keystone Bank'],['providus','Providus Bank'],['other','Other Nigerian bank']];

  const technical=t=>/public\.chatearn_|schema cache|could not find the function|permission denied for function/i.test(String(t||''));
  function removeTechnicalNotices(root=document){root.querySelectorAll?.('.toast,.ce-toast,[role="alert"],.admin-status-banner,.error-toast,.toast-message').forEach(el=>{if(technical(el.textContent))el.remove()});const portal=byId('withdrawalPortalStatus');if(portal&&technical(portal.textContent))portal.style.display='none'}
  function patchToast(){if(window.__CE_QUIET_WITHDRAWAL_TOAST__)return;window.__CE_QUIET_WITHDRAWAL_TOAST__=true;const original=window.showToast;if(typeof original==='function')window.showToast=function(message,...rest){if(technical(message))return;return original.call(this,message,...rest)}}
  function cleanOldUi(){byId('cePayoutAccountForm')?.remove();document.querySelectorAll('#withdraw .form-group,#withdraw .btn-place-wd,#withdraw .admin-status-banner').forEach(el=>{if(!el.closest('#ceDirectWithdrawalForm'))el.style.display='none'});const portal=byId('withdrawalPortalStatus');if(portal)portal.style.display='none';document.querySelectorAll('#withdraw .wd-body > div').forEach(el=>{if(el.id==='ceDirectWithdrawalForm'||el.closest('#ceDirectWithdrawalForm'))return;const t=(el.textContent||'').toLowerCase();if(t.includes('verified payout account')||t.includes('secure withdrawal')||t.includes('withdrawal information could not be loaded'))el.style.display='none'});removeTechnicalNotices()}
  function visibleAmount(){const stateAmount=Number(window.ChatEarnWithdrawalV5?.getState?.()?.portal?.wallet?.available_balance||0);if(stateAmount>0)return stateAmount;try{if(Number(totalBalance)>0)return Number(totalBalance)}catch(_){}const text=document.querySelector('#withdraw .wd-amount-display,#withdraw .amount-display,#withdraw .wd-amount')?.textContent||'';return Number(text.replace(/[^0-9]/g,''))||0}

  function routeWithdrawal(item){
    item=item?.withdrawal||item?.request||item?.data||item;
    const id=item?.withdrawal_id||item?.id||null,status=String(item?.status||item?.next||'sharing_required').toLowerCase();
    if(!id)return false;
    localStorage.removeItem(IDEMPOTENCY_KEY);
    if(status==='sharing_required'||status==='submitted'||status==='sharewall'){saveFlow({withdrawal_id:id,stage:'sharing_required'});window.goScreen?.('sharewall');return true}
    if(status==='kyc_required'||status==='needs_action'||status==='kyc'){saveFlow({withdrawal_id:id,stage:'kyc_required'});window.goScreen?.('kyc');return true}
    saveFlow({withdrawal_id:id,stage:'processing'});window.goScreen?.('processing');return true;
  }
  async function recoverActive(){try{const r=await rpc('chatearn_get_active_withdrawal_v7');return r?.ok&&r?.active?routeWithdrawal(r.active):false}catch(_){return false}}

  async function placeWithFallback({provider,accountNumber,accountName,amount,key}){
    let primary=null;
    try{primary=await rpc('chatearn_place_withdrawal_now_v7',{p_provider:provider,p_account_number:accountNumber,p_account_name:accountName,p_amount:amount,p_idempotency_key:key});if(primary?.ok)return primary}catch(_){}
    const saved=await rpc('chatearn_save_payout_account_v5',{p_provider:provider,p_account_number:accountNumber,p_account_name:accountName,p_is_default:false});
    if(!saved?.ok) return primary||saved;
    const accountId=saved?.account?.id||saved?.account_id||saved?.id;
    if(!accountId)return primary||{ok:false,code:'bank_details_failed'};
    return rpc('chatearn_submit_withdrawal_v5',{p_payout_account_id:accountId,p_amount:amount,p_idempotency_key:key,p_client_metadata:null});
  }

  function ensureDirectForm(){
    const body=document.querySelector('#withdraw .wd-body');if(!body)return;cleanOldUi();if(byId('ceDirectWithdrawalForm'))return;
    const d=loadDraft(),f=document.createElement('form');f.id='ceDirectWithdrawalForm';f.className='ce-direct-withdrawal-form';f.style.cssText='margin:18px 0 0;display:grid;gap:14px';
    f.innerHTML=`<div class="form-group" style="display:block"><label class="form-label">Select Bank</label><select id="ceDirectBank" class="form-input" required>${BANKS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div><div class="form-group" style="display:block"><label class="form-label">Account Name</label><input id="ceDirectAccountName" class="form-input" required maxlength="120" autocomplete="name" placeholder="Enter the name on the bank account"></div><div class="form-group" style="display:block"><label class="form-label">Account Number</label><input id="ceDirectAccountNumber" class="form-input" required inputmode="numeric" maxlength="10" autocomplete="off" placeholder="Enter 10-digit account number"></div><div style="background:rgba(0,200,83,.08);border:1px solid rgba(0,200,83,.2);border-radius:10px;padding:12px 14px;font-size:12px;color:#69F0AE;line-height:1.55">🔒 Your withdrawal details and progress are saved securely.</div><button type="submit" class="btn-place-wd" style="display:block!important">Place My Withdrawal Now →</button><div id="ceDirectWithdrawalStatus" style="font-size:12px;color:var(--text);text-align:center;min-height:18px">Next: compulsory sharing, KYC, then payment processing.</div>`;
    body.appendChild(f);const bank=byId('ceDirectBank'),name=byId('ceDirectAccountName'),number=byId('ceDirectAccountNumber');bank.value=d.bank||'opay';name.value=d.account_name||'';number.value=d.account_number||'';
    const persist=()=>saveDraft({bank:bank.value,account_name:name.value.trim(),account_number:number.value.replace(/\D/g,'').slice(0,10)});bank.onchange=persist;name.oninput=persist;number.oninput=()=>{number.value=number.value.replace(/\D/g,'').slice(0,10);persist()};
    f.onsubmit=async e=>{
      e.preventDefault();removeTechnicalNotices();const btn=f.querySelector('button'),status=byId('ceDirectWithdrawalStatus'),accountName=name.value.trim(),accountNumber=number.value.replace(/\D/g,'').slice(0,10);
      if(accountName.length<3||!/[a-zA-Z]/.test(accountName)){status.textContent='Enter the correct account name.';name.focus();return}
      if(accountNumber.length!==10){status.textContent='Enter a valid 10-digit account number.';number.focus();return}
      btn.disabled=true;btn.textContent='Checking Balance…';status.textContent='Confirming your available balance…';
      await window.ChatEarnWithdrawalV5?.refresh?.();
      const amount=visibleAmount();if(amount<40000){status.textContent='Your withdrawal amount is not ready yet.';btn.disabled=false;btn.textContent='Place My Withdrawal Now →';return}
      persist();btn.textContent='Placing Withdrawal…';status.textContent='Securing your request…';let key=localStorage.getItem(IDEMPOTENCY_KEY);if(!key){key=`direct-${crypto.randomUUID()}`;localStorage.setItem(IDEMPOTENCY_KEY,key)}
      try{const r=await placeWithFallback({provider:bank.value,accountNumber,accountName,amount,key});if(r?.ok&&routeWithdrawal(r))return;if(await recoverActive())return;status.textContent=r?.code==='authentication_required'?'Your session expired. Log in again and retry.':'Withdrawal could not be started. Please try again shortly.'}
      catch(_){if(!(await recoverActive()))status.textContent='Withdrawal could not be started. Please try again shortly.'}
      finally{btn.disabled=false;btn.textContent='Place My Withdrawal Now →';removeTechnicalNotices()}
    };
  }

  function showContinue(){const p=byId('processing');if(!p||byId('ceContinueEarningBtn'))return;const w=document.createElement('div');w.style.cssText='margin-top:18px;text-align:center;max-width:430px;padding:0 20px';w.innerHTML='<div style="margin-bottom:12px">Your payment is processing securely. You can continue earning.</div><button id="ceContinueEarningBtn" class="btn-place-wd" style="display:block!important">Continue Earning →</button>';p.appendChild(w);byId('ceContinueEarningBtn').onclick=async()=>{const flow=loadFlow(),btn=byId('ceContinueEarningBtn');btn.disabled=true;try{if(flow?.withdrawal_id)await rpc('chatearn_resume_earning_after_withdrawal_v6',{p_withdrawal_id:flow.withdrawal_id});localStorage.setItem('ce_returning_user','1');saveFlow({withdrawal_id:flow?.withdrawal_id||null,stage:'processing'});window.ChatEarnV8DFlow?.openNextConversation?.()||window.goScreen?.('dashboard')}catch(_){btn.disabled=false}}}
  function resume(){const f=loadFlow();if(!f?.stage)return;let s='';try{s=currentScreen||''}catch(_){}if(f.stage==='sharing_required'&&['withdraw','processing'].includes(s))window.goScreen?.('sharewall');else if(f.stage==='kyc_required'&&s==='withdraw')window.goScreen?.('kyc')}
  const original=window.goScreen;if(typeof original==='function')window.goScreen=function(id){const r=original(id);if(id==='withdraw')setTimeout(()=>{ensureDirectForm();window.ChatEarnWithdrawalV5?.refresh?.();recoverActive()},80);if(id==='processing')setTimeout(showContinue,60);return r};
  function boot(){patchToast();cleanOldUi();let s='';try{s=currentScreen||''}catch(_){}if(s==='withdraw'){ensureDirectForm();window.ChatEarnWithdrawalV5?.refresh?.();recoverActive()}if(s==='processing')showContinue();resume()}
  const observer=new MutationObserver(records=>{for(const r of records){if(r.addedNodes.length){removeTechnicalNotices();break}}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{boot();observer.observe(document.body,{childList:true,subtree:true})},{once:true});else{boot();observer.observe(document.body,{childList:true,subtree:true})}
  window.addEventListener('pageshow',()=>setTimeout(boot,120));
  window.ChatEarnV8EDirectWithdrawal=Object.freeze({version:VERSION,ensureDirectForm,recoverActive,diagnostic:()=>({version:VERSION,flow:loadFlow(),soleUiOwner:true,soleSubmitOwner:true})});
})();