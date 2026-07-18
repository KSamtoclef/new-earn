/* ChatEarn Module 6A: canonical withdrawal frontend integration.
 * Temporary filename retained until the final script consolidation pass.
 */
(() => {
  'use strict';

  const VERSION = '6A.1';
  const state = {
    portal: null,
    accounts: [],
    selectedAccountId: null,
    loading: false,
    submitting: false,
    lastLoadedAt: 0
  };

  const byId = id => document.getElementById(id);
  const fmt = value => '₦' + Number(value || 0).toLocaleString('en-NG');
  const text = value => String(value ?? '');
  const safe = value => text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

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

  function accountLabel(account) {
    const provider = account.provider || account.bank_name || 'Payout account';
    const masked = account.masked_account || (account.account_last4 ? `•••• ${account.account_last4}` : 'Verified');
    return `${provider} · ${masked}`;
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

  function renderAccounts() {
    const container = document.querySelector('#withdraw .bank-options');
    if (!container) return;

    if (!state.accounts.length) {
      container.innerHTML = '<div style="width:100%;padding:14px;border:1px solid var(--line);border-radius:12px;color:var(--muted);font-size:13px;">No verified payout account is available. Add and verify an account before requesting withdrawal.</div>';
      state.selectedAccountId = null;
      return;
    }

    if (!state.selectedAccountId || !state.accounts.some(a => a.id === state.selectedAccountId)) {
      state.selectedAccountId = (state.accounts.find(a => a.is_default) || state.accounts[0]).id;
    }

    container.innerHTML = state.accounts.map(account => {
      const selected = account.id === state.selectedAccountId;
      return `<button type="button" class="bank-option${selected ? ' selected' : ''}" data-payout-account-id="${safe(account.id)}" style="text-align:left;cursor:pointer;">
        <div class="bo-name" style="font-size:15px;font-weight:900;">${safe(account.provider || account.bank_name || 'Payout account')}</div>
        <div style="font-size:11px;color:var(--text);margin-top:3px;">${safe(account.masked_account || (account.account_last4 ? `•••• ${account.account_last4}` : 'Verified account'))}</div>
      </button>`;
    }).join('');

    container.querySelectorAll('[data-payout-account-id]').forEach(button => {
      button.addEventListener('click', () => {
        state.selectedAccountId = button.dataset.payoutAccountId;
        renderAccounts();
      });
    });
  }

  function renderPortal() {
    const portal = state.portal || {};
    const available = availableBalance(portal);
    const minimum = minimumAmount(portal);
    const active = activeWithdrawal(portal);

    const amountNode = byId('wdAmount');
    if (amountNode) amountNode.textContent = fmt(available);
    const earningsNode = byId('earnPageAmount');
    if (earningsNode) earningsNode.textContent = Number(available).toLocaleString('en-NG');

    const oldAccountNumber = byId('wdAccNo')?.closest('.form-group');
    const oldAccountName = byId('wdAccName')?.closest('.form-group');
    if (oldAccountNumber) oldAccountNumber.style.display = 'none';
    if (oldAccountName) oldAccountName.style.display = 'none';
    const verifyStatus = byId('bankVerifyStatus');
    if (verifyStatus) verifyStatus.style.display = 'none';

    renderAccounts();

    const submit = document.querySelector('#withdraw .btn-place-wd');
    if (submit) {
      if (active) {
        submit.disabled = true;
        submit.textContent = `${active.ui_label || active.status_label || active.status || 'Withdrawal pending'}`;
      } else if (!state.accounts.length) {
        submit.disabled = true;
        submit.textContent = 'Verified payout account required';
      } else if (minimum && available < minimum) {
        submit.disabled = true;
        submit.textContent = `Minimum withdrawal is ${fmt(minimum)}`;
      } else {
        submit.disabled = false;
        submit.textContent = `Withdraw ${fmt(available)} →`;
      }
    }
  }

  async function loadPortal(force = false) {
    if (state.loading) return state.portal;
    if (!force && state.portal && Date.now() - state.lastLoadedAt < 10000) return state.portal;
    state.loading = true;
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
      renderPortal();
      return state.portal;
    } catch (error) {
      console.error('[ChatEarn 6A] withdrawal portal load failed', error);
      toast(error?.message || 'Unable to load withdrawal details.', 'error');
      throw error;
    } finally {
      state.loading = false;
    }
  }

  function makeIdempotencyKey() {
    const existing = sessionStorage.getItem('ce_withdrawal_idempotency_key');
    if (existing) return existing;
    const key = `withdrawal-${crypto.randomUUID()}`;
    sessionStorage.setItem('ce_withdrawal_idempotency_key', key);
    return key;
  }

  async function submitWithdrawal() {
    if (state.submitting) return;
    await loadPortal();
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
    if (!amount || amount < minimum) {
      toast(`Your available balance must reach ${fmt(minimum)} before withdrawal.`, 'error');
      return;
    }

    const button = document.querySelector('#withdraw .btn-place-wd');
    state.submitting = true;
    if (button) { button.disabled = true; button.textContent = 'Submitting securely…'; }

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
      const status = text(withdrawal.status || result.status);

      toast(result.message || 'Withdrawal request submitted successfully.');
      if (status === 'kyc_required' && typeof goScreen === 'function') goScreen('kyc');
      else if (status === 'sharing_required' && typeof goScreen === 'function') goScreen('sharewall');
      else if (typeof goScreen === 'function') goScreen('processing');

      const ref = byId('ppRef');
      if (ref) ref.textContent = withdrawal.public_reference || result.public_reference || 'Pending';
      const amountNode = byId('ppAmount');
      if (amountNode) amountNode.textContent = fmt(withdrawal.amount || amount);
      const account = state.accounts.find(a => a.id === state.selectedAccountId);
      const bankNode = byId('ppBank');
      if (bankNode && account) bankNode.textContent = accountLabel(account);
    } catch (error) {
      console.error('[ChatEarn 6A] withdrawal submit failed', error);
      toast(error?.message || 'Unable to submit withdrawal.', 'error');
      renderPortal();
    } finally {
      state.submitting = false;
    }
  }

  const previousGoScreen = typeof goScreen === 'function' ? goScreen : null;
  if (previousGoScreen) {
    window.goScreen = function module6AGoScreen(id) {
      const result = previousGoScreen(id);
      if (id === 'withdraw' || id === 'earnings') void loadPortal(id === 'withdraw');
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
    const submit = document.querySelector('#withdraw .btn-place-wd');
    if (submit) submit.setAttribute('onclick', 'placeWithdrawal()');
  }, { once: true });

  console.info(`[ChatEarn] Module ${VERSION} canonical withdrawal controller loaded`);
})();