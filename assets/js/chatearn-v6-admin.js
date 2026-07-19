/* ChatEarn Ads & Tasks Admin v1.0.0 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_ADS_TASKS_ADMIN__) return;
  window.__CHAT_EARN_ADS_TASKS_ADMIN__ = true;

  /* Stop legacy admin extensions before DOMContentLoaded. */
  window.__CHAT_EARN_V6_1_ADMIN__ = true;
  window.__CHAT_EARN_V6_SPONSORED_ADS_UI__ = true;
  window.__CHAT_EARN_SPONSORED_ADS_STABILITY__ = true;
  window.__CHAT_EARN_HONEST_ANALYTICS__ = true;
  window.__CHAT_EARN_MODULE_7B3__ = true;
  window.__CHAT_EARN_MODULE_7C2__ = true;
  window.__CHAT_EARN_SIMPLIFIED_ADMIN_UI__ = true;
  window.__CHAT_EARN_LIVE_MANAGER_EDITOR__ = true;

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = v => String(v || 'ad').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'ad';
  const palettes = {
    emerald:['#16a34a','#f0fdf4','#14532d'], blue:['#2563eb','#eff6ff','#1e3a8a'],
    purple:['#7c3aed','#faf5ff','#4c1d95'], orange:['#ea580c','#fff7ed','#7c2d12'],
    rose:['#e11d48','#fff1f2','#881337'], gold:['#ca8a04','#fefce8','#713f12']
  };

  let client;
  let offers = [];
  let tasks = [];
  let editingOffer = null;

  function db() {
    if (client) return client;
    if (!window.supabase?.createClient || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) throw new Error('Admin connection is not ready.');
    client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'chatearn-ads-admin-auth'}
    });
    window.ceAdminClient = client;
    return client;
  }

  async function rpc(name, args={}) {
    const {data,error} = await db().rpc(name,args);
    if (error) throw error;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  function error(message='') {
    const box = $('adminError');
    if (!box) return;
    box.textContent = message;
    box.style.display = message ? 'block' : 'none';
  }

  function status(text, bad=false) {
    if ($('adminRealtimeText')) $('adminRealtimeText').textContent = text;
    if ($('adminRealtimeDot')) $('adminRealtimeDot').className = 'admin-live-dot ' + (bad ? 'error' : 'live');
    if ($('adminLastUpdated')) $('adminLastUpdated').textContent = '';
    if ($('adminAutoRefreshText')) $('adminAutoRefreshText').textContent = 'Manual refresh only';
  }

  function creative(offer={}) {
    try {
      const raw = offer.notes ?? offer.targeting?.notes;
      const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (v && typeof v === 'object') return v;
    } catch (_) {}
    return {tag:'SPONSORED',headline:offer.name||'Sponsored opportunity',description:'Open this sponsored opportunity to continue.',cta:'Open Now',preset:'emerald'};
  }

  function shell() {
    const content = $('adminContent');
    if (!content) return;
    content.innerHTML = `
      <nav class="ce-mini-tabs"><button class="active" data-view="ads">Sponsored Ads</button><button data-view="tasks">Tasks</button></nav>
      <section id="ceAdsView">
        <div class="ce-page-head"><div><h2>Sponsored Ads</h2><p>Create and publish adverts shown inside ChatEarn.</p></div><button class="admin-btn primary" id="ceNewAd">Create Ad</button></div>
        <div id="ceAdEditor" class="ce-editor" hidden></div>
        <div class="ce-list-head"><h3>Campaigns</h3><button class="admin-btn" id="ceRefreshAds">Refresh</button></div>
        <div id="ceAdsList" class="ce-stack"></div>
      </section>
      <section id="ceTasksView" hidden>
        <div class="ce-page-head"><div><h2>Tasks</h2><p>Configure the earning task displayed to users.</p></div><button class="admin-btn primary" id="ceEditTask">Edit Task</button></div>
        <div id="ceTaskEditor" class="ce-editor" hidden></div>
        <div id="ceTaskList" class="ce-stack"></div>
      </section>`;

    document.querySelectorAll('.ce-mini-tabs button').forEach(btn => btn.onclick = () => switchView(btn.dataset.view));
    $('ceNewAd').onclick = () => openAd();
    $('ceRefreshAds').onclick = loadAll;
    $('ceEditTask').onclick = openTask;
  }

  function switchView(view) {
    document.querySelectorAll('.ce-mini-tabs button').forEach(b => b.classList.toggle('active', b.dataset.view===view));
    $('ceAdsView').hidden = view !== 'ads';
    $('ceTasksView').hidden = view !== 'tasks';
  }

  function adForm(offer=null) {
    const c = creative(offer||{});
    const selected = new Set(Array.isArray(offer?.placements) ? offer.placements : ['chat_native']);
    return `<form id="ceAdForm">
      <div class="ce-grid">
        <label>Campaign name<input name="name" required maxlength="80" value="${esc(offer?.name||'')}"></label>
        <label>Destination link<input name="url" type="url" required placeholder="https://..." value="${esc(offer?.url||'')}"></label>
        <label>Sponsored tag<input name="tag" maxlength="24" value="${esc(c.tag||'SPONSORED')}"></label>
        <label>Headline<input name="headline" required maxlength="90" value="${esc(c.headline||'')}"></label>
        <label class="wide">Description<textarea name="description" required maxlength="220">${esc(c.description||'')}</textarea></label>
        <label>Button text<input name="cta" required maxlength="40" value="${esc(c.cta||'Open Now')}"></label>
        <label>Colour style<select name="preset">${Object.keys(palettes).map(k=>`<option value="${k}" ${c.preset===k?'selected':''}>${k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select></label>
        <label>Priority<input name="order" type="number" min="1" max="100" value="${Number(offer?.display_order||10)}"></label>
        <fieldset class="wide"><legend>Placement</legend>
          <label><input type="checkbox" name="place" value="chat_native" ${selected.has('chat_native')||selected.has('all')?'checked':''}> In-chat card</label>
          <label><input type="checkbox" name="place" value="chat_banner" ${selected.has('chat_banner')?'checked':''}> Bottom banner</label>
          <label><input type="checkbox" name="place" value="chat_half_screen" ${selected.has('chat_half_screen')?'checked':''}> Half-screen advert</label>
        </fieldset>
        <label class="wide check"><input name="active" type="checkbox" ${offer ? (offer.active?'checked':'') : 'checked'}> Publish immediately</label>
      </div>
      <div id="cePreview" class="ce-preview"></div>
      <div class="ce-actions"><button class="admin-btn primary" type="submit">Save Advert</button><button class="admin-btn" type="button" id="ceCancelAd">Cancel</button></div>
    </form>`;
  }

  function openAd(offer=null) {
    editingOffer = offer?.offer_key || null;
    const box = $('ceAdEditor');
    box.innerHTML = adForm(offer);
    box.hidden = false;
    $('ceCancelAd').onclick = () => { box.hidden=true; editingOffer=null; };
    $('ceAdForm').onsubmit = saveAd;
    $('ceAdForm').oninput = preview;
    preview();
    box.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function preview() {
    const f = $('ceAdForm'), p = $('cePreview');
    if (!f || !p) return;
    const colors = palettes[f.elements.preset.value] || palettes.emerald;
    p.style.background = `linear-gradient(145deg,${colors[1]},#fff)`;
    p.style.borderColor = colors[0]; p.style.color = colors[2];
    p.innerHTML = `<small style="color:${colors[0]}">${esc(f.elements.tag.value||'SPONSORED')}</small><h3>${esc(f.elements.headline.value||'Your headline')}</h3><p>${esc(f.elements.description.value||'Your advert description')}</p><button type="button" style="background:${colors[0]}">${esc(f.elements.cta.value||'Open Now')} →</button>`;
  }

  async function saveAd(e) {
    e.preventDefault(); error('');
    const f=e.currentTarget, button=f.querySelector('[type="submit"]');
    const places=[...f.querySelectorAll('[name="place"]:checked')].map(x=>x.value);
    if (!places.length) return error('Select at least one placement.');
    const colors=palettes[f.elements.preset.value]||palettes.emerald;
    const notes=JSON.stringify({tag:f.elements.tag.value.trim()||'SPONSORED',headline:f.elements.headline.value.trim(),description:f.elements.description.value.trim(),cta:f.elements.cta.value.trim()||'Open Now',preset:f.elements.preset.value,accent:colors[0],background:colors[1],text:colors[2]});
    button.disabled=true; button.textContent='Saving…';
    try {
      await rpc('chatearn_v6_admin_save_offer',{
        p_offer_key:editingOffer||`${slug(f.elements.name.value)}-${Date.now().toString(36)}`,
        p_name:f.elements.name.value.trim(),p_url:f.elements.url.value.trim(),p_display_order:Number(f.elements.order.value||10),
        p_audience:'all',p_placements:places,p_active:f.elements.active.checked,p_quality_threshold_seconds:12,
        p_max_exposures_per_user:10,p_cooldown_hours:0,p_notes:notes
      });
      $('ceAdEditor').hidden=true; editingOffer=null; await loadAll();
    } catch(ex) { error(ex.message||String(ex)); }
    finally { button.disabled=false; button.textContent='Save Advert'; }
  }

  function taskForm(task={}) {
    return `<form id="ceTaskForm"><div class="ce-grid">
      <label>Task title<input name="title" required maxlength="90" value="${esc(task.title||'Quick earning task')}"></label>
      <label>Button text<input name="button" required maxlength="40" value="${esc(task.button_text||task.cta||'Start Task')}"></label>
      <label class="wide">Description<textarea name="subtitle" required maxlength="220">${esc(task.subtitle||task.description||'Complete this task, then return and continue earning.')}</textarea></label>
      <label>Task type<select name="type"><option value="offer">Sponsored offer</option><option value="external">External link</option></select></label>
      <label>Linked advert<select name="offer"><option value="">Select advert</option>${offers.map(o=>`<option value="${esc(o.offer_key)}" ${task.linked_offer_key===o.offer_key?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label>
      <label>External link<input name="external" type="url" placeholder="https://..." value="${esc(task.external_url||'')}"></label>
      <label>Show after messages<input name="trigger" type="number" min="1" max="100" value="${Number(task.trigger_message_count||3)}"></label>
      <label>Reward amount<input name="reward" type="number" min="0" value="${Number(task.reward_amount||0)}"></label>
      <label class="wide check"><input name="active" type="checkbox" ${task.active!==false?'checked':''}> Task active</label>
    </div><div class="ce-actions"><button class="admin-btn primary" type="submit">Save Task</button><button class="admin-btn" type="button" id="ceCancelTask">Cancel</button></div></form>`;
  }

  function openTask() {
    const task=tasks[0]||{}; const box=$('ceTaskEditor');
    box.innerHTML=taskForm(task); box.hidden=false;
    $('ceCancelTask').onclick=()=>box.hidden=true;
    $('ceTaskForm').onsubmit=saveTask;
    box.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function saveTask(e) {
    e.preventDefault(); error('');
    const f=e.currentTarget, button=f.querySelector('[type="submit"]');
    button.disabled=true; button.textContent='Saving…';
    try {
      await rpc('chatearn_v6_admin_save_task',{
        p_task_key:'chat_task',p_title:f.elements.title.value.trim(),p_subtitle:f.elements.subtitle.value.trim(),
        p_button_text:f.elements.button.value.trim(),p_task_type:f.elements.type.value,p_required_count:1,
        p_reward_amount:Number(f.elements.reward.value||0),p_min_visit:1,p_display_order:10,p_active:f.elements.active.checked,
        p_cooldown_hours:0,p_max_daily_completions:1,p_linked_offer_key:f.elements.offer.value||null,p_notes:'',
        p_audience:'all',p_placement:'chat',p_trigger_message_count:Number(f.elements.trigger.value||3),
        p_external_url:f.elements.external.value.trim()||null
      });
      $('ceTaskEditor').hidden=true; await loadAll();
    } catch(ex) { error(ex.message||String(ex)); }
    finally { button.disabled=false; button.textContent='Save Task'; }
  }

  function adRow(o) {
    const c=creative(o);
    return `<article class="ce-card"><div><h3>${esc(c.headline||o.name)} <span class="admin-tag ${o.active?'':'bad'}">${o.active?'Active':'Paused'}</span></h3><p>${esc(c.description||'')}</p><small>${esc(o.url||'')}</small></div><div class="ce-actions"><button class="admin-btn" data-edit="${esc(o.offer_key)}">Edit</button><button class="admin-btn" data-toggle="${esc(o.offer_key)}">${o.active?'Pause':'Resume'}</button><button class="admin-btn danger" data-archive="${esc(o.offer_key)}">Archive</button></div></article>`;
  }

  function taskRow(t) {
    return `<article class="ce-card"><div><h3>${esc(t.title||'Quick earning task')} <span class="admin-tag ${t.active?'':'bad'}">${t.active?'Active':'Paused'}</span></h3><p>${esc(t.subtitle||t.description||'')}</p><small>${esc(t.task_type||'offer')} · after ${Number(t.trigger_message_count||3)} messages</small></div><div class="ce-actions"><button class="admin-btn" id="ceTaskEditRow">Edit</button></div></article>`;
  }

  async function loadAll() {
    error(''); status('Loading…');
    try {
      const payload=await rpc('chatearn_v6_admin_manager_inventory');
      offers=Array.isArray(payload?.offers)?payload.offers:[];
      tasks=Array.isArray(payload?.tasks)?payload.tasks:[];
      $('ceAdsList').innerHTML=offers.map(adRow).join('')||'<div class="admin-empty">No adverts created yet.</div>';
      $('ceTaskList').innerHTML=tasks.map(taskRow).join('')||'<div class="admin-empty">No task configured yet.</div>';
      document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openAd(offers.find(o=>o.offer_key===b.dataset.edit)));
      document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=async()=>{const o=offers.find(x=>x.offer_key===b.dataset.toggle);try{await rpc('chatearn_v6_admin_offer_action',{p_offer_key:o.offer_key,p_action:o.active?'pause':'resume'});await loadAll();}catch(ex){error(ex.message||String(ex));}});
      document.querySelectorAll('[data-archive]').forEach(b=>b.onclick=async()=>{try{await rpc('chatearn_v6_admin_offer_action',{p_offer_key:b.dataset.archive,p_action:'archive'});await loadAll();}catch(ex){error(ex.message||String(ex));}});
      if ($('ceTaskEditRow')) $('ceTaskEditRow').onclick=openTask;
      status('Ads and Tasks ready');
    } catch(ex) { error(ex.message||String(ex)); status('Admin unavailable',true); }
  }

  async function authorised() {
    const {data:{session}}=await db().auth.getSession();
    if (!session) return false;
    const {data,error:rpcError}=await db().rpc('chatearn_v3_admin_is_admin');
    if (rpcError) throw rpcError;
    return Boolean(data);
  }

  window.adminLogin = async function() {
    error(''); const button=$('adminLoginBtn');
    button.disabled=true; button.textContent='Opening…';
    try {
      const {error:loginError}=await db().auth.signInWithPassword({email:$('adminEmail').value.trim(),password:$('adminPass').value});
      if (loginError) throw loginError;
      if (!await authorised()) throw new Error('Administrator access required.');
      $('adminLoginBox').style.display='none'; $('adminContent').style.display='block'; shell(); await loadAll();
    } catch(ex) { error(ex.message||String(ex)); }
    finally { button.disabled=false; button.textContent='Open Admin Panel'; }
  };

  window.adminLogout = async function(){await db().auth.signOut();$('adminContent').style.display='none';$('adminLoginBox').style.display='block';status('Signed out');};
  window.refreshAdmin = loadAll;
  window.closeAdmin = function(){const shellEl=$('adminShell');if(shellEl)shellEl.classList.remove('open');};
  window.adminSwitchTab = () => false;

  function styles() {
    const s=document.createElement('style');
    s.textContent=`#adminTabs,.admin-panel{display:none!important}.ce-mini-tabs{display:flex;gap:10px;margin-bottom:24px}.ce-mini-tabs button{border:1px solid #26372e;background:#111b16;color:#aebbb3;border-radius:14px;padding:13px 18px;font-weight:850;font-size:15px}.ce-mini-tabs button.active{background:#00d768;color:#031108;border-color:#00d768}.ce-page-head,.ce-list-head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:18px}.ce-page-head h2,.ce-list-head h3{margin:0}.ce-page-head p{margin:5px 0 0;color:#819087;font-size:13px}.ce-stack{display:grid;gap:14px}.ce-card,.ce-editor{border:1px solid #244833;background:#0d1812;border-radius:18px;padding:18px}.ce-card{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.ce-card h3{margin:0 0 8px}.ce-card p{margin:0 0 8px;color:#aab5ae}.ce-card small{color:#748179;word-break:break-all}.ce-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.ce-grid label{display:grid;gap:7px;font-size:12px;font-weight:800;color:#aab5ae}.ce-grid input,.ce-grid textarea,.ce-grid select{width:100%;box-sizing:border-box;border:1px solid #26372e;background:#09110d;color:#fff;border-radius:12px;padding:13px;font:inherit}.ce-grid textarea{min-height:94px;resize:vertical}.ce-grid .wide,.ce-grid fieldset.wide{grid-column:1/-1}.ce-grid fieldset{border:1px solid #26372e;border-radius:14px;padding:14px;display:flex;gap:16px;flex-wrap:wrap}.ce-grid fieldset label,.ce-grid .check{display:flex;align-items:center;gap:8px}.ce-grid input[type=checkbox]{width:20px;height:20px}.ce-preview{margin-top:16px;border:2px solid;border-radius:18px;padding:20px}.ce-preview small{font-weight:900;letter-spacing:1.2px}.ce-preview h3{font-size:24px;margin:12px 0 8px}.ce-preview p{margin:0 0 16px}.ce-preview button{width:100%;border:0;border-radius:12px;padding:13px;color:#fff;font-weight:900}.ce-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:15px}.admin-btn.danger{background:#7f1d2d!important;border-color:#9f2940!important}@media(max-width:640px){.ce-grid{grid-template-columns:1fr}.ce-card,.ce-page-head{display:block}.ce-page-head .admin-btn{margin-top:14px}.ce-mini-tabs button{flex:1}}`;
    document.head.appendChild(s);
  }

  async function boot() {
    styles();
    try {
      if (await authorised()) {
        $('adminLoginBox').style.display='none'; $('adminContent').style.display='block'; shell(); await loadAll();
      } else { status('Sign in to manage ads and tasks'); }
    } catch(ex) { error(ex.message||String(ex)); status('Admin unavailable',true); }
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();