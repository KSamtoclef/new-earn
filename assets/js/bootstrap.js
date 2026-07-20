(() => {
'use strict';
const sources=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://unpkg.com/@supabase/supabase-js@2'];
const appScripts=['./assets/js/chatearn-app.js?v=12','./assets/js/chatearn-v4-2.js?v=12'];
const wait=(ms)=>new Promise((_,reject)=>setTimeout(()=>reject(new Error('Loading timed out')),ms));
const load=(src)=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
function setReady(ready){
  const a=document.getElementById('regSubmitBtn');
  const b=document.getElementById('loginBtn');
  if(a)a.disabled=!ready;
  if(b)b.disabled=!ready;
}
function error(message){
  const t=document.getElementById('toast');
  if(t){t.textContent=message;t.className='toast show error';}
}
async function boot(){
  setReady(false);
  try{
    if(!window.supabase?.createClient){
      let ok=false;
      for(const src of sources){
        try{await Promise.race([load(src),wait(10000)]);if(window.supabase?.createClient){ok=true;break;}}catch{}
      }
      if(!ok)throw new Error('Authentication service could not load.');
    }
    for(const src of appScripts)await Promise.race([load(src),wait(10000)]);
    if(typeof window.doRegister!=='function'||typeof window.doLogin!=='function')throw new Error('Authentication did not initialize.');
    setReady(true);
  }catch(e){setReady(false);error(e.message||'The app could not start.');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();