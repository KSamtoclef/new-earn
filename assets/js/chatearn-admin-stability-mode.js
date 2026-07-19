/* ChatEarn admin stability mode v1.1.0 */
(() => {
  'use strict';
  if (window.__CHAT_EARN_ADMIN_STABILITY_MODE__) return;
  window.__CHAT_EARN_ADMIN_STABILITY_MODE__ = true;

  const HIDE_TEXT = [
    'verified counting:',
    'simple meaning:',
    'period performance:',
    'loading genuine sponsored-ad activity'
  ];

  function normalise(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function clearStaleErrors() {
    const error = document.getElementById('adminError');
    if (!error) return;
    const text = String(error.textContent || '');
    if (/panel\('overview'\)|null is not an object/i.test(text)) {
      error.textContent = '';
      error.style.display = 'none';
    }
  }

  function cleanCopy() {
    clearStaleErrors();
    const root = document.getElementById('adminContent');
    if (!root) return;

    root.querySelectorAll('p,div,section').forEach(node => {
      if (node.children.length > 8) return;
      const text = normalise(node.textContent);
      if (HIDE_TEXT.some(prefix => text.startsWith(prefix))) {
        node.hidden = true;
        node.dataset.ceRemovedCopy = '1';
      }
    });

    root.querySelectorAll('h1,h2,h3').forEach(node => {
      const text = normalise(node.textContent);
      if (text === 'offer engagement quality') node.textContent = 'Sponsored Ad Performance';
      if (text === 'active & paused offers') node.textContent = 'Sponsored Ads';
      if (text === 'active & paused tasks') node.textContent = 'Tasks';
    });
  }

  let timer = 0;
  function scheduleClean() {
    clearTimeout(timer);
    timer = window.setTimeout(cleanCopy, 120);
  }

  const content = document.getElementById('adminContent');
  if (content) {
    new MutationObserver(scheduleClean).observe(content, {
      childList: true,
      subtree: true
    });
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#adminTabs,[data-ce6-tab],.admin-tab')) scheduleClean();
  });

  const style = document.createElement('style');
  style.textContent = `
    #adminContent [data-ce-removed-copy="1"]{display:none!important}
    #adminContent .ce6-manager-note{display:none!important}
    #adminContent .admin-status-banner{font-size:13px;line-height:1.45;padding:12px 14px}
    #adminContent h2{letter-spacing:-.02em}
    #adminContent .admin-empty{padding:20px;text-align:center}
    #adminContent form{scroll-margin-top:130px}
  `;
  document.head.appendChild(style);

  cleanCopy();
})();
