/* ChatEarn V4.1 — returning-user continuity, rotating tasks and no-repeat offers */
(() => {
  'use strict';

  if (window.__CE_V4_RETURNING__) return;
  window.__CE_V4_RETURNING__ = true;

  const state = {
    experience: null,
    loading: false,
    claiming: false,
    offerOpenedAt: 0,
    pendingDraft: null,
    lastLoadAt: 0
  };

  const byId = id => document.getElementById(id);
  const safeMoney = value => typeof money === 'function' ? money(value) : `₦${Number(value || 0).toLocaleString('en-NG')}`;

  async function ensureSession(showLogin = true) {
    try {
      let { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;

      if (!data?.session) {
        const refreshed = await supabaseClient.auth.refreshSession();
        if (!refreshed.error && refreshed.data?.session) data = refreshed.data;
      }

      if (!data?.session) {
        if (showLogin) {
          showToast('Your session needs a quick login to continue safely.');
          openLogin();
        }
        return false;
      }

      currentUser = data.session.user;
      if (!currentProfile || currentProfile.user_id !== currentUser.id) {
        await loadProfile();
      }
      return true;
    } catch (error) {
      if (showLogin) {
        showToast('Please log in again to continue.');
        openLogin();
      }
      return false;
    }
  }

  function removeExtraEarningsLinks() {
    document.querySelectorAll('#earnings a').forEach(link => link.remove());
  }

  function hideLegacyReturnCard() {
    const old = byId('ceReturnCard');
    if (old) old.classList.remove('show');
  }

  function createHub() {
    if (byId('ceV4ReturnHub')) return;
    const hub = document.createElement('section');
    hub.id = 'ceV4ReturnHub';
    hub.className = 'ce-v4-return-hub';
    hub.innerHTML = `
      <div class="ce-v4-hub-top">
        <div>
          <div class="ce-v4-hub-eyebrow">Fresh return activity</div>
          <div class="ce-v4-hub-title" id="ceV4HubTitle">Welcome back</div>
          <div class="ce-v4-hub-sub" id="ceV4HubSub">Loading a fresh activity for this visit…</div>
        </div>
        <div class="ce-v4-visit-badge" id="ceV4VisitBadge">Visit 2</div>
      </div>
      <div class="ce-v4-payment" id="ceV4PaymentBox">
        <div class="ce-v4-payment-title" id="ceV4PaymentTitle"></div>
        <div class="ce-v4-payment-sub" id="ceV4PaymentSub"></div>
      </div>
      <div class="ce-v4-task">
        <div class="ce-v4-task-head">
          <div>
            <div class="ce-v4-task-title" id="ceV4TaskTitle">Preparing your next task…</div>
            <div class="ce-v4-task-sub" id="ceV4TaskSub"></div>
          </div>
          <div class="ce-v4-reward" id="ceV4Reward"></div>
        </div>
        <div class="ce-v4-progress-row"><span id="ceV4ProgressLabel">Progress</span><span id="ceV4ProgressText">0/1</span></div>
        <div class="ce-v4-progress"><div id="ceV4ProgressFill"></div></div>
        <div class="ce-v4-actions">
          <button type="button" class="ce-v4-primary" id="ceV4TaskButton">Open Task</button>
          <button type="button" class="ce-v4-secondary" id="ceV4AnotherButton">Another</button>
        </div>
        <div class="ce-v4-complete" id="ceV4CompleteText"></div>
      </div>`;

    const anchor = byId('ceReturnCard') || document.querySelector('.dash-header');
    if (anchor) anchor.after(hub);

    byId('ceV4TaskButton').addEventListener('click', runCurrentTask);
    byId('ceV4AnotherButton').addEventListener('click', skipCurrentTask);
  }

  function renderExperience() {
    createHub();
    hideLegacyReturnCard();
    const hub = byId('ceV4ReturnHub');
    const payload = state.experience;

    if (!payload?.ok || !payload.available || Number(payload.visit_number || 1) < 2) {
      hub.classList.remove('show');
      return;
    }

    const task = payload.assignment;
    hub.classList.add('show');
    byId('ceV4HubTitle').textContent = `Welcome back, ${userName || 'User'}`;
    byId('ceV4HubSub').textContent = 'Your chats, tasks and withdrawal can keep moving while you return.';
    byId('ceV4VisitBadge').textContent = `Visit ${payload.visit_number}`;

    const payment = payload.withdrawal;
    const paymentBox = byId('ceV4PaymentBox');
    if (payment) {
      paymentBox.classList.add('show');
      byId('ceV4PaymentTitle').textContent = `Withdrawal ${String(payment.status || 'pending').toUpperCase()} · ${safeMoney(payment.amount)}`;
      byId('ceV4PaymentSub').textContent = payment.status === 'pending'
        ? 'New eligible earnings are automatically added to this pending amount until it is approved.'
        : 'You can continue using ChatEarn and start another withdrawal when eligible.';
    } else {
      paymentBox.classList.remove('show');
    }

    byId('ceV4TaskTitle').textContent = task.title || 'Fresh task';
    byId('ceV4TaskSub').textContent = task.subtitle || '';
    byId('ceV4TaskButton').textContent = task.button_text || 'Continue';

    const reward = byId('ceV4Reward');
    if (Number(task.reward_amount || 0) > 0) {
      reward.classList.add('show');
      reward.textContent = `+${safeMoney(task.reward_amount)}`;
    } else {
      reward.classList.remove('show');
      reward.textContent = '';
    }

    const progress = Math.max(0, Number(task.progress || 0));
    const required = Math.max(1, Number(task.required_count || 1));
    const percent = Math.min(100, Math.round(progress / required * 100));
    byId('ceV4ProgressText').textContent = `${Math.min(progress, required)}/${required}`;
    byId('ceV4ProgressFill').style.width = `${percent}%`;
    byId('ceV4CompleteText').classList.remove('show');
  }

  async function loadExperience(force = false) {
    if (state.loading || !currentUser || currentScreen !== 'dashboard') return;
    if (!force && Date.now() - state.lastLoadAt < 1500) return;
    state.loading = true;
    try {
      if (!(await ensureSession(false))) return;
      const { data, error } = await supabaseClient.rpc('chatearn_v4_get_return_experience', {
        p_visitor_id: VISITOR_ID,
        p_session_id: SESSION_ID
      });
      if (error) throw error;
      state.experience = typeof data === 'string' ? JSON.parse(data) : data;
      state.lastLoadAt = Date.now();
      if (state.experience?.balance != null) {
        totalBalance = Number(state.experience.balance);
        chatEarnings = Math.max(0, totalBalance - SIGNUP_BONUS);
        updateBalance();
      }
      renderExperience();
    } catch (error) {
      console.warn('Return experience:', error?.message || error);
    } finally {
      state.loading = false;
    }
  }

  function partnerIndex(name) {
    const index = FOREIGNERS.findIndex(item => String(item.name).toLowerCase() === String(name || '').toLowerCase());
    return index >= 0 ? index : Math.floor(Math.random() * FOREIGNERS.length);
  }

  async function markTask(eventType, metadata = {}) {
    const id = state.experience?.assignment?.id;
    if (!id) return;
    try {
      await supabaseClient.rpc('chatearn_v4_task_event', {
        p_assignment_id: id,
        p_event_type: eventType,
        p_metadata: metadata
      });
    } catch (error) {
      console.warn('Task event:', error?.message || error);
    }
  }

  async function claimCurrentTask() {
    const id = state.experience?.assignment?.id;
    if (!id || state.claiming) return;
    state.claiming = true;
    try {
      const { data, error } = await supabaseClient.rpc('chatearn_v4_claim_return_task', {
        p_assignment_id: id
      });
      if (error) throw error;
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (result?.completed) {
        if (result.balance != null) {
          totalBalance = Number(result.balance);
          chatEarnings = Math.max(0, totalBalance - SIGNUP_BONUS);
          updateBalance();
        }
        const complete = byId('ceV4CompleteText');
        complete.textContent = Number(result.reward || 0) > 0
          ? `${safeMoney(result.reward)} task bonus added. A new task is ready.`
          : 'Task completed. A fresh activity is ready.';
        complete.classList.add('show');
        if (Number(result.reward || 0) > 0) showEarnToast(`+${safeMoney(result.reward)} Task Bonus!`);
        state.experience = null;
        state.lastLoadAt = 0;
        setTimeout(() => loadExperience(true), 900);
      } else {
        await loadExperience(true);
      }
    } catch (error) {
      console.warn('Task claim:', error?.message || error);
    } finally {
      state.claiming = false;
    }
  }

  async function runCurrentTask() {
    const task = state.experience?.assignment;
    if (!task) return;
    if (!(await ensureSession(true))) return;

    await markTask('opened', { task_type: task.task_type });

    if (task.task_type === 'chat_continue' || task.task_type === 'chat_new') {
      await openChat(partnerIndex(task.partner_key));
      return;
    }
    if (task.task_type === 'chat_sprint') {
      await openChat(Math.floor(Math.random() * FOREIGNERS.length));
      return;
    }
    if (task.task_type === 'share') {
      doShareWA();
      return;
    }
    if (task.task_type === 'offer') {
      if (!task.offer_url) {
        showToast('No unused task link is available yet.');
        await skipCurrentTask();
        return;
      }
      state.offerOpenedAt = Date.now();
      sessionStorage.setItem('ce_v4_task_offer', JSON.stringify({
        assignment_id: task.id,
        offer_key: task.offer_key,
        opened_at: state.offerOpenedAt
      }));
      try {
        await supabaseClient.rpc('chatearn_v3_track_offer_event', {
          p_offer_key: task.offer_key,
          p_event_type: 'open',
          p_visitor_id: VISITOR_ID,
          p_session_id: SESSION_ID,
          p_placement: 'return_task',
          p_visit_number: Number(state.experience.visit_number || 2),
          p_messages_before: Number(replyCount || 0),
          p_seconds_away: null,
          p_metadata: { assignment_id: task.id, source: 'v4_return_task' }
        });
      } catch (error) {}
      window.open(task.offer_url, '_blank', 'noopener');
    }
  }

  async function skipCurrentTask() {
    const button = byId('ceV4AnotherButton');
    if (button) button.disabled = true;
    try {
      await markTask('skipped', { reason: 'user_requested_another' });
      state.experience = null;
      state.lastLoadAt = 0;
      await loadExperience(true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function handleOfferReturn() {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('ce_v4_task_offer') || 'null'); } catch (error) {}
    if (!saved?.assignment_id || !saved.opened_at) return;
    const seconds = Math.round((Date.now() - saved.opened_at) / 1000);
    if (seconds < 2) return;
    sessionStorage.removeItem('ce_v4_task_offer');
    await markTask('returned', { seconds_away: seconds, offer_key: saved.offer_key });
    try {
      await supabaseClient.rpc('chatearn_v3_track_offer_event', {
        p_offer_key: saved.offer_key,
        p_event_type: 'return',
        p_visitor_id: VISITOR_ID,
        p_session_id: SESSION_ID,
        p_placement: 'return_task',
        p_visit_number: Number(state.experience?.visit_number || 2),
        p_messages_before: Number(replyCount || 0),
        p_seconds_away: seconds,
        p_metadata: { assignment_id: saved.assignment_id, source: 'v4_return_task' }
      });
    } catch (error) {}
    await claimCurrentTask();
  }

  async function v4SubmitMessage(text, clientId) {
    let retried = false;
    while (true) {
      try {
        if (!(await ensureSession(true))) throw new Error('Login required');
        const { data, error } = await supabaseClient.rpc('chatearn_send_message', {
          p_partner_key: currentChatUser.name,
          p_body: text,
          p_client_message_id: clientId,
          p_session_id: SESSION_ID
        });
        if (error) throw error;

        const result = Array.isArray(data) ? data[0] : data;
        const reward = Number(result?.reward || 0);
        totalBalance = Number(result?.balance || totalBalance);
        replyCount = Number(result?.total_messages || replyCount + 1);
        chatEarnings = Math.max(0, totalBalance - SIGNUP_BONUS);

        const element = document.querySelector(`.msg[data-client-id="${clientId}"]`);
        if (element) {
          const status = element.querySelector('.msg-status');
          if (status) status.textContent = '✓✓';
          if (reward) {
            const earn = document.createElement('div');
            earn.className = 'msg-earn';
            earn.textContent = `+${safeMoney(reward)} earned! 💰`;
            element.appendChild(earn);
          }
        }

        if (reward) showEarnToast(`+${safeMoney(reward)} Earned! 💰`);
        updateBalance();
        trackEvent('user_message_sent', { partner: currentChatUser.name, message_length: text.length, reward });
        setTimeout(() => deliverReply(getNextReply(text)), 250);
        setTimeout(() => claimCurrentTask(), 500);
        return;
      } catch (error) {
        const authProblem = /login required|jwt|session|refresh token/i.test(error?.message || '');
        if (authProblem && !retried) {
          retried = true;
          const refreshed = await supabaseClient.auth.refreshSession();
          if (!refreshed.error && refreshed.data?.session) continue;
        }

        const element = document.querySelector(`.msg[data-client-id="${clientId}"]`);
        if (element) {
          element.classList.add('failed');
          let retry = element.querySelector('.msg-retry');
          if (!retry) {
            retry = document.createElement('div');
            retry.className = 'msg-retry';
            retry.textContent = authProblem ? 'Session paused · log in and tap to retry' : 'Failed to send · tap to retry';
            retry.onclick = async () => {
              retry.remove();
              element.classList.remove('failed');
              await v4SubmitMessage(text, clientId);
            };
            element.appendChild(retry);
          }
        }
        chatBusy = false;
        if (authProblem) openLogin();
        showToast(`⚠️ ${error?.message || 'Message could not be sent'}`);
        return;
      }
    }
  }

  window.sendMsg = async function () {
    if (chatBusy || !currentChatUser) return;
    const input = byId('chatInput');
    const text = input?.value.trim();
    if (!text) return;

    if (!(await ensureSession(true))) {
      state.pendingDraft = { text, partner: currentChatUser.name };
      sessionStorage.setItem('ce_v4_pending_chat_draft', JSON.stringify(state.pendingDraft));
      return;
    }

    input.value = '';
    chatBusy = true;
    const clientId = crypto.randomUUID();
    renderStoredMessage({
      sender: 'user', body: text, status: navigator.onLine ? 'sent' : 'pending',
      reward: 0, created_at: new Date().toISOString(), client_message_id: clientId
    });

    if (!navigator.onLine) {
      pendingMessageQueue.push({ text, clientId, partner: currentChatUser.name });
      localStorage.setItem('ce_pending_messages', JSON.stringify(pendingMessageQueue));
      byId('offlineStrip')?.classList.add('show');
      chatBusy = false;
      return;
    }
    await v4SubmitMessage(text, clientId);
  };

  window.submitMessage = v4SubmitMessage;

  const oldGoScreen = window.goScreen;
  window.goScreen = function (id) {
    const result = oldGoScreen(id);
    if (id === 'dashboard') {
      removeExtraEarningsLinks();
      setTimeout(() => loadExperience(true), 120);
    }
    return result;
  };

  const oldDoLogin = window.doLogin;
  window.doLogin = async function () {
    await oldDoLogin();
    if (!currentUser) return;
    let draft = state.pendingDraft;
    try { draft = draft || JSON.parse(sessionStorage.getItem('ce_v4_pending_chat_draft') || 'null'); } catch (error) {}
    if (draft?.text) {
      sessionStorage.removeItem('ce_v4_pending_chat_draft');
      state.pendingDraft = null;
      const index = partnerIndex(draft.partner);
      await openChat(index);
      byId('chatInput').value = draft.text;
      setTimeout(() => window.sendMsg(), 100);
    }
    setTimeout(() => loadExperience(true), 150);
  };

  const previousTrackEvent = window.trackEvent;
  window.trackEvent = async function (name, metadata = {}) {
    const result = await previousTrackEvent(name, metadata);
    if (name === 'user_message_sent' || name === 'whatsapp_returned') {
      setTimeout(() => claimCurrentTask(), 450);
    }
    return result;
  };

  function initialise() {
    createHub();
    removeExtraEarningsLinks();
    hideLegacyReturnCard();

    setTimeout(async () => {
      if (await ensureSession(false)) {
        if (currentScreen === 'dashboard') loadExperience(true);
      }
    }, 900);

    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        currentUser = session.user;
        setTimeout(async () => {
          try { await loadProfile(); } catch (error) {}
          if (currentScreen === 'dashboard') loadExperience(true);
        }, 150);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) handleOfferReturn();
    });
    window.addEventListener('pageshow', handleOfferReturn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }
})();
