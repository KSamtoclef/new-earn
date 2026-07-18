/* ChatEarn V8F.1 — lightweight UI and admin stabilizer. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_V8F1_STABILIZER__) return;
  window.__CHAT_EARN_V8F1_STABILIZER__=true;
  const VERSION='8F.1',byId=id=>document.getElementById(id);

  function cleanEarningsPage(){const page=byId('earnings'),primary=page?.querySelector('.btn-withdraw');if(!primary)return;[...primary.parentElement.querySelectorAll('a,button')].forEach(n=>{if(n!==primary)n.remove()})}

  function cleanWithdrawal(){
    const page=byId('withdraw'),direct=byId('ceDirectWithdrawalForm');if(!page||!direct)return;
    page.querySelectorAll('.bank-options,#wdAccNo,#wdAccName,#bankVerifyStatus').forEach(n=>{const g=n.closest('.form-group');if(g)g.style.display='none';else n.style.display='none'});
    page.querySelectorAll('.btn-place-wd').forEach(n=>{if(!direct.contains(n))n.style.display='none'});
    const status=byId('withdrawalPortalStatus');if(status)status.style.display='none';
  }

  function activateCanonicalTab(name,button){
    document.querySelectorAll('[data-ce6-tab]').forEach(b=>b.classList.toggle('active',b===button));
    document.querySelectorAll('#adminContent .admin-panel').forEach(p=>p.classList.remove('active'));
    byId(`ce6-${name}`)?.classList.add('active');
    if(name==='withdrawals')setTimeout(()=>window.ChatEarnAdminWithdrawalsV5?.refresh?.(),40);
    if(name==='kyc')setTimeout(()=>window.ChatEarnAdminKyc?.refresh?.(),40);
  }

  function installAdminInterception(){const tabs=byId('adminTabs');if(!tabs||tabs.dataset.ceCanonicalIntercept==='1')return;tabs.dataset.ceCanonicalIntercept='1';tabs.addEventListener('click',event=>{const button=event.target.closest('[data-ce6-tab]');const name=button?.dataset.ce6Tab;if(!['withdrawals','kyc'].includes(name))return;event.preventDefault();event.stopImmediatePropagation();activateCanonicalTab(name,button)},true)}

  function boot(){cleanEarningsPage();cleanWithdrawal();installAdminInterception();setTimeout(()=>{cleanEarningsPage();cleanWithdrawal();installAdminInterception()},500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('pageshow',()=>setTimeout(boot,80));
  window.ChatEarnV8FDiagnostic=()=>({version:VERSION,directWithdrawalVisible:Boolean(byId('ceDirectWithdrawalForm')),adminWithdrawalReady:Boolean(window.ChatEarnAdminWithdrawalsV5),adminKycReady:Boolean(window.ChatEarnAdminKyc),tabInterception:byId('adminTabs')?.dataset.ceCanonicalIntercept==='1'});
  console.info(`[ChatEarn] Stabilizer ${VERSION} loaded`);
})();