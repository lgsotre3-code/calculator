/**
 * rvb-country-presets.js — Country presets for Rent vs. Buy calculator
 * -------------------------------------------------------------------
 * Provides default values for regional inputs (property tax, maintenance,
 * appreciation, rent increase, selling costs) when the user selects a
 * country. Values are plausibility estimates based on publicly available
 * data — they are starting points, not financial advice.
 *
 * Usage:
 *   window.RvbPresets.get(code)  → { tax, maint, appreciation, rentInc, sellCost, vacancy }
 *   window.RvbPresets.list()     → [{ code, label }, ...]
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
   * Sources & rationale (abbreviated — see full notes per field):
   *
   * property_tax (annual % of home value):
   *   US  — Urban Institute / Tax Foundation: median ~1.1%, range 0.3-2.5%.
   *   BR  — IPTU varies by municipality; São Paulo capital average ~0.5-1%.
   *   PT  — IMI ranges 0.3-0.8% depending on municipality; use 0.4%.
   *   ES  — IBI is local; national average ~0.4-0.7%; use 0.6%.
   *   FR  — Taxe foncière ~1-1.5% for most communes; use 1.1%.
   *   DE  — Grundsteuer historically low ~0.3%, reform underway; use 0.3%.
   *   GB  — Council Tax band-based; effective ~0.7-1% of value; use 0.8%.
   *
   * maintenance (annual % of home value):
   *   US  — Industry rule of thumb 1-2%; use 1%.
   *   BR  — Higher due to building maintenance culture; ~1.2%.
   *   PT  — Similar to Southern Europe; ~1%.
   *   ES  — Community fees + upkeep; ~0.8%.
   *   FR  — Copropriété charges vary; ~1%.
   *   DE  — Well-maintained stock; ~0.8%.
   *   GB  — Older housing stock; ~1%.
   *
   * appreciation (annual % expected):
   *   US  — Long-run real appreciation ~3%; nominal ~5%; use 3%.
   *   BR  — Historically high nominal, volatile; use 4%.
   *   PT  — Strong post-2015 recovery; use 3%.
   *   ES  — Post-crisis recovery; use 2.5%.
   *   FR  — Steady moderate; use 2.5%.
   *   DE  — Strong in recent years; use 3%.
   *   GB  — London-heavy but moderate nationally; use 2.5%.
   *
   * rent_increase (annual %):
   *   US  — CPI shelter ~3-4%; use 3.5%.
   *   BR  — IGPM/IPCA-driven; use 6%.
   *   PT  — INE rental index ~2%; use 2%.
   *   ES  — CPI-linked; use 2.5%.
   *   FR  — Plafonnement loyer; use 2%.
   *   DE  — Mietpreisbremse capped; use 2%.
   *   GB  — Renters Reform; use 3%.
   *
   * selling_costs (one-time % of sale price):
   *   US  — Agent commission ~5% + closing ~2%; use 7%.
   *   BR  — ITBI + registration + broker; ~6-8%; use 7%.
   *   PT  — IMT + agent + fees; ~5-7%; use 6%.
   *   ES  — Transfer tax + agent; ~8-10%; use 9%.
   *   FR  — Frais de notaire ~7-8% + agent ~4%; use 11%.
   *   DE  — Grunderwerbsteuer ~3.5-6.5% + agent ~3-4%; use 8%.
   *   GB  — Stamp Duty + agent; ~3-5%; use 4%.
   */
  var PRESETS = {
    US: { tax: 1.2, maint: 1.0, appreciation: 3.0, rentInc: 3.5, sellCost: 7.0, vacancy: 5 },
    BR: { tax: 0.8, maint: 1.2, appreciation: 4.0, rentInc: 6.0, sellCost: 7.0, vacancy: 5 },
    PT: { tax: 0.4, maint: 1.0, appreciation: 3.0, rentInc: 2.0, sellCost: 6.0, vacancy: 5 },
    ES: { tax: 0.6, maint: 0.8, appreciation: 2.5, rentInc: 2.5, sellCost: 9.0, vacancy: 5 },
    FR: { tax: 1.1, maint: 1.0, appreciation: 2.5, rentInc: 2.0, sellCost: 11.0, vacancy: 5 },
    DE: { tax: 0.3, maint: 0.8, appreciation: 3.0, rentInc: 2.0, sellCost: 8.0, vacancy: 5 },
    GB: { tax: 0.8, maint: 1.0, appreciation: 2.5, rentInc: 3.0, sellCost: 4.0, vacancy: 5 }
  };

  /**
   * Country labels are NOT translated here — they live in the i18n
   * dictionaries as `rvb_country_XX` (e.g. rvb_country_US).
   * This list provides only the codes and a static English fallback.
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

  window.RvbPresets = {
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
