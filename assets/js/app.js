(() => {
  'use strict';
  const files = [
    './assets/js/auth.js?v=1',
    './assets/js/chat.js?v=1'
  ];
  async function load(src) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }
  (async () => {
    for (const src of files) await load(src);
    if (document.readyState !== 'loading') document.dispatchEvent(new Event('DOMContentLoaded'));
  })().catch(error => console.error('[ChatEarn]', error));
})();