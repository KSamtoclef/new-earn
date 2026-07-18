/* ChatEarn Module 6B: canonical withdrawal frontend and UI-state integration.
 * Temporary filename retained until the final script consolidation pass.
 */
(() => {
  'use strict';

  const VERSION = '6B.1';
  const state = {
    portal: null,
    accounts: [],
    selectedAccountId: null,
    loading: false,
    submitting: false,
    lastLoadedAt: 0,
    lastError: null
  };

  const byId = id => document.getElementById(id);
  const fmt = value => '₦' + Number(value || 0).toLocaleString('en-NG');
  const text = value => String(value ?? '');
  const safe = value => text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const sameId = (a, b) => text(a) === text(b);

  function client() {
    if (typeof supabaseClient !== 'undefined' && supabaseClient?.rpc) return supabaseClient;
    throw new Error('Supabase client is unavailable');
  }

  function unwrap(data) {
    if (!data || typeof data !== 'object') return {};
    return data.data && typeof data.data === 'object' ? data.data : data;
  }

  function toast(message, kind = 'info') {
    if (typeof showToast === 'function') {
      showToast(message);
      return;
    }
    const node = byId('toast');
    if (!node) return;
    node.textContent = message;
    node.dataset.kind = kind;
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 3500);
  }

  function portalWallet(portal) {
    return portal.wallet || portal.balance || {};
  }

  function availableBalance(portal) {
    const wallet = portalWallet(portal);
    return Number(wallet.available_balance ?? wallet.available ?? portal.available_balance ?? 0);
  }

  function minimumAmount(portal) {
    const eligibility = portal.eligibility || portal.progress || {};
    return Number(
      eligibility.minimum_amount ?? eligibility.assigned_threshold ??
      portal.minimum_amount ?? portal.withdrawal_threshold ?? 0
    );
  }

  function activeWithdrawal(portal) {
    return portal.active_withdrawal || portal.withdrawal || null;
  }

  function eligibility(portal) {
    return portal.eligibility || portal.progress || {};
  }

  function isEligible(portal) {
    const info = eligibility(portal);
    if (typeof info.can_withdraw === 'boolean') return info.can_withdraw;
    if (typeof portal.can_withdraw === 'boolean') return portal.can_withdraw;
    const minimum = minimumAmount(portal);
    return availableBalance(portal) > 0 && (!minimum || availableBalance(portal) >= minimum);
  }

  function accountLabel(account) {
    const provider = account.provider || account.bank_name || 'Payout account';
    const masked = account.masked_account || (account.account_last4 ? `•••• ${account.account_last4}` : 'Verified');
    return `${provider} · ${masked}`;
  }

  function statusLabel(withdrawal) {
    return withdrawal?.ui_label || withdrawal?.status_label || withdrawal?.status || 'Withdrawal pending';
  }

  function ensureStatusBox() {
    const body = document.querySelector('#withdraw .wd-body');
    if (!body) return null;
    let box = byId('withdrawalV5Status');
    if (!box) {
      box = document.createElement('div');
      box.id = 'withdrawalV5Status';
      box.setAttribute('role', 'status');
      box.style.cssText = 'display:none;margin:0 0 16px;padding:13px 14px;border-radius:12px;border:1px solid var(--line);background:var(--card);font-size:13px;line-height:1.55;';
      const amountDisplay = body.querySelector('.wd-amount-display');
      if (amountDisplay?.nextSibling) body.insertBefore(box, amountDisplay.nextSibling);
      else body.prepend(box);
    }
    return box;
  }

  function renderStatusBox() {
    const box = ensureStatusBox();
    if (!box) return;

    if (state.loading) {
      box.style.display = 'block';
      box.textContent = 'Loading your secure withdrawal details…';
      return;
    }

    if (state.lastError) {
      box.style.display = 'block';
      box.innerHTML = `<strong>Withdrawal details could not be loaded.</strong><br>${safe(state.lastError)}`;
      return;
    }

    const portal = state.portal || {};
    const active = activeWithdrawal(portal);
    const minimum = minimumAmount(portal);
    const available = availableBalance(portal);

    if (active) {
      const reference = active.public_reference ? `<br>Reference: <strong>${safe(active.public_reference)}</strong>` : '';
      box.style.display = 'block';
      box.innerHTML = `<strong>${safe(statusLabel(active))}</strong><br>Your withdrawal of ${safe(fmt(active.amount || available))} is already in progress.${reference}`;
      return;
    }

    if (!state.accounts.length) {
      box.style.display = 'block';
      box.innerHTML = '<strong>Verified payout account required.</strong><br>No verified payout account is currently available for this profile.';
      return;
    }

    if (!isEligible(portal)) {
      box.style.display = 'block';
      box.innerHTML = `<strong>Withdrawal not available yet.</strong><br>Your available balance must reach ${safe(fmt(minimum))}.`;
      return;
    }

    box.style.display = 'block';
    box.innerHTML = '<strong>Ready for withdrawal.</strong><br>Select a verified payout account and submit your request securely.';
  }

  function retireLegacyInputs() {
    const oldAccountNumber = byId('wdAccNo')?.closest('.form-group');
    const oldAccountName = byId('wdAccName')?.closest('.form-group');
    if (oldAccountNumber) {
      oldAccountNumber.style.display = 'none';
      oldAccountNumber.setAttribute('aria-hidden', 'true');
    }
    if (oldAccountName) {
      oldAccountName.style.display = 'none';
      oldAccountName.setAttribute('aria-hidden', 'true');
    }
    const verifyStatus = byId('bankVerifyStatus');
    if (verifyStatus) {
      verifyStatus.style.display = 'none';
      verifyStatus.setAttribute('aria-hidden', 'true');
    }
  }

  function renderAccounts() {
    const container = document.querySelector('#withdraw .bank-options');
    if (!container) return;

    if (!state.accounts.length) {
      container.innerHTML = '<div style="width:100%;padding:14px;border:1px solid var(--line);border-radius:12px;color:var(--muted);font-size:13px;">No verified payout account is available.</div>';
      state.selectedAccountId = null;
      return;
    }

    if (!state.selectedAccountId || !state.accounts.some(a => sameId(a.id, state.selectedAccountId))) {
      state.selectedAccountId = text((state.accounts.find(a => a.is_default) || state.accounts[0]).id);
    }

    container.innerHTML = state.accounts.map(account => {
      const selected = sameId(account.id, state.selectedAccountId);
      return `<button type="button" class="bank-option${selected ? ' selected' : ''}" data-payout-account-id="${safe(account.id)}" aria-pressed="${selected}" style="text-align:left;cursor:pointer;">
        <div class="bo-name" style="font-size:15px;font-weight:900;">${safe(account.provider || account.bank_name || 'Payout account')}</div>
        <div style="font-size:11px;color:var(--text);margin-top:3px;">${safe(account.masked_account || (account.account_last4 ? `•••• ${account.account_last4}` : 'Verified account'))}</div>
      </button>`;
    }).join('');

    container.querySelectorAll('[data-payout-account-id]').forEach(button => {
      button.addEventListener('click', () => {
        state.selectedAccountId = text(button.dataset.payoutAccountId);
        renderAccounts();
      });
    });
  }

  function renderPortal() {
    retireLegacyInputs();
    const portal = state.portal || {};
    const available = availableBalance(portal);
    const minimum = minimumAmount(portal);
    const active = activeWithdrawal(portal);

    const amountNode = byId('wdAmount');
    if (amountNode) amountNode.textContent = fmt(available);
    const earningsNode = byId('earnPageAmount');
    if (earningsNode) earningsNode.textContent = Number(available).toLocaleString('en-NG');

    renderAccounts();
    renderStatusBox();

    const submit = document.querySelector('#withdraw .btn-place-wd');
    if (!submit) return;

    submit.removeAttribute('aria-busy');
    if (active) {
      submit.disabled = true;
      submit.textContent = statusLabel(active);
    } else if (!state.accounts.length) {
      submit.disabled = true;
      submit.textContent = 'Verified payout account required';
    } else if (!isEligible(portal)) {
      submit.disabled = true;
      submit.textContent = minimum ? `Minimum withdrawal is ${fmt(minimum)}` : 'Withdrawal unavailable';
    } else {
      submit.disabled = false;
      submit.textContent = `Withdraw ${fmt(available)} →`;
    }
  }

  async function loadPortal(force = false) {
    if (state.loading) return state.portal;
    if (!force && state.portal && Date.now() - state.lastLoadedAt < 10000) return state.portal;

    state.loading = true;
    state.lastError = null;
    renderStatusBox();

    try {
      const [{ data: portalData, error: portalError }, { data: accountData, error: accountError }] = await Promise.all([
        client().rpc('chatearn_get_withdrawal_portal_v5'),
        client().rpc('chatearn_get_payout_accounts_v5')
      ]);
      if (portalError) throw portalError;
      if (accountError) throw accountError;

      state.portal = unwrap(portalData);
      const accountPayload = unwrap(accountData);
      state.accounts = Array.isArray(accountPayload) ? accountPayload : (accountPayload.accounts || accountPayload.payout_accounts || []);
      state.lastLoadedAt = Date.now();
      return state.portal;
    } catch (error) {
      state.lastError = error?.message || 'Unable to load withdrawal details.';
      console.error('[ChatEarn 6B] withdrawal portal load failed', error);
      toast(state.lastError, 'error');
      throw error;
    } finally {
      state.loading = false;
      renderPortal();
    }
  }

  function makeIdempotencyKey() {
    const existing = sessionStorage.getItem('ce_withdrawal_idempotency_key');
    if (existing) return existing;
    const key = `withdrawal-${crypto.randomUUID()}`;
    sessionStorage.setItem('ce_withdrawal_idempotency_key', key);
    return key;
  }

  function routeWithdrawalResult(withdrawal, result) {
    const status = text(withdrawal?.status || result?.status).toLowerCase();
    if (status === 'kyc_required' && typeof goScreen === 'function') return goScreen('kyc');
    if (status === 'sharing_required' && typeof goScreen === 'function') return goScreen('sharewall');
    if (typeof goScreen === 'function') return goScreen('processing');
  }

  async function submitWithdrawal() {
    if (state.submitting) return;

    try {
      await loadPortal();
    } catch (_) {
      return;
    }

    const portal = state.portal || {};
    const active = activeWithdrawal(portal);
    if (active) {
      toast('You already have an active withdrawal request.');
      return;
    }

    const amount = availableBalance(portal);
    const minimum = minimumAmount(portal);
    if (!state.selectedAccountId) {
      toast('Select a verified payout account.', 'error');
      return;
    }
    if (!isEligible(portal) || !amount || (minimum && amount < minimum)) {
      toast(minimum ? `Your available balance must reach ${fmt(minimum)} before withdrawal.` : 'Withdrawal is not available yet.', 'error');
      return;
    }

    const button = document.querySelector('#withdraw .btn-place-wd');
    state.submitting = true;
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Submitting securely…';
    }

    try {
      const { data, error } = await client().rpc('chatearn_submit_withdrawal_v5', {
        p_payout_account_id: state.selectedAccountId,
        p_amount: amount,
        p_idempotency_key: makeIdempotencyKey(),
        p_user_note: null
      });
      if (error) throw error;

      const result = unwrap(data);
      if (result.ok === false) throw new Error(result.message || 'Withdrawal could not be submitted.');

      sessionStorage.removeItem('ce_withdrawal_idempotency_key');
      await loadPortal(true);
      const withdrawal = activeWithdrawal(state.portal || {}) || result.withdrawal || result;

      const ref = byId('ppRef');
      if (ref) ref.textContent = withdrawal.public_reference || result.public_reference || 'Pending';
      const amountNode = byId('ppAmount');
      if (amountNode) amountNode.textContent = fmt(withdrawal.amount || amount);
      const account = state.accounts.find(a => sameId(a.id, state.selectedAccountId));
      const bankNode = byId('ppBank');
      if (bankNode && account) bankNode.textContent = accountLabel(account);

      toast(result.message || 'Withdrawal request submitted successfully.');
      routeWithdrawalResult(withdrawal, result);
    } catch (error) {
      console.error('[ChatEarn 6B] withdrawal submit failed', error);
      toast(error?.message || 'Unable to submit withdrawal.', 'error');
      renderPortal();
    } finally {
      state.submitting = false;
      if (button) button.removeAttribute('aria-busy');
    }
  }

  const previousGoScreen = typeof goScreen === 'function' ? goScreen : null;
  if (previousGoScreen) {
    window.goScreen = function module6BGoScreen(id) {
      const result = previousGoScreen(id);
      if (id === 'withdraw' || id === 'earnings') void loadPortal(id === 'withdraw').catch(() => {});
      return result;
    };
  }

  window.placeWithdrawal = submitWithdrawal;
  window.selectBank = function retiredLegacyBankSelector() { renderAccounts(); };
  window.triggerBankVerify = function retiredLegacyBankVerification() {};
  window.ChatEarnWithdrawalV5 = Object.freeze({
    version: VERSION,
    load: loadPortal,
    submit: submitWithdrawal,
    refresh: () => loadPortal(true),
    getState: () => ({ ...state, accounts: [...state.accounts] })
  });

  document.addEventListener('DOMContentLoaded', () => {
    retireLegacyInputs();
    ensureStatusBox();
    const submit = document.querySelector('#withdraw .btn-place-wd');
    if (submit) submit.setAttribute('onclick', 'placeWithdrawal()');
  }, { once: true });

  console.info(`[ChatEarn] Module ${VERSION} canonical withdrawal controller loaded`);
})();