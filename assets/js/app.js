(() => {
  'use strict';
  const client = window.ChatEarn?.client;
  const screens = [...document.querySelectorAll('.screen')];
  const toast = document.getElementById('toast');
  let toastTimer = 0;

  function show(screenId) {
    screens.forEach(screen => screen.classList.toggle('active', screen.id === screenId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function notify(message, error = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = error ? 'show error' : 'show';
    toastTimer = window.setTimeout(() => { toast.className = ''; }, 3200);
  }

  function setBusy(button, busy, busyText, readyText) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? busyText : readyText;
  }

  const money = value => `₦${Number(value || 0).toLocaleString('en-NG')}`;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function loadProfile(user, retries = 5) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const { data, error } = await client
        .from('profiles')
        .select('user_id,display_name,balance,chats')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!error && data) return data;
      lastError = error || new Error('Your profile is still being prepared.');
      if (attempt < retries) await sleep(350 + attempt * 400);
    }
    throw lastError;
  }

  function renderProfile(user, profile) {
    const displayName = profile.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    document.getElementById('userName').textContent = displayName.split(' ')[0];
    document.getElementById('balance').textContent = money(profile.balance);
    document.getElementById('chatCount').textContent = Number(profile.chats || 0).toLocaleString('en-NG');
    document.getElementById('accountStatus').textContent = 'Active';
  }

  async function enterAccount(user) {
    show('loading');
    document.getElementById('loadingText').textContent = 'Loading your real account balance…';
    try {
      const profile = await loadProfile(user);
      renderProfile(user, profile);
      show('dashboard');
    } catch (error) {
      show('landing');
      notify(error?.message || 'Unable to load your account.', true);
    }
  }

  async function register(event) {
    event.preventDefault();
    const button = document.getElementById('registerButton');
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    if (!name || !email || password.length < 6) return notify('Complete all fields correctly.', true);
    setBusy(button, true, 'Creating account…', 'Create account');
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      });
      if (error) throw error;
      let session = data.session;
      if (!session) {
        const login = await client.auth.signInWithPassword({ email, password });
        if (login.error) throw new Error('Account created. Confirm the email or enable automatic sign-in in Supabase Auth.');
        session = login.data.session;
      }
      if (!session?.user) throw new Error('No active session was created.');
      await enterAccount(session.user);
    } catch (error) {
      notify(error?.message || 'Registration failed.', true);
    } finally {
      setBusy(button, false, 'Creating account…', 'Create account');
    }
  }

  async function login(event) {
    event.preventDefault();
    const button = document.getElementById('loginButton');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    setBusy(button, true, 'Logging in…', 'Log in');
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session?.user) throw new Error('Login completed without an active session.');
      await enterAccount(data.session.user);
    } catch (error) {
      notify(error?.message || 'Login failed.', true);
    } finally {
      setBusy(button, false, 'Logging in…', 'Log in');
    }
  }

  async function logout() {
    const button = document.getElementById('logoutButton');
    button.disabled = true;
    try {
      await client.auth.signOut();
      show('landing');
      notify('Logged out successfully.');
    } finally {
      button.disabled = false;
    }
  }

  async function boot() {
    if (!client) {
      notify('Secure connection failed to initialize.', true);
      return;
    }
    document.querySelectorAll('[data-open]').forEach(button => {
      button.addEventListener('click', () => show(button.dataset.open));
    });
    document.getElementById('registerForm').addEventListener('submit', register);
    document.getElementById('loginForm').addEventListener('submit', login);
    document.getElementById('logoutButton').addEventListener('click', logout);

    const { data, error } = await client.auth.getSession();
    if (error) return notify(error.message, true);
    if (data.session?.user) await enterAccount(data.session.user);
    else show('landing');

    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') show('landing');
      if (event === 'TOKEN_REFRESHED' && session?.user) renderProfile;
    });
  }

  window.addEventListener('DOMContentLoaded', boot, { once: true });
})();