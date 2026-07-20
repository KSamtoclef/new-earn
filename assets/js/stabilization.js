(() => {
  'use strict';
  if (window.__CHAT_EARN_STABILIZATION__) return;
  window.__CHAT_EARN_STABILIZATION__ = true;

  const client = window.ChatEarn?.client;
  const MINIMUM = 40000;
  const FIRST_LIMIT = 80000;
  const ACTIVE_WITHDRAWALS = new Set(['submitted','pending','processing','approved']);
  const money = n => `₦${Number(n || 0).toLocaleString('en-NG')}`;
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  const toast = (message, bad=false) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = bad ? 'show error' : 'show';
    setTimeout(() => { el.className = ''; }, 3200);
  };
  const getUser = async () => (await client.auth.getSession()).data?.session?.user || null;
  const profile = async userId => {
    const {data,error} = await client.from('profiles').select('balance,has_withdrawn').eq('user_id',userId).maybeSingle();
    if (error) throw error;
    return data || {balance:0,has_withdrawn:false};
  };
  const latestWithdrawal = async userId => {
    const {data,error} = await client.from('withdrawals').select('id,status,public_reference,submitted_at').eq('user_id',userId).order('submitted_at',{ascending:false}).limit(1);
    if (error) throw error;
    return data?.[0] || null;
  };
  const latestKyc = async userId => {
    const {data,error} = await client.from('kyc_submissions').select('id,status,submitted_at,reviewed_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(1);
    if (error) throw error;
    return data?.[0] || null;
  };

  async function guardChat(event) {
    if (!event.target?.matches?.('#composer')) return;
    const user = await getUser();
    if (!user) return;
    try {
      const [p,w] = await Promise.all([profile(user.id),latestWithdrawal(user.id)]);
      const unlocked = Boolean(p.has_withdrawn) || ['processing','approved','paid','completed'].includes(String(w?.status||'').toLowerCase());
      if (!unlocked && Number(p.balance||0) >= FIRST_LIMIT) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toast(`First earning cycle reached ${money(FIRST_LIMIT)}. Submit your withdrawal to continue.`,true);
        document.getElementById('rewardsButton')?.click();
      }
    } catch (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast(error.message || 'Unable to verify earning eligibility.',true);
    }
  }

  async function guardWithdrawal(event) {
    const button = event.target?.closest?.('#rewardsButton');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const user = await getUser();
      if (!user) return toast('Login required.',true);
      const [p,w] = await Promise.all([profile(user.id),latestWithdrawal(user.id)]);
      if (w && ACTIVE_WITHDRAWALS.has(String(w.status).toLowerCase())) {
        show('processing');
        const text = document.getElementById('processingText');
        if (text) text.textContent = `Status: ${String(w.status).replaceAll('_',' ')}${w.public_reference?` · ${w.public_reference}`:''}`;
        return;
      }
      if (Number(p.balance||0) < MINIMUM) return toast(`${money(MINIMUM-Number(p.balance||0))} remaining before withdrawal.`,true);
      show('withdraw');
      const amount = document.getElementById('wdAmountText');
      if (amount) amount.textContent = `${money(p.balance)} available.`;
    } catch (error) { toast(error.message || 'Unable to verify withdrawal eligibility.',true); }
  }

  const shareKey = 'ce_verified_share_returns_v1';
  const pendingShareKey = 'ce_share_opened_at_v1';
  const readShares = () => Math.max(0,Math.min(5,Number(sessionStorage.getItem(shareKey)||0)));
  function renderShares() {
    const shares = readShares();
    const fill = document.getElementById('shareFill');
    const text = document.getElementById('shareText');
    const button = document.getElementById('shareButton');
    if (fill) fill.style.width = `${shares*20}%`;
    if (text) text.textContent = shares >= 5 ? 'Sharing completed.' : `${5-shares} verified return${5-shares===1?'':'s'} remaining.`;
    if (button) button.textContent = shares >= 5 ? 'Continue to KYC' : 'Open WhatsApp';
  }
  async function shareGuard(event) {
    if (!event.target?.closest?.('#shareButton')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const shares = readShares();
    if (shares >= 5) return show('kyc');
    sessionStorage.setItem(pendingShareKey,String(Date.now()));
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`I am using ChatEarn. Join here: ${location.origin}`)}`,'_blank','noopener,noreferrer');
  }
  async function verifyShareReturn() {
    const opened = Number(sessionStorage.getItem(pendingShareKey)||0);
    if (!opened || Date.now()-opened < 1800 || document.visibilityState === 'hidden') return;
    sessionStorage.removeItem(pendingShareKey);
    const next = Math.min(5,readShares()+1);
    sessionStorage.setItem(shareKey,String(next));
    try {
      await client.rpc('chatearn_record_share_attempt',{p_session_id:sessionStorage.getItem('ce_session_id'),p_step:next,p_seconds_away:Math.round((Date.now()-opened)/1000),p_returned:true});
    } catch (_) {}
    renderShares();
    if (next >= 5) setTimeout(()=>show('kyc'),500);
  }

  async function kycGuard(event) {
    if (!event.target?.closest?.('#kycDone')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const user = await getUser();
      const kyc = user ? await latestKyc(user.id) : null;
      const status = String(kyc?.status||'').toLowerCase();
      if (!kyc || !['submitted','pending','approved'].includes(status)) return toast('Complete and submit the verification before continuing.',true);
      show('processing');
      const w = await latestWithdrawal(user.id);
      const text = document.getElementById('processingText');
      if (text) text.textContent = `Withdrawal: ${String(w?.status||'submitted').replaceAll('_',' ')} · KYC: ${status}`;
    } catch (error) { toast(error.message || 'Unable to confirm KYC status.',true); }
  }

  async function continueGuard(event) {
    if (!event.target?.closest?.('#continueEarning')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const user = await getUser();
      const w = user ? await latestWithdrawal(user.id) : null;
      const status = String(w?.status||'').toLowerCase();
      if (!['processing','approved','paid','completed'].includes(status)) return toast('Your withdrawal has not reached processing yet.',true);
      show('dashboard');
      toast('Earning access confirmed.');
    } catch (error) { toast(error.message || 'Unable to confirm earning access.',true); }
  }

  async function enhanceAdmin() {
    const root = document.getElementById('adminContent');
    if (!root || document.getElementById('offerManager')) return;
    const allowed = await client.rpc('chatearn_v3_admin_is_admin');
    if (allowed.error || allowed.data !== true) return;
    const panel = document.createElement('div');
    panel.id = 'offerManager'; panel.className = 'panel';
    panel.innerHTML = '<h3>Existing Sponsored Ads</h3><button id="refreshOffers" class="secondary">Refresh Ads</button><div id="offerRows">Loading…</div>';
    root.prepend(panel);
    document.getElementById('refreshOffers').onclick = loadOffers;
    panel.addEventListener('click',async event=>{
      const btn=event.target.closest('[data-offer-action]'); if(!btn)return;
      const id=btn.dataset.id, action=btn.dataset.offerAction;
      try {
        if(action==='edit'){
          const {data,error}=await client.from('offers').select('*').eq('id',id).single(); if(error)throw error;
          const creative=data.targeting?.creative||{}; const form=document.getElementById('offerForm');
          form.elements.key.value=data.targeting?.offer_key||id; form.elements.name.value=data.name||''; form.elements.url.value=data.destination_url||'';
          form.elements.headline.value=creative.headline||data.name||''; form.elements.description.value=creative.description||''; form.elements.cta.value=creative.cta||'Open Now'; form.elements.active.checked=String(data.status)==='active';
          form.scrollIntoView({behavior:'smooth'});
        } else if(action==='toggle') {
          const active=btn.dataset.active==='true'; const {error}=await client.from('offers').update({status:active?'draft':'active'}).eq('id',id); if(error)throw error;
        } else if(action==='delete') {
          if(!confirm('Archive this sponsored ad?'))return;
          const {error}=await client.from('offers').update({archived_at:new Date().toISOString(),status:'draft'}).eq('id',id); if(error)throw error;
        }
        await loadOffers(); toast('Sponsored ad updated.');
      } catch(error){toast(error.message||'Ad action failed.',true);}
    });
    await loadOffers();
  }
  async function loadOffers(){
    const target=document.getElementById('offerRows'); if(!target)return;
    const {data,error}=await client.from('offers').select('id,name,destination_url,status,targeting,archived_at,updated_at').is('archived_at',null).order('updated_at',{ascending:false});
    if(error){target.textContent=error.message;return;}
    target.innerHTML=(data||[]).map(o=>{
      const key=o.targeting?.offer_key||o.id, active=String(o.status)==='active';
      return `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><b>${String(o.name||key).replace(/[<>]/g,'')}</b><div style="font-size:12px;color:var(--muted)">${active?'Active':'Paused'} · ${String(key).replace(/[<>]/g,'')}</div><div style="display:flex;gap:7px;margin-top:8px"><button class="secondary" data-offer-action="edit" data-id="${o.id}">Edit</button><button class="secondary" data-offer-action="toggle" data-active="${active}" data-id="${o.id}">${active?'Pause':'Resume'}</button><button class="secondary" data-offer-action="delete" data-id="${o.id}">Delete</button></div></div>`;
    }).join('')||'<p>No sponsored ads.</p>';
  }

  function boot(){
    if(!client)return;
    document.addEventListener('submit',guardChat,true);
    document.addEventListener('click',guardWithdrawal,true);
    document.addEventListener('click',shareGuard,true);
    document.addEventListener('click',kycGuard,true);
    document.addEventListener('click',continueGuard,true);
    document.addEventListener('visibilitychange',verifyShareReturn);
    window.addEventListener('pageshow',verifyShareReturn);
    renderShares();
    new MutationObserver(()=>{renderShares();enhanceAdmin().catch(()=>{});}).observe(document.body,{childList:true,subtree:true});
    enhanceAdmin().catch(()=>{});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();