(() => {
'use strict';

/* EDIT ONLY THIS LIST TO CHANGE SPONSORED ADS.
   title       = main text
   description = smaller text
   cta         = button text
   url         = destination
   theme       = green | blue | purple | orange | gold
   placement   = dashboard | chat | both
   mode        = fixed | random
   type        = native | inpush | overlay
   returningOnly = true means it appears only after first withdrawal processing
*/
const ADS = [
  { id:'bonus', title:"Claim Today's Bonus Offer", description:'Exclusive reward for active users', cta:'Claim →', url:'https://example.com/bonus', icon:'🎁', theme:'green', placement:'both', mode:'fixed', type:'native', returningOnly:false },
  { id:'boost', title:'Boost Your Earnings Today', description:'Open this sponsored opportunity to continue', cta:'Open →', url:'https://example.com/boost', icon:'💳', theme:'blue', placement:'chat', mode:'random', type:'native', returningOnly:false },
  { id:'report', title:'View Earnings Report', description:'See useful earning information', cta:'View →', url:'https://example.com/report', icon:'📊', theme:'purple', placement:'dashboard', mode:'fixed', type:'native', returningOnly:false },
  { id:'special', title:'Special Sponsored Opportunity', description:'A limited offer selected for active members', cta:'Check Now →', url:'https://example.com/special', icon:'⭐', theme:'orange', placement:'chat', mode:'random', type:'inpush', returningOnly:true },
  { id:'gold', title:'Recommended Sponsored Task', description:'Another opportunity for active chat users', cta:'View Offer →', url:'https://example.com/task', icon:'🔥', theme:'gold', placement:'chat', mode:'random', type:'overlay', returningOnly:true }
];

const THEMES = {
  green:{bg:'linear-gradient(135deg,rgba(0,200,83,.18),rgba(0,200,83,.06))',border:'rgba(0,200,83,.42)',accent:'#69F0AE'},
  blue:{bg:'linear-gradient(135deg,rgba(41,121,255,.20),rgba(41,121,255,.06))',border:'rgba(41,121,255,.45)',accent:'#82B1FF'},
  purple:{bg:'linear-gradient(135deg,rgba(170,0,255,.18),rgba(170,0,255,.05))',border:'rgba(170,0,255,.42)',accent:'#EA80FC'},
  orange:{bg:'linear-gradient(135deg,rgba(255,109,0,.20),rgba(255,109,0,.05))',border:'rgba(255,109,0,.45)',accent:'#FFAB40'},
  gold:{bg:'linear-gradient(135deg,rgba(255,215,0,.18),rgba(255,215,0,.05))',border:'rgba(255,215,0,.42)',accent:'#FFD740'}
};
let randomCursor=Math.floor(Math.random()*1000);
let nextChatAdAt=4;

function currentState(){
  const key=Object.keys(localStorage).find(k=>k.startsWith('chatearn_state_')&&k!=='chatearn_state_guest');
  if(!key)return{};
  try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return{}}
}
function isReturning(){
  const state=currentState();
  return state.firstCycleComplete===true||state.withdrawal?.status==='processing';
}
function eligible(placement,mode){
  const returning=isReturning();
  return ADS.filter(ad=>(ad.placement===placement||ad.placement==='both')&&(!mode||ad.mode===mode)&&(!ad.returningOnly||returning));
}
function chooseRandom(placement){
  const list=eligible(placement,'random');if(!list.length)return null;
  const ad=list[randomCursor%list.length];randomCursor+=1;return ad;
}
function safeUrl(url){try{const parsed=new URL(url,location.origin);return ['http:','https:'].includes(parsed.protocol)?parsed.href:'#';}catch{return '#';}}
function content(ad,compact=false){
  const t=THEMES[ad.theme]||THEMES.green;
  const root=document.createElement('a');root.href=safeUrl(ad.url);root.target='_blank';root.rel='noopener noreferrer sponsored';root.dataset.sponsoredId=ad.id;
  root.style.cssText=`display:flex;align-items:center;gap:11px;text-decoration:none;color:#fff;background:${t.bg};border:1px solid ${t.border};border-radius:14px;padding:${compact?'12px':'14px 16px'};box-shadow:0 10px 28px rgba(0,0,0,.22)`;
  const icon=document.createElement('span');icon.textContent=ad.icon||'📢';icon.style.fontSize=compact?'22px':'25px';
  const body=document.createElement('span');body.style.cssText='flex:1;min-width:0';
  const label=document.createElement('small');label.textContent='SPONSORED';label.style.cssText=`display:block;color:${t.accent};font-size:8px;font-weight:900;letter-spacing:1.2px;margin-bottom:3px`;
  const title=document.createElement('b');title.textContent=ad.title;title.style.cssText='display:block;font-size:13px;line-height:1.35';
  const desc=document.createElement('span');desc.textContent=ad.description;desc.style.cssText='display:block;color:#aebbb3;font-size:10px;line-height:1.45;margin-top:3px';
  const cta=document.createElement('strong');cta.textContent=ad.cta||'Open →';cta.style.cssText=`color:${t.accent};font-size:11px;white-space:nowrap`;
  body.append(label,title,desc);root.append(icon,body,cta);return root;
}
function nativeAd(ad,body){
  const wrapper=document.createElement('div');wrapper.className='msg-row';wrapper.dataset.codeAd=ad.id;wrapper.style.margin='10px 0';wrapper.appendChild(content(ad,true));body.appendChild(wrapper);body.scrollTop=body.scrollHeight;
}
function inPushAd(ad){
  document.querySelector('[data-ce-inpush]')?.remove();
  const shell=document.createElement('div');shell.dataset.ceInpush=ad.id;shell.style.cssText='position:fixed;left:12px;right:12px;bottom:92px;z-index:9995;max-width:456px;margin:auto;background:#151915;border:1px solid rgba(255,255,255,.11);border-radius:16px;padding:10px;box-shadow:0 18px 45px rgba(0,0,0,.55)';
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close sponsored message');close.style.cssText='position:absolute;right:6px;top:4px;width:26px;height:26px;border:0;border-radius:50%;background:#292d29;color:#fff;font-size:18px;z-index:2';close.onclick=()=>shell.remove();
  shell.append(close,content(ad,true));document.body.appendChild(shell);setTimeout(()=>shell.remove(),12000);
}
function overlayAd(ad){
  if(document.querySelector('[data-ce-overlay]'))return;
  const backdrop=document.createElement('div');backdrop.dataset.ceOverlay=ad.id;backdrop.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.74);display:flex;align-items:center;justify-content:center;padding:22px;backdrop-filter:blur(5px)';
  const panel=document.createElement('div');panel.style.cssText='position:relative;width:100%;max-width:390px;background:#111511;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:18px;box-shadow:0 25px 80px rgba(0,0,0,.75)';
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close sponsored offer');close.style.cssText='position:absolute;right:8px;top:8px;width:30px;height:30px;border:0;border-radius:50%;background:#272b27;color:#fff;font-size:20px;z-index:2';close.onclick=()=>backdrop.remove();
  panel.append(close,content(ad,false));backdrop.appendChild(panel);document.body.appendChild(backdrop);
}
function showAd(ad,body){
  if(!ad)return;
  if(ad.type==='overlay')overlayAd(ad);
  else if(ad.type==='inpush')inPushAd(ad);
  else nativeAd(ad,body);
}
function mountDashboard(){
  const dashboard=document.getElementById('dashboard');if(!dashboard||dashboard.querySelector('[data-code-ads="dashboard"]'))return;
  const host=document.createElement('section');host.dataset.codeAds='dashboard';host.style.cssText='padding:0 16px 8px';
  eligible('dashboard','fixed').forEach(ad=>host.appendChild(content(ad)));
  dashboard.querySelector('.withdraw-teaser')?.insertAdjacentElement('afterend',host);
}
function afterReply(count,body){
  if(!body||count<nextChatAdAt)return;
  const ad=chooseRandom('chat')||eligible('chat','fixed')[0];if(!ad)return;
  showAd(ad,body);
  nextChatAdAt=count+(isReturning()?3+Math.floor(Math.random()*2):4);
}
function showLoginModal(){const modal=document.getElementById('loginModal');if(!modal)return;modal.classList.add('show');modal.style.display='flex';setTimeout(()=>document.getElementById('loginEmail')?.focus(),50);}
function hideLoginModal(){const modal=document.getElementById('loginModal');if(!modal)return;modal.classList.remove('show');modal.style.display='none';}
function showLoginError(message){const box=document.getElementById('loginError');if(!box)return;box.textContent=message;box.classList.add('show');}
function bindAuthButtons(){
  document.addEventListener('click',event=>{
    const registerButton=event.target.closest('#regSubmitBtn');
    if(registerButton){event.preventDefault();event.stopImmediatePropagation();if(typeof window.doRegister==='function')window.doRegister();else alert('Registration is still loading. Refresh the page and try again.');return;}
    const loginButton=event.target.closest('#loginBtn');
    if(loginButton){event.preventDefault();event.stopImmediatePropagation();const email=document.getElementById('loginEmail')?.value.trim();const password=document.getElementById('loginPass')?.value||'';if(!email||!password){showLoginError('Enter your email and password.');return;}document.getElementById('loginError')?.classList.remove('show');if(typeof window.doLogin==='function')window.doLogin();else showLoginError('Login is still loading. Refresh the page and try again.');return;}
    if(event.target.closest('.reg-login span')){event.preventDefault();event.stopImmediatePropagation();showLoginModal();return;}
    if(event.target.closest('.login-close')){event.preventDefault();event.stopImmediatePropagation();hideLoginModal();}
  },true);
}
function boot(){mountDashboard();bindAuthButtons();new MutationObserver(mountDashboard).observe(document.body,{childList:true,subtree:true});}
window.ChatEarnAds=Object.freeze({ADS,afterReply});window.openLogin=showLoginModal;window.closeLogin=hideLoginModal;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();