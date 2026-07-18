/* ChatEarn V8E.1 — direct, persistent withdrawal journey. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_V8E_DIRECT_WITHDRAWAL__) return;
  window.__CHAT_EARN_V8E_DIRECT_WITHDRAWAL__ = true;

  const VERSION = '8E.1';
  const DRAFT_KEY = 'ce_withdrawal_draft_v8e';
  const FLOW_KEY = 'ce_withdrawal_flow_v8e';
  const IDEMPOTENCY_KEY = 'ce_direct_withdrawal_key';
  const byId = id => document.getElementById(id);
  const toast = message => { try { window.showToast?.(message); } catch (_) {} };
  const getClient = () => {
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient?.rpc) return supabaseClient; } catch (_) {}
    if (window.supabaseClient?.rpc) return window.supabaseClient;
    throw new Error('Secure connection is still loading. Please wait a moment and try again.');
  };
  const rpc = async (name,args={}) => {
    const {data,error}=await getClient().rpc(name,args);
    if(error) throw error;
    return typeof data==='string'?JSON.parse(data):data;
  };
  const loadDraft=()=>{try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch(_){return{}}};
  const saveDraft=draft=>localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));
  const loadFlow=()=>{try{return JSON.parse(localStorage.getItem(FLOW_KEY)||'null')}catch(_){return null}};
  const saveFlow=flow=>localStorage.setItem(FLOW_KEY,JSON.stringify({...flow,updated_at:Date.now()}));

  const BANKS=[
    ['opay','OPay'],['palmpay','PalmPay'],['kuda','Kuda Bank'],['moniepoint','Moniepoint'],
    ['gtbank','GTBank'],['access','Access Bank'],['firstbank','First Bank'],['uba','UBA'],
    ['zenith','Zenith Bank'],['fcmb','FCMB'],['fidelity','Fidelity Bank'],['sterling','Sterling Bank'],
    ['wema','Wema Bank / ALAT'],['union','Union Bank'],['stanbic','Stanbic IBTC'],['ecobank','Ecobank'],
    ['polaris','Polaris Bank'],['keystone','Keystone Bank'],['providus','Providus Bank'],['other','Other Nigerian bank']
  ];

  function secureBackNotice(){
    const modal=byId('backWarn');
    if(!modal)return;
    const title=modal.querySelector('.bw-title');
    const body=modal.querySelector('.bw-body');
    const stay=modal.querySelector('.btn-bw-stay');
    const leave=modal.querySelector('.btn-bw-leave');
    if(title)title.textContent='Your progress is saved';
    if(body)body.innerHTML='Your earnings and withdrawal progress are securely stored. Continue whenever you are ready.';
    if(stay)stay.textContent='Continue current step';
    if(leave){leave.textContent='Return to dashboard';leave.onclick=()=>{window.closeBackWarn?.();window.goScreen?.('dashboard')}}
  }

  function removeConflictingAccountUi(){
    byId('cePayoutAccountForm')?.remove();
    const group=document.querySelector('#withdraw .bank-options')?.closest('.form-group');
    if(group)group.style.display='none';
    document.querySelector('#withdraw .btn-place-wd')?.style.setProperty('display','none','important');
  }

  function ensureDirectForm(){
    const body=document.querySelector('#withdraw .wd-body');
    if(!body)return;
    removeConflictingAccountUi();
    if(byId('ceDirectWithdrawalForm'))return;
    const draft=loadDraft();
    const form=document.createElement('form');
    form.id='ceDirectWithdrawalForm';
    form.style.cssText='margin:0 0 18px;padding:17px;border:1px solid var(--line);border-radius:17px;background:var(--card2);display:grid;gap:12px;';
    form.innerHTML=`<div style="font-size:16px;font-weight:900;">Where should we send your withdrawal?</div>
      <div style="font-size:12px;line-height:1.5;color:var(--muted);">Enter the account for this withdrawal. Your progress is saved automatically.</div>
      <label style="font-size:12px;color:var(--text);">Bank</label>
      <select id="ceDirectBank" required style="width:100%;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--white);">${BANKS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
      <label style="font-size:12px;color:var(--text);">Account name</label>
      <input id="ceDirectAccountName" required maxlength="120" autocomplete="name" placeholder="Name on the bank account" style="width:100%;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--white);">
      <label style="font-size:12px;color:var(--text);">Account number</label>
      <input id="ceDirectAccountNumber" required inputmode="numeric" maxlength="10" autocomplete="off" placeholder="10-digit account number" style="width:100%;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--white);">
      <button type="submit" style="width:100%;padding:15px;border:0;border-radius:13px;background:#00c853;color:#031108;font-size:16px;font-weight:900;cursor:pointer;">Place my withdrawal now →</button>
      <div id="ceDirectWithdrawalStatus" style="font-size:11px;line-height:1.45;color:var(--muted);">Next: compulsory sharing, then KYC and payment processing.</div>`;
    const status=byId('withdrawalPortalStatus');
    if(status&&/could not be loaded/i.test(status.textContent||''))status.style.display='none';
    body.querySelector('.wd-amount-display')?.insertAdjacentElement('afterend',form);
    if(!form.isConnected)body.prepend(form);
    const bank=byId('ceDirectBank'),name=byId('ceDirectAccountName'),number=byId('ceDirectAccountNumber');
    bank.value=draft.bank||'opay';name.value=draft.account_name||'';number.value=draft.account_number||'';
    const persist=()=>saveDraft({bank:bank.value,account_name:name.value.trim(),account_number:number.value.replace(/\D/g,'').slice(0,10)});
    bank.addEventListener('change',persist);name.addEventListener('input',persist);number.addEventListener('input',()=>{number.value=number.value.replace(/\D/g,'').slice(0,10);persist()});
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=form.querySelector('button[type="submit"]');
      const accountName=name.value.trim(),accountNumber=number.value.replace(/\D/g,'').slice(0,10);
      if(accountName.length<3)return toast('Enter the account name.');
      if(accountNumber.length!==10)return toast('Enter a valid 10-digit account number.');
      persist();button.disabled=true;button.textContent='Securing withdrawal…';
      let key=sessionStorage.getItem(IDEMPOTENCY_KEY);
      if(!key){key=`direct-${crypto.randomUUID()}`;sessionStorage.setItem(IDEMPOTENCY_KEY,key)}
      try{
        const stateAmount=Number(window.ChatEarnWithdrawalV5?.getState?.()?.portal?.wallet?.available_balance||0);
        let fallbackAmount=0;try{if(typeof totalBalance!=='undefined')fallbackAmount=Number(totalBalance||0)}catch(_){}
        const result=await rpc('chatearn_place_withdrawal_direct_v6',{p_provider:bank.value,p_account_number:accountNumber,p_account_name:accountName,p_amount:stateAmount||fallbackAmount,p_idempotency_key:key});
        if(result?.ok===false)throw new Error(result.message||'Withdrawal could not be placed.');
        saveFlow({withdrawal_id:result.withdrawal_id,stage:'sharing_required'});
        toast('Withdrawal placed. Complete the required sharing step.');
        window.goScreen?.('sharewall');
      }catch(error){toast(error?.message||'Withdrawal could not be placed. Please try again.')}finally{button.disabled=false;button.textContent='Place my withdrawal now →'}
    });
  }

  function resumeSavedFlow(){
    const flow=loadFlow();if(!flow?.stage)return;
    let screen='';try{screen=currentScreen||''}catch(_){}
    if(flow.stage==='sharing_required'&&['withdraw','processing'].includes(screen))window.goScreen?.('sharewall');
    if(flow.stage==='kyc_required'&&screen==='withdraw')window.goScreen?.('kyc');
  }

  function showContinueEarning(){
    const processing=byId('processing');if(!processing||byId('ceContinueEarningBtn'))return;
    const wrap=document.createElement('div');wrap.style.cssText='margin-top:18px;text-align:center;max-width:430px;padding:0 20px;';
    wrap.innerHTML='<div style="font-size:14px;line-height:1.55;color:var(--text);margin-bottom:12px;">Your payment is processing securely. You can continue earning while we complete it.</div><button id="ceContinueEarningBtn" type="button" style="width:100%;padding:14px;border:0;border-radius:13px;background:#00c853;color:#031108;font-weight:900;">Continue earning →</button>';
    processing.appendChild(wrap);
    byId('ceContinueEarningBtn').addEventListener('click',async()=>{
      const flow=loadFlow();const button=byId('ceContinueEarningBtn');button.disabled=true;button.textContent='Opening next chat…';
      try{
        if(flow?.withdrawal_id)await rpc('chatearn_resume_earning_after_withdrawal_v6',{p_withdrawal_id:flow.withdrawal_id});
        localStorage.setItem('ce_returning_user','1');saveFlow({withdrawal_id:flow?.withdrawal_id||null,stage:'processing'});
        window.ChatEarnV8DFlow?.openNextConversation?.()||window.goScreen?.('dashboard');
      }catch(error){toast(error?.message||'Your next earning session could not be opened yet.');button.disabled=false;button.textContent='Continue earning →'}
    });
  }

  const previousGoScreen=typeof window.goScreen==='function'?window.goScreen:null;
  if(previousGoScreen){window.goScreen=function v8eGoScreen(id){const result=previousGoScreen(id);if(id==='withdraw')setTimeout(ensureDirectForm,60);if(id==='processing')setTimeout(showContinueEarning,60);return result}}
  const observer=new MutationObserver(()=>{ensureDirectForm();showContinueEarning();secureBackNotice()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(()=>{ensureDirectForm();showContinueEarning();secureBackNotice()},1800);
  window.addEventListener('pageshow',()=>setTimeout(resumeSavedFlow,250));
  secureBackNotice();
  window.ChatEarnV8EDirectWithdrawal=Object.freeze({version:VERSION,ensureDirectForm,resumeSavedFlow,diagnostic:()=>({version:VERSION,draftSaved:Boolean(localStorage.getItem(DRAFT_KEY)),flow:loadFlow()})});
  console.info(`[ChatEarn] V8E direct withdrawal ${VERSION} loaded`);
})();