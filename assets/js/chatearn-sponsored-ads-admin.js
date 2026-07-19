/* ChatEarn Sponsored Ads Manager v1.2.0 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_SPONSORED_ADS_MANAGER__) return;
  window.__CHAT_EARN_SPONSORED_ADS_MANAGER__ = true;

  const VERSION='1.2.0',deletedKey='ce_sponsored_ads_deleted_keys_v1';
  const byId=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client=()=>{
    if(window.ceAdminClient?.rpc)return window.ceAdminClient;
    try{if(typeof supabaseClient!=='undefined'&&supabaseClient?.rpc)return supabaseClient}catch(_){}
    return window.supabaseClient?.rpc?window.supabaseClient:null;
  };
  const parse=v=>typeof v==='string'?JSON.parse(v):v;
  const loadDeleted=()=>{try{return new Set(JSON.parse(localStorage.getItem(deletedKey)||'[]'))}catch(_){return new Set()}};
  const saveDeleted=set=>localStorage.setItem(deletedKey,JSON.stringify([...set]));
  const slug=s=>String(s||'ad').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28)||'ad';
  const makeKey=headline=>`${slug(headline)}-${Date.now().toString(36)}`;
  const encodeMeta=meta=>`CEAD1:${btoa(unescape(encodeURIComponent(JSON.stringify(meta))))}`;
  const decodeMeta=name=>{try{if(String(name||'').startsWith('CEAD1:'))return JSON.parse(decodeURIComponent(escape(atob(String(name).slice(6)))))}catch(_){}return{headline:String(name||'Sponsored activity'),description:'Open this sponsored activity to continue.',cta:'Open Now'};};
  async function rpc(name,args={}){const c=client();if(!c)throw new Error('Sponsored connection is still loading.');const{data,error}=await c.rpc(name,args);if(error)throw error;return parse(data)}

  async function getNextOffer(placement='chat_banner'){
    try{const offer=await rpc('chatearn_v4_get_unique_offer',{p_placement:placement,p_visitor_id:localStorage.getItem('ce_visitor_id'),p_session_id:sessionStorage.getItem('ce_session_id')});if(!offer?.available||!offer.url)return null;return{...offer,...decodeMeta(offer.name)}}catch(e){console.warn('Sponsored ad load:',e?.message||e);return null}
  }
  function openOffer(offer,placement='chat_banner'){
    const url=String(offer?.url||'').trim();
    if(!/^https:\/\//i.test(url)){window.showToast?.('This sponsored link is unavailable.');return false}
    const opened=window.open(url,'_blank','noopener,noreferrer');
    if(!opened)window.location.href=url;
    void rpc('chatearn_v3_track_offer_event',{p_offer_key:offer.offer_key,p_event_type:'open',p_visitor_id:localStorage.getItem('ce_visitor_id'),p_session_id:sessionStorage.getItem('ce_session_id'),p_placement:placement,p_visit_number:Number(window.ceVisitInfo?.visit_number||1),p_messages_before:Number(window.replyCount||0),p_seconds_away:null,p_metadata:{source:'sponsored_ads_manager'}}).catch(()=>{});
    return false;
  }

  async function personalizePlacement(node){
    if(!node||node.dataset.ceManagedCreative==='1')return;
    const placement=node.id==='ceAdaptiveOfferSheet'?'chat_half_screen':'chat_banner';
    const offer=await getNextOffer(placement);if(!offer)return;
    node.dataset.ceManagedCreative='1';
    const title=node.querySelector('h3,b'),description=node.querySelector('p,div[style*="font-size:12px"]'),button=node.querySelector('.open');
    if(title)title.textContent=offer.headline||'Sponsored activity';
    if(description)description.textContent=offer.description||'Open this sponsored activity to continue.';
    if(button){button.textContent=(offer.cta||'Open Now')+' →';button.onclick=e=>{e.preventDefault();e.stopPropagation();openOffer(offer,placement)}}
  }
  function watchPlacements(){new MutationObserver(mutations=>{for(const m of mutations)for(const n of m.addedNodes){if(!(n instanceof HTMLElement))continue;if(n.id==='ceAdaptiveOffer'||n.id==='ceAdaptiveOfferSheet')void personalizePlacement(n);n.querySelectorAll?.('#ceAdaptiveOffer,#ceAdaptiveOfferSheet').forEach(x=>void personalizePlacement(x))}}).observe(document.documentElement,{childList:true,subtree:true})}

  let managerData={offers:[],tasks:[]},editingKey=null;
  function placements(){return [...document.querySelectorAll('[data-ce-ad-placement]:checked')].map(x=>x.value)}
  function resetForm(){editingKey=null;const f=byId('ceSponsoredAdForm');f?.reset();if(byId('ceAdSaveBtn'))byId('ceAdSaveBtn').textContent='Save Sponsored Ad';if(byId('ceAdCancelEdit'))byId('ceAdCancelEdit').style.display='none';document.querySelectorAll('[data-ce-ad-placement]').forEach((x,i)=>x.checked=i===0)}
  function buildPanel(){
    const oldTab=[...document.querySelectorAll('#adminTabs .admin-tab')].find(x=>/offers\s*&\s*tasks|offer manager/i.test(x.textContent||''));if(oldTab)oldTab.textContent='Sponsored Ads';
    const panel=byId('admin-offer-manager');if(!panel||byId('ceSponsoredAdForm'))return;
    panel.innerHTML=`<div class="admin-status-banner"><b>Sponsored Ads:</b> Add each ad once, then edit, archive, unarchive, preview or delete it here. Active ads rotate automatically.</div><div class="admin-section-title">Create or edit sponsored ad</div><form id="ceSponsoredAdForm" class="ce-v42-admin-form"><input id="ceAdHeadline" class="wide" placeholder="Ad headline" required maxlength="90"><textarea id="ceAdDescription" class="wide" placeholder="Short description" required maxlength="220"></textarea><input id="ceAdCta" placeholder="Button text, e.g. Open Now" required maxlength="40"><input id="ceAdUrl" class="wide" type="url" placeholder="Sponsored link: https://..." required><select id="ceAdAudience"><option value="all">All users</option><option value="new">New users</option><option value="returning">Returning users</option></select><input id="ceAdOrder" type="number" min="1" max="100" value="10" title="Lower numbers show first"><div class="wide" style="display:grid;gap:8px;padding:12px;border:1px solid var(--line);border-radius:12px"><b>Where should this ad appear?</b><label><input type="checkbox" data-ce-ad-placement value="chat_banner" checked> Bottom chat banner</label><label><input type="checkbox" data-ce-ad-placement value="chat_half_screen"> Half-screen chat pop-up</label><label><input type="checkbox" data-ce-ad-placement value="chat_native"> Sponsored card inside chat</label><label><input type="checkbox" data-ce-ad-placement value="dashboard"> Dashboard</label><label><input type="checkbox" data-ce-ad-placement value="earnings"> Earnings page</label></div><button id="ceAdSaveBtn" class="admin-btn primary wide" type="submit">Save Sponsored Ad</button><button id="ceAdCancelEdit" class="admin-btn wide" type="button" style="display:none">Cancel Editing</button></form><div class="admin-toolbar"><div class="admin-section-title">Active sponsored ads</div><button class="admin-btn" id="ceAdRefresh">Refresh</button></div><div id="ceAdActiveList" class="admin-list"></div><div class="admin-section-title">Archived sponsored ads</div><div id="ceAdArchivedList" class="admin-list"></div><div id="ceAdPreviewModal" style="display:none;position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.72);align-items:center;justify-content:center;padding:20px"><div style="width:min(430px,100%);background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px"><div id="ceAdPreviewBody"></div><button class="admin-btn wide" id="ceAdPreviewClose" type="button" style="margin-top:14px">Close Preview</button></div></div>`;
    byId('ceSponsoredAdForm').addEventListener('submit',saveAd);byId('ceAdCancelEdit').onclick=resetForm;byId('ceAdRefresh').onclick=loadManager;byId('ceAdPreviewClose').onclick=()=>byId('ceAdPreviewModal').style.display='none';
  }
  async function saveAd(e){e.preventDefault();const btn=byId('ceAdSaveBtn');btn.disabled=true;try{const headline=byId('ceAdHeadline').value.trim(),description=byId('ceAdDescription').value.trim(),cta=byId('ceAdCta').value.trim(),url=byId('ceAdUrl').value.trim(),places=placements();if(!places.length)throw new Error('Select at least one ad placement.');if(!/^https:\/\//i.test(url))throw new Error('Enter a complete https:// sponsored link.');const key=editingKey||makeKey(headline);await rpc('chatearn_v4_admin_save_offer',{p_offer_key:key,p_name:encodeMeta({headline,description,cta}),p_url:url,p_display_order:Number(byId('ceAdOrder').value||10),p_audience:byId('ceAdAudience').value,p_placements:places,p_active:true});window.showToast?.(editingKey?'Sponsored ad updated.':'Sponsored ad saved.');resetForm();await loadManager()}catch(err){window.showAdminError?.(err.message||String(err),true)}finally{btn.disabled=false}}
  function row(o){const m=decodeMeta(o.name);return `<div class="admin-row"><div class="admin-row-main"><div class="admin-row-title">${esc(m.headline)} <span class="admin-tag ${o.active?'':'bad'}">${o.active?'Active':'Archived'}</span></div><div class="admin-row-sub">${esc(m.description)}</div><div class="admin-row-sub">CTA: ${esc(m.cta)} · ${esc(o.url)}</div><div><span class="ce-v42-stat">Impressions ${Number(o.impressions||0)}</span><span class="ce-v42-stat">Opens ${Number(o.opens||0)}</span></div></div><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end"><button class="admin-action" onclick="ceAdPreview('${esc(o.offer_key)}')">Preview</button><button class="admin-action" onclick="ceAdEdit('${esc(o.offer_key)}')">Edit</button><button class="admin-action ${o.active?'reject':'approve'}" onclick="ceAdArchive('${esc(o.offer_key)}',${o.active})">${o.active?'Archive':'Unarchive'}</button><button class="admin-action reject" onclick="ceAdDelete('${esc(o.offer_key)}')">Delete</button></div></div>`}
  async function loadManager(){buildPanel();const active=byId('ceAdActiveList'),archived=byId('ceAdArchivedList');if(!active||!archived)return;active.innerHTML='<div class="admin-empty">Loading ads…</div>';archived.innerHTML='';try{managerData=await rpc('chatearn_v4_admin_offer_manager')||{offers:[],tasks:[]};const deleted=loadDeleted(),offers=(managerData.offers||[]).filter(o=>!deleted.has(o.offer_key));active.innerHTML=offers.filter(o=>o.active).map(row).join('')||'<div class="admin-empty">No active sponsored ads.</div>';archived.innerHTML=offers.filter(o=>!o.active).map(row).join('')||'<div class="admin-empty">No archived sponsored ads.</div>'}catch(e){active.innerHTML=`<div class="admin-empty">${esc(e.message||e)}</div>`}}
  window.ceAdEdit=key=>{const o=(managerData.offers||[]).find(x=>x.offer_key===key);if(!o)return;const m=decodeMeta(o.name);editingKey=key;byId('ceAdHeadline').value=m.headline;byId('ceAdDescription').value=m.description;byId('ceAdCta').value=m.cta;byId('ceAdUrl').value=o.url||'';byId('ceAdAudience').value=o.audience||'all';byId('ceAdOrder').value=o.display_order||10;const p=new Set(o.placements||['all']);document.querySelectorAll('[data-ce-ad-placement]').forEach(x=>x.checked=p.has('all')||p.has(x.value));byId('ceAdSaveBtn').textContent='Update Sponsored Ad';byId('ceAdCancelEdit').style.display='block';byId('ceSponsoredAdForm').scrollIntoView({behavior:'smooth',block:'start'})};
  window.ceAdArchive=async(key,isActive)=>{try{await rpc('chatearn_v4_admin_toggle_offer',{p_offer_key:key,p_active:!isActive});window.showToast?.(isActive?'Ad archived.':'Ad restored.');await loadManager()}catch(e){window.showAdminError?.(e.message||String(e),true)}};
  window.ceAdDelete=async key=>{if(!confirm('Delete this sponsored ad permanently?'))return;try{await rpc('chatearn_v4_admin_delete_offer',{p_offer_key:key});window.showToast?.('Sponsored ad deleted.')}catch(e){try{await rpc('chatearn_v4_admin_toggle_offer',{p_offer_key:key,p_active:false});const d=loadDeleted();d.add(key);saveDeleted(d);window.showToast?.('Ad archived and removed from this manager.')}catch(inner){window.showAdminError?.(inner.message||String(inner),true);return}}await loadManager()};
  window.ceAdPreview=key=>{const o=(managerData.offers||[]).find(x=>x.offer_key===key);if(!o)return;const m=decodeMeta(o.name);byId('ceAdPreviewBody').innerHTML=`<div style="font-size:11px;color:var(--muted);margin-bottom:8px">SPONSORED</div><h3 style="margin:0 0 8px">${esc(m.headline)}</h3><p style="color:var(--text);line-height:1.5">${esc(m.description)}</p><button class="admin-btn primary wide" type="button">${esc(m.cta)}</button>`;byId('ceAdPreviewModal').style.display='flex'};

  function boot(){buildPanel();watchPlacements();const tab=[...document.querySelectorAll('#adminTabs .admin-tab')].find(x=>/sponsored ads/i.test(x.textContent||''));tab?.addEventListener('click',()=>setTimeout(loadManager,80))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.ChatEarnSponsoredAds=Object.freeze({version:VERSION,getNextOffer,openOffer,loadManager,decodeMeta});
})();
