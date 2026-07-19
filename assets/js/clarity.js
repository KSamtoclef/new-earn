/* ChatEarn canonical Supabase bootstrap. Runs before deferred application modules. */
(() => {
  'use strict';

  const LEGACY_PROJECT = 'dtjxcgzpwemdgdeinkcl';
  const CONFIG_SOURCE = './assets/js/chatearn-module7-admin.js?v=8.1.0';

  function readCanonicalConfig() {
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && !String(window.SUPABASE_URL).includes(LEGACY_PROJECT)) {
      return { url: window.SUPABASE_URL, key: window.SUPABASE_ANON_KEY };
    }

    try {
      const request = new XMLHttpRequest();
      request.open('GET', CONFIG_SOURCE, false);
      request.send(null);
      if (request.status < 200 || request.status >= 300) return null;

      const source = request.responseText || '';
      const urlMatch = source.match(/window\.SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
      const keyMatch = source.match(/window\.SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
      if (!urlMatch || !keyMatch) return null;

      return { url: urlMatch[1], key: keyMatch[1] };
    } catch (error) {
      console.warn('[ChatEarn] Canonical Supabase config could not be loaded:', error?.message || error);
      return null;
    }
  }

  const config = readCanonicalConfig();
  if (config) {
    window.CHATEARN_CONFIG = Object.freeze({
      supabaseUrl: config.url,
      supabaseAnonKey: config.key,
      projectRef: new URL(config.url).hostname.split('.')[0]
    });
    window.SUPABASE_URL = config.url;
    window.SUPABASE_ANON_KEY = config.key;
  }

  if (config && window.supabase?.createClient && !window.supabase.createClient.__ceCanonicalWrapped) {
    const originalCreateClient = window.supabase.createClient.bind(window.supabase);
    const wrappedCreateClient = (url, key, options) => {
      const requestedUrl = String(url || '');
      const useCanonical = !requestedUrl || requestedUrl.includes(LEGACY_PROJECT) || requestedUrl === config.url;
      return originalCreateClient(
        useCanonical ? config.url : url,
        useCanonical ? config.key : key,
        options
      );
    };
    wrappedCreateClient.__ceCanonicalWrapped = true;
    window.supabase.createClient = wrappedCreateClient;
  }

  window.ChatEarnSupabaseDiagnostic = () => ({
    projectRef: window.CHATEARN_CONFIG?.projectRef || null,
    canonical: Boolean(config)
  });
})();

/* Microsoft Clarity */
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, 'clarity', 'script', 'xeogna7gvf');
