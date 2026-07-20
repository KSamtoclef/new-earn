(() => {
  'use strict';
  const client = window.ChatEarn?.client;
  const partners = [
    ['alexlab102','Alex','🇺🇸','Hey, how is your day going?'],
    ['emiliacute','Emilia','🇬🇧','Hi! Tell me something interesting about yourself.'],
    ['mattjohn','Matt','🇨🇦','Hello! What are you working on today?'],
    ['abi1990','Abi','🇿🇦','Hey there! What do you enjoy doing?'],
    ['princess77','Princess','🇦🇺','Hi! What is life like where you are?'],
    ['camilaanders','Camila','🇪🇸','Hello! What would you like to talk about?']
  ];
  let active = null;
  let sending = false;

  const money = n => `₦${Number(n || 0).toLocaleString('en-NG')}`;
  const uuid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  const toast = (text, bad=false) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.className = bad ? 'show error' : 'show';
    setTimeout(() => { el.className = ''; }, 2800);
  };

  function style() {
    const s = document.createElement('style');
    s.textContent = `.partner-list{display:grid;gap:10px;margin-top:14px}.partner{display:flex;align-items:center;gap:12px;width:100%;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--card);color:var(--text);text-align:left}.avatar{width:45px;height:45px;border-radius:50%;display:grid;place-items:center;background:var(--card2);font-size:22px}.partner b{display:block}.partner small{color:var(--muted)}#chat{padding-bottom:86px}.chat-head{display:flex;align-items:center;gap:12px;padding:8px 0 14px;border-bottom:1px solid var(--line)}.chat-head .back{margin-right:auto}.chat-head strong{display:block}.chat-head small{color:var(--green2)}.messages{display:flex;flex-direction:column;gap:10px;padding:18px 0;min-height:55vh}.bubble{max-width:82%;padding:11px 13px;border-radius:16px;line-height:1.45;font-size:14px}.bubble.in{background:var(--card2);align-self:flex-start}.bubble.out{background:var(--green);color:#041108;align-self:flex-end}.earn{display:block;margin-top:4px;font-size:10px;font-weight:900}.composer{position:fixed;left:0;right:0;bottom:0;max-width:480px;margin:auto;display:flex;gap:8px;padding:10px 14px;background:#08110c;border-top:1px solid var(--line)}.composer input{flex:1}.send{width:52px;border:0;border-radius:14px;background:var(--green);font-weight:900}`;
    document.head.appendChild(s);
  }

  function build() {
    const dashboard = document.getElementById('dashboard');
    const empty = dashboard?.querySelector('.empty-state');
    if (empty) empty.innerHTML = `<div>💬</div><h3>Choose a chat partner</h3><p>Every successful reply is rewarded by the server.</p><div class="partner-list">${partners.map(p => `<button class="partner" data-partner="${p[0]}"><span class="avatar">${p[2]}</span><span><b>${p[1]}</b><small>Online now</small></span></button>`).join('')}</div>`;
    document.querySelector('.shell')?.insertAdjacentHTML('beforeend', `<section id="chat" class="screen"><header class="chat-head"><button id="chatBack" class="back">←</button><span class="avatar" id="chatAvatar">🌍</span><div><strong id="chatName">Partner</strong><small>Online</small></div></header><div id="messages" class="messages"></div><form id="composer" class="composer"><input id="chatInput" maxlength="1500" placeholder="Type a message…" autocomplete="off"><button class="send" type="submit">➤</button></form></section>`);
    document.querySelectorAll('[data-partner]').forEach(b => b.addEventListener('click', () => open(b.dataset.partner)));
    document.getElementById('chatBack')?.addEventListener('click', () => show('dashboard'));
    document.getElementById('composer')?.addEventListener('submit', send);
  }

  function add(text, type, reward=0) {
    const b = document.createElement('div');
    b.className = `bubble ${type}`;
    b.textContent = text;
    if (reward) b.insertAdjacentHTML('beforeend', `<span class="earn">+${money(reward)}</span>`);
    document.getElementById('messages').appendChild(b);
    b.scrollIntoView({behavior:'smooth',block:'end'});
  }

  function open(key) {
    active = partners.find(p => p[0] === key) || partners[0];
    document.getElementById('chatName').textContent = active[1];
    document.getElementById('chatAvatar').textContent = active[2];
    document.getElementById('messages').innerHTML = '';
    add(active[3], 'in');
    show('chat');
    document.getElementById('chatInput').focus();
  }

  async function send(e) {
    e.preventDefault();
    if (sending || !active) return;
    const input = document.getElementById('chatInput');
    const body = input.value.trim();
    if (!body) return;
    sending = true;
    input.disabled = true;
    add(body, 'out');
    input.value = '';
    try {
      const {data,error} = await client.rpc('chatearn_send_message', {
        p_partner_key: active[0], p_body: body,
        p_client_message_id: uuid(), p_session_id: sessionStorage.getItem('ce_session_id') || uuid()
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const last = [...document.querySelectorAll('.bubble.out')].pop();
      if (row?.reward) last?.insertAdjacentHTML('beforeend', `<span class="earn">+${money(row.reward)}</span>`);
      document.getElementById('balance').textContent = money(row?.balance);
      document.getElementById('chatCount').textContent = Number(row?.total_messages || 0).toLocaleString('en-NG');
      setTimeout(() => add('Nice! Tell me more about that.', 'in'), 650);
    } catch (err) {
      toast(err?.message || 'Message failed to send.', true);
    } finally {
      sending = false;
      input.disabled = false;
      input.focus();
    }
  }

  function autoOpen() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard?.classList.contains('active') && !sessionStorage.getItem('ce_chat_opened')) {
      sessionStorage.setItem('ce_chat_opened','1');
      setTimeout(() => open(partners[Math.floor(Math.random()*partners.length)][0]), 350);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (!client) return;
    style(); build(); autoOpen();
    new MutationObserver(autoOpen).observe(document.getElementById('dashboard'), {attributes:true,attributeFilter:['class']});
  }, {once:true});
})();