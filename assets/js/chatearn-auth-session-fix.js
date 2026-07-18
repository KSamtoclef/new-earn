/* ChatEarn Module 8F: stable auth/session controller. */
(() => {
  'use strict';
  if (window.__CHAT_EARN_AUTH_SESSION_STABLE__) return;
  window.__CHAT_EARN_AUTH_SESSION_STABLE__ = true;

  const VERSION = '8.1.0';
  let lastUser = null;
  let resolving = null;
  let lastCheckedAt = 0;
  let installed = false;

  const client = () => {
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient?.auth) return supabaseClient; } catch (_) {}
    return window.supabaseClient?.auth ? window.supabaseClient : null;
  };
  const modal = () => document.getElementById('loginModal');
  const hideLogin = () => modal()?.classList.remove('show');
  const showLogin = () => modal()?.classList.add('show');

  function syncUser(user) {
    if (!user) return lastUser;
    lastUser = user;
    try { currentUser = user; } catch (_) {}
    hideLogin();
    return user;
  }

  async function getVerifiedSession(loadAccount = false, force = false) {
    if (!force && lastUser && Date.now() - lastCheckedAt < 10000) return { user:lastUser };
    if (resolving) return resolving;
    resolving = (async () => {
      const supa = client();
      if (!supa) return lastUser ? { user:lastUser } : null;
      const { data, error } = await supa.auth.getSession();
      if (error) throw error;
      lastCheckedAt = Date.now();
      const session = data?.session || null;
      if (session?.user) syncUser(session.user);
      if (session?.user && loadAccount && typeof loadProfile === 'function') {
        try { await loadProfile({ force:true, retries:2 }); } catch (_) {}
      }
      return session || (lastUser ? { user:lastUser } : null);
    })().finally(() => { resolving = null; });
    return resolving;
  }

  async function requireUser() {
    try {
      const session = await getVerifiedSession(false, false);
      if (session?.user || lastUser) return syncUser(session?.user || lastUser);
      const forced = await getVerifiedSession(false, true);
      if (forced?.user) return syncUser(forced.user);
    } catch (error) {
      console.warn('[ChatEarn] Session check delayed:', error?.message || error);
      if (lastUser) return lastUser;
    }
    showLogin();
    window.showToast?.('Please log in to continue.');
    return null;
  }

  async function verifiedRegister() {
    const supa = client();
    const name = document.getElementById('regName')?.value.trim() || '';
    const email = document.getElementById('regEmail')?.value.trim() || '';
    const password = document.getElementById('regPass')?.value || '';
    const button = document.getElementById('regSubmitBtn');
    if (!supa) return window.showToast?.('Secure connection is loading. Try again.');
    if (!name) return window.showToast?.('⚠️ Enter your full name');
    if (!/^\S+@\S+\.\S+$/.test(email)) return window.showToast?.('⚠️ Enter a valid email');
    if (password.length < 6) return window.showToast?.('⚠️ Password must be at least 6 characters');
    if (button) { button.disabled=true; button.textContent='Creating account…'; }
    try {
      const signup = await supa.auth.signUp({ email,password,options:{data:{full_name:name}} });
      if (signup.error) throw signup.error;
      let session = signup.data?.session;
      if (!session) {
        const login = await supa.auth.signInWithPassword({ email,password });
        if (login.error) throw login.error;
        session = login.data?.session;
      }
      if (!session?.user) throw new Error('No active login session was created.');
      syncUser(session.user);
      try { userName=(session.user.user_metadata?.full_name||name).split(' ')[0]; } catch (_) {}
      goScreen?.('loading');
      const profilePromise=typeof loadProfile==='function'?loadProfile({force:true,retries:3}).catch(()=>null):Promise.resolve(null);
      runLoadingSequence?.(profilePromise);
      window.trackEvent?.('registration_success');
    } catch (error) {
      window.showToast?.(`⚠️ ${error.message}`);
      if (typeof currentScreen!=='undefined'&&currentScreen==='loading') goScreen?.('register');
    } finally { if (button) { button.disabled=false; button.textContent='Create Account & Get ₦10,000 →'; } }
  }

  async function verifiedLogin() {
    const supa=client();
    const email=document.getElementById('loginEmail')?.value.trim()||'';
    const password=document.getElementById('loginPass')?.value||'';
    const button=document.getElementById('loginBtn');
    const errorNode=document.getElementById('loginError');
    errorNode?.classList.remove('show');
    if (!supa) return window.showToast?.('Secure connection is loading. Try again.');
    if (!/^\S+@\S+\.\S+$/.test(email)||!password) return;
    if (button) { button.disabled=true; button.textContent='Logging in…'; }
    try {
      const login=await supa.auth.signInWithPassword({email,password});
      if (login.error) throw login.error;
      if (!login.data?.session?.user) throw new Error('Login completed without an active session.');
      syncUser(login.data.session.user);
      hideLogin();
      goScreen?.('dashboard');
      if (typeof loadProfile==='function') loadProfile({force:true,retries:2}).then(()=>updateBalance?.()).catch(()=>null);
    } catch (error) {
      if (errorNode) { errorNode.textContent=error.message||'Unable to log in.'; errorNode.classList.add('show'); }
    } finally { if (button) { button.disabled=false; button.textContent='Log In & Continue →'; } }
  }

  function wrapProtected(name) {
    const original=window[name];
    if (typeof original!=='function'||original.__ceStableAuthWrapped) return;
    const wrapped=async function(...args){const user=await requireUser();if(!user)return false;return original.apply(this,args)};
    wrapped.__ceStableAuthWrapped=true;
    wrapped.__ceStableAuthOriginal=original;
    window[name]=wrapped;
  }

  function install() {
    window.doRegister=verifiedRegister;
    window.doLogin=verifiedLogin;
    wrapProtected('openChat');
    wrapProtected('sendMsg');
    installed=true;
  }

  function boot() {
    install();
    const supa=client();
    supa?.auth?.onAuthStateChange?.((event,session)=>{
      lastCheckedAt=Date.now();
      if (session?.user) syncUser(session.user);
      else if (event==='SIGNED_OUT') {
        lastUser=null;
        try { currentUser=null; } catch (_) {}
      }
    });
    getVerifiedSession(false,true).catch(()=>null);
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.addEventListener('pageshow',()=>getVerifiedSession(false,false).catch(()=>null));
  window.ChatEarnAuthSessionDiagnostic=async()=>({version:VERSION,installed,lastUserId:lastUser?.id||null,session:(await getVerifiedSession(false,true).catch(()=>null))?.user?.id||null});
  console.info(`[ChatEarn] Stable auth/session controller ${VERSION} loaded`);
})();