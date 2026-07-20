(() => {
  'use strict';
  if (window.__CHAT_EARN_REWARDS__) return;
  window.__CHAT_EARN_REWARDS__ = true;

  const client = window.ChatEarn?.client;
  const MINIMUM = 40000;
  const money = value => `₦${Number(value || 0).toLocaleString('en-NG')}`;

  function addCard() {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard || document.getElementById('rewardsCard')) return;
    dashboard.insertAdjacentHTML('beforeend', `
      <section id="rewardsCard" style="margin-top:12px;padding:18px;border:1px solid var(--line);border-radius:18px;background:var(--card)">
        <small style="color:var(--green2);font-weight:900">REWARDS STATUS</small>
        <h3 style="margin:8px 0 4px">Withdrawal eligibility</h3>
        <p id="rewardsText" style="color:var(--muted);line-height:1.55;margin:0">Checking your account…</p>
        <div style="height:8px;background:var(--card2);border-radius:99px;overflow:hidden;margin-top:14px"><div id="rewardsProgress" style="height:100%;width:0;background:var(--green)"></div></div>
        <button id="rewardsButton" class="primary" type="button" disabled>Not eligible yet</button>
      </section>`);
  }

  async function refresh() {
    if (!client) return;
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return;

    const [{ data: profile }, { data: withdrawals }] = await Promise.all([
      client.from('profiles').select('balance').eq('user_id', user.id).maybeSingle(),
      client.from('withdrawals').select('status,submitted_at').eq('user_id', user.id).order('submitted_at', { ascending: false }).limit(1)
    ]);

    const balance = Number(profile?.balance || 0);
    const latest = withdrawals?.[0] || null;
    const percent = Math.min(100, Math.round((balance / MINIMUM) * 100));
    const text = document.getElementById('rewardsText');
    const progress = document.getElementById('rewardsProgress');
    const button = document.getElementById('rewardsButton');
    if (!text || !progress || !button) return;

    progress.style.width = `${percent}%`;
    if (latest) {
      text.textContent = `Latest request status: ${String(latest.status).replaceAll('_', ' ')}.`;
      button.textContent = 'View status';
      button.disabled = false;
    } else if (balance >= MINIMUM) {
      text.textContent = `You have reached the ${money(MINIMUM)} minimum.`;
      button.textContent = 'Eligible to continue';
      button.disabled = false;
    } else {
      text.textContent = `${money(MINIMUM - balance)} remaining before eligibility.`;
      button.textContent = `${percent}% complete`;
      button.disabled = true;
    }
  }

  function boot() {
    addCard();
    refresh().catch(error => console.error('[Rewards]', error));
    const dashboard = document.getElementById('dashboard');
    if (dashboard) new MutationObserver(() => dashboard.classList.contains('active') && refresh()).observe(dashboard, { attributes: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();