(() => {
  'use strict';
  if (window.__CHAT_EARN_ADMIN__) return;
  window.__CHAT_EARN_ADMIN__ = true;

  const client = window.ChatEarn?.client;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parse = value => typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
  const toast = (m, bad=false) => { const t=document.getElementById('toast'); if(!t)return; t.textContent=m; t.className=bad?'show error':'show'; setTimeout(()=>t.className='',3000); };

  function build() {
    if (document.getElementById('admin')) return;
    document.querySelector('.shell')?.insertAdjacentHTML('beforeend', `
      <section id="admin" class="screen">
        <header class="dashboard-head"><div><small>ADMIN</small><h2>Ads & Tasks</h2></div><button id="adminClose" class="ghost">Close</button></header>
        <div id="adminDenied" class="panel" hidden><h3>Administrator access required</h3><p>Log in with the authorised administrator account.</p></div>
        <div id="adminContent" hidden>
          <div class="panel"><h3>Sponsored Ad</h3><form id="offerForm"><label>Campaign key<input name="key" required placeholder="campaign_key"></label><label>Name<input name="name" required></label><label>Destination URL<input name="url" type="url" required placeholder="https://"></label><label>Headline<input name="headline" required></label><label>Description<input name="description" required></label><label>CTA<input name="cta" value="Open Now" required></label><label>Display order<input name="order" type="number" min="1" value="10"></label><label><input name="active" type="checkbox" checked> Active</label><button class="primary" type="submit">Save Sponsored Ad</button></form></div>
          <div class="panel"><h3>Primary Task</h3><form id="taskForm"><label>Title<input name="title" required></label><label>Description<input name="subtitle"></label><label>Button text<input name="button" value="Open Task" required></label><label>Task type<select name="type"><option value="external">External</option><option value="offer">Sponsored offer</option></select></label><label>External URL<input name="externalUrl" type="url" placeholder="https://"></label><label>Linked offer key<input name="linkedOffer"></label><label>Show after messages<input name="trigger" type="number" min="1" value="3"></label><label><input name="active" type="checkbox" checked> Active</label><button class="primary" type="submit">Save Task</button></form></div>
          <div class="panel"><h3>Withdrawals</h3><button class="secondary" data-load-queue="withdrawals">Refresh Withdrawals</button><div id="withdrawalQueue"></div></div>
          <div class="panel"><h3>KYC</h3><button class="secondary" data-load-queue="kyc">Refresh KYC</button><div id="kycQueue"></div></div>
        </div>
      </section>`);
    document.getElementById('adminClose')?.addEventListener('click', () => { location.hash=''; document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id==='dashboard')); });
    document.getElementById('offerForm')?.addEventListener('submit', saveOffer);
    document.getElementById('taskForm')?.addEventListener('submit', saveTask);
    document.querySelectorAll('[data-load-queue]').forEach(b=>b.addEventListener('click',()=>loadQueue(b.dataset.loadQueue)));
    document.getElementById('admin')?.addEventListener('click', event => {
      const button = event.target.closest('[data-review-id]');
      if (button) review(button.dataset.reviewKind, button.dataset.reviewId, button.dataset.reviewStatus);
    });
  }

  async function checkAdmin() {
    const { data: session } = await client.auth.getSession();
    if (!session?.session?.user) return false;
    const { data, error } = await client.rpc('chatearn_admin_is_admin');
    return !error && data === true;
  }

  async function openAdmin() {
    build();
    const allowed = await checkAdmin();
    document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id==='admin'));
    document.getElementById('adminDenied').hidden = allowed;
    document.getElementById('adminContent').hidden = !allowed;
    if (allowed) { loadQueue('withdrawals'); loadQueue('kyc'); }
  }

  async function saveOffer(event) {
    event.preventDefault();
    const f = new FormData(event.target);
    const creative = { headline:f.get('headline'), description:f.get('description'), cta:f.get('cta'), tag:'SPONSORED' };
    const { error } = await client.rpc('chatearn_admin_save_offer', {
      p_offer_key:f.get('key'), p_name:f.get('name'), p_url:f.get('url'), p_display_order:Number(f.get('order')||10),
      p_audience:'all', p_placements:['chat_native'], p_active:f.get('active')==='on', p_quality_threshold_seconds:30,
      p_max_exposures_per_user:3, p_cooldown_hours:0, p_notes:JSON.stringify(creative)
    });
    if (error) return toast(error.message,true);
    toast('Sponsored ad saved.');
  }

  async function saveTask(event) {
    event.preventDefault();
    const f = new FormData(event.target);
    const type = f.get('type');
    const { error } = await client.rpc('chatearn_admin_save_task', {
      p_task_key:'chat_task', p_title:f.get('title'), p_subtitle:f.get('subtitle')||'', p_button_text:f.get('button'),
      p_task_type:type, p_required_count:1, p_reward_amount:0, p_min_visit:1, p_display_order:10,
      p_active:f.get('active')==='on', p_cooldown_hours:0, p_max_daily_completions:1,
      p_linked_offer_key:type==='offer'?(f.get('linkedOffer')||null):null, p_notes:null, p_audience:'all', p_placement:'chat',
      p_trigger_message_count:Number(f.get('trigger')||3), p_external_url:type==='external'?(f.get('externalUrl')||null):null
    });
    if (error) return toast(error.message,true);
    toast('Task saved.');
  }

  async function review(kind, id, status) {
    const { error } = await client.rpc('chatearn_admin_review_records', { p_kind:kind, p_ids:[id], p_status:status, p_note:null });
    if (error) return toast(error.message,true);
    toast(`${kind==='kyc'?'KYC':'Withdrawal'} ${status}.`);
    loadQueue(kind);
  }

  function row(item, kind) {
    const title = kind==='withdrawals' ? `${esc(item.full_name||'User')} · ₦${Number(item.amount||0).toLocaleString('en-NG')}` : esc(item.full_name||'User');
    const id = esc(item.id||'');
    return `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><b>${title}</b><div style="color:var(--muted);font-size:12px;margin-top:4px">${esc(item.status||'pending')} · ${esc(item.reference||item.id||'')}</div><div style="display:flex;gap:8px;margin-top:10px"><button class="secondary" data-review-kind="${kind}" data-review-id="${id}" data-review-status="approved">Approve</button><button class="secondary" data-review-kind="${kind}" data-review-id="${id}" data-review-status="rejected">Reject</button></div></div>`;
  }

  async function loadQueue(kind) {
    const target = document.getElementById(kind==='withdrawals'?'withdrawalQueue':'kycQueue');
    if (!target) return;
    target.textContent='Loading…';
    const { data, error } = await client.rpc('chatearn_admin_get_queue', { p_kind:kind, p_status:null, p_limit:50, p_offset:0 });
    if (error) { target.textContent=error.message; return; }
    const payload=parse(data)||{}; const rows=Array.isArray(payload.rows)?payload.rows:[];
    target.innerHTML=rows.length?rows.map(x=>row(x,kind)).join(''):'<p style="color:var(--muted)">No records.</p>';
  }

  function route() { if (location.hash==='#admin') openAdmin().catch(e=>toast(e.message,true)); }
  function boot() { if(!client)return; build(); route(); window.addEventListener('hashchange',route); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();