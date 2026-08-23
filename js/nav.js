/**
 * nav.js — Responsive navigation toggle (hamburger menu)
 * -----------------------------------------------------
 * Adds accessible open/close behaviour to the header <button class="menu-toggle">
 * that controls <nav class="main-nav"> on screens narrower than 768px.
 *
 * Behaviour:
 *   • Clicking the toggle adds/removes .active on the <nav> and toggles
 *     aria-expanded on the button (used by CSS to draw the X icon).
 *   • Pressing Escape closes the menu and returns focus to the toggle.
 *   • Clicking a link (or tapping outside the header) closes the menu.
 *
 * Load this file after the header markup on every page.
 */
(function () {
  'use strict';

  function init() {
    var toggle = document.querySelector('.menu-toggle');
    var nav = document.querySelector('.main-nav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      nav.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open
        ? (toggle.getAttribute('data-label-close') || 'Close menu')
        : (toggle.getAttribute('data-label-open') || 'Open menu'));
    }

    toggle.addEventListener('click', function () {
      setOpen(nav.classList.contains('active') ? false : true);
    });

    // Close on Escape and return focus to the toggle.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('active')) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Close after navigating to any link inside the menu.
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });

    // Close when tapping outside the header (on touch devices).
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('active') && !e.target.closest('.site-header')) {
        setOpen(false);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(function () {
  'use strict';
  try {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      var manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.json';
      document.head.appendChild(manifestLink);

      var promoScript = document.createElement('script');
      promoScript.src = '/js/install-promo.js';
      promoScript.defer = true;
      document.head.appendChild(promoScript);

      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
      });
    }
  } catch (pwaError) {}
})();
