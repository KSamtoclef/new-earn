(() => {
  'use strict';
  const files = [
    './assets/js/auth.js?v=10',
    './assets/js/chat.js?v=10'
  ];

  function load(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function boot() {
    for (const src of files) await load(src);
    window.dispatchEvent(new CustomEvent('chatearn:ready'));
  }

  boot().catch(error => console.error('[ChatEarn]', error));
})();