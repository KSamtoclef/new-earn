/* ChatEarn V8D — transparent offer formats, payout account capture,
 * withdrawal sharing progress, and returning-user handoff.
 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_V8D_FLOW__) return;
  window.__CHAT_EARN_V8D_FLOW__ = true;

  const VERSION = '8D.1';
  const bootedAt = Date.now();
  const shown = new Set();
  let processingPoll = null;

  const byId = id => document.getElementById(id);
  const page = () => { try { return currentScreen || ''; } catch (_) { return ''; } };
  const toast = message => window.showToast?.(message);
  const track = (name, metadata = {}) => { try { window.trackEvent?.(name, metadata); } catch (_) {} };
  const rpc = async (name, args = {}) => {
    if (!window.supabaseClient?.rpc) throw new Error('Supabase client is unavailable');
    const { data, error } = await window.supabaseClient.rpc(name, args);
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
    if (typeof window.ceV42OpenNextOffer !== 'function') return toast('This sponsored activity is not available yet.');
    window.ceV42OpenNextOffer(placement, button);
  }

  function showBanner(milestone) {
    if (byId('ceAdaptiveOffer')) return;
    const node = document.createElement('aside');
    node.id = 'ceAdaptiveOffer';
    node.setAttribute('aria-label', 'Sponsored activity');
    node.style.cssText = 'position:fixed;left:14px;right:14px;bottom:92px;z-index:9994;background:#202321;border:1px solid rgba(0,200,83,.55);border-radius:18px;padding:14px 48px 14px 14px;box-shadow:0 16px 38px rgba(0,0,0,.45);color:#fff;';
    node.innerHTML = '<button type="button" aria-label="Close sponsored activity" style="position:absolute;right:9px;top:9px;width:32px;height:32px;border:1px solid #454a47;border-radius:50%;background:#303431;color:#d7ddd8;font-size:18px;cursor:pointer;">×</button><div style="display:flex;gap:12px;align-items:center;"><div style="font-size:28px;">🎁</div><div style="min-width:0;flex:1;"><div style="font-size:15px;font-weight:900;">Sponsored activity</div><div style="font-size:12px;color:#b9c0bb;margin-top:2px;">Open it now or close this card and keep chatting.</div></div><button class="ce-open" type="button" style="border:0;border-radius:12px;background:#00c853;color:#031108;font-weight:900;padding:11px 15px;cursor:pointer;">Open →</button></div>';
    node.querySelector('[aria-label="Close sponsored activity"]').addEventListener('click', () => node.remove());
    node.querySelector('.ce-open').addEventListener('click', event => openOffer(`chat_banner_${milestone}`, event.currentTarget));
    document.body.appendChild(node);
    track('adaptive_offer_impression', { format: 'banner', milestone });
    setTimeout(() => node.remove(), 20000);
  }

  function showSheet(milestone) {
    if (byId('ceAdaptiveOfferSheet')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ceAdaptiveOfferSheet';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9996;background:rgba(0,0,0,.62);display:flex;align-items:flex-end;justify-content:center;';
    overlay.innerHTML = '<section role="dialog" aria-modal="true" aria-label="Sponsored activity" style="position:relative;width:100%;max-width:520px;min-height:44vh;background:#171a18;border:1px solid rgba(0,200,83,.55);border-radius:26px 26px 0 0;padding:30px 22px 24px;color:#fff;"><button type="button" aria-label="Close sponsored activity" style="position:absolute;right:12px;top:12px;width:34px;height:34px;border:1px solid #454a47;border-radius:50%;background:#242825;color:#d7ddd8;font-size:19px;cursor:pointer;">×</button><div style="font-size:11px;letter-spacing:1.5px;color:#879089;text-transform:uppercase;">Sponsored</div><div style="font-size:42px;margin-top:16px;">⚡</div><h3 style="font-size:25px;line-height:1.15;margin:12px 0 8px;">Another activity is available</h3><p style="font-size:14px;line-height:1.55;color:#bfc7c1;margin:0 0 22px;">Open it, or continue chatting without interruption.</p><button class="ce-open" type="button" style="width:100%;border:0;border-radius:15px;background:#00c853;color:#031108;font-size:16px;font-weight:900;padding:15px;cursor:pointer;">Open sponsored activity →</button><button class="ce-close" type="button" style="width:100%;border:0;background:transparent;color:#c4cbc6;padding:14px 10px 4px;cursor:pointer;">Continue chatting</button></section>';
    const close = () => overlay.remove();
    overlay.querySelector('[aria-label="Close sponsored activity"]').addEventListener('click', close);
    overlay.querySelector('.ce-close').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.querySelector('.ce-open').addEventListener('click', event => openOffer(`chat_sheet_${milestone}`, event.currentTarget));
    document.body.appendChild(overlay);
    track('adaptive_offer_impression', { format: 'sheet', milestone });
  }

  function reconcileOffers() {
    if (page() !== 'chat' || Date.now() - bootedAt < 45000) return;
    const count = successfulMessages();
    if (count >= 6 && count % 6 === 0 && !shown.has(`banner:${count}`)) {
      shown.add(`banner:${count}`);
      showBanner(count);
    }
    if (count >= 9 && count % 9 === 0 && !shown.has(`sheet:${count}`)) {
      shown.add(`sheet:${count}`);
      setTimeout(() => { if (page() === 'chat' && !byId('ceAdaptiveOffer')) showSheet(count); }, 3500);
    }
  }

  function ensurePayoutForm() {
    const body = document.querySelector('#withdraw .wd-body');
    if (!body || byId('cePayoutAccountForm')) return;
    const accountArea = body.querySelector('.bank-options');
    if (!accountArea) return;
    const form = document.createElement('form');
    form.id = 'cePayoutAccountForm';
    form.style.cssText = 'margin:0 0 18px;padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--card2);display:grid;gap:11px;';
    form.innerHTML = '<div style="font-size:14px;font-weight:900;">Add payout account</div><select id="cePayoutProvider" required style="width:100%;padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--white);"><option value="opay">OPay</option><option value="palmpay">PalmPay</option></select><input id="cePayoutAccountName" required maxlength="120" autocomplete="name" placeholder="Account name" style="width:100%;padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--white);"><input id="cePayoutAccountNumber" required inputmode="numeric" maxlength="10" autocomplete="off" placeholder="10-digit account number" style="width:100%;padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--white);"><label style="display:flex;gap:9px;align-items:center;font-size:12px;color:var(--text);"><input id="cePayoutDefault" type="checkbox" checked> Make this my default payout account</label><button type="submit" style="width:100%;padding:13px;border:0;border-radius:12px;background:#00c853;color:#031108;font-weight:900;cursor:pointer;">Save payout account</button><div style="font-size:11px;line-height:1.45;color:var(--muted);">The account must be verified before it can receive a withdrawal.</div>';
    accountArea.closest('.form-group')?.insertAdjacentElement('beforebegin', form);
    if (!form.isConnected) accountArea.insertAdjacentElement('beforebegin', form);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const number = byId('cePayoutAccountNumber').value.replace(/\D/g, '').slice(0, 10);
      const name = byId('cePayoutAccountName').value.trim();
      if (number.length !== 10) return toast('Enter a valid 10-digit account number.');
      if (name.length < 3) return toast('Enter the account name.');
      button.disabled = true;
      button.textContent = 'Saving…';
      try {
        const result = await rpc('chatearn_save_payout_account_v5', {
          p_provider: byId('cePayoutProvider').value,
          p_account_number: number,
          p_account_name: name,
          p_is_default: byId('cePayoutDefault').checked
        });
        toast(result?.message || 'Payout account saved.');
        form.reset();
        byId('cePayoutDefault').checked = true;
        await window.ChatEarnWithdrawalV5?.refresh?.();
      } catch (error) {
        toast(error?.message || 'Payout account could not be saved.');
      } finally {
        button.disabled = false;
        button.textContent = 'Save payout account';
      }
    });
  }

  function withdrawalId() {
    const state = window.ChatEarnWithdrawalV5?.getState?.();
    return state?.portal?.active_withdrawal?.id || null;
  }

  async function recordShare() {
    const id = withdrawalId();
    if (!id) return;
    try {
      const result = await rpc('chatearn_record_withdrawal_share_v5', { p_withdrawal_id: id, p_channel: 'whatsapp' });
      toast(`Sharing progress: ${Number(result?.completed || 0)}/${Number(result?.required || 5)}`);
      track('withdrawal_share_recorded', { withdrawal_id: id, completed: result?.completed, required: result?.required });
      if (result?.done) {
        await window.ChatEarnWithdrawalV5?.refresh?.();
        window.goScreen?.(result.next === 'kyc' ? 'kyc' : 'processing');
      }
    } catch (error) {
      console.warn('[ChatEarn V8D] share progress:', error?.message || error);
    }
  }

  function bindShareButtons() {
    const wall = byId('sharewall');
    if (!wall) return;
    wall.querySelectorAll('button,a').forEach(button => {
      const label = `${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`.toLowerCase();
      if (!/share|whatsapp/.test(label) || button.dataset.ceShareBound === '1') return;
      button.dataset.ceShareBound = '1';
      button.addEventListener('click', () => setTimeout(recordShare, 1800));
    });
  }

  function openNextConversation() {
    try {
      localStorage.setItem('ce_returning_user', '1');
      const list = typeof FOREIGNERS !== 'undefined' ? FOREIGNERS : [];
      const currentName = (() => { try { return currentChatUser?.name; } catch (_) { return null; } })();
      const currentIndex = list.findIndex(item => item.name === currentName);
      window.goScreen?.('dashboard');
      if (list.length && typeof openChat === 'function') setTimeout(() => openChat((Math.max(currentIndex, -1) + 1) % list.length), 650);
    } catch (_) {
      window.goScreen?.('dashboard');
    }
  }

  async function pollProcessing() {
    if (page() !== 'processing') return;
    try {
      await window.ChatEarnWithdrawalV5?.refresh?.();
      const state = window.ChatEarnWithdrawalV5?.getState?.();
      const active = state?.portal?.active_withdrawal;
      const history = state?.portal?.history || [];
      const latest = String(active?.status || history?.[0]?.status || '').toLowerCase();
      if (!active && ['paid','completed'].includes(latest)) {
        clearInterval(processingPoll);
        processingPoll = null;
        toast('Withdrawal completed. Your next earning chat is ready.');
        setTimeout(openNextConversation, 1200);
      }
    } catch (_) {}
  }

  function startProcessingWatch() {
    if (processingPoll) return;
    processingPoll = setInterval(pollProcessing, 8000);
    pollProcessing();
  }

  function enhanceAdminOffers() {
    const panel = byId('admin-offer-manager');
    if (!panel || byId('ceOfferPresentationForm')) return;
    const form = document.createElement('form');
    form.id = 'ceOfferPresentationForm';
    form.className = 'ce-v42-admin-form';
    form.style.marginBottom = '18px';
    form.innerHTML = '<div class="admin-section-title wide">Offer display settings</div><input id="ceDisplayOfferKey" placeholder="Existing offer_key" required><select id="ceDisplayFormat"><option value="native">Native chat card</option><option value="banner">Bottom banner</option><option value="half_screen">Half-screen sheet</option><option value="interstitial">Interstitial</option></select><input id="ceDisplayFrequency" type="number" min="1" max="100" value="3" placeholder="Messages between displays"><input id="ceDisplayMaximum" type="number" min="1" max="20" value="3" placeholder="Maximum per session"><button class="admin-btn primary wide" type="submit">Save display settings</button>';
    panel.prepend(form);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.submitter;
      button.disabled = true;
      try {
        const client = window.ceAdminClient || window.supabaseClient;
        const { error } = await client.rpc('chatearn_v5_admin_save_offer_presentation', {
          p_offer_key: byId('ceDisplayOfferKey').value.trim(),
          p_format: byId('ceDisplayFormat').value,
          p_frequency_messages: Number(byId('ceDisplayFrequency').value || 3),
          p_max_per_session: Number(byId('ceDisplayMaximum').value || 3),
          p_close_delay_seconds: 0,
          p_active: true
        });
        if (error) throw error;
        toast('Offer display settings saved.');
      } catch (error) {
        window.showAdminError?.(error?.message || String(error), true);
      } finally {
        button.disabled = false;
      }
    });
  }

  const originalGoScreen = typeof window.goScreen === 'function' ? window.goScreen : null;
  if (originalGoScreen) {
    window.goScreen = function v8dGoScreen(id) {
      const result = originalGoScreen(id);
      if (id === 'withdraw') setTimeout(ensurePayoutForm, 80);
      if (id === 'sharewall') setTimeout(bindShareButtons, 80);
      if (id === 'processing') startProcessingWatch();
      return result;
    };
  }

  const observer = new MutationObserver(() => {
    ensurePayoutForm();
    bindShareButtons();
    enhanceAdminOffers();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(reconcileOffers, 1500);
  setInterval(() => {
    ensurePayoutForm();
    bindShareButtons();
    enhanceAdminOffers();
  }, 2500);

  window.ChatEarnV8DFlow = Object.freeze({
    version: VERSION,
    recordShare,
    openNextConversation,
    diagnostic: () => ({ version: VERSION, successfulMessages: successfulMessages(), shown: [...shown], payoutFormReady: Boolean(byId('cePayoutAccountForm')), currentPage: page() })
  });

  console.info(`[ChatEarn] V8D flow ${VERSION} loaded`);
})();
