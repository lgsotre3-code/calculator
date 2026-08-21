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

  var active = DEFAULT;
  var fmt, fmt0;

  function rebuild() {
    var c = CURRENCIES[active] || CURRENCIES[DEFAULT];
    fmt  = new Intl.NumberFormat('en-US', { style: 'currency', currency: c.code, minimumFractionDigits: 2 });
    fmt0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: c.code, minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
      var sym = CURRENCIES[active] ? CURRENCIES[active].symbol : '$';
      var abs = Math.abs(v);
      if (abs >= 1e6)  return sym + (v / 1e6).toFixed(1) + 'M';
      if (abs >= 1e3)  return sym + (v / 1e3).toFixed(0) + 'k';
      return sym + Math.round(v);
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
