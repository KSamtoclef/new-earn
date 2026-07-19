/* ChatEarn landing-page cleanup. */
(() => {
  'use strict';
  const removePayoutCounter = () => {
    const counter = document.querySelector('.live-counter');
    if (counter) counter.remove();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removePayoutCounter, { once: true });
  } else {
    removePayoutCounter();
  }
})();
