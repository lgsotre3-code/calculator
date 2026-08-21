/**
 * currencies.js — Multi-currency support (independent of language)
 * ----------------------------------------------------------------
 * Provides dynamic currency formatting for all calculators.
 * Persists the active currency in localStorage; defaults to USD.
 *
 * Usage:
 *   window.Currency.format(v)   → "$123,456.78" (2 decimals)
 *   window.Currency.format0(v)  → "$123,456"    (0 decimals)
 *   window.Currency.compact(v)  → "$1.2M" / "$123k" / "$42"
 *   window.Currency.symbol()    → "$"
 *   window.Currency.getActive() → "USD"
 *
 * Dispatches 'currency:changed' on document when the user switches.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'mortgage_currency';
  var DEFAULT = 'USD';

  var CURRENCIES = {
    USD: { code: 'USD', symbol: '$' },
    EUR: { code: 'EUR', symbol: '\u20AC' },
    BRL: { code: 'BRL', symbol: 'R$' },
    GBP: { code: 'GBP', symbol: '\u00A3' }
  };

  /* Language → Intl locale for number separators (thousands, decimal). */
  var LANG_LOCALE = {
    en: 'en-US', pt: 'pt-BR', es: 'es-ES', fr: 'fr-FR', de: 'de-DE'
  };

  function fmtLocale() {
    var lang = (window.i18n && window.i18n.currentLang) || 'en';
    return LANG_LOCALE[lang] || 'en-US';
  }

  var active = DEFAULT;
  var fmt, fmt0;

  function rebuild() {
    var c = CURRENCIES[active] || CURRENCIES[DEFAULT];
    var loc = fmtLocale();
    fmt  = new Intl.NumberFormat(loc, { style: 'currency', currency: c.code, minimumFractionDigits: 2 });
    fmt0 = new Intl.NumberFormat(loc, { style: 'currency', currency: c.code, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function load() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s && CURRENCIES[s]) active = s;
    } catch (e) { /* ignore */ }
    rebuild();
  }

  function save(code) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* ignore */ }
  }

  function dispatch() {
    document.dispatchEvent(new CustomEvent('currency:changed', { detail: { code: active } }));
  }

  /* ---------- public API ---------- */

  var Currency = {
    init: function () {
      load();
      var sel = document.getElementById('currency-select');
      if (sel) {
        sel.value = active;
        sel.addEventListener('change', function () {
          var code = this.value;
          if (!CURRENCIES[code]) return;
          active = code;
          rebuild();
          save(code);
          dispatch();
        });
      }
      /* Rebuild formatters when language changes (number separators follow UI language). */
      document.addEventListener('i18n:updated', function () {
        rebuild();
        dispatch();
      });
    },

    getActive: function () { return active; },

    setActive: function (code) {
      if (!CURRENCIES[code]) return;
      active = code;
      rebuild();
      save(code);
      dispatch();
    },

    format:  function (v) { return fmt.format(v); },
    format0: function (v) { return fmt0.format(v); },

    compact: function (v) {
      var loc = fmtLocale();
      var opts = { notation: 'compact', compactDisplay: 'short', style: 'currency', currency: (CURRENCIES[active] || CURRENCIES[DEFAULT]).code, maximumFractionDigits: 1 };
      try { return new Intl.NumberFormat(loc, opts).format(v); } catch (e) { return '$' + v.toFixed(0); }
    },

    symbol: function () {
      return CURRENCIES[active] ? CURRENCIES[active].symbol : '$';
    }
  };

  window.Currency = Currency;

  /* Auto-init on DOMContentLoaded (defer scripts run before it fires). */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Currency.init(); });
  } else {
    Currency.init();
  }
})();
