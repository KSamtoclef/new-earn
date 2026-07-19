/* ChatEarn honest analytics overlay v1.1.0 */
(()=>{
'use strict';
if(window.__CHAT_EARN_HONEST_ANALYTICS__)return;
window.__CHAT_EARN_HONEST_ANALYTICS__=true;
const VERSION='1.1.0';
let range='today',busy=false;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString();
const pct=n=>Number.isFinite(Number(n))?`${Math.max(0,Number(n)).toFixed(1).replace('.0','')}%`:'—';
async function rpc(name,args={}){const c=window.ceAdminClient;if(!c?.rpc)throw new Error('Admin connection is still loading.');const{data,error}=await c.rpc(name,args);if(error)throw error;return typeof data==='string'?JSON.parse(data):data}
function ranges(){return `<div class="ce6-ranges" id="ceHonestAdRanges">${[['today','Today'],['yesterday','Yesterday'],['7d','Last 7 Days'],['30d','Last 30 Days']].map(([k,l])=>`<button type="button" data-honest-ad-range="${k}" class="${range===k?'active':''}">${l}</button>`).join('')}</div>`}
function metric(o,names){for(const n of names){const v=o?.[n];if(v!==undefined&&v!==null&&v!=='')return Number(v)}return null}
function nameOf(o){const raw=String(o?.name||o?.offer_name||o?.offer_key||'Sponsored ad');try{if(raw.startsWith('CEAD1:')){const m=JSON.parse(decodeURIComponent(escape(atob(raw.slice(6)))));return m.headline||o.offer_key}}catch(_){}return raw}
async function renderSponsoredPerformance(){
 const panel=$('ce6-offers');if(!panel||!panel.classList.contains('active')||busy)return;busy=true;
 let host=$('ceHonestAdPerformance');if(!host){host=document.createElement('section');host.id='ceHonestAdPerformance';host.style.cssText='margin:16px 0 22px';const title=[...panel.querySelectorAll('h3')].find(x=>/active sponsored ads/i.test(x.textContent||''));panel.insertBefore(host,title||panel.firstChild)}
 host.innerHTML=`<div class="ce6-manager-note">Loading genuine sponsored-ad activity for the selected Lagos date range…</div>${ranges()}`;
 try{
  const d=await rpc('chatearn_v6_admin_offer_task_manager',{p_range:range});const offers=Array.isArray(d?.offers)?d.offers:[];
  host.innerHTML=`<div class="ce6-manager-note"><b>Period performance:</b> Views are recorded impressions, clicks are recorded opens, and returns mean the browser came back after opening the ad. Missing values are shown as — instead of being guessed.</div>${ranges()}<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Sponsored ad</th><th>Views</th><th>Clicks</th><th>CTR</th><th>Returns</th><th>Return rate</th></tr></thead><tbody>${offers.map(o=>{const views=metric(o,['impressions','views','total_impressions','unique_impressions']),clicks=metric(o,['opens','clicks','total_opens','unique_openers']),returns=metric(o,['returns','offer_returns','total_returns']),ctr=metric(o,['unique_ctr','ctr'])??(views&&clicks!=null?clicks/views*100:null),rr=metric(o,['return_rate'])??(clicks&&returns!=null?returns/clicks*100:null);return `<tr><td>${esc(nameOf(o))}</td><td>${views==null?'—':fmt(views)}</td><td>${clicks==null?'—':fmt(clicks)}</td><td>${ctr==null?'—':pct(ctr)}</td><td>${returns==null?'—':fmt(returns)}</td><td>${rr==null?'—':pct(rr)}</td></tr>`}).join('')||'<tr><td colspan="6">No sponsored-ad activity in this period.</td></tr>'}</tbody></table></div>`;
 }catch(e){host.innerHTML=`<div class="ce6-manager-note">Sponsored-ad period analytics could not load: ${esc(e.message||e)}</div>${ranges()}`}
 finally{busy=false}
}
function cleanOverview(){
 const p=$('ce6-overview');if(!p||!p.classList.contains('active'))return;
 const hero=p.querySelector('.ce6-quality-hero');if(hero&&!hero.dataset.honest){hero.dataset.honest='1';const score=Number((hero.querySelector('strong')?.textContent||'').replace(/[^0-9.]/g,''));const cards=[...hero.querySelectorAll('.ce6-card')].map(x=>x.textContent||'');const invalid=cards.some(t=>/Completed cycles/i.test(t)&&/^0\D/.test(t.trim()))||cards.some(t=>/Meaningful stays/i.test(t)&&/^0\D/.test(t.trim()));if(invalid||score<1){hero.innerHTML='<div><small>DATA QUALITY</small><strong>Checking</strong><span>Some supporting events are missing, so no engagement score is shown.</span></div>'}else{const label=hero.querySelector('small');if(label)label.textContent='ENGAGEMENT SIGNAL (RECORDED EVENTS ONLY)'}}
 const labels=[...p.querySelectorAll('.ce6-card span')];for(const label of labels){const text=(label.textContent||'').trim();if(text==='Site entries')label.textContent='Recorded page entries';if(text==='Sessions')label.textContent='Browser sessions';if(text==='Unique browsers')label.textContent='Unique browser IDs';if(text==='Online now')label.textContent='Recent active browsers'}
 let note=$('ceHonestOverviewNote');if(!note){note=document.createElement('div');note.id='ceHonestOverviewNote';note.className='ce6-manager-note';note.innerHTML='<b>How to read this:</b> Unique browser IDs are the closest estimate of people. Page entries and sessions are activity totals, so one person can create several of them. Figures are never converted into estimated users.';const head=p.querySelector('.ce6-head');head?.insertAdjacentElement('afterend',note)}
}
function cleanPerformance(){const p=$('ce6-performance');if(!p||!p.classList.contains('active'))return;let note=$('ceHonestPerformanceNote');if(!note){note=document.createElement('div');note.id='ceHonestPerformanceNote';note.className='ce6-manager-note';note.innerHTML='<b>Verified counting:</b> Funnel stages may use different identities. Registration is account-based; browser activity is visitor-ID based; page views are events. Do not compare page views directly with people.';const head=p.querySelector('.ce6-head');head?.insertAdjacentElement('afterend',note)}const rows=[...p.querySelectorAll('.ce6-funnel b')];for(const b of rows){if((b.textContent||'').trim()==='Site Entries')b.textContent='Recorded Site Entries'}}
function loadSimplifiedAdmin(){if(window.__CHAT_EARN_SIMPLIFIED_ADMIN_UI__)return;const s=document.createElement('script');s.src='./assets/js/chatearn-admin-simplified-ui.js?v=1.0.0';s.async=false;s.dataset.chatearnModule='simplified-admin';document.head.appendChild(s)}
function refresh(){cleanOverview();cleanPerformance();renderSponsoredPerformance()}
document.addEventListener('click',e=>{const r=e.target.closest('[data-honest-ad-range]');if(r){range=r.dataset.honestAdRange;renderSponsoredPerformance();return}const tab=e.target.closest('[data-ce6-tab]');if(tab)setTimeout(refresh,350)},true);
new MutationObserver(()=>setTimeout(refresh,80)).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{refresh();loadSimplifiedAdmin()},{once:true});else{refresh();loadSimplifiedAdmin()}
window.ChatEarnHonestAnalytics=Object.freeze({version:VERSION,refresh});
})();
