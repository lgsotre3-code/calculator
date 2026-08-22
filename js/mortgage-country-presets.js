/**
 * mortgage-country-presets.js — Country presets for Mortgage Calculator
 * -------------------------------------------------------------------
 * Provides default values for property tax and home insurance when the
 * user selects a country. Values are plausibility estimates based on
 * publicly available data — they are starting points, not financial advice.
 *
 * Usage:
 *   window.MortgageCountryPresets.get(code)  → { propertyTax, insurance }
 *   window.MortgageCountryPresets.list()     → [{ code, fallback }, ...]
 *
 * Country selection is INDEPENDENT of language and currency (same
 * philosophy as the currency selector). Choosing "Brazil" does NOT
 * force Portuguese or BRL — it only fills in the input defaults.
 */
(function () {
  'use strict';

  /**
   * Presets per country.
   *
   * property_tax (annual % of home value):
   *   Consistent with rvb-country-presets.js values for cross-calculator
   *   coherence. Sources documented there.
   *
   *   US  — 1.2%  (Tax Foundation median ~1.1%, range 0.3-2.5%)
   *   BR  — 0.8%  (IPTU São Paulo average ~0.5-1%)
   *   PT  — 0.4%  (IMI 0.3-0.8%)
   *   ES  — 0.6%  (IBI national average ~0.4-0.7%)
   *   FR  — 1.1%  (Taxe foncière ~1-1.5%)
   *   DE  — 0.3%  (Grundsteuer ~0.3%, reform underway)
   *   GB  — 0.8%  (Council Tax effective ~0.7-1%)
   *
   * insurance (annual absolute value in a currency-neutral estimate):
   *   Homeowner's insurance premiums vary widely by country, climate
   *   risk, and coverage type. The values below are rough annual
   *   estimates in USD-equivalent for a typical mid-range home.
   *   Since the mortgage calculator is currency-independent, these
   *   numbers serve as a starting reference — users should adjust
   *   for their local market and currency.
   *
   *   US  — $1,200/yr  (NAIC avg ~$1,100-1,400 for $350k home)
   *   BR  — $500/yr    (condominium insurance common; standalone lower)
   *   PT  — $400/yr    (multirrisco/house insurance ~€350-450)
   *   ES  — $350/yr    (seguro de hogar ~€300-400)
   *   FR  — $500/yr    (assurance habitation ~€400-600)
   *   DE  — $400/yr    (Wohngebäudeversicherung ~€350-450)
   *   GB  — $450/yr    (buildings insurance ~£350-450)
   */
  var PRESETS = {
    US: { propertyTax: 1.2, insurance: 1200 },
    BR: { propertyTax: 0.8, insurance: 500 },
    PT: { propertyTax: 0.4, insurance: 400 },
    ES: { propertyTax: 0.6, insurance: 350 },
    FR: { propertyTax: 1.1, insurance: 500 },
    DE: { propertyTax: 0.3, insurance: 400 },
    GB: { propertyTax: 0.8, insurance: 450 }
  };

  /**
   * Country labels are NOT translated here — they live in the i18n
   * dictionaries as `rvb_country_XX` (e.g. rvb_country_US), reused
   * from the Rent vs. Buy calculator for consistency.
 * This list provides only the codes and a static English fallback.
 *
 * 2026-08-21  Cross-calculator note: propertyTax values are intentionally
 *              identical to `tax` in rvb-country-presets.js. If you update
 *              one file, update the other to keep them in sync. The two files
 *              remain separate because each calculator needs a different
 *              subset of regional fields — Finance vs. Cash and Renovation ROI
 *              have no regional inputs at all, so no shared preset file is used.
 */
  var COUNTRY_LIST = [
    { code: 'US', fallback: 'United States' },
    { code: 'BR', fallback: 'Brazil' },
    { code: 'PT', fallback: 'Portugal' },
    { code: 'ES', fallback: 'Spain' },
    { code: 'FR', fallback: 'France' },
    { code: 'DE', fallback: 'Germany' },
    { code: 'GB', fallback: 'United Kingdom' }
  ];

  /**
   * U.S. state-level refinements for the US preset.
   *
   * propertyTax — effective property tax rate (% of home value / year),
   *   approximations from Tax Foundation effective-rate tables.
   * insurance  — rough annual homeowner premium (USD, HO-3, ~$300k dwelling),
   *   higher in catastrophe-exposed markets (FL/OK/TX/LA).
   * Both are starting points, not quotes.
   */
  var US_STATES = {
    AL: { name: 'Alabama',        propertyTax: 0.37, insurance: 2250 },
    AK: { name: 'Alaska',         propertyTax: 1.19, insurance: 2600 },
    AZ: { name: 'Arizona',        propertyTax: 0.60, insurance: 2000 },
    AR: { name: 'Arkansas',       propertyTax: 0.62, insurance: 2200 },
    CA: { name: 'California',     propertyTax: 0.71, insurance: 1600 },
    CO: { name: 'Colorado',       propertyTax: 0.51, insurance: 2500 },
    CT: { name: 'Connecticut',    propertyTax: 2.14, insurance: 1900 },
    DE: { name: 'Delaware',       propertyTax: 0.57, insurance: 1200 },
    DC: { name: 'District of Columbia', propertyTax: 0.57, insurance: 1500 },
    FL: { name: 'Florida',        propertyTax: 0.80, insurance: 4200 },
    GA: { name: 'Georgia',        propertyTax: 0.92, insurance: 2300 },
    HI: { name: 'Hawaii',         propertyTax: 0.32, insurance: 1400 },
    ID: { name: 'Idaho',          propertyTax: 0.68, insurance: 1300 },
    IL: { name: 'Illinois',       propertyTax: 2.08, insurance: 2100 },
    IN: { name: 'Indiana',        propertyTax: 0.83, insurance: 1700 },
    IA: { name: 'Iowa',           propertyTax: 1.53, insurance: 2000 },
    KS: { name: 'Kansas',         propertyTax: 1.40, insurance: 2100 },
    KY: { name: 'Kentucky',       propertyTax: 0.90, insurance: 1800 },
    LA: { name: 'Louisiana',      propertyTax: 0.55, insurance: 3200 },
    ME: { name: 'Maine',          propertyTax: 1.15, insurance: 1400 },
    MD: { name: 'Maryland',       propertyTax: 1.09, insurance: 1500 },
    MA: { name: 'Massachusetts',  propertyTax: 1.09, insurance: 1700 },
    MI: { name: 'Michigan',       propertyTax: 1.38, insurance: 1800 },
    MN: { name: 'Minnesota',      propertyTax: 1.09, insurance: 2000 },
    MS: { name: 'Mississippi',    propertyTax: 0.78, insurance: 2400 },
    MO: { name: 'Missouri',       propertyTax: 1.01, insurance: 1900 },
    MT: { name: 'Montana',        propertyTax: 0.84, insurance: 2200 },
    NE: { name: 'Nebraska',       propertyTax: 1.64, insurance: 2300 },
    NV: { name: 'Nevada',         propertyTax: 0.53, insurance: 1300 },
    NH: { name: 'New Hampshire',  propertyTax: 1.77, insurance: 1300 },
    NJ: { name: 'New Jersey',     propertyTax: 2.23, insurance: 1700 },
    NM: { name: 'New Mexico',     propertyTax: 0.79, insurance: 1800 },
    NY: { name: 'New York',       propertyTax: 1.73, insurance: 2000 },
    NC: { name: 'North Carolina', propertyTax: 0.82, insurance: 1700 },
    ND: { name: 'North Dakota',   propertyTax: 0.99, insurance: 1900 },
    OH: { name: 'Ohio',           propertyTax: 1.53, insurance: 1600 },
    OK: { name: 'Oklahoma',       propertyTax: 0.87, insurance: 3000 },
    OR: { name: 'Oregon',         propertyTax: 0.93, insurance: 1500 },
    PA: { name: 'Pennsylvania',   propertyTax: 1.50, insurance: 1500 },
    RI: { name: 'Rhode Island',   propertyTax: 1.63, insurance: 1900 },
    SC: { name: 'South Carolina', propertyTax: 0.88, insurance: 2100 },
    SD: { name: 'South Dakota',   propertyTax: 1.27, insurance: 2000 },
    TN: { name: 'Tennessee',      propertyTax: 0.71, insurance: 1900 },
    TX: { name: 'Texas',          propertyTax: 1.60, insurance: 3300 },
    UT: { name: 'Utah',           propertyTax: 0.58, insurance: 1400 },
    VT: { name: 'Vermont',        propertyTax: 1.83, insurance: 1500 },
    VA: { name: 'Virginia',       propertyTax: 0.82, insurance: 1500 },
    WA: { name: 'Washington',     propertyTax: 0.94, insurance: 1500 },
    WV: { name: 'West Virginia',  propertyTax: 0.61, insurance: 1400 },
    WI: { name: 'Wisconsin',      propertyTax: 1.62, insurance: 1600 },
    WY: { name: 'Wyoming',        propertyTax: 0.61, insurance: 1800 }
  };

  window.MortgageCountryPresets = {
    /**
     * Returns the preset object for a country code, or null for 'custom'.
     */
    get: function (code) {
      return PRESETS[code] || null;
    },

    /**
     * Returns the list of available country codes.
     */
    list: function () {
      return COUNTRY_LIST;
    },

    /**
     * Returns the sorted list of U.S. state codes (for populating the
     * state <select>). Returns [] on older copies without data.
     */
    states: function () {
      return Object.keys(US_STATES).sort();
    },

    /**
     * Returns { name, propertyTax, insurance } for a U.S. state code,
     * or null if unknown.
     */
    getState: function (code) {
      return US_STATES[code] || null;
    }
  };
})();
