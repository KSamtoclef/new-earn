(() => {
  'use strict';
  if (window.__CE_WITHDRAWAL_LOCK_UI__) return;
  window.__CE_WITHDRAWAL_LOCK_UI__ = true;
  const MIN=40000, MAX=80000;
  const money=n=>'₦'+Number(n||0).toLocaleString('en-NG');
  const bal=()=>{try{return Number(totalBalance||0)}catch(_){return 0}};
  const uid=()=>{try{return currentUser?.id||'guest'}catch(_){return'guest'}};
  const go=()=>{try{goScreen('withdraw')}catch(_){window.goScreen?.('withdraw')}};
  async function blocked(){let v=bal()>=MAX;try{v=await window.ChatEarnFirstCycleTaskRuntime?.shouldBlock?.()??v}catch(_){}return v}
  function lockInputs(on){
    const input=document.getElementById('chatInput'),send=document.querySelector('.btn-send');
    if(input){input.disabled=on;input.placeholder=on?'Withdrawal required to continue earning':'Type a message…'}
    if(send)send.disabled=on;
    document.querySelectorAll('.quick-reply,.quick-replies button').forEach(x=>x.disabled=on);
  }
  function minNotice(body,amount){
    const key='ce_min_withdraw_seen:'+uid();
    if(amount<MIN||amount>=MAX||sessionStorage.getItem(key)==='1'){body.querySelector('#ceMinWithdrawNotice')?.remove();return}
    if(body.querySelector('#ceMinWithdrawNotice'))return;
    const c=document.createElement('div');c.id='ceMinWithdrawNotice';
    c.style.cssText='margin:14px 0;padding:13px 14px;border:1px solid rgba(0,200,83,.32);border-radius:16px;background:#121a15;display:flex;align-items:center;justify-content:space-between;gap:12px';
    c.innerHTML=`<div><b style="color:#fff">Withdrawal available</b><div style="font-size:12px;color:#9eaaa2;margin-top:3px">${money(amount)} is ready. You may continue earning up to ${money(MAX)}.</div></div><button type="button" style="padding:10px 13px;border:0;border-radius:12px;background:#00c853;font-weight:900">Withdraw</button>`;
    c.querySelector('button').onclick=go;body.appendChild(c);sessionStorage.setItem(key,'1');
  }
  function maxCard(body,amount,on){
    let c=body.querySelector('#ceMaxWithdrawLock');
    if(!on){c?.remove();return}
    body.querySelector('#ceMinWithdrawNotice')?.remove();
    if(!c){c=document.createElement('div');c.id='ceMaxWithdrawLock';c.style.cssText='position:sticky;bottom:12px;z-index:50;margin:18px 0 8px;padding:20px;border:1px solid rgba(0,230,118,.65);border-radius:22px;background:#102018;box-shadow:0 18px 44px rgba(0,0,0,.42);text-align:center';c.innerHTML='<div style="font-size:12px;font-weight:900;letter-spacing:.08em;color:#7fffb0">FIRST EARNING SESSION COMPLETE</div><div class="amt" style="font-size:30px;font-weight:1000;color:#fff;margin-top:8px"></div><div style="font-size:14px;line-height:1.45;color:#c7d2cb;margin:9px 0 16px">Your messages are locked. Continue to withdrawal to unlock your next earning session.</div><button type="button" style="width:100%;min-height:58px;border:0;border-radius:16px;background:#00d65f;font-size:18px;font-weight:1000">Withdraw now →</button>';c.querySelector('button').onclick=go;body.appendChild(c)}
    c.querySelector('.amt').textContent=money(Math.min(amount,MAX));
  }
  async function render(){const body=document.getElementById('chatBody');if(!body)return;const amount=bal(),on=await blocked();minNotice(body,amount);maxCard(body,amount,on);lockInputs(on)}
  let t;const schedule=()=>{clearTimeout(t);t=setTimeout(render,80)};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',schedule);window.addEventListener('focus',schedule);setInterval(schedule,1200);schedule();
})();