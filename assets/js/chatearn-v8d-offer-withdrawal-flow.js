/* ChatEarn V8D.2 — rotating ad presentation, compulsory sharing and returning-user handoff.
 * Withdrawal form ownership belongs exclusively to V8E.
 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_V8D_FLOW__) return;
  window.__CHAT_EARN_V8D_FLOW__ = true;

  const VERSION = '8D.2';
  const bootedAt = Date.now();
  const shown = new Set();
  let processingPoll = null;

  const byId = id => document.getElementById(id);
  const page = () => { try { return currentScreen || ''; } catch (_) { return ''; } };
  const toast = message => { try { window.showToast?.(message); } catch (_) {} };
  const track = (name, metadata = {}) => { try { window.trackEvent?.(name, metadata); } catch (_) {} };
  const getClient = () => {
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient?.rpc) return supabaseClient; } catch (_) {}
    if (window.supabaseClient?.rpc) return window.supabaseClient;
    return null;
  };
  const rpc = async (name, args = {}) => {
    const client = getClient();
    if (!client) throw new Error('Secure connection is still loading. Please try again.');
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return typeof data === 'string' ? JSON.parse(data) : data;
  };

  function successfulMessages() {
    const body = byId('chatBody');
    if (!body) return 0;
    return [...body.querySelectorAll('.msg.outgoing')].filter(message => {
      if (message.classList.contains('failed')) return false;
      return Boolean(message.querySelector('.msg-earn') || message.querySelector('.msg-status')?.textContent?.includes('✓✓'));
    }).length;
  }

  function openOffer(placement, button) {
    if (typeof window.ceV42OpenNextOffer !== 'function') {
      toast('Sponsored activities are still loading. Continue chatting and try again.');
      return;
    }
    window.ceV42OpenNextOffer(placement, button);
  }

  function closeExistingAds() {
    byId('ceAdaptiveOffer')?.remove();
    byId('ceAdaptiveOfferSheet')?.remove();
  }

  function showBanner(milestone) {
    if (page() !== 'chat' || byId('ceAdaptiveOffer') || byId('ceAdaptiveOfferSheet')) return;
    const node = document.createElement('aside');
    node.id = 'ceAdaptiveOffer';
    node.setAttribute('aria-label', 'Sponsored activity');
    node.style.cssText = 'position:fixed;left:14px;right:14px;bottom:92px;z-index:9994;background:#202321;border:1px solid rgba(0,200,83,.55);border-radius:18px;padding:14px 46px 14px 14px;box-shadow:0 16px 38px rgba(0,0,0,.45);color:#fff;';
    node.innerHTML = '<button type="button" class="ce-close" aria-label="Close sponsored activity" style="position:absolute;right:8px;top:8px;width:28px;height:28px;border:1px solid #454a47;border-radius:50%;background:#303431;color:#d7ddd8;font-size:16px;cursor:pointer;">×</button><div style="display:flex;gap:11px;align-items:center;"><div style="font-size:27px;">🎁</div><div style="min-width:0;flex:1;"><div style="font-size:15px;font-weight:900;">Sponsored activity</div><div style="font-size:12px;color:#b9c0bb;margin-top:2px;">Open this offer or close it and continue chatting.</div></div><button class="ce-open" type="button" style="border:0;border-radius:12px;background:#00c853;color:#031108;font-weight:900;padding:11px 14px;cursor:pointer;">Open →</button></div>';
    node.querySelector('.ce-close').addEventListener('click', () => node.remove());
    node.querySelector('.ce-open').addEventListener('click', event => openOffer('chat_banner', event.currentTarget));
    document.body.appendChild(node);
    track('adaptive_offer_impression', { format:'banner', milestone });
    setTimeout(() => node.remove(), 22000);
  }

  function showHalfScreen(milestone) {
    if (page() !== 'chat' || byId('ceAdaptiveOffer') || byId('ceAdaptiveOfferSheet')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ceAdaptiveOfferSheet';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9996;background:rgba(0,0,0,.62);display:flex;align-items:flex-end;justify-content:center;';
    overlay.innerHTML = '<section role="dialog" aria-modal="true" aria-label="Sponsored activity" style="position:relative;width:100%;max-width:520px;min-height:44vh;background:#171a18;border:1px solid rgba(0,200,83,.55);border-radius:26px 26px 0 0;padding:30px 22px 24px;color:#fff;"><button type="button" class="ce-close-x" aria-label="Close sponsored activity" style="position:absolute;right:11px;top:11px;width:30px;height:30px;border:1px solid #454a47;border-radius:50%;background:#242825;color:#d7ddd8;font-size:17px;cursor:pointer;">×</button><div style="font-size:11px;letter-spacing:1.5px;color:#879089;text-transform:uppercase;">Sponsored</div><div style="font-size:42px;margin-top:14px;">⚡</div><h3 style="font-size:25px;line-height:1.15;margin:12px 0 8px;">A new earning activity is available</h3><p style="font-size:14px;line-height:1.55;color:#bfc7c1;margin:0 0 22px;">Open it now, or close this sheet and keep chatting normally.</p><button class="ce-open" type="button" style="width:100%;border:0;border-radius:15px;background:#00c853;color:#031108;font-size:16px;font-weight:900;padding:15px;cursor:pointer;">Open sponsored activity →</button><button class="ce-continue" type="button" style="width:100%;border:0;background:transparent;color:#c4cbc6;padding:14px 10px 4px;cursor:pointer;">Continue chatting</button></section>';
    const close = () => overlay.remove();
    overlay.querySelector('.ce-close-x').addEventListener('click', close);
    overlay.querySelector('.ce-continue').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.querySelector('.ce-open').addEventListener('click', event => openOffer('chat_half_screen', event.currentTarget));
    document.body.appendChild(overlay);
    track('adaptive_offer_impression', { format:'half_screen', milestone });
  }

  function formatForMilestone(count) {
    // Rotates presentation rather than showing one static style every time.
    const seed = (count * 17 + String(sessionStorage.getItem('ce_session_id') || '').length) % 4;
    return seed === 0 || seed === 3 ? 'half_screen' : 'banner';
  }

  function reconcileOffers() {
    if (page() !== 'chat' || Date.now() - bootedAt < 30000) return;
    const count = successfulMessages();
    if (count < 6 || count % 3 !== 0) return;
    const key = `adaptive:${count}`;
    if (shown.has(key)) return;
    shown.add(key);
    const format = formatForMilestone(count);
    const delay = format === 'half_screen' ? 2600 : 900;
    setTimeout(() => {
      if (page() !== 'chat') return;
      if (format === 'half_screen') showHalfScreen(count);
      else showBanner(count);
    }, delay);
  }

  function withdrawalId() {
    const state = window.ChatEarnWithdrawalV5?.getState?.();
    if (state?.portal?.active_withdrawal?.id) return state.portal.active_withdrawal.id;
    try { return JSON.parse(localStorage.getItem('ce_withdrawal_flow_v8e') || 'null')?.withdrawal_id || null; } catch (_) { return null; }
  }

  async function recordShare() {
    const id = withdrawalId();
    if (!id) return toast('Your withdrawal session is still loading. Please try again.');
    try {
      const result = await rpc('chatearn_record_withdrawal_share_v5', { p_withdrawal_id:id, p_channel:'whatsapp' });
      toast(`Sharing progress: ${Number(result?.completed || 0)}/${Number(result?.required || 5)}`);
      track('withdrawal_share_recorded', { withdrawal_id:id, completed:result?.completed, required:result?.required });
      localStorage.setItem('ce_withdrawal_flow_v8e', JSON.stringify({ withdrawal_id:id, stage:result?.done ? (result.next === 'kyc' ? 'kyc_required' : 'processing') : 'sharing_required', updated_at:Date.now() }));
      if (result?.done) {
        await window.ChatEarnWithdrawalV5?.refresh?.();
        window.goScreen?.(result.next === 'kyc' ? 'kyc' : 'processing');
      }
    } catch (error) { toast(error?.message || 'Sharing progress could not be saved. Please try again.'); }
  }

  function bindShareButtons() {
    const wall = byId('sharewall');
    if (!wall) return;
    wall.querySelectorAll('button,a').forEach(button => {
      const label = `${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`.toLowerCase();
      if (!/share|whatsapp/.test(label) || button.dataset.ceShareBound === '1') return;
      button.dataset.ceShareBound = '1';
      button.addEventListener('click', () => setTimeout(recordShare, 1500));
    });
  }

  function openNextConversation() {
    closeExistingAds();
    try {
      localStorage.setItem('ce_returning_user','1');
      const list = typeof FOREIGNERS !== 'undefined' ? FOREIGNERS : [];
      const currentName = (() => { try { return currentChatUser?.name; } catch (_) { return null; } })();
      const currentIndex = list.findIndex(item => item.name === currentName);
      window.goScreen?.('dashboard');
      if (list.length && typeof openChat === 'function') setTimeout(() => openChat((Math.max(currentIndex,-1)+1)%list.length),650);
    } catch (_) { window.goScreen?.('dashboard'); }
  }

  async function pollProcessing() {
    if (page() !== 'processing') return;
    try {
      await window.ChatEarnWithdrawalV5?.refresh?.();
      const state = window.ChatEarnWithdrawalV5?.getState?.();
      const active = state?.portal?.active_withdrawal;
      const latest = String(active?.status || state?.portal?.history?.[0]?.status || '').toLowerCase();
      if (!active && ['paid','completed'].includes(latest)) {
        clearInterval(processingPoll); processingPoll = null;
        localStorage.setItem('ce_withdrawal_flow_v8e', JSON.stringify({ stage:'completed', updated_at:Date.now() }));
        toast('Withdrawal completed. Your next earning chat is ready.');
        setTimeout(openNextConversation,1200);
      }
    } catch (_) {}
  }

  function startProcessingWatch() {
    if (processingPoll) return;
    processingPoll = setInterval(pollProcessing,8000);
    pollProcessing();
  }

  function enhanceAdminOffers() {
    const panel = byId('admin-offer-manager');
    if (!panel || byId('ceOfferPresentationForm')) return;
    const form = document.createElement('form');
    form.id = 'ceOfferPresentationForm'; form.className = 'ce-v42-admin-form'; form.style.marginBottom = '18px';
    form.innerHTML = '<div class="admin-section-title wide">Offer display settings</div><input id="ceDisplayOfferKey" placeholder="Existing offer_key" required><select id="ceDisplayFormat"><option value="native">Native chat card</option><option value="banner">Bottom banner</option><option value="half_screen">Half-screen sheet</option><option value="interstitial">Interstitial</option></select><input id="ceDisplayFrequency" type="number" min="1" max="100" value="3" placeholder="Messages between displays"><input id="ceDisplayMaximum" type="number" min="1" max="20" value="3" placeholder="Maximum per session"><button class="admin-btn primary wide" type="submit">Save display settings</button>';
    panel.prepend(form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); const button = event.submitter; button.disabled = true;
      try {
        const client = window.ceAdminClient || getClient();
        if (!client) throw new Error('Admin connection is still loading.');
        const { error } = await client.rpc('chatearn_v5_admin_save_offer_presentation', {
          p_offer_key:byId('ceDisplayOfferKey').value.trim(), p_format:byId('ceDisplayFormat').value,
          p_frequency_messages:Number(byId('ceDisplayFrequency').value || 3), p_max_per_session:Number(byId('ceDisplayMaximum').value || 3),
          p_close_delay_seconds:0, p_active:true
        });
        if (error) throw error;
        toast('Offer display settings saved.');
      } catch (error) { window.showAdminError?.(error?.message || String(error),true); } finally { button.disabled = false; }
    });
  }

  const originalGoScreen = typeof window.goScreen === 'function' ? window.goScreen : null;
  if (originalGoScreen) {
    window.goScreen = function v8dGoScreen(id) {
      closeExistingAds();
      const result = originalGoScreen(id);
      if (id === 'sharewall') setTimeout(bindShareButtons,80);
      if (id === 'processing') startProcessingWatch();
      return result;
    };
  }

  const observer = new MutationObserver(() => { bindShareButtons(); enhanceAdminOffers(); });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(reconcileOffers,1400);
  setInterval(() => { bindShareButtons(); enhanceAdminOffers(); },2500);

  window.ChatEarnV8DFlow = Object.freeze({
    version:VERSION, recordShare, openNextConversation,
    diagnostic:() => ({version:VERSION,successfulMessages:successfulMessages(),shown:[...shown],currentPage:page(),withdrawalUiOwner:'V8E',adaptiveFormats:['banner','half_screen']})
  });
  console.info(`[ChatEarn] V8D flow ${VERSION} loaded`);
})();