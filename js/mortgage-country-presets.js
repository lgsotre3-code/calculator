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
    }
  };
})();
