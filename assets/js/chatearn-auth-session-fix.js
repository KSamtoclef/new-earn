/* ChatEarn Module 8 verified auth/session controller. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_AUTH_SESSION_FIX_V4__) return;
  window.__CHAT_EARN_AUTH_SESSION_FIX_V4__ = true;

  const VERSION = '8.0.4';
  let lastUser = null;
  let resolving = null;
  let lastCheckedAt = 0;

  const client = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  const modal = () => document.getElementById('loginModal');
  const hideLogin = () => modal()?.classList.remove('show');
  const showLogin = () => modal()?.classList.add('show');

  function syncUser(user) {
    lastUser = user || null;
    try { currentUser = lastUser; } catch (_) {}
    if (lastUser) hideLogin();
    return lastUser;
  }

  async function getVerifiedSession(loadAccount = false, force = false) {
    if (!force && lastUser && Date.now() - lastCheckedAt < 1000) return { user: lastUser };
    if (resolving) return resolving;
    resolving = (async () => {
      const supa = client();
      if (!supa?.auth) return null;
      const { data, error } = await supa.auth.getSession();
      if (error) throw error;
      lastCheckedAt = Date.now();
      const session = data?.session || null;
      const user = syncUser(session?.user || null);
      if (user && loadAccount && typeof loadProfile === 'function') {
        try { await loadProfile({ force: true, retries: 3 }); }
        catch (error) { console.warn('[ChatEarn] Account profile is still syncing:', error?.message || error); }
      }
      return session;
    })().finally(() => { resolving = null; });
    return resolving;
  }

  async function requireUser() {
    try {
      const session = await getVerifiedSession(true, true);
      if (session?.user) { hideLogin(); return session.user; }
    } catch (error) {
      console.warn('[ChatEarn] Session verification failed:', error?.message || error);
    }
    showLogin();
    if (typeof showToast === 'function') showToast('Please log in to continue.');
    return null;
  }

  async function verifiedRegister() {
    const supa = client();
    const name = document.getElementById('regName')?.value.trim() || '';
    const email = document.getElementById('regEmail')?.value.trim() || '';
    const password = document.getElementById('regPass')?.value || '';
    const button = document.getElementById('regSubmitBtn');
    if (!name) return showToast?.('⚠️ Enter your full name');
    if (!/^\S+@\S+\.\S+$/.test(email)) return showToast?.('⚠️ Enter a valid email');
    if (password.length < 6) return showToast?.('⚠️ Password must be at least 6 characters');
    if (button) { button.disabled = true; button.textContent = 'Creating account…'; }
    try {
      trackEvent?.('registration_attempt', { email_domain: email.split('@')[1] || '' });
      const signup = await supa.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (signup.error) throw signup.error;
      let session = signup.data?.session || null;
      if (!session) {
        const login = await supa.auth.signInWithPassword({ email, password });
        if (login.error) throw login.error;
        session = login.data?.session || null;
      }
      const verified = await getVerifiedSession(false, true);
      if (!session?.user || !verified?.user) throw new Error('No active login session was created.');
      syncUser(verified.user);
      try { userName = (verified.user.user_metadata?.full_name || name).split(' ')[0]; } catch (_) {}
      const dashName = document.getElementById('dashName');
      if (dashName) dashName.textContent = `${userName || name.split(' ')[0]}!`;
      goScreen?.('loading');
      const profilePromise = typeof loadProfile === 'function' ? loadProfile({ force: true, retries: 4 }).catch(() => null) : Promise.resolve(null);
      runLoadingSequence?.(profilePromise);
      trackEvent?.('registration_success');
    } catch (error) {
      trackEvent?.('registration_error', { message: error.message });
      showToast?.(`⚠️ ${error.message}`);
      if (typeof currentScreen !== 'undefined' && currentScreen === 'loading') goScreen?.('register');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Create Account & Get ₦10,000 →'; }
    }
  }

  async function verifiedLogin() {
    const supa = client();
    const email = document.getElementById('loginEmail')?.value.trim() || '';
    const password = document.getElementById('loginPass')?.value || '';
    const button = document.getElementById('loginBtn');
    const errorNode = document.getElementById('loginError');
    errorNode?.classList.remove('show');
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      if (errorNode) { errorNode.textContent = 'Enter a valid email address.'; errorNode.classList.add('show'); }
      return;
    }
    if (!password) {
      if (errorNode) { errorNode.textContent = 'Enter your password.'; errorNode.classList.add('show'); }
      return;
    }
    if (button) { button.disabled = true; button.textContent = 'Logging in…'; }
    try {
      const login = await supa.auth.signInWithPassword({ email, password });
      if (login.error) throw login.error;
      const session = await getVerifiedSession(false, true);
      if (!session?.user) throw new Error('Login completed without an active session. Please try again.');
      syncUser(session.user);
      try { userName = (session.user.user_metadata?.full_name || email.split('@')[0] || 'User').split(' ')[0]; } catch (_) {}
      hideLogin();
      const dashName = document.getElementById('dashName');
      if (dashName) dashName.textContent = `${userName || 'User'}!`;
      goScreen?.('dashboard');
      if (typeof loadProfile === 'function') loadProfile({ force: true, retries: 3 }).then(() => updateBalance?.()).catch(() => showToast?.('Logged in. Account details are still syncing.'));
      trackEvent?.('login_success');
    } catch (error) {
      if (errorNode) { errorNode.textContent = error.message || 'Unable to log in.'; errorNode.classList.add('show'); }
      trackEvent?.('login_error', { message: error.message });
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Log In & Continue →'; }
    }
  }

  function wrapProtected(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__ceVerifiedAuthWrapped) return false;
    const wrapped = async function (...args) {
      const user = await requireUser();
      if (!user) return false;
      return original.apply(this, args);
    };
    wrapped.__ceVerifiedAuthWrapped = true;
    wrapped.__ceVerifiedAuthOriginal = original;
    window[name] = wrapped;
    return true;
  }

  function guardLoginModal() {
    const node = modal();
    if (!node || node.dataset.ceAuthObserved === '1') return;
    node.dataset.ceAuthObserved = '1';
    new MutationObserver(() => {
      if (!node.classList.contains('show')) return;
      getVerifiedSession(false, true).then(session => {
        if (session?.user) hideLogin();
      }).catch(() => null);
    }).observe(node, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  function install() {
    window.doRegister = verifiedRegister;
    window.doLogin = verifiedLogin;
    wrapProtected('openChat');
    wrapProtected('sendMsg');
    guardLoginModal();
  }

  client()?.auth?.onAuthStateChange?.((_event, session) => {
    lastCheckedAt = Date.now();
    syncUser(session?.user || null);
  });

  const timer = setInterval(install, 100);
  setTimeout(() => clearInterval(timer), 20000);
  install();

  window.ChatEarnAuthSessionDiagnostic = async () => {
    let session = null, error = null;
    try { session = await getVerifiedSession(false, true); } catch (e) { error = e?.message || String(e); }
    let pageUser = null;
    try { pageUser = currentUser || null; } catch (_) {}
    return {
      version: VERSION,
      sessionUserId: session?.user?.id || null,
      pageUserId: pageUser?.id || null,
      synchronized: Boolean(session?.user?.id && session.user.id === pageUser?.id),
      registrationControllerInstalled: window.doRegister === verifiedRegister,
      loginControllerInstalled: window.doLogin === verifiedLogin,
      openChatGuardInstalled: Boolean(window.openChat?.__ceVerifiedAuthWrapped),
      sendGuardInstalled: Boolean(window.sendMsg?.__ceVerifiedAuthWrapped),
      modalObserverInstalled: modal()?.dataset.ceAuthObserved === '1',
      error
    };
  };

  getVerifiedSession(false, true).catch(() => null);
  console.info(`[ChatEarn] Verified auth/session controller ${VERSION} loaded`);
})();