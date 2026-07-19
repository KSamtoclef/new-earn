/* ChatEarn live Sponsored Ads & Tasks editor v1.0.0 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_LIVE_MANAGER_EDITOR__) return;
  window.__CHAT_EARN_LIVE_MANAGER_EDITOR__ = true;

  const PRESETS = {
    emerald: { label: 'Emerald Green', accent: '#16a34a', background: '#f0fdf4', text: '#14532d' },
    ocean: { label: 'Ocean Blue', accent: '#0284c7', background: '#f0f9ff', text: '#0c4a6e' },
    royal: { label: 'Royal Purple', accent: '#7c3aed', background: '#faf5ff', text: '#4c1d95' },
    sunset: { label: 'Sunset Orange', accent: '#ea580c', background: '#fff7ed', text: '#7c2d12' },
    rose: { label: 'Rose Red', accent: '#e11d48', background: '#fff1f2', text: '#881337' },
    gold: { label: 'Premium Gold', accent: '#ca8a04', background: '#fefce8', text: '#713f12' }
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const parseJson = value => { try { const v = JSON.parse(String(value || '')); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
  const client = () => window.ceAdminClient;

  function offerCreativeFrom(form) {
    const old = parseJson(form.elements.notes?.value);
    const presetKey = form.elements.creativePreset?.value || old.preset || 'emerald';
    const preset = PRESETS[presetKey] || PRESETS.emerald;
    return {
      ...old,
      headline: form.elements.creativeHeadline?.value.trim() || form.elements.name?.value.trim() || 'Sponsored opportunity',
      description: form.elements.creativeDescription?.value.trim() || 'Open this sponsored opportunity to continue.',
      cta: form.elements.creativeCta?.value.trim() || 'Open Now',
      tag: form.elements.creativeTag?.value.trim() || 'SPONSORED',
      preset: presetKey,
      accent: form.elements.accentColor?.value || preset.accent,
      background: form.elements.backgroundColor?.value || preset.background,
      text: form.elements.textColor?.value || preset.text
    };
  }

  function renderOfferPreview(form) {
    const box = form.querySelector('[data-live-offer-preview]');
    if (!box) return;
    const c = offerCreativeFrom(form);
    box.style.background = `linear-gradient(145deg, ${c.background}, #ffffff)`;
    box.style.borderColor = c.accent;
    box.style.color = c.text;
    box.innerHTML = `<small style="font-weight:900;letter-spacing:1.2px;color:${esc(c.accent)}">${esc(c.tag)}</small><h3 style="margin:8px 0 6px">${esc(c.headline)}</h3><p style="margin:0 0 12px;line-height:1.45">${esc(c.description)}</p><button type="button" style="width:100%;border:0;border-radius:10px;padding:11px;background:${esc(c.accent)};color:#fff;font-weight:900">${esc(c.cta)} →</button>`;
  }

  function enhanceOffer(form) {
    if (!form || form.dataset.liveManagerEnhanced === '1') return;
    form.dataset.liveManagerEnhanced = '1';
    const saved = parseJson(form.elements.notes?.value);
    const presetKey = PRESETS[saved.preset] ? saved.preset : 'emerald';
    const preset = PRESETS[presetKey];
    const block = document.createElement('section');
    block.className = 'ce-live-editor-block';
    block.innerHTML = `<div class="ce-live-editor-title"><b>Ad creative</b><span>Public appearance</span></div>
      <input name="creativeTag" maxlength="24" placeholder="Tag e.g. SPONSORED" value="${esc(saved.tag || 'SPONSORED')}">
      <input name="creativeHeadline" maxlength="90" placeholder="Public headline" value="${esc(saved.headline || form.elements.name?.value || '')}" required>
      <textarea name="creativeDescription" maxlength="220" placeholder="Short description" required>${esc(saved.description || '')}</textarea>
      <input name="creativeCta" maxlength="40" placeholder="Button text" value="${esc(saved.cta || 'Open Now')}" required>
      <select name="creativePreset">${Object.entries(PRESETS).map(([k,v]) => `<option value="${k}" ${k===presetKey?'selected':''}>${esc(v.label)}</option>`).join('')}</select>
      <div class="ce-live-color-grid"><label>Accent<input name="accentColor" type="color" value="${esc(saved.accent || preset.accent)}"></label><label>Background<input name="backgroundColor" type="color" value="${esc(saved.background || preset.background)}"></label><label>Text<input name="textColor" type="color" value="${esc(saved.text || preset.text)}"></label></div>
      <div data-live-offer-preview class="ce-live-preview"></div>`;
    form.elements.name?.insertAdjacentElement('afterend', block);
    block.addEventListener('input', () => renderOfferPreview(form));
    block.querySelector('[name="creativePreset"]')?.addEventListener('change', event => {
      const p = PRESETS[event.target.value] || PRESETS.emerald;
      form.elements.accentColor.value = p.accent;
      form.elements.backgroundColor.value = p.background;
      form.elements.textColor.value = p.text;
      renderOfferPreview(form);
    });
    renderOfferPreview(form);
  }

  function enhanceTask(form) {
    if (!form || form.dataset.liveManagerEnhanced === '1') return;
    form.dataset.liveManagerEnhanced = '1';
    const saved = parseJson(form.elements.notes?.value);
    const block = document.createElement('section');
    block.className = 'ce-live-editor-block';
    block.innerHTML = `<div class="ce-live-editor-title"><b>Task delivery</b><span>Who sees it and when</span></div>
      <select name="audience"><option value="all">All users</option><option value="new">New users</option><option value="returning">Returning users</option></select>
      <select name="placement"><option value="chat">Inside chat</option><option value="dashboard">Dashboard</option><option value="returning">Returning-user area</option></select>
      <input name="triggerMessages" type="number" min="1" max="100" value="${Number(saved.trigger_message_count || 3)}" placeholder="Show after messages">
      <input name="externalUrl" type="url" value="${esc(saved.external_url || '')}" placeholder="Optional external https:// link">
      <small class="ce-live-help">Offer tasks use the linked sponsored campaign. External tasks use the URL above.</small>`;
    form.elements.button?.insertAdjacentElement('afterend', block);
    form.elements.audience.value = saved.audience || 'all';
    form.elements.placement.value = saved.placement || 'chat';
  }

  async function saveOffer(form) {
    const f = new FormData(form);
    const creative = offerCreativeFrom(form);
    const { error } = await client().rpc('chatearn_v6_admin_save_offer', {
      p_offer_key: f.get('key'), p_name: f.get('name'), p_url: f.get('url'),
      p_display_order: Number(f.get('order') || 10), p_audience: f.get('audience'),
      p_placements: String(f.get('placements') || 'all').split(',').map(x => x.trim()).filter(Boolean),
      p_active: f.get('active') === 'on', p_quality_threshold_seconds: Number(f.get('threshold') || 30),
      p_max_exposures_per_user: Number(f.get('maxExposure') || 1), p_cooldown_hours: Number(f.get('cooldown') || 0),
      p_notes: JSON.stringify(creative)
    });
    if (error) throw error;
  }

  async function saveTask(form) {
    const f = new FormData(form);
    const notes = {
      note: String(f.get('notes') || '').trim(),
      audience: f.get('audience') || 'all',
      placement: f.get('placement') || 'chat',
      trigger_message_count: Number(f.get('triggerMessages') || 3),
      external_url: String(f.get('externalUrl') || '').trim()
    };
    const { error } = await client().rpc('chatearn_v6_admin_save_task', {
      p_task_key: f.get('key'), p_title: f.get('title'), p_subtitle: f.get('subtitle') || '',
      p_button_text: f.get('button'), p_task_type: f.get('type'),
      p_required_count: Number(f.get('required') || 1), p_reward_amount: Number(f.get('reward') || 0),
      p_min_visit: Number(f.get('minvisit') || 2), p_display_order: Number(f.get('order') || 10),
      p_active: f.get('active') === 'on', p_cooldown_hours: Number(f.get('cooldown') || 0),
      p_max_daily_completions: Number(f.get('maxDaily') || 1), p_linked_offer_key: f.get('linkedOffer') || null,
      p_notes: JSON.stringify(notes), p_audience: notes.audience, p_placement: notes.placement,
      p_trigger_message_count: notes.trigger_message_count, p_external_url: notes.external_url || null
    });
    if (error) throw error;
  }

  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !['ce6OfferForm','ce6TaskForm'].includes(form.id)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = form.querySelector('button[type="submit"], button:not([type])');
    const old = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Saving…'; }
    try {
      if (!client()) throw new Error('Admin connection is not ready');
      if (form.id === 'ce6OfferForm') await saveOffer(form); else await saveTask(form);
      window.showToast?.(form.id === 'ce6OfferForm' ? 'Sponsored ad saved' : 'Task saved');
      form.closest('#ce6Editor')?.replaceChildren();
      await window.refreshAdmin?.();
    } catch (error) {
      window.showToast?.(error.message || 'Save failed');
      const box = document.getElementById('adminError');
      if (box) { box.textContent = error.message || String(error); box.style.display = 'block'; }
    } finally {
      if (button) { button.disabled = false; button.textContent = old || 'Save'; }
    }
  }, true);

  const style = document.createElement('style');
  style.textContent = `.ce-live-editor-block{grid-column:1/-1;display:grid;gap:10px;padding:16px;border:1px solid #dbe4f0;border-radius:16px;background:#f8fafc}.ce-live-editor-title{display:flex;justify-content:space-between;align-items:center}.ce-live-editor-title span,.ce-live-help{font-size:12px;color:#64748b}.ce-live-color-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.ce-live-color-grid label{font-size:12px;font-weight:800;color:#475569}.ce-live-color-grid input{width:100%;height:42px;padding:3px}.ce-live-preview{padding:16px;border:1px solid;border-radius:14px;box-shadow:0 10px 30px rgba(15,23,42,.08)}`;
  document.head.appendChild(style);

  const scan = () => { enhanceOffer(document.getElementById('ce6OfferForm')); enhanceTask(document.getElementById('ce6TaskForm')); };
  new MutationObserver(() => setTimeout(scan, 20)).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();