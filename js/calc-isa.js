/**
 * calc-isa.js — ISA vs GIA Calculator (UK)
 * -----------------------------------------
 * Compares a stocks & shares ISA (tax-free) with a General Investment
 * Account (taxable: CGT + dividend tax) over a multi-year period.
 *
 * UK 2024/25 tax rules:
 *   CGT:         10% basic / 20% higher+ on gains above £3,000 exempt
 *   Dividend:    8.75% basic / 33.75% higher / 39.35% additional above £1,000
 *   ISA cap:     £20,000/year — excess must go in GIA
 *
 * Dependency: CalcCore + Chart.js. Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var ISA_ALLOWANCE = 20000;
  var CGT_EXEMPT = 3000;
  var DIV_ALLOWANCE = 1000;

  var TAX_BANDS = {
    basic:      { cgt: 0.10, div: 0.0875 },
    higher:     { cgt: 0.20, div: 0.3375 },
    additional: { cgt: 0.20, div: 0.3935 }
  };

  var el = {};
  function cache() {
    ['isa-annual', 'isa-annual-slider', 'isa-years', 'isa-years-slider',
     'isa-return', 'isa-return-slider', 'isa-tax-band',
     'isa-equity', 'isa-equity-slider',
     'isa-verdict', 'isa-out-isa', 'isa-out-gia', 'isa-out-tax', 'isa-out-advantage',
     'isa-cmp-invested-isa', 'isa-cmp-invested-gia', 'isa-cmp-growth-isa', 'isa-cmp-growth-gia',
     'isa-cmp-cgt', 'isa-cmp-divtax', 'isa-cmp-net-isa', 'isa-cmp-net-gia',
     'isa-cmp-final-isa', 'isa-cmp-final-gia',
     'isa-calculate', 'isa-reset', 'isa-chart']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  function read() {
    return {
      annual: C.clamp(C.val(el['isa-annual'], 0), 0, 200000),
      years: C.clamp(Math.round(C.val(el['isa-years'], 1)), 1, 40),
      ret: C.clamp(C.val(el['isa-return'], 0), 0, 30),
      band: el['isa-tax-band'] ? el['isa-tax-band'].value : 'basic',
      equityPct: C.clamp(C.val(el['isa-equity'], 50), 0, 100) / 100
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

  /**
   * Year-by-year simulation.
   * Each year: add contribution, grow by return, apply taxes on GIA only.
   * CGT and dividend tax are calculated on an estimate of gains:
   *   - Equity portion → CGT + dividend tax
   *   - Bond portion → income tax (simplified: same rate as marginal income tax)
   */
  function simulate(s) {
    var tax = TAX_BANDS[s.band] || TAX_BANDS.basic;
    var incomeTaxRate = s.band === 'basic' ? 0.20 : s.band === 'higher' ? 0.40 : 0.45;

    var isaVal = 0, giaVal = 0;
    var giaTotalTax = 0;
    var giaCgt = 0, giaDivTax = 0;
    var cgtExemptUsed = 0;

    for (var y = 0; y < s.years; y++) {
      // Add contributions
      var isaContrib = Math.min(s.annual, ISA_ALLOWANCE);
      var giaContrib = s.annual;
      isaVal += isaContrib;
      giaVal += giaContrib;

      // Grow
      var grossReturnIsa = isaVal * s.ret / 100;
      var grossReturnGia = giaVal * s.ret / 100;
      isaVal += grossReturnIsa;
      giaVal += grossReturnGia;

      // GIA taxes (estimated on this year's growth)
      var equityReturn = grossReturnGia * s.equityPct;
      var bondReturn = grossReturnGia * (1 - s.equityPct);

      // Dividend tax (simplified: assume dividends = equityReturn * 0.4 yield)
      var dividends = equityReturn * 0.4;
      var divAbove = Math.max(dividends - DIV_ALLOWANCE, 0);
      var divTax = divAbove * tax.div;

      // CGT (on the rest of equity gains + bond gains, minus exempt)
      var cgtGains = equityReturn * 0.6 + bondReturn; // capital appreciation
      var annualExempt = Math.max(CGT_EXEMPT - cgtExemptUsed, 0);
      var cgtable = Math.max(cgtGains - annualExempt, 0);
      cgtExemptUsed = Math.min(cgtExemptUsed + Math.max(cgtGains, 0), CGT_EXEMPT);
      var cgt = cgtable * tax.cgt;

      // Income tax on bond distributions (for GIA only)
      var bondIncomeTax = bondReturn * 0.4 * incomeTaxRate; // assume 40% of bond return is income

      var yearTax = divTax + cgt + bondIncomeTax;
      giaVal -= yearTax;
      giaTotalTax += yearTax;
      giaCgt += cgt;
      giaDivTax += divTax + bondIncomeTax;
    }

    var totalInvestedIsa = Math.min(s.annual, ISA_ALLOWANCE) * s.years;
    var totalInvestedGia = s.annual * s.years;
    var giaGrowth = giaVal - totalInvestedGia + giaTotalTax;

    return {
      isaFinal: isaVal,
      giaFinal: giaVal,
      totalTax: giaTotalTax,
      cgt: giaCgt,
      divTax: giaDivTax,
      advantage: isaVal - giaVal,
      totalInvestedIsa: totalInvestedIsa,
      totalInvestedGia: totalInvestedGia,
      giaGrowth: giaGrowth,
      isaGrowth: isaVal - totalInvestedIsa
    };
  }

  function calculate() {
    var s = read();
    var r = simulate(s);

    el['isa-out-isa'].textContent = C.money0(r.isaFinal);
    el['isa-out-gia'].textContent = C.money0(r.giaFinal);
    el['isa-out-tax'].textContent = C.money0(r.totalTax);
    el['isa-out-advantage'].textContent = C.money0(r.advantage);

    // Comparison table
    el['isa-cmp-invested-isa'].textContent = C.money0(r.totalInvestedIsa);
    el['isa-cmp-invested-gia'].textContent = C.money0(r.totalInvestedGia);
    el['isa-cmp-growth-isa'].textContent = C.money0(r.isaGrowth);
    el['isa-cmp-growth-gia'].textContent = C.money0(r.giaGrowth);
    el['isa-cmp-cgt'].textContent = C.money0(r.cgt);
    el['isa-cmp-divtax'].textContent = C.money0(r.divTax);
    el['isa-cmp-net-isa'].textContent = C.money0(r.isaGrowth);
    el['isa-cmp-net-gia'].textContent = C.money0(r.giaGrowth);
    el['isa-cmp-final-isa'].innerHTML = '<strong>' + C.money0(r.isaFinal) + '</strong>';
    el['isa-cmp-final-gia'].innerHTML = '<strong>' + C.money0(r.giaFinal) + '</strong>';

    // Verdict
    var verdict = el['isa-verdict'];
    verdict.className = 'calculator__verdict';
    if (r.advantage > 0) {
      verdict.textContent = 'ISA saves you ' + C.money0(r.advantage) + ' over ' + s.years + ' years by sheltering returns from CGT and dividend tax.';
      verdict.classList.add('calculator__verdict--win');
    } else {
      verdict.textContent = 'Both accounts produce similar outcomes with these inputs.';
      verdict.classList.add('calculator__verdict--tie');
    }

    // Chart
    C.barChart('isa-chart',
      ['ISA (Tax-Free)', 'GIA (Taxable)'],
      [{ data: [r.isaFinal, r.giaFinal], color: ['#38a169', '#2b6cb0'] }]);

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'isa_vs_gia',
        annual_investment: s.annual,
        years: s.years,
        return_pct: s.ret,
        tax_band: s.band,
        isa_final: r.isaFinal,
        gia_final: r.giaFinal,
        tax_paid: r.totalTax,
        isa_advantage: r.advantage
      });
    }
  }

  function reset() {
    el['isa-annual'].value = 10000; el['isa-annual-slider'].value = 10000;
    el['isa-years'].value = 20; el['isa-years-slider'].value = 20;
    el['isa-return'].value = 7; el['isa-return-slider'].value = 7;
    el['isa-tax-band'].value = 'basic';
    el['isa-equity'].value = 70; el['isa-equity-slider'].value = 70;
    calculate();
  }

  function init() {
    cache();
    if (!el['isa-annual']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    [
      ['isa-annual-slider', 'isa-annual'],
      ['isa-years-slider', 'isa-years'],
      ['isa-return-slider', 'isa-return'],
      ['isa-equity-slider', 'isa-equity']
    ].forEach(function (p) { bindPair(p[0], p[1]); });

    el['isa-tax-band'].addEventListener('change', recalc);
    el['isa-calculate'].addEventListener('click', calculate);
    el['isa-reset'].addEventListener('click', reset);

    document.addEventListener('i18n:updated', function () { C.schedule(calculate); });
    document.addEventListener('currency:changed', function () { C.schedule(calculate); });
    document.addEventListener('calc:reflow', function () { C.schedule(calculate); });

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
