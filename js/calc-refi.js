/**
 * calc-refi.js — Refinance calculator
 * -----------------------------------
 * Compares the current loan (balance, rate, remaining term) with a new loan
 * (new rate, new term, closing costs):
 *   • New monthly payment and monthly savings.
 *   • Total interest saved over the life of the new loan.
 *   • Break-even point in months (closing costs ÷ monthly savings).
 *   • Side-by-side comparison table + a monthly payment bar chart.
 *
 * Dependency: CalcCore + Chart.js. Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['refi-balance', 'refi-balance-slider', 'refi-current-rate', 'refi-current-rate-slider',
     'refi-remaining-term', 'refi-remaining-term-slider',
     'refi-new-rate', 'refi-new-rate-slider', 'refi-new-term', 'refi-new-term-slider',
     'refi-closing-costs', 'refi-closing-costs-slider',
     'refi-verdict', 'refi-out-new-payment', 'refi-out-monthly-savings',
     'refi-out-total-savings', 'refi-out-break-even',
     'refi-cmp-rate-cur', 'refi-cmp-rate-new', 'refi-cmp-term-cur', 'refi-cmp-term-new',
     'refi-cmp-pay-cur', 'refi-cmp-pay-new', 'refi-cmp-int-cur', 'refi-cmp-int-new',
     'refi-calculate', 'refi-reset', 'refi-chart-payment']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

  function amortize(principal, annualRate, termYears) {
    var r = annualRate / 100 / 12;
    var months = termYears * 12;
    if (principal <= 0 || months <= 0) return { M: 0, totalInterest: 0, totalPaid: 0 };
    if (r === 0) return { M: principal / months, totalInterest: 0, totalPaid: principal };
    var M = principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    return {
      M: M,
      totalInterest: M * months - principal,
      totalPaid: M * months
    };
  }

  function read() {
    return {
      balance: C.clamp(C.val(el['refi-balance'], 0), 0, 2000000),
      currentRate: C.clamp(C.val(el['refi-current-rate'], 0), 0, 25),
      remainingTerm: C.clamp(Math.round(C.val(el['refi-remaining-term'], 1)), 1, 40),
      newRate: C.clamp(C.val(el['refi-new-rate'], 0), 0, 25),
      newTerm: C.clamp(Math.round(C.val(el['refi-new-term'], 1)), 1, 40),
      closingCosts: C.clamp(C.val(el['refi-closing-costs'], 0), 0, 500000)
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

  function calculate() {
    var s = read();
    var cur = amortize(s.balance, s.currentRate, s.remainingTerm);
    var neu = amortize(s.balance, s.newRate, s.newTerm);

    var monthlySavings = Math.max(cur.M - neu.M, 0);
    var totalSaved = Math.max(cur.totalInterest - neu.totalInterest, 0);
    var breakEven = monthlySavings > 0 ? Math.ceil(s.closingCosts / monthlySavings) : null;

    el['refi-out-new-payment'].textContent = C.money(neu.M);
    el['refi-out-monthly-savings'].textContent = monthlySavings > 0 ? C.money(monthlySavings) : '—';
    el['refi-out-total-savings'].textContent = C.money(totalSaved);
    el['refi-out-break-even'].textContent = breakEven === null
      ? t('refi_no_savings')
      : breakEven + ' ' + t('months_abbr');

    var verdict = el['refi-verdict'];
    verdict.className = 'calculator__verdict';
    if (breakEven === null) {
      verdict.textContent = t('refi_verdict_none');
      verdict.classList.add('calculator__verdict--lose');
    } else if (neu.M >= cur.M && totalSaved <= 0) {
      verdict.textContent = t('refi_verdict_no_gain');
      verdict.classList.add('calculator__verdict--tie');
    } else {
      verdict.textContent = t('refi_verdict_ok')
        .replace('{savings}', C.money(monthlySavings))
        .replace('{months}', breakEven);
    }

    // Comparison table
    el['refi-cmp-rate-cur'].textContent = C.pct(s.currentRate);
    el['refi-cmp-rate-new'].textContent = C.pct(s.newRate);
    el['refi-cmp-term-cur'].textContent = s.remainingTerm + 'y';
    el['refi-cmp-term-new'].textContent = s.newTerm + 'y';
    el['refi-cmp-pay-cur'].textContent = C.money(cur.M);
    el['refi-cmp-pay-new'].textContent = C.money(neu.M);
    el['refi-cmp-int-cur'].textContent = C.money(cur.totalInterest);
    el['refi-cmp-int-new'].textContent = C.money(neu.totalInterest);

    renderChart(s, cur.M, neu.M);

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'refinance',
        current_balance: s.balance,
        current_rate: s.currentRate,
        remaining_term: s.remainingTerm,
        new_rate: s.newRate,
        new_term: s.newTerm,
        closing_costs: s.closingCosts,
        monthly_savings: monthlySavings,
        total_interest_saved: totalSaved,
        break_even_months: breakEven
      });
    }
  }

  function renderChart(s, curM, newM) {
    C.barChart('refi-chart-payment',
      [t('refi_cmp_current'), t('refi_cmp_new')],
      [{ data: [curM, newM], color: ['#2b6cb0', '#38a169'] }]);
  }

  function reset() {
    el['refi-balance'].value = 300000; el['refi-balance-slider'].value = 300000;
    el['refi-current-rate'].value = 6.5; el['refi-current-rate-slider'].value = 6.5;
    el['refi-remaining-term'].value = 25; el['refi-remaining-term-slider'].value = 25;
    el['refi-new-rate'].value = 5.5; el['refi-new-rate-slider'].value = 5.5;
    el['refi-new-term'].value = 30; el['refi-new-term-slider'].value = 30;
    el['refi-closing-costs'].value = 6000; el['refi-closing-costs-slider'].value = 6000;
    calculate();
  }

  function init() {
    cache();
    if (!el['refi-balance']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    [
      ['refi-balance-slider', 'refi-balance'],
      ['refi-current-rate-slider', 'refi-current-rate'],
      ['refi-remaining-term-slider', 'refi-remaining-term'],
      ['refi-new-rate-slider', 'refi-new-rate'],
      ['refi-new-term-slider', 'refi-new-term'],
      ['refi-closing-costs-slider', 'refi-closing-costs']
    ].forEach(function (p) { bindPair(p[0], p[1]); });

    el['refi-calculate'].addEventListener('click', calculate);
    el['refi-reset'].addEventListener('click', reset);

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
