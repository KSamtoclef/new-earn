(() => {
'use strict';

const AUTH_TIMEOUT_MS = 15000;

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
    showError.timer = setTimeout(() => { toast.className = 'toast'; }, 4500);
  }
}
function timeoutAfter(ms, message){
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
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
    if(!validEmail(email)){ showError('regError','Enter a valid email address. Check the ending, for example gmail.com.'); return; }
    if(password.length < 6){ showError('regError','Password must contain at least 6 characters.'); return; }

    try{
      await Promise.race([
        Promise.resolve(original.apply(this,args)),
        timeoutAfter(AUTH_TIMEOUT_MS,'Registration is taking too long. Check your connection and try again.')
      ]);
    }catch(error){
      showError('regError', error?.message || 'Registration failed. Please try again.');
    }finally{
      if(button){ button.disabled = false; button.textContent = 'Create Account & Get ₦10,000 →'; }
    }
  };
  wrapped.__watchdog = true;
  window.doRegister = wrapped;
}

function wrapLogin(){
  if(typeof window.doLogin !== 'function' || window.doLogin.__watchdog) return;
  const original = window.doLogin;
  const wrapped = async function(...args){
    const email = byId('loginEmail')?.value.trim();
    const password = byId('loginPass')?.value || '';
    const button = byId('loginBtn');

    if(!validEmail(email)){ showError('loginError','Enter a valid email address.'); return; }
    if(!password){ showError('loginError','Enter your password.'); return; }

    try{
      await Promise.race([
        Promise.resolve(original.apply(this,args)),
        timeoutAfter(AUTH_TIMEOUT_MS,'Login is taking too long. Check your connection and try again.')
      ]);
    }catch(error){
      showError('loginError', error?.message || 'Login failed. Please try again.');
    }finally{
      if(button){ button.disabled = false; button.textContent = 'Log In & Continue →'; }
    }
  };
  wrapped.__watchdog = true;
  window.doLogin = wrapped;
}

function boot(){
  wrapRegister();
  wrapLogin();
  let attempts = 0;
  const timer = setInterval(() => {
    wrapRegister();
    wrapLogin();
    attempts += 1;
    if(attempts >= 20 || (window.doRegister?.__watchdog && window.doLogin?.__watchdog)) clearInterval(timer);
  }, 250);
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
