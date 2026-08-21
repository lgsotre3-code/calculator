/**
 * calc-points.js — Discount Points Calculator
 * ---------------------------------------------
 * Calculates whether buying mortgage discount points is worth it.
 * Each point costs X% of the loan (default 1%) and reduces the rate
 * by Y% (default 0.25%). Shows breakeven months, monthly savings,
 * and total cost comparison.
 *
 * Dependency: CalcCore (js/calc-core.js) + Chart.js. Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['pts-loan', 'pts-loan-slider', 'pts-rate', 'pts-rate-slider', 'pts-term',
     'pts-count', 'pts-count-slider', 'pts-reduction', 'pts-reduction-slider',
     'pts-cost-pct', 'pts-cost-pct-slider',
     'pts-verdict', 'pts-out-breakeven', 'pts-out-cost',
     'pts-out-before', 'pts-out-after', 'pts-out-savings', 'pts-out-new-rate',
     'pts-chart-savings', 'pts-chart-compare',
     'pts-calculate', 'pts-reset']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

  /* Standard amortization: returns monthly P&I payment and total interest. */
  function amortize(principal, annualRate, months) {
    var r = annualRate / 100 / 12;
    if (r === 0) return { M: principal / months, totalInterest: 0, totalPaid: principal };
    var M = principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    var totalInterest = M * months - principal;
    return { M: M, totalInterest: totalInterest, totalPaid: principal + totalInterest };
  }

  /* Build cumulative savings array (month by month) for the chart. */
  function cumulativeSavings(monthlyBefore, monthlyAfter, termMonths) {
    var data = [];
    var cumSavings = 0;
    for (var i = 0; i <= termMonths; i++) {
      data.push(Math.round(cumSavings * 100) / 100);
      cumSavings += (monthlyBefore - monthlyAfter);
    }
    return data;
  }

  function read() {
    return {
      loan: C.clamp(C.val(el['pts-loan'], 0), 10000, 2000000),
      rate: C.clamp(C.val(el['pts-rate'], 1), 0.01, 15),
      term: parseInt(el['pts-term'].value, 10) || 30,
      count: C.clamp(C.val(el['pts-count'], 0), 0, 4),
      reduction: C.clamp(C.val(el['pts-reduction'], 0.25), 0.1, 0.5),
      costPct: C.clamp(C.val(el['pts-cost-pct'], 1), 0.5, 2)
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

  function render(s) {
    var n = s.term * 12;
    var totalCost = s.loan * s.costPct / 100 * s.count;
    var newRate = Math.max(s.rate - s.reduction * s.count, 0.01);
    var base = amortize(s.loan, s.rate, n);
    var withPoints = amortize(s.loan, newRate, n);

    var monthlySavings = base.M - withPoints.M;
    var breakeven = monthlySavings > 0 ? Math.ceil(totalCost / monthlySavings) : 0;

    // Verdict
    var verdict = el['pts-verdict'];
    verdict.className = 'calculator__verdict';
    if (s.count === 0) {
      verdict.textContent = t('pts_verdict_none');
      verdict.classList.add('calculator__verdict--tie');
    } else if (monthlySavings <= 0) {
      verdict.textContent = t('pts_verdict_no_savings');
      verdict.classList.add('calculator__verdict--tie');
    } else if (breakeven > n) {
      verdict.textContent = t('pts_verdict_too_long').replace('{months}', breakeven);
      verdict.classList.add('calculator__verdict--cash');
    } else {
      var stayYears = Math.round(breakeven / 12 * 10) / 10;
      verdict.textContent = t('pts_verdict_worth').replace('{months}', breakeven).replace('{years}', stayYears);
      verdict.classList.add('calculator__verdict');
    }

    el['pts-out-cost'].textContent = C.money(totalCost);
    el['pts-out-before'].textContent = C.money(base.M);
    el['pts-out-after'].textContent = C.money(withPoints.M);
    el['pts-out-savings'].textContent = C.money(monthlySavings);
    el['pts-out-new-rate'].textContent = newRate.toFixed(2) + '%';
    el['pts-out-breakeven'].textContent = s.count === 0 || monthlySavings <= 0
      ? t('pts_breakeven_na')
      : breakeven + ' ' + t('months');

    renderCharts(s, base, withPoints, totalCost, monthlySavings, n);

    return {
      cells: {
        [t('pts_out_cost')]: C.money(totalCost),
        [t('pts_out_monthly_before')]: C.money(base.M),
        [t('pts_out_monthly_after')]: C.money(withPoints.M),
        [t('pts_out_savings')]: C.money(monthlySavings),
        [t('pts_out_new_rate')]: newRate.toFixed(2) + '%',
        [t('pts_out_breakeven')]: s.count === 0 || monthlySavings <= 0
          ? t('pts_breakeven_na')
          : breakeven + ' ' + t('months')
      }
    };
  }

  function renderCharts(s, base, withPoints, totalCost, monthlySavings, n) {
    // Cumulative savings line chart
    var labels = [];
    var savingsData = cumulativeSavings(base.M, withPoints.M, n);
    for (var i = 0; i <= n; i++) {
      labels.push(i % 12 === 0 ? (i / 12) : '');
    }
    C.lineChart('pts-chart-savings', labels, [
      { label: t('pts_chart_savings_label'), data: savingsData, color: '#2b6cb0', fill: true }
    ]);

    // Total cost comparison bar chart
    C.barChart('pts-chart-compare', [t('pts_chart_no_points'), t('pts_chart_with_points')],
      [{ data: [base.totalInterest, withPoints.totalInterest + totalCost], color: ['#e53e3e', '#38a169'] }]);
  }

  function calculate() {
    var s = read();
    render(s);

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'discount_points',
        loan_amount: s.loan,
        base_rate: s.rate,
        loan_term: s.term,
        points_count: s.count,
        rate_reduction: s.reduction,
        cost_per_point_pct: s.costPct
      });
    }
  }

  function reset() {
    el['pts-loan'].value = 300000; el['pts-loan-slider'].value = 300000;
    el['pts-rate'].value = 6.5; el['pts-rate-slider'].value = 6.5;
    el['pts-term'].value = 30;
    el['pts-count'].value = 1; el['pts-count-slider'].value = 1;
    el['pts-reduction'].value = 0.25; el['pts-reduction-slider'].value = 0.25;
    el['pts-cost-pct'].value = 1; el['pts-cost-pct-slider'].value = 1;
    calculate();
  }

  function init() {
    cache();
    if (!el['pts-loan']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId, fromSlider) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    bindPair('pts-loan-slider', 'pts-loan', false);
    bindPair('pts-rate-slider', 'pts-rate', false);
    bindPair('pts-count-slider', 'pts-count', false);
    bindPair('pts-reduction-slider', 'pts-reduction', false);
    bindPair('pts-cost-pct-slider', 'pts-cost-pct', false);
    el['pts-term'].addEventListener('input', recalc);

    el['pts-calculate'].addEventListener('click', calculate);
    el['pts-reset'].addEventListener('click', reset);

    document.addEventListener('i18n:updated', function () {
      C.schedule(calculate);
    });

    document.addEventListener('currency:changed', function () {
      C.schedule(calculate);
    });

    document.addEventListener('calc:reflow', function () {
      C.schedule(calculate);
    });

    // Compare Scenarios
    C.scenarios.init({
      container: '#pts-scenario-table',
      addButton: '#pts-scenario-add',
      clearButton: '#pts-scenario-clear',
      nameInput: '#pts-scenario-name',
      emptyKey: 'scenario_empty',
      buildCells: function () {
        var s = read();
        var n = s.term * 12;
        var totalCost = s.loan * s.costPct / 100 * s.count;
        var newRate = Math.max(s.rate - s.reduction * s.count, 0.01);
        var base = amortize(s.loan, s.rate, n);
        var withPoints = amortize(s.loan, newRate, n);
        var monthlySavings = base.M - withPoints.M;
        var breakeven = monthlySavings > 0 ? Math.ceil(totalCost / monthlySavings) : 0;
        return {
          cells: {
            [t('pts_out_cost')]: C.money(totalCost),
            [t('pts_out_monthly_before')]: C.money(base.M),
            [t('pts_out_monthly_after')]: C.money(withPoints.M),
            [t('pts_out_savings')]: C.money(monthlySavings),
            [t('pts_out_new_rate')]: newRate.toFixed(2) + '%',
            [t('pts_out_breakeven')]: s.count === 0 || monthlySavings <= 0
              ? t('pts_breakeven_na')
              : breakeven + ' ' + t('months')
          }
        };
      }
    });

    // Initial render: wait for i18n dictionary
    if (window.i18n && window.i18n.ready) {
      window.i18n.ready.then(calculate).catch(calculate);
    } else {
      calculate();
    }

    // Prefill rate with market rate
    C.prefillRate({ inputId: 'pts-rate', sliderId: 'pts-rate-slider', onApplied: calculate });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
