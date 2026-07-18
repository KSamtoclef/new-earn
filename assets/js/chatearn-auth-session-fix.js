/* ChatEarn Module 8 auth/session bridge.
 * Keeps page auth state synchronized with Supabase and prevents repeated login prompts.
 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_AUTH_SESSION_FIX__) return;
  window.__CHAT_EARN_AUTH_SESSION_FIX__ = true;

  const VERSION = '8.0.2';
  let resolving = null;
  let lastUser = null;

  function setCurrentUser(user) {
    lastUser = user || null;
    try { currentUser = lastUser; } catch (_) {}
    return lastUser;
  }

  function hideLogin() {
    document.getElementById('loginModal')?.classList.remove('show');
  }

  async function resolveSession(options = {}) {
    if (resolving) return resolving;
    resolving = (async () => {
      const client = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
      if (!client?.auth) return null;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      const user = setCurrentUser(data?.session?.user || null);
      if (user) {
        hideLogin();
        if (options.loadProfile !== false && typeof loadProfile === 'function') {
          try { await loadProfile({ retries: 2 }); }
          catch (error) { console.warn('[ChatEarn] Profile still syncing:', error?.message || error); }
        }
      }
      return user;
    })().finally(() => { resolving = null; });
    return resolving;
  }

  async function requireSession() {
    try {
      const user = lastUser || await resolveSession();
      if (user) { hideLogin(); return user; }
    } catch (error) {
      console.warn('[ChatEarn] Session check failed:', error?.message || error);
    }
    const originalOpenLogin = window.__ceOriginalOpenLogin;
    if (typeof originalOpenLogin === 'function') originalOpenLogin();
    else document.getElementById('loginModal')?.classList.add('show');
    if (typeof showToast === 'function') showToast('Please log in to continue.');
    return null;
  }

  function wrapFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__ceAuthWrapped) return false;
    const wrapped = async function (...args) {
      const user = await requireSession();
      if (!user) return false;
      return original.apply(this, args);
    };
    wrapped.__ceAuthWrapped = true;
    wrapped.__ceAuthOriginal = original;
    window[name] = wrapped;
    return true;
  }

  function guardOpenLogin() {
    const original = window.openLogin;
    if (typeof original !== 'function' || original.__ceSessionAware) return false;
    window.__ceOriginalOpenLogin = original;
    const guarded = function (...args) {
      resolveSession({ loadProfile: false }).then(user => {
        if (user) { hideLogin(); return; }
        original.apply(this, args);
      }).catch(() => original.apply(this, args));
    };
    guarded.__ceSessionAware = true;
    window.openLogin = guarded;
    return true;
  }

  const client = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  client?.auth?.onAuthStateChange?.((_event, session) => {
    setCurrentUser(session?.user || null);
    if (session?.user) {
      hideLogin();
      setTimeout(() => resolveSession({ loadProfile: true }).catch(() => null), 0);
    }
  });

  const installTimer = setInterval(() => {
    guardOpenLogin();
    const chatReady = wrapFunction('openChat');
    const sendReady = wrapFunction('sendMsg');
    if ((chatReady || window.openChat?.__ceAuthWrapped) && (sendReady || window.sendMsg?.__ceAuthWrapped) && window.openLogin?.__ceSessionAware) {
      clearInterval(installTimer);
    }
  }, 50);
  setTimeout(() => clearInterval(installTimer), 15000);

  document.addEventListener('click', event => {
    if (!document.getElementById('loginModal')?.classList.contains('show')) return;
    resolveSession({ loadProfile: false }).then(user => { if (user) hideLogin(); }).catch(() => null);
  }, true);

  window.ChatEarnAuthSessionDiagnostic = async () => {
    let sessionUser = null, error = null;
    try { sessionUser = await resolveSession({ loadProfile: false }); }
    catch (e) { error = e?.message || String(e); }
    let pageUser = null;
    try { pageUser = currentUser || null; } catch (_) {}
    return {
      version: VERSION,
      sessionUserId: sessionUser?.id || null,
      pageUserId: pageUser?.id || null,
      synchronized: Boolean(sessionUser?.id && sessionUser.id === pageUser?.id),
      openChatGuardInstalled: Boolean(window.openChat?.__ceAuthWrapped),
      sendGuardInstalled: Boolean(window.sendMsg?.__ceAuthWrapped),
      loginGuardInstalled: Boolean(window.openLogin?.__ceSessionAware),
      error
    };
  };

  resolveSession({ loadProfile: false }).catch(() => null);
  console.info(`[ChatEarn] Auth/session bridge ${VERSION} loaded`);
})();