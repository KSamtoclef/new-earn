(() => {
'use strict';
const sources=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://unpkg.com/@supabase/supabase-js@2'];
const appScripts=['./assets/js/chatearn-app.js?v=13','./assets/js/chatearn-v4-2.js?v=13'];
const wait=(ms)=>new Promise((_,reject)=>setTimeout(()=>reject(new Error('Loading timed out')),ms));
const load=(src)=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error(`Could not load ${src}`));document.head.appendChild(s);});
const byId=(id)=>document.getElementById(id);

window.goScreen=window.goScreen||function(id){
  document.querySelectorAll('.screen').forEach(screen=>{screen.classList.remove('active');screen.style.display='none';});
  const target=byId(id);
  if(!target)return;
  target.classList.add('active');
  target.style.display=['loading','processing'].includes(id)?'flex':'block';
};
window.openLogin=window.openLogin||function(){byId('loginModal')?.classList.add('show');};
window.closeLogin=window.closeLogin||function(){byId('loginModal')?.classList.remove('show');};

function setReady(ready){
  const register=byId('regSubmitBtn');
  const login=byId('loginBtn');
  if(register){register.disabled=!ready;register.textContent=ready?'Create Account & Get ₦10,000 →':'Preparing secure registration…';}
  if(login){login.disabled=!ready;login.textContent=ready?'Log In & Continue →':'Preparing secure login…';}
}
function showError(message){
  const toast=byId('toast');
  if(toast){toast.textContent=message;toast.className='toast show error';}
}
async function boot(){
  setReady(false);
  try{
    if(!window.supabase?.createClient){
      let loaded=false;
      for(const src of sources){
        try{await Promise.race([load(src),wait(10000)]);if(window.supabase?.createClient){loaded=true;break;}}catch{}
      }
      if(!loaded)throw new Error('Authentication service could not load.');
    }
    for(const src of appScripts)await Promise.race([load(src),wait(10000)]);
    if(typeof window.doRegister!=='function'||typeof window.doLogin!=='function')throw new Error('Authentication did not initialize.');
    setReady(true);
  }catch(error){
    setReady(false);
    showError(error?.message||'The app could not start.');
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();