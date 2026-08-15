/**
 * analytics.js — Google Analytics 4 + Google Tag Manager + sharing
 * -----------------------------------------------------------------
 * Setup status:
 *   - AdSense client: configured in HTML head (ca-pub-2920008879492175).
 *   - GA4: load the gtag.js loader in the HTML <head> and uncomment the
 *     gtag('config', 'G-XXXXXXXXXX') call there, then this file fires events.
 *   - GTM: optional, also loaded in the HTML <head>.
 *
 * The gtag() helper is defined here as a safe no-op when the real loader
 * script (in index.html) has not loaded yet.
 */
(function () {
  'use strict';

  // --- GA4: ensure dataLayer + gtag exist even before the loader loads ---
  // NOTE: the gtag() config for your Measurement ID already runs in index.html
  // <head>. This file only guarantees the helpers exist and fires events.
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  // --- Social share buttons -------------------------------------------------
  // Buttons carry data-share="facebook|twitter|linkedin|whatsapp" and a
  // data-share-url override (falls back to window.location.href).
  function share(platform) {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    const base = {
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + url,
      twitter: 'https://twitter.com/intent/tweet?text=' + title + '&url=' + url,
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + url,
      whatsapp: 'https://api.whatsapp.com/send?text=' + title + '%20' + url
    }[platform];
    if (base) window.open(base, '_blank', 'noopener,width=620,height=480');
    window.dataLayer.push({ event: 'social_share', platform: platform });
  }

  function initShareButtons() {
    document.querySelectorAll('[data-share]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        share(btn.getAttribute('data-share'));
      });
    });
  }

  // --- Affiliate / CTA clicks ----------------------------------------------
  function trackCta() {
    document.querySelectorAll('[data-cta]').forEach((link) => {
      link.addEventListener('click', () => {
        window.dataLayer.push({ event: 'affiliate_click', cta: link.getAttribute('data-cta') });
      });
    });
  }

  // --- Page load event -------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    initShareButtons();
    trackCta();
    window.dataLayer.push({ event: 'page_view', page: window.location.pathname });
  });
})();
