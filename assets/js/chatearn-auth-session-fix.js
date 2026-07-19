/* ChatEarn Module 8F: durable auth/session controller. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_AUTH_SESSION_DURABLE__) return;
  window.__CHAT_EARN_AUTH_SESSION_DURABLE__ = true;

  const VERSION = '8.3.0';
  const USER_CACHE_KEY = 'ce_last_verified_user_v82';
  const LOGOUT_KEY = 'ce_explicit_logout_v82';
  let lastUser = null;
  let resolving = null;
  let installed = false;
  let unsubscribe = null;
  let autoOpenTimer = 0;

  const client = () => {
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient?.auth) return supabaseClient; } catch (_) {}
    return window.supabaseClient?.auth ? window.supabaseClient : null;
  };
  const modal = () => document.getElementById('loginModal');
  const hideLogin = () => modal()?.classList.remove('show');
  const showLogin = () => modal()?.classList.add('show');

  function readCachedUser() {
    try { return JSON.parse(localStorage.getItem(USER_CACHE_KEY) || 'null'); } catch (_) { return null; }
  }
  function cacheUser(user) {
    if (!user?.id) return;
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify({ id:user.id, email:user.email || '', user_metadata:user.user_metadata || {} }));
    localStorage.removeItem(LOGOUT_KEY);
  }
  function syncUser(user) {
    if (!user?.id) return lastUser;
    lastUser = user;
    cacheUser(user);
    try { currentUser = user; } catch (_) {}
    hideLogin();
    return user;
  }
  function explicitlyLoggedOut() { return localStorage.getItem(LOGOUT_KEY) === '1'; }

  async function resolveSession(retries = 2) {
    if (resolving) return resolving;
    resolving = (async () => {
      const supa = client();
      if (!supa) return null;
      let lastError = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const { data, error } = await supa.auth.getSession();
          if (error) throw error;
          if (data?.session?.user) return syncUser(data.session.user);
        } catch (error) { lastError = error; }
        if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 350 + attempt * 500));
      }
      if (lastError) console.warn('[ChatEarn] Session refresh delayed:', lastError.message || lastError);
      return null;
    })().finally(() => { resolving = null; });
    return resolving;
  }

  async function requireUser() {
    if (lastUser?.id) return lastUser;
    const user = await resolveSession(2);
    if (user?.id) return user;
    const cached = !explicitlyLoggedOut() ? readCachedUser() : null;
    if (cached?.id) {
      lastUser = cached;
      try { currentUser = cached; } catch (_) {}
      hideLogin();
      resolveSession(3).catch(() => null);
      return cached;
    }
    showLogin();
    window.showToast?.('Please log in to continue.');
    return null;
  }

  async function loadCanonicalProfile(options = {}) {
    const user = await requireUser();
    if (!user?.id) return null;
    const supa = client();
    if (!supa?.from) return null;
    const retries = Math.max(0, Number(options.retries || 0));
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const { data, error } = await supa
        .from('profiles')
        .select('user_id,display_name,balance,chats,shares,day,day_earnings,kyc_done,kyc_pending,has_withdrawn,last_active_at,updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!error && data) {
        try {
          currentProfile = data;
          userName = (data.display_name || user.user_metadata?.full_name || user.email || 'User').split(' ')[0];
          totalBalance = Number(data.balance || 0);
          replyCount = Number(data.chats || 0);
          chatEarnings = Math.max(0, totalBalance - 10000);
          document.getElementById('dashName').textContent = userName + '!';
          updateBalance?.();
        } catch (_) {}
        return data;
      }
      lastError = error || new Error('Profile is still being prepared');
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 300 + attempt * 400));
    }
    throw lastError || new Error('Unable to load account profile');
  }

  function installCanonicalProfileLoader() {
    window.loadProfile = loadCanonicalProfile;
    try { loadProfile = loadCanonicalProfile; } catch (_) {}
  }

  function scheduleAutoOpenChat(delay = 500) {
    clearTimeout(autoOpenTimer);
    autoOpenTimer = window.setTimeout(() => {
      try {
        if (typeof openChat !== 'function') return;
        const count = Array.isArray(window.FOREIGNERS) ? window.FOREIGNERS.length : 6;
        const index = Math.floor(Math.random() * Math.max(1, count));
        openChat(index);
      } catch (error) {
        console.warn('[ChatEarn] Auto-open chat delayed:', error?.message || error);
      }
    }, delay);
  }

  async function verifiedRegister() {
    const supa = client();
    const name = document.getElementById('regName')?.value.trim() || '';
    const email = document.getElementById('regEmail')?.value.trim() || '';
    const password = document.getElementById('regPass')?.value || '';
    const button = document.getElementById('regSubmitBtn');
    if (!supa) return window.showToast?.('Secure connection is loading. Try again.');
    if (!name) return window.showToast?.('Enter your full name');
    if (!/^\S+@\S+\.\S+$/.test(email)) return window.showToast?.('Enter a valid email');
    if (password.length < 6) return window.showToast?.('Password must be at least 6 characters');
    if (button) { button.disabled = true; button.textContent = 'Creating account…'; }
    try {
      const signup = await supa.auth.signUp({ email, password, options:{ data:{ full_name:name } } });
      if (signup.error) throw signup.error;
      let session = signup.data?.session;
      if (!session) {
        const login = await supa.auth.signInWithPassword({ email, password });
        if (login.error) throw login.error;
        session = login.data?.session;
      }
      if (!session?.user) throw new Error('No active login session was created.');
      syncUser(session.user);
      try { userName = (session.user.user_metadata?.full_name || name).split(' ')[0]; } catch (_) {}
      goScreen?.('loading');
      const profilePromise = loadCanonicalProfile({ retries:4 }).catch(() => null);
      if (typeof runLoadingSequence === 'function') runLoadingSequence(profilePromise);
      else profilePromise.finally(() => { goScreen?.('dashboard'); scheduleAutoOpenChat(500); });
      window.trackEvent?.('registration_success');
    } catch (error) {
      window.showToast?.(error.message || 'Registration failed.');
      if (typeof currentScreen !== 'undefined' && currentScreen === 'loading') goScreen?.('register');
    } finally { if (button) { button.disabled = false; button.textContent = 'Create Account & Get ₦10,000 →'; } }
  }

  async function verifiedLogin() {
    const supa = client();
    const email = document.getElementById('loginEmail')?.value.trim() || '';
    const password = document.getElementById('loginPass')?.value || '';
    const button = document.getElementById('loginBtn');
    const errorNode = document.getElementById('loginError');
    errorNode?.classList.remove('show');
    if (!supa) return window.showToast?.('Secure connection is loading. Try again.');
    if (!/^\S+@\S+\.\S+$/.test(email) || !password) return;
    if (button) { button.disabled = true; button.textContent = 'Logging in…'; }
    try {
      const login = await supa.auth.signInWithPassword({ email, password });
      if (login.error) throw login.error;
      if (!login.data?.session?.user) throw new Error('Login completed without an active session.');
      syncUser(login.data.session.user);
      hideLogin();
      goScreen?.('dashboard');
      await loadCanonicalProfile({ retries:4 });
      updateBalance?.();
      scheduleAutoOpenChat(550);
      window.trackEvent?.('login_success');
    } catch (error) {
      if (errorNode) { errorNode.textContent = error.message || 'Unable to log in.'; errorNode.classList.add('show'); }
    } finally { if (button) { button.disabled = false; button.textContent = 'Log In & Continue →'; } }
  }

  function wrapProtected(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__ceDurableAuthWrapped) return;
    const wrapped = async function(...args) {
      const user = await requireUser();
      if (!user) return false;
      return original.apply(this, args);
    };
    wrapped.__ceDurableAuthWrapped = true;
    wrapped.__ceDurableAuthOriginal = original;
    window[name] = wrapped;
  }

  function install() {
    installCanonicalProfileLoader();
    window.doRegister = verifiedRegister;
    window.doLogin = verifiedLogin;
    wrapProtected('openChat');
    wrapProtected('sendMsg');
    installed = true;
  }

  function boot() {
    const cached = !explicitlyLoggedOut() ? readCachedUser() : null;
    if (cached?.id) syncUser(cached);
    install();
    const supa = client();
    if (supa?.auth?.onAuthStateChange && !unsubscribe) {
      const listener = supa.auth.onAuthStateChange((event, session) => {
        if (session?.user) syncUser(session.user);
        if (event === 'SIGNED_OUT' && explicitlyLoggedOut()) {
          lastUser = null;
          localStorage.removeItem(USER_CACHE_KEY);
          try { currentUser = null; } catch (_) {}
        }
      });
      unsubscribe = listener?.data?.subscription || true;
    }
    resolveSession(3).then(user => { if (user?.id) loadCanonicalProfile({ retries:2 }).catch(() => null); }).catch(() => null);
  }

  window.ceExplicitUserLogout = async () => {
    localStorage.setItem(LOGOUT_KEY, '1');
    localStorage.removeItem(USER_CACHE_KEY);
    lastUser = null;
    try { currentUser = null; } catch (_) {}
    await client()?.auth?.signOut?.();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  window.addEventListener('pageshow', () => { install(); resolveSession(2).catch(() => null); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resolveSession(2).catch(() => null); });
  window.ChatEarnAuthSessionDiagnostic = async () => ({ version:VERSION, installed, cachedUserId:readCachedUser()?.id || null, currentUserId:lastUser?.id || null, liveUserId:(await resolveSession(1).catch(() => null))?.id || null });
  console.info(`[ChatEarn] Durable auth/session controller ${VERSION} loaded`);
})();