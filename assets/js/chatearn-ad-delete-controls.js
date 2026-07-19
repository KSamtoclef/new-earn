(() => {
  'use strict';
  if (window.__CE_AD_DELETE_CONTROLS__) return;
  window.__CE_AD_DELETE_CONTROLS__ = true;

  async function removeOffer(key) {
    const client = window.ceAdminClient;
    if (!client?.rpc) throw new Error('Admin connection is not ready.');
    const { error } = await client.rpc('chatearn_v6_admin_offer_action', {
      p_offer_key: key,
      p_action: 'delete'
    });
    if (error) throw error;
  }

  function upgrade() {
    document.querySelectorAll('#ceAdsList [data-archive]').forEach(button => {
      button.textContent = 'Delete';
      button.dataset.deleteOffer = button.dataset.archive;
      button.removeAttribute('data-archive');
    });
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest?.('[data-delete-offer]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!confirm('Delete this sponsored advert? It will stop appearing immediately.')) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Deleting…';
    try {
      await removeOffer(button.dataset.deleteOffer);
      await window.refreshAdmin?.();
      setTimeout(upgrade, 100);
    } catch (error) {
      const box = document.getElementById('adminError');
      if (box) {
        box.textContent = error.message || String(error);
        box.style.display = 'block';
      }
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }, true);

  new MutationObserver(upgrade).observe(document.documentElement, { childList: true, subtree: true });
  upgrade();
})();
