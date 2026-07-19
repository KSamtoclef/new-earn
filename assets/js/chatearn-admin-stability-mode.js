/* ChatEarn admin stability mode v1.0.0 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_ADMIN_STABILITY_MODE__) return;
  window.__CHAT_EARN_ADMIN_STABILITY_MODE__ = true;

  function clearStaleErrors() {
    const error = document.getElementById('adminError');
    if (!error) return;
    const text = String(error.textContent || '');
    if (/panel\('overview'\)|null is not an object/i.test(text)) {
      error.textContent = '';
      error.style.display = 'none';
    }
  }

  new MutationObserver(clearStaleErrors).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  clearStaleErrors();
})();
