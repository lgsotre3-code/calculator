/**
 * scenario-url.js — Shareable scenario links
 * -------------------------------------------
 * Keeps the calculator inputs mirrored in the query string so users can
 * copy/share/bookmark a fully-filled scenario (?h=450000&d=15&r=6.5&...).
 *
 * - Applies URL params on load (reuses the native input events, so all
 *   slider syncing / clamping / recalculation logic stays in one place).
 * - Updates the address bar silently (history.replaceState — no reload,
 *   no extra history entries).
 * - Powers the "Copy share link" button.
 *
 * Loaded ONLY on the main calculator page; every element access is
 * guarded, so it degrades to a no-op if markup changes.
 */
(function () {
  'use strict';

  // element id -> short query key (stable contract; do not rename keys)
  var FIELDS = [
    { id: 'mortgage-country',      key: 'c' },
    { id: 'mortgage-us-state',     key: 's' },
    { id: 'home-value',            key: 'h' },
    { id: 'down-payment-slider',   key: 'd' },
    { id: 'interest-rate',         key: 'r' },
    { id: 'loan-term',             key: 't' },
    { id: 'payment-frequency',     key: 'f' },
    { id: 'start-date',            key: 'sd' },
    { id: 'property-tax',          key: 'x' },
    { id: 'insurance',             key: 'i' },
    { id: 'extra-payment',         key: 'e' },
    { id: 'amortization-system',   key: 'a' }
  ];

  function el(id) { return document.getElementById(id); }

  function setValue(input, value) {
    var proto = input instanceof HTMLSelectElement
      ? window.HTMLSelectElement && window.HTMLSelectElement.prototype
      : window.HTMLInputElement && window.HTMLInputElement.prototype;
    var desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) {
      desc.set.call(input, String(value));
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function buildQuery() {
    var parts = [];
    FIELDS.forEach(function (f) {
      var node = el(f.id);
      if (!node || node.value === '' || node.value == null) return;
      if (f.id === 'mortgage-country' && node.value === 'custom') return;
      parts.push(encodeURIComponent(f.key) + '=' + encodeURIComponent(node.value));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function updateUrl() {
    try {
      var q = buildQuery();
      var next = location.pathname + q;
      if (q !== location.search) history.replaceState(null, '', next);
    } catch (e) { /* sandboxed contexts */ }
  }

  function applyParams() {
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }
    if (!params || ![...params.keys()].length) return;

    // Fixed order: region presets first, then numeric fields.
    FIELDS.forEach(function (f) {
      var raw = params.get(f.key);
      var node = el(f.id);
      if (!node || raw === null || raw === '') return;
      setValue(node, raw);
    });
  }

  function bindCopyButton() {
    var btn = el('copy-share-link');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var t = (window.i18n && window.i18n.t) ? window.i18n.t.bind(window.i18n) : function (k) { return k; };
      var label = btn.querySelector('span');
      var original = label ? label.textContent : '';
      var done = function () {
        if (label) label.textContent = t('link_copied');
        setTimeout(function () { if (label) label.textContent = original; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(location.href).then(done, function () { legacyCopy(done); });
      } else {
        legacyCopy(done);
      }
    });
  }

  function legacyCopy(done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = location.href;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch (e) { /* clipboard unavailable */ }
  }

  function init() {
    applyParams();
    bindCopyButton();

    var form = document.querySelector('.calculator') || document.querySelector('.calculator-wrapper');
    if (!form) return;
    var timer = null;
    var handler = function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(updateUrl, 500);
    };
    form.addEventListener('input', handler);
    form.addEventListener('change', handler);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
