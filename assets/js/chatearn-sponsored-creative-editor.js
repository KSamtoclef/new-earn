/* ChatEarn sponsored creative editor v1.0.0 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_SPONSORED_CREATIVE_EDITOR__) return;
  window.__CHAT_EARN_SPONSORED_CREATIVE_EDITOR__ = true;

  const PRESETS = {
    emerald: { label: 'Emerald Green', accent: '#22c55e', background: '#071b12', text: '#f0fdf4' },
    ocean: { label: 'Ocean Blue', accent: '#38bdf8', background: '#071827', text: '#f0f9ff' },
    royal: { label: 'Royal Purple', accent: '#a78bfa', background: '#160b2b', text: '#faf5ff' },
    sunset: { label: 'Sunset Orange', accent: '#fb923c', background: '#2a1006', text: '#fff7ed' },
    rose: { label: 'Rose Red', accent: '#fb7185', background: '#2a0911', text: '#fff1f2' },
    gold: { label: 'Premium Gold', accent: '#fbbf24', background: '#211706', text: '#fffbeb' }
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const encode = value => `CEAD1:${btoa(unescape(encodeURIComponent(JSON.stringify(value))))}`;
  const decode = value => {
    try {
      const raw = String(value || '');
      if (raw.startsWith('CEAD1:')) return JSON.parse(decodeURIComponent(escape(atob(raw.slice(6)))));
    } catch (_) {}
    return { headline: String(value || ''), description: '', cta: 'Open Now', preset: 'emerald', ...PRESETS.emerald };
  };

  function renderPreview(form) {
    const preview = form.querySelector('[data-ce-creative-preview]');
    if (!preview) return;
    const accent = form.elements.accentColor?.value || PRESETS.emerald.accent;
    const background = form.elements.backgroundColor?.value || PRESETS.emerald.background;
    const text = form.elements.textColor?.value || PRESETS.emerald.text;
    const headline = form.elements.creativeHeadline?.value || 'Sponsored opportunity';
    const description = form.elements.creativeDescription?.value || 'Add a short reason for users to open this sponsored offer.';
    const cta = form.elements.creativeCta?.value || 'Open Now';
    preview.style.background = `linear-gradient(145deg, ${background}, #050505)`;
    preview.style.borderColor = accent;
    preview.style.color = text;
    preview.innerHTML = `<small style="font-weight:900;letter-spacing:1.3px;color:${esc(accent)}">SPONSORED</small><h3 style="margin:8px 0 6px">${esc(headline)}</h3><p style="margin:0 0 12px;line-height:1.5">${esc(description)}</p><button type="button" style="width:100%;border:0;border-radius:11px;padding:11px;background:${esc(accent)};color:#08110b;font-weight:900">${esc(cta)} →</button>`;
  }

  function applyPreset(form) {
    const preset = PRESETS[form.elements.creativePreset?.value] || PRESETS.emerald;
    if (form.elements.accentColor) form.elements.accentColor.value = preset.accent;
    if (form.elements.backgroundColor) form.elements.backgroundColor.value = preset.background;
    if (form.elements.textColor) form.elements.textColor.value = preset.text;
    renderPreview(form);
  }

  function enhance(form) {
    if (!form || form.dataset.ceCreativeEnhanced === '1') return;
    form.dataset.ceCreativeEnhanced = '1';
    const nameInput = form.elements.name;
    if (!nameInput) return;
    const current = decode(nameInput.value);
    const preset = PRESETS[current.preset] ? current.preset : 'emerald';
    const block = document.createElement('section');
    block.style.cssText = 'grid-column:1/-1;display:grid;gap:10px;padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.02)';
    block.innerHTML = `<b>Sponsored creative design</b><input name="creativeHeadline" maxlength="90" placeholder="Public headline" value="${esc(current.headline || '')}" required><textarea name="creativeDescription" maxlength="220" placeholder="Short public description" required>${esc(current.description || '')}</textarea><input name="creativeCta" maxlength="40" placeholder="Button text" value="${esc(current.cta || 'Open Now')}" required><select name="creativePreset">${Object.entries(PRESETS).map(([key,item]) => `<option value="${key}" ${key===preset?'selected':''}>${esc(item.label)}</option>`).join('')}</select><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px"><label>Accent<input name="accentColor" type="color" value="${esc(current.accent || PRESETS[preset].accent)}"></label><label>Background<input name="backgroundColor" type="color" value="${esc(current.background || PRESETS[preset].background)}"></label><label>Text<input name="textColor" type="color" value="${esc(current.text || PRESETS[preset].text)}"></label></div><div data-ce-creative-preview style="padding:16px;border:1px solid;border-radius:16px"></div>`;
    nameInput.insertAdjacentElement('afterend', block);
    nameInput.type = 'hidden';
    block.addEventListener('input', () => renderPreview(form));
    block.querySelector('[name="creativePreset"]').addEventListener('change', () => applyPreset(form));
    renderPreview(form);
  }

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'ce6OfferForm') return;
    const presetKey = form.elements.creativePreset?.value || 'emerald';
    const preset = PRESETS[presetKey] || PRESETS.emerald;
    const payload = {
      headline: form.elements.creativeHeadline?.value.trim() || 'Sponsored opportunity',
      description: form.elements.creativeDescription?.value.trim() || 'Open this sponsored opportunity to continue.',
      cta: form.elements.creativeCta?.value.trim() || 'Open Now',
      preset: presetKey,
      accent: form.elements.accentColor?.value || preset.accent,
      background: form.elements.backgroundColor?.value || preset.background,
      text: form.elements.textColor?.value || preset.text
    };
    if (form.elements.name) form.elements.name.value = encode(payload);
  }, true);

  const observer = new MutationObserver(() => enhance(document.getElementById('ce6OfferForm')));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhance(document.getElementById('ce6OfferForm'));

  window.ChatEarnSponsoredCreativeEditor = Object.freeze({ version: '1.0.0', presets: PRESETS, enhance });
})();
