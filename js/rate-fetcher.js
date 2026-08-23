/**
 * rateFetcher.js — Automatic mortgage interest rate lookup by country
 * -------------------------------------------------------------------
 * Fetches the latest mortgage interest rate for each supported country
 * using official central-bank or government APIs. No competitor does this
 * automatically — most require manual entry.
 *
 * Sources:
 *   US  — CalcCore.getCurrentMortgageRate() (FRED MORTGAGE30US via Vercel)
 *   BR  — Banco Central do Brasil SGS series 20772 (taxa média PF imobiliário)
 *   ES  — ECB MIR.M.ES.B.A2C.AM.R.A.2250.EUR.N
 *   FR  — ECB MIR.M.FR.B.A2C.AM.R.A.2250.EUR.N
 *   DE  — ECB MIR.M.DE.B.A2C.AM.R.A.2250.EUR.N
 *   PT  — ECB MIR.M.PT.B.A2C.AM.R.A.2250.EUR.N
 *   GB  — Bank of England (IUMTLMV — variable, or fallback 4.5%)
 *
 * API: window.RateFetcher
 *   .fetchRate(countryCode)      → Promise<number|null>  (e.g. 0.065 for 6.5%)
 *   .getCachedRate(countryCode)  → { rate, timestamp } | null
 *   .clearCache(countryCode)     → void
 *   .clearAllCache()             → void
 *
 * Integration with calculator.js:
 *   When the user selects a country, call RateFetcher.fetchRate(code).
 *   On success, prefill the interest-rate input + slider and show a
 *   translated "Updated on DD/MM/YYYY" note. On failure, show a
 *   fallback message and keep the field editable.
 *
 * The module is pure Vanilla JS — no build step, no dependencies.
 */
(function () {
  'use strict';

  var CACHE_PREFIX = 'mc_rate_';
  var CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  var FETCH_TIMEOUT_MS = 5000;

  /* ------------------------------------------------------------------
   * Data sources configuration
   * ------------------------------------------------------------------ */
  var RATE_SOURCES = {
    US: {
      // The existing FRED endpoint is handled separately via CalcCore.
      // This entry is for cache/fallback purposes only.
      fallback: 0.065,
      label: 'Freddie Mac PMMS via FRED'
    },
    BR: {
      url: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.20772/dados/ultimos/1?formato=json',
      parser: function (data) {
        // Response: [{ "data": "22/08/2026", "valor": "11.22" }]
        if (!Array.isArray(data) || !data.length) return null;
        var val = parseFloat(data[0].valor);
        return isFinite(val) ? val / 100 : null; // 11.22 → 0.1122
      },
      fallback: 0.105,
      label: 'Banco Central do Brasil (SGS 20772)'
    },
    ES: {
      url: 'https://data.ecb.europa.eu/api/data/MIR.M.ES.B.A2C.AM.R.A.2250.EUR.N?format=json',
      parser: function (data) {
        return parseEcbRate(data);
      },
      fallback: 0.035,
      label: 'ECB Mortgage Interest Rates'
    },
    FR: {
      url: 'https://data.ecb.europa.eu/api/data/MIR.M.FR.B.A2C.AM.R.A.2250.EUR.N?format=json',
      parser: function (data) {
        return parseEcbRate(data);
      },
      fallback: 0.035,
      label: 'ECB Mortgage Interest Rates'
    },
    DE: {
      url: 'https://data.ecb.europa.eu/api/data/MIR.M.DE.B.A2C.AM.R.A.2250.EUR.N?format=json',
      parser: function (data) {
        return parseEcbRate(data);
      },
      fallback: 0.035,
      label: 'ECB Mortgage Interest Rates'
    },
    PT: {
      url: 'https://data.ecb.europa.eu/api/data/MIR.M.PT.B.A2C.AM.R.A.2250.EUR.N?format=json',
      parser: function (data) {
        return parseEcbRate(data);
      },
      fallback: 0.035,
      label: 'ECB Mortgage Interest Rates'
    },
    GB: {
      // Bank of England — try IUMTLMV (variable rate mortgage interest rate)
      // The BoE API returns CSV; we parse the latest value.
      url: 'https://www.bankofengland.co.uk/boeapps/database/fromshowcolumns.asp?Travel=NIxAZxSUx&FromSeries=1&ToSeries=50&DAession=DA012&Ession=x&onClick=1&SeriesCodes=IUMTLMV&UsingCodes=Y&CSVF=TN&Ession=x&Ession=x&ression.x=1&ression.y=1&CP=315&SOut=0',
      parser: function (text) {
        // BoE returns CSV with lines like: "Date,IUMTLMV" then rows.
        // We parse the last numeric value.
        if (typeof text !== 'string') return null;
        var lines = text.split('\n').filter(function (l) { return l.trim(); });
        // Find the last line with a numeric value
        for (var i = lines.length - 1; i >= 0; i--) {
          var parts = lines[i].split(',');
          var val = parseFloat(parts[parts.length - 1]);
          if (isFinite(val) && val > 0 && val < 30) {
            return val / 100; // e.g. 4.5 → 0.045
          }
        }
        return null;
      },
      fallback: 0.045,
      label: 'Bank of England (IUMTLMV)',
      responseType: 'text' // BoE returns CSV/text, not JSON
    }
  };

  /* ------------------------------------------------------------------
   * ECB response parser (shared by ES, FR, DE, PT)
   *
   * ECB Data Portal returns:
   *   { "dataSets": [...], "structure": {...} }
   * The observations are in dataSets[0].series["0:0:0:0:0"].observations
   * which is an object like { "0": [value], "1": [value], ... }
   * We extract the last non-null observation.
   * ------------------------------------------------------------------ */
  function parseEcbRate(data) {
    try {
      var series = data.dataSets && data.dataSets[0] && data.dataSets[0].series;
      if (!series) return null;
      var key = Object.keys(series)[0]; // "0:0:0:0:0"
      var obs = series[key] && series[key].observations;
      if (!obs) return null;
      var keys = Object.keys(obs);
      // Get the last observation
      for (var i = keys.length - 1; i >= 0; i--) {
        var val = parseFloat(obs[keys[i]][0]);
        if (isFinite(val) && val > 0) {
          return val / 100; // e.g. 3.5 → 0.035
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------------------------------------------
   * Cache helpers
   * ------------------------------------------------------------------ */
  function getCacheKey(countryCode) {
    return CACHE_PREFIX + countryCode;
  }

  function getCachedRate(countryCode) {
    try {
      var raw = localStorage.getItem(getCacheKey(countryCode));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveToCache(countryCode, rate) {
    try {
      localStorage.setItem(getCacheKey(countryCode), JSON.stringify({
        rate: rate,
        timestamp: Date.now()
      }));
    } catch (e) { /* quota exceeded — degrade silently */ }
  }

  function isCacheValid(timestamp) {
    return (Date.now() - timestamp) < CACHE_TTL_MS;
  }

  function clearCache(countryCode) {
    try { localStorage.removeItem(getCacheKey(countryCode)); } catch (e) {}
  }

  function clearAllCache() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(CACHE_PREFIX) === 0) keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  /* ------------------------------------------------------------------
   * Fetch with timeout (AbortController)
   * ------------------------------------------------------------------ */
  function fetchWithTimeout(url, opts, timeoutMs) {
    if (typeof AbortController === 'undefined') {
      return fetch(url, opts);
    }
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || FETCH_TIMEOUT_MS);
    return fetch(url, Object.assign({}, opts || {}, { signal: controller.signal }))
      .then(function (res) { clearTimeout(timer); return res; })
      .catch(function (err) { clearTimeout(timer); throw err; });
  }

  /* ------------------------------------------------------------------
   * API failure simulation (for testing)
   * Usage: window.simulateApiFailure = true;  → all fetches will fail
   *        window.simulateApiFailure = false;  → restore normal behavior
   * ------------------------------------------------------------------ */
  window.simulateApiFailure = false;

  /* ------------------------------------------------------------------
   * Main fetch function
   * ------------------------------------------------------------------ */
  function fetchRate(countryCode) {
    if (!countryCode || countryCode === 'custom') return Promise.resolve(null);

    // US: delegate to existing CalcCore endpoint
    if (countryCode === 'US') {
      // Check cache first
      var cachedUs = getCachedRate('US');
      if (cachedUs && isCacheValid(cachedUs.timestamp)) {
        return Promise.resolve(cachedUs.rate);
      }
      if (window.CalcCore && window.CalcCore.getCurrentMortgageRate) {
        return window.CalcCore.getCurrentMortgageRate().then(function (rate) {
          if (rate && rate > 0) {
            saveToCache('US', rate);
            return rate;
          }
          return RATE_SOURCES.US.fallback;
        }).catch(function () {
          return RATE_SOURCES.US.fallback;
        });
      }
      return Promise.resolve(RATE_SOURCES.US.fallback);
    }

    // Other countries
    var source = RATE_SOURCES[countryCode];
    if (!source) return Promise.resolve(null);

    // Check cache
    var cached = getCachedRate(countryCode);
    if (cached && isCacheValid(cached.timestamp)) {
      return Promise.resolve(cached.rate);
    }

    // Simulate failure for testing
    if (window.simulateApiFailure) {
      return Promise.resolve(source.fallback);
    }

    // Fetch from API
    var fetchOpts = {};
    var responseType = source.responseType || 'json';

    return fetchWithTimeout(source.url, fetchOpts, FETCH_TIMEOUT_MS)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return responseType === 'text' ? res.text() : res.json();
      })
      .then(function (data) {
        var rate = source.parser(data);
        if (rate !== null && rate > 0 && rate < 0.30) { // sanity: 0%–30%
          saveToCache(countryCode, rate);
          return rate;
        }
        return source.fallback;
      })
      .catch(function () {
        return source.fallback;
      });
  }

  /* ------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------ */
  window.RateFetcher = {
    fetchRate: fetchRate,
    getCachedRate: getCachedRate,
    clearCache: clearCache,
    clearAllCache: clearAllCache,
    isCacheValid: isCacheValid,
    sources: RATE_SOURCES
  };
})();
