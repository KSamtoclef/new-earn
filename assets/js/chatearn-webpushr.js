/*
 ChatEarn V4.3 — Webpushr integration
 - Loads Webpushr using the public site key.
 - Tracks native permission decisions.
 - Fetches and stores the Webpushr subscriber ID in Supabase.
 - Adds safe browser-specific custom attributes for targeting.
 - Does not expose REST API credentials.
*/
(() => {
  'use strict';

  if (window.__CHAT_EARN_WEBPUSHR__) return;
  window.__CHAT_EARN_WEBPUSHR__ = true;

  const WEBPUSHR_SITE_KEY = "BH_DnurzuaZJGB9IXocgQIXTmXzwZk4Ub7t649HoFloUdkF3klv-xCmFbQmelHKDs-u3lhazP2tJF7lnopTzP98";
  const VISITOR_ID = localStorage.getItem('ce_visitor_id') || '';
  const PAGE = () => (location.hash || '#landing').replace(/^#/, '') || 'landing';

  function safeTrack(eventName, metadata = {}) {
    try {
      if (typeof window.trackEvent === 'function') {
        window.trackEvent(eventName, metadata);
      }
    } catch (_) {}
  }

  function detectDevice() {
    const ua = navigator.userAgent || '';
    if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function detectBrowser() {
    const ua = navigator.userAgent || '';
    if (/edg/i.test(ua)) return 'edge';
    if (/opr|opera/i.test(ua)) return 'opera';
    if (/firefox|fxios/i.test(ua)) return 'firefox';
    if (/chrome|crios/i.test(ua)) return 'chrome';
    if (/safari/i.test(ua)) return 'safari';
    return 'other';
  }

  async function getCurrentUserId() {
    try {
      if (!window.supabaseClient?.auth?.getUser) return null;
      const { data } = await window.supabaseClient.auth.getUser();
      return data?.user?.id || null;
    } catch (_) {
      return null;
    }
  }

  async function saveSubscriber(sid) {
    if (!sid || !window.supabaseClient?.rpc) return;

    const userId = await getCurrentUserId();
    const permission =
      typeof Notification === 'undefined'
        ? 'unsupported'
        : Notification.permission;

    try {
      await window.supabaseClient.rpc('chatearn_v4_webpush_upsert', {
        p_subscriber_id: String(sid).slice(0, 180),
        p_visitor_id: VISITOR_ID || null,
        p_permission_status: permission,
        p_browser: detectBrowser(),
        p_device: detectDevice(),
        p_source_page: PAGE(),
        p_metadata: {
          user_id_hint: userId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
          language: navigator.language || null
        }
      });
    } catch (error) {
      safeTrack('webpushr_sync_error', {
        message: String(error?.message || error).slice(0, 180)
      });
    }
  }

  async function applyAttributes() {
    if (typeof window.webpushr !== 'function') return;

    const userId = await getCurrentUserId();
    const attributes = {
      visitor_id: VISITOR_ID || 'unknown',
      user_id: userId || 'anonymous',
      source_page: PAGE(),
      device: detectDevice(),
      browser: detectBrowser()
    };

    try {
      window.webpushr('attributes', attributes);
    } catch (_) {}

    try {
      window.webpushr('fetch_id', sid => {
        if (!sid) return;
        safeTrack('webpushr_subscriber_ready', {
          subscriber_id_suffix: String(sid).slice(-8),
          permission:
            typeof Notification === 'undefined'
              ? 'unsupported'
              : Notification.permission
        });
        saveSubscriber(sid);
      });
    } catch (_) {}
  }

  // Called by Webpushr after its SDK is ready.
  window._webpushrScriptReady = function () {
    applyAttributes();
  };

  // Called by Webpushr when the native browser prompt is accepted or denied.
  window.webpushrPermissionAction = function (permissionAction) {
    safeTrack('webpushr_permission', {
      permission: permissionAction,
      page: PAGE()
    });

    // fetch_id is available only after a successful subscription.
    if (permissionAction === 'granted') {
      setTimeout(applyAttributes, 800);
    }
  };

  // Official Webpushr SDK loader.
  if (typeof window.webpushr === 'undefined') {
    window.webpushr = function () {
      (window.webpushr.q = window.webpushr.q || []).push(arguments);
    };
  }

  const script = document.createElement('script');
  script.id = 'webpushr-jssdk';
  script.async = true;
  script.src = 'https://cdn.webpushr.com/app.min.js';
  script.onload = () => safeTrack('webpushr_sdk_loaded', { page: PAGE() });
  script.onerror = () => safeTrack('webpushr_sdk_error', { page: PAGE() });
  document.head.appendChild(script);

  window.webpushr('setup', { key: WEBPUSHR_SITE_KEY });

  // Refresh browser-specific attributes after login/navigation.
  window.addEventListener('hashchange', () => {
    setTimeout(applyAttributes, 500);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      setTimeout(applyAttributes, 500);
    }
  });
})();
