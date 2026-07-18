/* ChatEarn Module 8 auth/session bridge.
 * Keeps the page-level currentUser state synchronized with the persisted Supabase session
 * and prevents a valid signed-in user from being asked to log in again before chat opens.
 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_AUTH_SESSION_FIX__) return;
  window.__CHAT_EARN_AUTH_SESSION_FIX__ = true;

  const VERSION = '8.0.1';
  let resolving = null;

  function setCurrentUser(user) {
    try { currentUser = user || null; } catch (_) {}
    return user || null;
  }

  async function resolveSession(options = {}) {
    if (resolving) return resolving;
    resolving = (async () => {
      const client = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
      if (!client?.auth) return null;

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      const user = setCurrentUser(data?.session?.user || null);

      if (user && options.loadProfile !== false && typeof loadProfile === 'function') {
        try { await loadProfile({ retries: 2 }); } catch (error) {
          console.warn('[ChatEarn] Session restored; profile still syncing:', error?.message || error);
        }
      }

      if (user) {
        document.getElementById('loginModal')?.classList.remove('show');
      }
      return user;
    })().finally(() => { resolving = null; });
    return resolving;
  }

  async function requireSession() {
    try {
      const user = await resolveSession();
      if (user) return user;
    } catch (error) {
      console.warn('[ChatEarn] Session check failed:', error?.message || error);
    }

    if (typeof openLogin === 'function') openLogin();
    else document.getElementById('loginModal')?.classList.add('show');
    if (typeof showToast === 'function') showToast('Please log in once to continue your chat.');
    return null;
  }

  function installOpenChatGuard() {
    const original = window.openChat;
    if (typeof original !== 'function' || original.__ceAuthSessionWrapped) return false;

    const wrapped = async function (...args) {
      const user = await requireSession();
      if (!user) return false;
      return original.apply(this, args);
    };
    wrapped.__ceAuthSessionWrapped = true;
    wrapped.__ceAuthSessionOriginal = original;
    window.openChat = wrapped;
    return true;
  }

  const client = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  client?.auth?.onAuthStateChange?.((_event, session) => {
    setCurrentUser(session?.user || null);
    if (session?.user) {
      document.getElementById('loginModal')?.classList.remove('show');
      setTimeout(() => resolveSession({ loadProfile: true }).catch(() => null), 0);
    }
  });

  const installTimer = setInterval(() => {
    if (installOpenChatGuard()) clearInterval(installTimer);
  }, 50);
  setTimeout(() => clearInterval(installTimer), 10000);

  window.ChatEarnAuthSessionDiagnostic = async () => {
    let sessionUser = null;
    let error = null;
    try { sessionUser = await resolveSession({ loadProfile: false }); }
    catch (e) { error = e?.message || String(e); }
    let pageUser = null;
    try { pageUser = currentUser || null; } catch (_) {}
    return {
      version: VERSION,
      sessionUserId: sessionUser?.id || null,
      pageUserId: pageUser?.id || null,
      synchronized: Boolean(sessionUser?.id && sessionUser.id === pageUser?.id),
      openChatGuardInstalled: Boolean(window.openChat?.__ceAuthSessionWrapped),
      error
    };
  };

  resolveSession({ loadProfile: false }).catch(() => null);
  console.info(`[ChatEarn] Auth/session bridge ${VERSION} loaded`);
})();