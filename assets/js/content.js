(() => {
  'use strict';
  if (window.__CHAT_EARN_CONTENT__) return;
  window.__CHAT_EARN_CONTENT__ = true;

  const client = window.ChatEarn?.client;
  const visitorId = () => localStorage.getItem('ce_visitor_id') || (() => { const id = crypto.randomUUID(); localStorage.setItem('ce_visitor_id', id); return id; })();
  const sessionId = () => sessionStorage.getItem('ce_session_id') || (() => { const id = crypto.randomUUID(); sessionStorage.setItem('ce_session_id', id); return id; })();
  let lastHandled = 0;

  const parse = value => typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;

  async function readTask() {
    const { data, error } = await client.rpc('chatearn_get_chat_task_config');
    if (error) return null;
    const config = parse(data);
    if (!config || config.active === false || config.enabled === false) return null;
    return config;
  }

  async function readOffer() {
    const { data, error } = await client.rpc('chatearn_get_sponsored_offer', {
      p_placement: 'chat_native',
      p_visitor_id: visitorId(),
      p_session_id: sessionId()
    });
    if (error) return null;
    const offer = parse(data);
    return offer?.available && /^https:\/\//i.test(String(offer.url || '')) ? offer : null;
  }

  function card(kind, title, description, cta, action) {
    const el = document.createElement('article');
    el.className = 'ce-inline-card';
    el.style.cssText = 'margin:8px 0;padding:16px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(145deg,var(--card2),var(--card));align-self:stretch';
    el.innerHTML = `<small style="color:var(--green2);font-weight:900">${kind}</small><h3 style="margin:7px 0 4px;font-size:17px"></h3><p style="margin:0;color:var(--muted);line-height:1.5;font-size:13px"></p><button type="button" class="primary" style="margin-top:12px"></button>`;
    el.querySelector('h3').textContent = title;
    el.querySelector('p').textContent = description;
    el.querySelector('button').textContent = cta;
    el.querySelector('button').addEventListener('click', action);
    return el;
  }

  function place(node) {
    const messages = document.getElementById('messages');
    if (!messages || !node) return;
    messages.appendChild(node);
    node.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  async function openOffer(offer) {
    window.open(offer.url, '_blank', 'noopener,noreferrer');
    await client.rpc('chatearn_track_sponsored_event', {
      p_offer_key: offer.offer_key,
      p_event_type: 'open',
      p_visitor_id: visitorId(),
      p_session_id: sessionId(),
      p_placement: 'chat_native',
      p_visit_number: 1,
      p_messages_before: document.querySelectorAll('#messages .bubble.out').length,
      p_seconds_away: null,
      p_metadata: { source: 'clean_content_module' }
    }).catch(() => {});
  }

  async function showTask() {
    const task = await readTask();
    if (!task) return;
    const url = task.url || task.destination_url || task.link;
    place(card('TASK', task.headline || task.title || 'Complete this task', task.description || task.body || 'Open the task to continue.', task.cta || task.button_text || 'Open Task', () => {
      if (/^https:\/\//i.test(String(url || ''))) window.open(url, '_blank', 'noopener,noreferrer');
    }));
  }

  async function showOffer() {
    const offer = await readOffer();
    if (!offer) return;
    place(card('SPONSORED', offer.headline || offer.name || 'Sponsored opportunity', offer.description || 'Open this sponsored opportunity.', offer.cta || 'Open Now', () => openOffer(offer)));
  }

  async function inspect() {
    const count = document.querySelectorAll('#messages .bubble.out .earn').length;
    if (count <= lastHandled) return;
    lastHandled = count;
    if (count > 0 && count % 3 === 0) await showTask();
    if (count > 0 && count % 4 === 0) await showOffer();
  }

  function boot() {
    if (!client) return;
    const messages = document.getElementById('messages');
    if (messages) new MutationObserver(inspect).observe(messages, { childList: true, subtree: true });
    else new MutationObserver(() => {
      const found = document.getElementById('messages');
      if (found && !found.dataset.contentObserved) {
        found.dataset.contentObserved = '1';
        new MutationObserver(inspect).observe(found, { childList: true, subtree: true });
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();