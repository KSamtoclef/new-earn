(() => {
  'use strict';
  const url = 'https://cqnovqvmxwmfngupgtov.supabase.co';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbm92cXZteHdtZm5ndXBndG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyODA0NzQsImV4cCI6MjA5OTg1NjQ3NH0.ZamXPTmqVsdHu1pD1EZLxPeSqWemBsj28Y1f-NOCEZs';
  if (!window.supabase?.createClient) throw new Error('Supabase library failed to load.');
  window.ChatEarn = Object.freeze({
    projectRef: 'cqnovqvmxwmfngupgtov',
    client: window.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'chatearn-auth-v1'
      }
    })
  });
  const chat = document.createElement('script');
  chat.src = './assets/js/chat.js?v=1';
  chat.defer = true;
  document.head.appendChild(chat);
})();