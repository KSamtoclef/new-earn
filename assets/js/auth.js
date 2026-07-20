(() => {
  'use strict';
  if (window.__CHAT_EARN_AUTH_ONLY__) return;
  window.__CHAT_EARN_AUTH_ONLY__ = true;

  const client = window.ChatEarn?.client;
  let toastTimer = 0;

  function show(id) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.toggle('active', screen.id === id);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function notify(message, error = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = error ? 'show error' : 'show';
    toastTimer = setTimeout(() => { toast.className = ''; }, 3200);
  }

  function setBusy(button, busy, busyText, readyText) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? busyText : readyText;
  }

  function enterApp(user) {
    const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const firstName = name.trim().split(/\s+/)[0] || 'User';
    document.getElementById('userName').textContent = firstName;
    document.body.dataset.userId = user.id;
    show('dashboard');
    window.dispatchEvent(new CustomEvent('chatearn:user-ready', { detail: { user } }));
  }

  async function register(event) {
    event.preventDefault();
    const button = document.getElementById('registerButton');
    const fullName = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!fullName || !email || password.length < 6) {
      notify('Complete all fields correctly.', true);
      return;
    }

    setBusy(button, true, 'Creating account…', 'Create account');
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });
      if (error) throw error;

      if (data.session?.user) {
        enterApp(data.session.user);
        notify('Account created successfully.');
        return;
      }

      notify('Account created. Check your email to confirm, then log in.');
      show('login');
      document.getElementById('loginEmail').value = email;
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
      if (!data.session?.user) throw new Error('No active session was created.');
      enterApp(data.session.user);
      notify('Welcome back.');
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
      document.body.removeAttribute('data-user-id');
      show('landing');
      notify('Logged out successfully.');
    } finally {
      button.disabled = false;
    }
  }

  async function boot() {
    if (!client) {
      notify('Authentication failed to initialize.', true);
      return;
    }

    document.querySelectorAll('[data-open]').forEach(button => {
      button.addEventListener('click', () => show(button.dataset.open));
    });
    document.getElementById('registerForm')?.addEventListener('submit', register);
    document.getElementById('loginForm')?.addEventListener('submit', login);
    document.getElementById('logoutButton')?.addEventListener('click', logout);

    const { data, error } = await client.auth.getSession();
    if (error) {
      notify(error.message, true);
      show('landing');
      return;
    }

    if (data.session?.user) enterApp(data.session.user);
    else show('landing');
  }

  window.addEventListener('chatearn:ready', boot, { once: true });
})();