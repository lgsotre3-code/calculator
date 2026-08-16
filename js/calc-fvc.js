/**
 * calc-fvc.js â€” Finance vs. Pay Cash calculator
 * ---------------------------------------------
 * Model: both options assume you own the home.
 *   â€¢ Financing: pay a down payment, keep (price âˆ’ down) invested at the
 *     investment return, and make monthly P&I payments.
 *   â€¢ Pay cash: pay the full price today; the purchase price no longer
 *     earns anything, but the monthly payments you avoid are invested.
 * The option with the higher end-of-term invested capital wins.
 *
 * Dependency: CalcCore (js/calc-core.js) + Chart.js. Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['fvc-price', 'fvc-price-slider', 'fvc-down', 'fvc-down-slider', 'fvc-down-usd',
     'fvc-rate', 'fvc-rate-slider', 'fvc-term', 'fvc-return', 'fvc-return-slider',
     'fvc-verdict', 'fvc-out-monthly', 'fvc-out-finance-total', 'fvc-out-cash-total',
     'fvc-out-finance-inv', 'fvc-out-cash-inv', 'fvc-chart-cost', 'fvc-chart-inv',
     'fvc-calculate', 'fvc-reset']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

  /* Standard amortization: returns monthly P&I, interest and paid totals. */
  function amortize(principal, annualRate, months) {
    var r = annualRate / 100 / 12;
    var M = r === 0
      ? principal / months
      : principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    var totalInterest = 0;
    var balance = principal;
    var balances = [principal];
    for (var i = 0; i < months; i++) {
      var interest = balance * r;
      totalInterest += interest;
      var principalPaid = M - interest;
      if (principalPaid > balance) principalPaid = balance;
      balance -= principalPaid;
      balances.push(Math.max(balance, 0));
    }
    return { M: M, totalInterest: totalInterest, totalPaid: principal + totalInterest, balances: balances };
  }

  function read() {
    return {
      price: C.clamp(C.val(el['fvc-price'], 0), 50000, 2000000),
      downPct: C.clamp(C.val(el['fvc-down'], 0), 0, 50),
      rate: C.clamp(C.val(el['fvc-rate'], 1), 0.01, 15),
      term: parseInt(el['fvc-term'].value, 10) || 30,
      ret: C.clamp(C.val(el['fvc-return'], 0), 0, 15)
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
    var down = s.price * s.downPct / 100;
    var loan = s.price - down;
    var sched = amortize(loan, s.rate, n);

    var totalFinance = down + sched.totalPaid;
    var totalCash = s.price;

    var rMonthly = s.ret / 100 / 12;
    var financeInv = loan * Math.pow(1 + s.ret / 100, s.term);
    var cashInv = rMonthly === 0
      ? sched.M * n
      : sched.M * (Math.pow(1 + rMonthly, n) - 1) / rMonthly;

    var diff = financeInv - cashInv;
    var verdict = el['fvc-verdict'];
    verdict.className = 'calculator__verdict';
    if (Math.abs(diff) < 1) {
      verdict.textContent = t('fvc_verdict_tie');
      verdict.classList.add('calculator__verdict--tie');
    } else if (diff > 0) {
      verdict.textContent = t('fvc_verdict_finance').replace('{amount}', C.money(diff));
      verdict.classList.add('calculator__verdict');
    } else {
      verdict.textContent = t('fvc_verdict_cash').replace('{amount}', C.money(-diff));
      verdict.classList.add('calculator__verdict--cash');
    }

    el['fvc-out-monthly'].textContent = C.money(sched.M);
    el['fvc-out-finance-total'].textContent = C.money(totalFinance);
    el['fvc-out-cash-total'].textContent = C.money(totalCash);
    el['fvc-out-finance-inv'].textContent = C.money(financeInv);
    el['fvc-out-cash-inv'].textContent = C.money(cashInv);

    renderCharts(s, sched, loan, down, financeInv, cashInv, rMonthly);

    return {
      cells: {
        [t('fvc_out_monthly')]: C.money(sched.M),
        [t('fvc_out_finance_total')]: C.money(totalFinance),
        [t('fvc_out_cash_total')]: C.money(totalCash),
        [t('fvc_out_finance_inv')]: C.money(financeInv),
        [t('fvc_out_cash_inv')]: C.money(cashInv),
        [t('fvc_out_advantage')]: verdict.textContent
      }
    };
  }

  function renderCharts(s, sched, loan, down, financeInv, cashInv, rMonthly) {
    var labels = [];
    var financeSeries = [];
    var cashSeries = [];
    var n = s.term * 12;
    for (var y = 0; y <= s.term; y++) {
      labels.push(y === 0 ? '0' : y);
      financeSeries.push(loan * Math.pow(1 + s.ret / 100, y));
      var m = y * 12;
      cashSeries.push(rMonthly === 0 ? sched.M * m : sched.M * (Math.pow(1 + rMonthly, m) - 1) / rMonthly);
    }

    C.barChart('fvc-chart-cost', [t('fvc_chart_cost_finance'), t('fvc_chart_cost_cash')],
      [{ data: [down + sched.totalPaid, s.price], color: ['#2b6cb0', '#38a169'] }]);

    C.lineChart('fvc-chart-inv', labels, [
      { label: t('fvc_chart_inv_finance'), data: financeSeries, color: '#2b6cb0', fill: false },
      { label: t('fvc_chart_inv_cash'), data: cashSeries, color: '#38a169', fill: false }
    ]);
  }

  function calculate() {
    var s = read();
    var down = s.price * s.downPct / 100;
    el['fvc-down-usd'].textContent = C.money(down);
    render(s);

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'finance_vs_cash',
        home_value: s.price,
        down_payment_pct: s.downPct,
        mortgage_rate: s.rate,
        loan_term: s.term,
        investment_return: s.ret
      });
    }
  }

  function reset() {
    el['fvc-price'].value = 350000; el['fvc-price-slider'].value = 350000;
    el['fvc-down'].value = 20; el['fvc-down-slider'].value = 20;
    el['fvc-rate'].value = 6.5; el['fvc-rate-slider'].value = 6.5;
    el['fvc-term'].value = 30;
    el['fvc-return'].value = 7; el['fvc-return-slider'].value = 7;
    calculate();
  }

  function init() {
    cache();
    if (!el['fvc-price']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId, fromSlider) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    bindPair('fvc-price-slider', 'fvc-price', false);
    bindPair('fvc-down-slider', 'fvc-down', false);
    bindPair('fvc-rate-slider', 'fvc-rate', false);
    bindPair('fvc-return-slider', 'fvc-return', false);
    el['fvc-term'].addEventListener('input', recalc);

    el['fvc-calculate'].addEventListener('click', calculate);
    el['fvc-reset'].addEventListener('click', reset);

    // Re-render labels and charts when the UI language changes.
    document.addEventListener('i18n:updated', function () {
      C.schedule(calculate);
    });

    // Re-render when the layout crosses a breakpoint or rotates (mobile fonts).
    document.addEventListener('calc:reflow', function () {
      C.schedule(calculate);
    });

    // Compare Scenarios: build cells from the current calculation.
    C.scenarios.init({
      container: '#fvc-scenario-table',
      addButton: '#fvc-scenario-add',
      clearButton: '#fvc-scenario-clear',
      nameInput: '#fvc-scenario-name',
      empty: t('scenario_empty'),
      buildCells: function () {
        var s = read();
        var n = s.term * 12;
        var down = s.price * s.downPct / 100;
        var sched = amortize(s.price - down, s.rate, n);
        var rMonthly = s.ret / 100 / 12;
        var financeInv = (s.price - down) * Math.pow(1 + s.ret / 100, s.term);
        var cashInv = rMonthly === 0 ? sched.M * n : sched.M * (Math.pow(1 + rMonthly, n) - 1) / rMonthly;
        var diff = financeInv - cashInv;
        var verdict = Math.abs(diff) < 1
          ? t('fvc_verdict_tie')
          : (diff > 0 ? t('fvc_verdict_finance').replace('{amount}', C.money(diff))
                      : t('fvc_verdict_cash').replace('{amount}', C.money(-diff)));
        return {
          cells: {
            [t('fvc_out_monthly')]: C.money(sched.M),
            [t('fvc_out_finance_total')]: C.money(down + sched.totalPaid),
            [t('fvc_out_cash_total')]: C.money(s.price),
            [t('fvc_out_finance_inv')]: C.money(financeInv),
            [t('fvc_out_cash_inv')]: C.money(cashInv),
            [t('fvc_out_advantage')]: verdict
          }
        };
      }
    });

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
