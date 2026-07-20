(() => {
'use strict';

const AUTH_TIMEOUT_MS = 15000;
const SDK_TIMEOUT_MS = 8000;
const SDK_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/@supabase/supabase-js@2'
];

function byId(id){ return document.getElementById(id); }
function validEmail(email){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(email || '').trim()); }
function showError(targetId, message){
  const box = byId(targetId);
  if(box){ box.textContent = message; box.classList.add('show'); box.style.display = 'block'; }
  const toast = byId('toast');
  if(toast){
    toast.textContent = message;
    toast.className = 'toast show error';
    clearTimeout(showError.timer);
    showError.timer = setTimeout(() => { toast.className = 'toast'; }, 5000);
  }
}
function timeoutAfter(ms, message){
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src===src);
    if(existing && window.supabase){ resolve(); return; }
    const script=document.createElement('script');
    script.src=src;
    script.async=true;
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}
async function ensureSupabase(){
  if(window.supabase?.createClient) return true;
  for(const src of SDK_SOURCES){
    try{
      await Promise.race([loadScript(src),timeoutAfter(SDK_TIMEOUT_MS,'Supabase SDK timed out.')]);
      if(window.supabase?.createClient) return true;
    }catch{}
  }
  return false;
}
async function ensureApp(){
  if(typeof window.doRegister==='function' && typeof window.doLogin==='function') return true;
  const ready=await ensureSupabase();
  if(!ready) return false;
  try{
    await Promise.race([
      loadScript(`./assets/js/chatearn-app.js?v=11.0.0-recovery`),
      timeoutAfter(SDK_TIMEOUT_MS,'ChatEarn app timed out.')
    ]);
  }catch{}
  return typeof window.doRegister==='function' && typeof window.doLogin==='function';
}

function wrapRegister(){
  if(typeof window.doRegister !== 'function' || window.doRegister.__watchdog) return;
  const original = window.doRegister;
  const wrapped = async function(...args){
    const name = byId('regName')?.value.trim();
    const email = byId('regEmail')?.value.trim();
    const password = byId('regPass')?.value || '';
    const button = byId('regSubmitBtn');
    if(!name){ showError('regError','Enter your full name.'); return; }
    if(!validEmail(email)){ showError('regError','Enter a valid email address.'); return; }
    if(password.length < 6){ showError('regError','Password must contain at least 6 characters.'); return; }
    try{
      await Promise.race([
        Promise.resolve(original.apply(this,args)),
        timeoutAfter(AUTH_TIMEOUT_MS,'Registration is taking too long. Check your connection and try again.')
      ]);
    }catch(error){ showError('regError', error?.message || 'Registration failed. Please try again.'); }
    finally{ if(button){ button.disabled=false; button.textContent='Create Account & Get ₦10,000 →'; } }
  };
  wrapped.__watchdog=true;
  window.doRegister=wrapped;
}
function wrapLogin(){
  if(typeof window.doLogin !== 'function' || window.doLogin.__watchdog) return;
  const original=window.doLogin;
  const wrapped=async function(...args){
    const email=byId('loginEmail')?.value.trim();
    const password=byId('loginPass')?.value||'';
    const button=byId('loginBtn');
    if(!validEmail(email)){ showError('loginError','Enter a valid email address.'); return; }
    if(!password){ showError('loginError','Enter your password.'); return; }
    try{
      await Promise.race([
        Promise.resolve(original.apply(this,args)),
        timeoutAfter(AUTH_TIMEOUT_MS,'Login is taking too long. Check your connection and try again.')
      ]);
    }catch(error){ showError('loginError',error?.message||'Login failed. Please try again.'); }
    finally{ if(button){ button.disabled=false; button.textContent='Log In & Continue →'; } }
  };
  wrapped.__watchdog=true;
  window.doLogin=wrapped;
}
async function boot(){
  const ready=await ensureApp();
  if(!ready){
    const message='Authentication service could not load. Please refresh or try another network.';
    const register=byId('regSubmitBtn');
    const login=byId('loginBtn');
    if(register) register.onclick=()=>showError('regError',message);
    if(login) login.onclick=()=>showError('loginError',message);
    return;
  }
  wrapRegister();
  wrapLogin();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();