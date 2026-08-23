/**
 * calc-brutto.js — German Brutto-Netto (gross-to-net salary) calculator
 * ---------------------------------------------------------------------
 * Simplified 2024/2025 German payroll model:
 *   • Lohnsteuer — progressive zone approximation of §32a EStG applied to
 *     the gross salary minus the flat Werbungskosten-Pauschbetrag
 *     (1.230 €/year):
 *       ≤ 11.604 €: 0% | →17.005 €: 14%→24% | →66.760 €: 24%→42% |
 *       ≤ 277.825 €: 42% | above: 45%.
 *     Tax classes I–V are approximated with factors on the computed tax
 *     (III cheaper, V more expensive, II slightly cheaper).
 *   • Solidaritätszuschlag — 5.5% of income tax above the Freigrenze
 *     (18.130 €/year, doubled for class III), with the statutory
 *     mitigation zone (11.9% of the excess).
 *   • Kirchensteuer — optional 8% (Bayern/Baden-Württemberg) or 9% of
 *     the Lohnsteuer.
 *   • Social insurance, employee shares on capped monthly bases:
 *       KV 8.15% (BBG 5.175 €), RV 9.3% + AV 1.3% (BBG 7.550 € West /
 *       7.150 € East), PV 1.7% (+0.6% childless from age 23, BBG 5.175 €).
 *
 * Dependency: CalcCore (+ Chart.js via CalcCore.barChart). Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var t = C.t;

  /* ---------- constants (2024/2025, simplified) ---------- */
  var WERBUNGSKOSTEN = 1230;            // flat employee expense allowance (€/yr)
  var B1 = 11604, B2 = 17005, B3 = 66760, B4 = 277825; // §32a zone edges
  var T2 = (B2 - B1) * 0.19;            // full zone II  (avg of 14%→24%)
  var T3 = (B3 - B2) * 0.33;            // full zone III (avg of 24%→42%)
  var T4 = (B4 - B3) * 0.42;            // full zone IV  (flat 42%)
  var CLASS_FACTOR = { 1: 1, 2: 0.90, 3: 0.70, 4: 1, 5: 1.60 };
  var CLASS_NAME = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
  var SOLI_RATE = 0.055;
  var SOLI_MITIGATION = 0.119;
  var SOLI_FREE_NORMAL = 18130;         // Freigrenze (tax amount, €/yr)
  var CHURCH_RATES = { 8: 0.08, 9: 0.09 };

  var BBG_KV_PV = 5175;                 // monthly assessment cap KV/PV
  var BBG_RV_WEST = 7550;               // monthly cap RV/AV West
  var BBG_RV_EAST = 7150;               // monthly cap RV/AV East
  var KV_EMP = 0.0815;                  // 7.3% (half general rate) + 0.85% supplement
  var RV_EMP = 0.093;
  var AV_EMP = 0.013;
  var PV_EMP = 0.017;
  var PV_CHILDLESS_EXTRA = 0.006;

  var el = {};
  function cache() {
    ['brutto-salary', 'brutto-salary-slider', 'brutto-class',
     'brutto-church', 'brutto-church-rate-field', 'brutto-church-rate',
     'brutto-region', 'brutto-childless',
     'brutto-out-gross-monthly', 'brutto-out-deduct-monthly',
     'brutto-out-net-monthly', 'brutto-out-net-annual',
     'brutto-out-deduct-annual', 'brutto-out-rate',
     'brutto-b-tax-m', 'brutto-b-tax-a',
     'brutto-b-soli-m', 'brutto-b-soli-a',
     'brutto-b-kist-m', 'brutto-b-kist-a',
     'brutto-b-kv-m', 'brutto-b-kv-a',
     'brutto-b-rv-m', 'brutto-b-rv-a',
     'brutto-b-av-m', 'brutto-b-av-a',
     'brutto-b-pv-m', 'brutto-b-pv-a',
     'brutto-b-total-m', 'brutto-b-total-a',
     'brutto-calculate', 'brutto-reset', 'brutto-chart-split']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  /* ---------- tax functions (approximations) ---------- */

  /** Cumulative income tax at taxable income x (progressive zones). */
  function taxAt(x) {
    if (x <= B1) return 0;
    if (x <= B2) {
      var f = (x - B1) / (B2 - B1);           // rate rises linearly 14%→24%
      return (x - B1) * (0.14 + 0.05 * f);
    }
    if (x <= B3) {
      var g = (x - B2) / (B3 - B2);           // rate rises linearly 24%→42%
      return T2 + (x - B2) * (0.24 + 0.09 * g);
    }
    if (x <= B4) return T2 + T3 + (x - B3) * 0.42;
    return T2 + T3 + T4 + (x - B4) * 0.45;
  }

  /** Annual Lohnsteuer incl. simplified tax-class adjustment. */
  function wageTax(annualGross, taxClass) {
    var taxable = Math.max(annualGross - WERBUNGSKOSTEN, 0);
    return taxAt(taxable) * (CLASS_FACTOR[taxClass] || 1);
  }

  /** Annual Solidaritätszuschlag with Freigrenze + mitigation zone. */
  function soliTax(incomeTaxAnnual, taxClass) {
    var free = taxClass === 3 ? SOLI_FREE_NORMAL * 2 : SOLI_FREE_NORMAL;
    if (incomeTaxAnnual <= free) return 0;
    return Math.min(SOLI_RATE * incomeTaxAnnual, SOLI_MITIGATION * (incomeTaxAnnual - free));
  }

  /** Employee social-insurance amounts (monthly, capped bases). */
  function socialMonthly(monthlyGross, isEast, childless) {
    var kvPvBase = Math.min(monthlyGross, BBG_KV_PV);
    var rvAvBase = Math.min(monthlyGross, isEast ? BBG_RV_EAST : BBG_RV_WEST);
    var pvRate = PV_EMP + (childless ? PV_CHILDLESS_EXTRA : 0);
    return {
      kv: kvPvBase * KV_EMP,
      rv: rvAvBase * RV_EMP,
      av: rvAvBase * AV_EMP,
      pv: kvPvBase * pvRate
    };
  }

  /* ---------- input handling ---------- */

  function read() {
    return {
      salary: C.clamp(C.val(el['brutto-salary'], 50000), 10000, 200000),
      taxClass: parseInt(el['brutto-class'].value, 10) || 1,
      church: el['brutto-church'].checked,
      churchRate: parseFloat(el['brutto-church-rate'].value) || 9,
      isEast: el['brutto-region'].value === 'east',
      childless: el['brutto-childless'].checked
    };
  }

  function syncSlider(sliderId, inputId, fromSlider) {
    if (fromSlider) { el[inputId].value = el[sliderId].value; }
    else {
      var min = parseFloat(el[sliderId].min) || 0;
      var max = parseFloat(el[sliderId].max) || 100;
      el[sliderId].value = C.clamp(C.val(el[inputId], min), min, max);
    }
  }

  /* ---------- rendering ---------- */

  function setRow(base, annualAmount) {
    el[base + '-m'].textContent = C.money(annualAmount / 12);
    el[base + '-a'].textContent = C.money(annualAmount);
  }

  function renderChart(grossM, dedM, netM) {
    C.barChart('brutto-chart-split',
      [t('brutto_chart_gross'), t('brutto_chart_deduct'), t('brutto_chart_net')],
      [{ data: [grossM, dedM, netM], color: ['#1a365d', '#c53030', '#38a169'] }]);
  }

  function calculate() {
    var s = read();

    var taxA = wageTax(s.salary, s.taxClass);
    var soliA = soliTax(taxA, s.taxClass);
    var kistA = s.church ? taxA * (CHURCH_RATES[s.churchRate] || 0.09) : 0;

    var m = s.salary / 12;
    var soc = socialMonthly(m, s.isEast, s.childless);

    var dedM = taxA / 12 + soliA / 12 + kistA / 12 + soc.kv + soc.rv + soc.av + soc.pv;
    var netM = Math.max(m - dedM, 0);

    el['brutto-out-gross-monthly'].textContent = C.money(m);
    el['brutto-out-deduct-monthly'].textContent = C.money(dedM);
    el['brutto-out-net-monthly'].textContent = C.money(netM);
    el['brutto-out-deduct-annual'].textContent = C.money(dedM * 12);
    el['brutto-out-net-annual'].textContent = C.money(netM * 12);
    el['brutto-out-rate'].textContent = C.pct(s.salary > 0 ? (dedM * 12 / s.salary) * 100 : 0);

    setRow('brutto-b-tax', taxA);
    setRow('brutto-b-soli', soliA);
    setRow('brutto-b-kist', kistA);
    setRow('brutto-b-kv', soc.kv * 12);
    setRow('brutto-b-rv', soc.rv * 12);
    setRow('brutto-b-av', soc.av * 12);
    setRow('brutto-b-pv', soc.pv * 12);
    setRow('brutto-b-total', dedM * 12);

    renderChart(m, dedM, netM);

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'brutto_netto',
        gross_annual: s.salary,
        tax_class: CLASS_NAME[s.taxClass] || 'I',
        church_tax: s.church,
        church_rate: s.church ? s.churchRate : 0,
        region: s.isEast ? 'east' : 'west',
        childless_surcharge: s.childless,
        net_monthly: Math.round(netM * 100) / 100,
        deductions_annual: Math.round(dedM * 12 * 100) / 100,
        effective_rate_pct: Math.round((dedM * 12 / s.salary) * 1000) / 10
      });
    }
  }

  function reset() {
    el['brutto-salary'].value = 50000; el['brutto-salary-slider'].value = 50000;
    el['brutto-class'].value = '1';
    el['brutto-church'].checked = false;
    el['brutto-church-rate'].value = '9';
    el['brutto-region'].value = 'west';
    el['brutto-childless'].checked = false;
    syncChurchField();
    calculate();
  }

  function syncChurchField() {
    el['brutto-church-rate-field'].hidden = !el['brutto-church'].checked;
  }

  function init() {
    cache();
    if (!el['brutto-salary']) return;

    var recalc = C.debounce(calculate, 120);

    el['brutto-salary-slider'].addEventListener('input', function () {
      syncSlider('brutto-salary-slider', 'brutto-salary', true); recalc();
    });
    el['brutto-salary'].addEventListener('input', function () {
      syncSlider('brutto-salary-slider', 'brutto-salary', false); recalc();
    });

    ['brutto-class', 'brutto-church-rate', 'brutto-region'].forEach(function (id) {
      el[id].addEventListener('change', recalc);
    });
    el['brutto-childless'].addEventListener('change', recalc);
    el['brutto-church'].addEventListener('change', function () {
      syncChurchField(); recalc();
    });

    el['brutto-calculate'].addEventListener('click', calculate);
    el['brutto-reset'].addEventListener('click', reset);

    // Re-render labels and chart when the UI language changes.
    document.addEventListener('i18n:updated', function () { C.schedule(calculate); });
    // Re-render when the user switches currency (independent of language).
    document.addEventListener('currency:changed', function () { C.schedule(calculate); });
    // Re-render when the layout crosses a breakpoint or rotates (mobile fonts).
    document.addEventListener('calc:reflow', function () { C.schedule(calculate); });

    // Initial render: wait for the i18n dictionary so labels are
    // translated on first paint instead of showing raw keys.
    if (window.i18n && window.i18n.ready) {
      window.i18n.ready.then(calculate).catch(calculate);
    } else {
      calculate();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
