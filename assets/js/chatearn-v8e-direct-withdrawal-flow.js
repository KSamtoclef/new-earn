/* ChatEarn V8E.3 — natural, persistent direct withdrawal journey. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_V8E3_DIRECT_WITHDRAWAL__) return;
  window.__CHAT_EARN_V8E3_DIRECT_WITHDRAWAL__=true;
  const VERSION='8E.3',DRAFT_KEY='ce_withdrawal_draft_v8e',FLOW_KEY='ce_withdrawal_flow_v8e',IDEMPOTENCY_KEY='ce_direct_withdrawal_key';
  const byId=id=>document.getElementById(id),toast=m=>window.showToast?.(m);
  const getClient=()=>{try{if(typeof supabaseClient!=='undefined'&&supabaseClient?.rpc)return supabaseClient}catch(_){}if(window.supabaseClient?.rpc)return window.supabaseClient;throw new Error('Secure connection is still loading. Please try again.')};
  const rpc=async(name,args={})=>{const{data,error}=await getClient().rpc(name,args);if(error)throw error;return typeof data==='string'?JSON.parse(data):data};
  const loadDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch(_){return{}}},saveDraft=d=>localStorage.setItem(DRAFT_KEY,JSON.stringify(d));
  const loadFlow=()=>{try{return JSON.parse(localStorage.getItem(FLOW_KEY)||'null')}catch(_){return null}},saveFlow=f=>localStorage.setItem(FLOW_KEY,JSON.stringify({...f,updated_at:Date.now()}));
  const BANKS=[['opay','OPay'],['palmpay','PalmPay'],['kuda','Kuda Bank'],['moniepoint','Moniepoint'],['gtbank','GTBank'],['access','Access Bank'],['firstbank','First Bank'],['uba','UBA'],['zenith','Zenith Bank'],['fcmb','FCMB'],['fidelity','Fidelity Bank'],['sterling','Sterling Bank'],['wema','Wema Bank / ALAT'],['union','Union Bank'],['stanbic','Stanbic IBTC'],['ecobank','Ecobank'],['polaris','Polaris Bank'],['keystone','Keystone Bank'],['providus','Providus Bank'],['other','Other Nigerian bank']];

  function cleanOldUi(){
    byId('cePayoutAccountForm')?.remove();
    document.querySelectorAll('#withdraw .form-group,#withdraw .btn-place-wd,#withdraw .admin-status-banner').forEach(el=>el.style.display='none');
    const status=byId('withdrawalPortalStatus');if(status)status.style.display='none';
    document.querySelectorAll('#withdraw .wd-body > div').forEach(el=>{const t=(el.textContent||'').toLowerCase();if(t.includes('verified payout account')||t.includes('secure withdrawal')||t.includes('withdrawal information could not be loaded'))el.style.display='none'});
  }

  function ensureDirectForm(){
    const body=document.querySelector('#withdraw .wd-body');if(!body)return;cleanOldUi();
    if(byId('ceDirectWithdrawalForm'))return;
    const d=loadDraft(),f=document.createElement('form');f.id='ceDirectWithdrawalForm';f.className='ce-direct-withdrawal-form';
    f.style.cssText='margin:18px 0 0;display:grid;gap:14px';
    f.innerHTML=`
      <div class="form-group" style="display:block"><label class="form-label">Select Bank</label><select id="ceDirectBank" class="form-input" required>${BANKS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="form-group" style="display:block"><label class="form-label">Account Name</label><input id="ceDirectAccountName" class="form-input" required maxlength="120" autocomplete="name" placeholder="Enter the name on the bank account"></div>
      <div class="form-group" style="display:block"><label class="form-label">Account Number</label><input id="ceDirectAccountNumber" class="form-input" required inputmode="numeric" maxlength="10" autocomplete="off" placeholder="Enter 10-digit account number"></div>
      <div style="background:rgba(0,200,83,.08);border:1px solid rgba(0,200,83,.2);border-radius:10px;padding:12px 14px;font-size:12px;color:#69F0AE;line-height:1.55">🔒 Your withdrawal details and progress are saved securely.</div>
      <button type="submit" class="btn-place-wd" style="display:block!important">Place My Withdrawal Now →</button>
      <div id="ceDirectWithdrawalStatus" style="font-size:12px;color:var(--text);text-align:center">Next: compulsory sharing, KYC, then payment processing.</div>`;
    body.appendChild(f);
    const bank=byId('ceDirectBank'),name=byId('ceDirectAccountName'),number=byId('ceDirectAccountNumber');
    bank.value=d.bank||'opay';name.value=d.account_name||'';number.value=d.account_number||'';
    const persist=()=>saveDraft({bank:bank.value,account_name:name.value.trim(),account_number:number.value.replace(/\D/g,'').slice(0,10)});
    bank.onchange=persist;name.oninput=persist;number.oninput=()=>{number.value=number.value.replace(/\D/g,'').slice(0,10);persist()};
    f.onsubmit=async e=>{e.preventDefault();const btn=f.querySelector('button'),accountName=name.value.trim(),accountNumber=number.value.replace(/\D/g,'').slice(0,10);if(accountName.length<3||!/[a-zA-Z]/.test(accountName))return toast('Enter the correct account name.');if(accountNumber.length!==10)return toast('Enter a valid 10-digit account number.');persist();btn.disabled=true;btn.textContent='Placing Withdrawal…';let key=localStorage.getItem(IDEMPOTENCY_KEY);if(!key){key=`direct-${crypto.randomUUID()}`;localStorage.setItem(IDEMPOTENCY_KEY,key)}try{const portalAmount=Number(window.ChatEarnWithdrawalV5?.getState?.()?.portal?.wallet?.available_balance||0);let fallback=0;try{fallback=Number(totalBalance||0)}catch(_){}const r=await rpc('chatearn_place_withdrawal_direct_v6',{p_provider:bank.value,p_account_number:accountNumber,p_account_name:accountName,p_amount:portalAmount||fallback,p_idempotency_key:key});if(r?.ok===false)throw new Error(r.message||'Withdrawal could not be placed.');saveFlow({withdrawal_id:r.withdrawal_id,stage:'sharing_required'});toast('Withdrawal placed. Complete the sharing step.');window.goScreen?.('sharewall')}catch(err){toast(err.message||'Withdrawal could not be placed. Please try again.')}finally{btn.disabled=false;btn.textContent='Place My Withdrawal Now →'}};
  }

  function showContinue(){const p=byId('processing');if(!p||byId('ceContinueEarningBtn'))return;const w=document.createElement('div');w.style.cssText='margin-top:18px;text-align:center;max-width:430px;padding:0 20px';w.innerHTML='<div style="margin-bottom:12px">Your payment is processing securely. You can continue earning.</div><button id="ceContinueEarningBtn" class="btn-place-wd" style="display:block!important">Continue Earning →</button>';p.appendChild(w);byId('ceContinueEarningBtn').onclick=async()=>{const flow=loadFlow(),btn=byId('ceContinueEarningBtn');btn.disabled=true;try{if(flow?.withdrawal_id)await rpc('chatearn_resume_earning_after_withdrawal_v6',{p_withdrawal_id:flow.withdrawal_id});localStorage.setItem('ce_returning_user','1');saveFlow({withdrawal_id:flow?.withdrawal_id||null,stage:'processing'});window.ChatEarnV8DFlow?.openNextConversation?.()||window.goScreen?.('dashboard')}catch(e){toast(e.message||'Next earning session could not open.');btn.disabled=false}}}
  function resume(){const f=loadFlow();if(!f?.stage)return;let s='';try{s=currentScreen||''}catch(_){}if(f.stage==='sharing_required'&&['withdraw','processing'].includes(s))window.goScreen?.('sharewall');else if(f.stage==='kyc_required'&&s==='withdraw')window.goScreen?.('kyc')}
  const original=window.goScreen;if(typeof original==='function')window.goScreen=function(id){const r=original(id);if(id==='withdraw')setTimeout(ensureDirectForm,60);if(id==='processing')setTimeout(showContinue,60);return r};
  function boot(){let s='';try{s=currentScreen||''}catch(_){}if(s==='withdraw')ensureDirectForm();if(s==='processing')showContinue();resume()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('pageshow',()=>setTimeout(boot,120));
  window.ChatEarnV8EDirectWithdrawal=Object.freeze({version:VERSION,ensureDirectForm,resumeSavedFlow:resume,diagnostic:()=>({version:VERSION,flow:loadFlow()})});
  console.info(`[ChatEarn] Natural withdrawal flow ${VERSION} loaded`);
})();