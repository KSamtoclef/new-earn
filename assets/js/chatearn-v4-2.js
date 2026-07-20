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
*/
const ADS = [
  { id:'bonus', title:"Claim Today's Bonus Offer", description:'Exclusive reward for active users', cta:'Claim →', url:'https://example.com/bonus', icon:'🎁', theme:'green', placement:'both', mode:'fixed' },
  { id:'boost', title:'Boost Your Earnings Today', description:'Open this sponsored opportunity to continue', cta:'Open →', url:'https://example.com/boost', icon:'💳', theme:'blue', placement:'chat', mode:'random' },
  { id:'report', title:'View Earnings Report', description:'See useful earning information', cta:'View →', url:'https://example.com/report', icon:'📊', theme:'purple', placement:'dashboard', mode:'fixed' },
  { id:'special', title:'Special Sponsored Opportunity', description:'A limited offer selected for active members', cta:'Check Now →', url:'https://example.com/special', icon:'⭐', theme:'orange', placement:'chat', mode:'random' },
  { id:'gold', title:'Recommended Sponsored Task', description:'Another opportunity for active chat users', cta:'View Offer →', url:'https://example.com/task', icon:'🔥', theme:'gold', placement:'chat', mode:'random' }
];

const THEMES = {
  green:{bg:'linear-gradient(135deg,rgba(0,200,83,.18),rgba(0,200,83,.06))',border:'rgba(0,200,83,.42)',accent:'#69F0AE'},
  blue:{bg:'linear-gradient(135deg,rgba(41,121,255,.2),rgba(41,121,255,.06))',border:'rgba(41,121,255,.45)',accent:'#82B1FF'},
  purple:{bg:'linear-gradient(135deg,rgba(170,0,255,.18),rgba(170,0,255,.05))',border:'rgba(170,0,255,.42)',accent:'#EA80FC'},
  orange:{bg:'linear-gradient(135deg,rgba(255,109,0,.2),rgba(255,109,0,.05))',border:'rgba(255,109,0,.45)',accent:'#FFAB40'},
  gold:{bg:'linear-gradient(135deg,rgba(255,215,0,.18),rgba(255,215,0,.05))',border:'rgba(255,215,0,.42)',accent:'#FFD740'}
};
let randomCursor=Math.floor(Math.random()*1000);
let nextChatAdAt=3+Math.floor(Math.random()*2);

function eligible(placement,mode){return ADS.filter(ad=>(ad.placement===placement||ad.placement==='both')&&(!mode||ad.mode===mode));}
function chooseRandom(placement){const list=eligible(placement,'random');if(!list.length)return null;const ad=list[randomCursor%list.length];randomCursor+=1;return ad;}
function safeUrl(url){try{const parsed=new URL(url,location.origin);return ['http:','https:'].includes(parsed.protocol)?parsed.href:'#';}catch{return '#';}}
function card(ad,compact=false){
  const t=THEMES[ad.theme]||THEMES.green;
  const el=document.createElement('a');el.href=safeUrl(ad.url);el.target='_blank';el.rel='noopener noreferrer sponsored';el.dataset.sponsoredId=ad.id;
  el.style.cssText=`display:flex;align-items:center;gap:11px;text-decoration:none;background:${t.bg};border:1px solid ${t.border};border-radius:14px;padding:${compact?'12px':'14px 16px'};margin:10px 0;color:#fff;box-shadow:0 10px 28px rgba(0,0,0,.18)`;
  const icon=document.createElement('span');icon.textContent=ad.icon||'📢';icon.style.fontSize=compact?'22px':'25px';
  const body=document.createElement('span');body.style.cssText='flex:1;min-width:0';
  const label=document.createElement('small');label.textContent='SPONSORED';label.style.cssText=`display:block;color:${t.accent};font-size:8px;font-weight:900;letter-spacing:1.2px;margin-bottom:3px`;
  const title=document.createElement('b');title.textContent=ad.title;title.style.cssText='display:block;font-size:13px;line-height:1.35';
  const desc=document.createElement('span');desc.textContent=ad.description;desc.style.cssText='display:block;color:#aebbb3;font-size:10px;line-height:1.45;margin-top:3px';
  const cta=document.createElement('strong');cta.textContent=ad.cta||'Open →';cta.style.cssText=`color:${t.accent};font-size:11px;white-space:nowrap`;
  body.append(label,title,desc);el.append(icon,body,cta);return el;
}
function mountDashboard(){
  const dashboard=document.getElementById('dashboard');if(!dashboard||dashboard.querySelector('[data-code-ads="dashboard"]'))return;
  const host=document.createElement('section');host.dataset.codeAds='dashboard';host.style.cssText='padding:0 16px 8px';
  eligible('dashboard','fixed').forEach(ad=>host.appendChild(card(ad)));
  dashboard.querySelector('.withdraw-teaser')?.insertAdjacentElement('afterend',host);
}
function afterReply(count,body){
  if(!body||count<nextChatAdAt)return;
  const ad=chooseRandom('chat')||eligible('chat','fixed')[0];if(!ad)return;
  const wrapper=document.createElement('div');wrapper.className='msg-row';wrapper.dataset.codeAd=ad.id;wrapper.appendChild(card(ad,true));body.appendChild(wrapper);body.scrollTop=body.scrollHeight;
  nextChatAdAt=count+3+Math.floor(Math.random()*2);
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