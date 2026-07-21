(() => {
'use strict';
const SDK_SOURCES=[
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/@supabase/supabase-js@2'
];
const APP='./assets/js/chatearn-app.js?v=20260721-alignment2';
const byId=id=>document.getElementById(id);
const timeout=ms=>new Promise((_,reject)=>setTimeout(()=>reject(new Error('Loading timed out')),ms));
const load=src=>new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=src;script.async=false;script.onload=resolve;
  script.onerror=()=>reject(new Error(`Could not load ${src}`));
  document.head.appendChild(script);
});
function setReady(ready){
  const reg=byId('regSubmitBtn'),login=byId('loginBtn');
  if(reg){reg.disabled=!ready;reg.textContent=ready?'Create Account & Get ₦10,000 →':'Preparing secure registration…';}
  if(login){login.disabled=!ready;login.textContent=ready?'Log In & Continue →':'Preparing secure login…';}
}
function showError(message){
  const toast=byId('toast');if(!toast)return;
  toast.textContent=message;toast.className='toast show error';
}
window.goScreen=window.goScreen||function(id){
  document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active');s.style.display='none';});
  const target=byId(id);if(!target)return;target.classList.add('active');target.style.display=['loading','processing'].includes(id)?'flex':'block';
};
window.openLogin=window.openLogin||(()=>byId('loginModal')?.classList.add('show'));
window.closeLogin=window.closeLogin||(()=>byId('loginModal')?.classList.remove('show'));
async function boot(){
  setReady(false);
  try{
    if(!window.supabase?.createClient){
      let ok=false;
      for(const src of SDK_SOURCES){
        try{await Promise.race([load(src),timeout(10000)]);if(window.supabase?.createClient){ok=true;break;}}catch{}
      }
      if(!ok)throw new Error('Authentication service could not load.');
    }
    await Promise.race([load(APP),timeout(12000)]);
    if(typeof window.doRegister!=='function'||typeof window.doLogin!=='function')throw new Error('Application did not initialize.');
    setReady(true);
  }catch(error){setReady(false);showError(error.message||'The app could not start.');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();