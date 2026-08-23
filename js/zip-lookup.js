/**
 * zip-lookup.js — Auto-fill Property Tax & Home Insurance from ZIP / CEP.
 *
 * Brazil:  BrasilAPI  (free, no key)
 * USA:     Census ACS (free) → fallback state mapping
 *
 * Architecture: standalone IIFE, attaches window.ZipLookup.
 * Called by calculator.js when the user clicks "Fetch data" or on debounce.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Config
   * ------------------------------------------------------------------ */
  var FETCH_TIMEOUT = 5000; // 5 s max per API call

  /* ------------------------------------------------------------------
   * Brazil — IPTU rate & insurance estimates by UF
   * Source: IBGE / SEFAZ averages (simplified for UX)
   * ------------------------------------------------------------------ */
  var BR_TAX = {
    SP: { taxPct: 0.40, insMonthly: 50 },
    RJ: { taxPct: 0.60, insMonthly: 80 },
    MG: { taxPct: 0.50, insMonthly: 60 },
    RS: { taxPct: 0.45, insMonthly: 55 },
    PR: { taxPct: 0.42, insMonthly: 52 },
    SC: { taxPct: 0.38, insMonthly: 48 },
    BA: { taxPct: 0.55, insMonthly: 65 },
    PE: { taxPct: 0.52, insMonthly: 62 },
    CE: { taxPct: 0.48, insMonthly: 58 },
    GO: { taxPct: 0.50, insMonthly: 55 },
    PA: { taxPct: 0.55, insMonthly: 65 },
    MA: { taxPct: 0.58, insMonthly: 68 }
  };
  var BR_DEFAULT = { taxPct: 0.50, insMonthly: 55 };

  /* ------------------------------------------------------------------
   * USA — fallback property-tax rate (%) and insurance ($/yr) by state
   * Source: Tax Foundation 2023 / Insurance Information Institute
   * ------------------------------------------------------------------ */
  var US_TAX = {
    AL: { taxPct: 0.39, ins: 1400 }, AK: { taxPct: 1.04, ins: 1100 },
    AZ: { taxPct: 0.62, ins: 1050 }, AR: { taxPct: 0.61, ins: 1300 },
    CA: { taxPct: 0.73, ins: 1100 }, CO: { taxPct: 0.51, ins: 1200 },
    CT: { taxPct: 1.79, ins: 1350 }, DE: { taxPct: 0.57, ins: 1100 },
    FL: { taxPct: 0.89, ins: 1600 }, GA: { taxPct: 0.87, ins: 1400 },
    HI: { taxPct: 0.27, ins: 1050 }, ID: { taxPct: 0.62, ins: 900 },
    IL: { taxPct: 2.10, ins: 1350 }, IN: { taxPct: 0.81, ins: 1150 },
    IA: { taxPct: 1.53, ins: 1100 }, KS: { taxPct: 1.41, ins: 1250 },
    KY: { taxPct: 0.84, ins: 1200 }, LA: { taxPct: 0.55, ins: 1700 },
    ME: { taxPct: 1.08, ins: 1050 }, MD: { taxPct: 1.06, ins: 1250 },
    MA: { taxPct: 1.12, ins: 1300 }, MI: { taxPct: 1.31, ins: 1200 },
    MN: { taxPct: 1.14, ins: 1100 }, MS: { taxPct: 0.71, ins: 1450 },
    MO: { taxPct: 0.93, ins: 1200 }, MT: { taxPct: 0.83, ins: 1000 },
    NE: { taxPct: 1.51, ins: 1200 }, NV: { taxPct: 0.55, ins: 950 },
    NH: { taxPct: 2.18, ins: 1050 }, NJ: { taxPct: 2.23, ins: 1350 },
    NM: { taxPct: 0.71, ins: 1050 }, NY: { taxPct: 1.40, ins: 1400 },
    NC: { taxPct: 0.78, ins: 1350 }, ND: { taxPct: 0.98, ins: 1100 },
    OH: { taxPct: 1.55, ins: 1100 }, OK: { taxPct: 0.87, ins: 1500 },
    OR: { taxPct: 0.84, ins: 900 },  PA: { taxPct: 1.58, ins: 1150 },
    RI: { taxPct: 1.33, ins: 1200 }, SC: { taxPct: 0.56, ins: 1350 },
    SD: { taxPct: 1.14, ins: 1100 }, TN: { taxPct: 0.68, ins: 1350 },
    TX: { taxPct: 1.80, ins: 1800 }, UT: { taxPct: 0.58, ins: 950 },
    VT: { taxPct: 1.86, ins: 1050 }, VA: { taxPct: 0.78, ins: 1200 },
    WA: { taxPct: 0.84, ins: 1000 }, WV: { taxPct: 0.57, ins: 1050 },
    WI: { taxPct: 1.52, ins: 1050 }, WY: { taxPct: 0.61, ins: 1000 },
    DC: { taxPct: 0.56, ins: 1200 }
  };
  var US_DEFAULT = { taxPct: 1.10, ins: 1200 };

  /* ------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------ */
  function fetchWithTimeout(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var opts = ctrl ? { signal: ctrl.signal } : {};
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    return fetch(url, opts).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  /** Normalize CEP: "01001-000" → "01001000", ZIP: "90210" stays "90210" */
  function normalizeCode(raw, country) {
    var s = (raw || '').replace(/\D/g, '');
    if (country === 'BR' && s.length === 8) return s;
    if (country === 'US' && s.length === 5) return s;
    return null;
  }

  /* ------------------------------------------------------------------
   * Brazil — BrasilAPI
   * ------------------------------------------------------------------ */
  function fetchBrazil(cep) {
    return fetchWithTimeout('https://brasilapi.com.br/api/cep/v1/' + cep, FETCH_TIMEOUT)
      .then(function (data) {
        if (!data || !data.state) throw new Error('No state');
        var uf = data.state.toUpperCase();
        var ref = BR_TAX[uf] || BR_DEFAULT;
        return {
          taxPct: ref.taxPct,
          insMonthly: ref.insMonthly,
          city: data.city || '',
          uf: uf
        };
      });
  }

  /* ------------------------------------------------------------------
   * USA — Census ACS (free) → fallback state mapping
   * ------------------------------------------------------------------ */
  function fetchUSA_Census(zip) {
    // Census ACS 5-year: median home value by ZIP (B25077_001E)
    var url = 'https://api.census.gov/data/2023/acs/acs5?get=NAME,B25077_001E&for=zip%20code%20tabulation%20area:' + zip;
    return fetchWithTimeout(url, FETCH_TIMEOUT)
      .then(function (data) {
        if (!data || !data[1]) throw new Error('No data');
        var medianValue = parseInt(data[1][1], 10);
        if (!isFinite(medianValue) || medianValue <= 0) throw new Error('Invalid value');
        return { medianHomeValue: medianValue };
      });
  }

  function getUSFallback(stateAbbr) {
    var s = (stateAbbr || '').toUpperCase();
    var ref = US_TAX[s] || US_DEFAULT;
    return { taxPct: ref.taxPct, insMonthly: Math.round(ref.ins / 12) };
  }

  /* ------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------ */
  window.ZipLookup = {
    /**
     * @param {string} rawCode  — raw ZIP / CEP from input
     * @param {string} country  — 'BR' or 'US'
     * @param {string} stateAbbr — US state abbreviation (for fallback)
     * @returns {Promise<{taxPct, insMonthly, city?, uf?, medianHomeValue?}>}
     */
    fetch: function (rawCode, country, stateAbbr) {
      var code = normalizeCode(rawCode, country);
      if (!code) return Promise.reject(new Error('invalid_code'));

      if (country === 'BR') return fetchBrazil(code);

      if (country === 'US') {
        return fetchUSA_Census(code).then(function (census) {
          var fallback = getUSFallback(stateAbbr);
          return {
            taxPct: fallback.taxPct,
            insMonthly: fallback.insMonthly,
            medianHomeValue: census.medianHomeValue || null
          };
        }).catch(function () {
          // Fallback: pure state mapping
          var fb = getUSFallback(stateAbbr);
          return { taxPct: fb.taxPct, insMonthly: fb.insMonthly, medianHomeValue: null };
        });
      }

      return Promise.reject(new Error('unsupported_country'));
    },

    /** Expose for testing */
    normalizeCode: normalizeCode,
    BR_TAX: BR_TAX,
    US_TAX: US_TAX
  };
})();
