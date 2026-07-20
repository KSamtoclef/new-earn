(() => {
  'use strict';
  const files = [
    './assets/js/auth.js?v=2',
    './assets/js/chat.js?v=2',
    './assets/js/rewards.js?v=2',
    './assets/js/withdrawal.js?v=2',
    './assets/js/content.js?v=2',
    './assets/js/admin.js?v=2'
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
    window.dispatchEvent(new Event('DOMContentLoaded'));
  })().catch(error => console.error('[ChatEarn]', error));
})();