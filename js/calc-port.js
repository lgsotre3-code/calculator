/**
 * calc-port.js â€” Loan Portability calculator
 * ------------------------------------------
 * Compares the current mortgage with a new one at the offered rate, on the
 * same outstanding balance and remaining term, and includes portability
 * costs (TAC, appraisal, notary, etc.).
 *
 * Outputs: current/new monthly payment, monthly savings, total savings over
 * the remaining term, interest saved, payback (months to recover the fees)
 * and the net benefit after costs.
 *
 * Dependency: CalcCore + Chart.js. Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['port-balance', 'port-balance-slider', 'port-rate-current', 'port-rate-current-slider',
     'port-rate-new', 'port-rate-new-slider', 'port-term', 'port-costs', 'port-costs-slider',
     'port-verdict', 'port-out-current', 'port-out-new', 'port-out-monthly-savings',
     'port-out-total-savings', 'port-out-interest-saved', 'port-out-payback', 'port-out-net',
     'port-chart-balance', 'port-chart-pay', 'port-calculate', 'port-reset']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

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
      balance: C.clamp(C.val(el['port-balance'], 0), 0, 2000000),
      rateCur: C.clamp(C.val(el['port-rate-current'], 0), 0.01, 15),
      rateNew: C.clamp(C.val(el['port-rate-new'], 0), 0.01, 15),
      term: parseInt(el['port-term'].value, 10) || 30,
      costs: C.clamp(C.val(el['port-costs'], 0), 0, 100000)
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
    var cur = amortize(s.balance, s.rateCur, n);
    var neu = amortize(s.balance, s.rateNew, n);

    var monthlySavings = cur.M - neu.M;
    var totalSavings = monthlySavings * n;
    var interestSaved = Math.max(cur.totalInterest - neu.totalInterest, 0);
    var payback = monthlySavings > 0 ? Math.ceil(s.costs / monthlySavings) : null;
    var net = totalSavings - s.costs;

    el['port-out-current'].textContent = C.money(cur.M);
    el['port-out-new'].textContent = C.money(neu.M);
    el['port-out-monthly-savings'].textContent = C.money(Math.max(monthlySavings, 0));
    el['port-out-total-savings'].textContent = C.money(Math.max(totalSavings, 0));
    el['port-out-interest-saved'].textContent = C.money(interestSaved);
    el['port-out-payback'].textContent = payback === null ? 'â€”' : C.num(payback) + ' ' + t('months_abbr');
    el['port-out-net'].textContent = C.money(net);
    el['port-out-net'].parentElement.classList.toggle('calculator__card--good', net >= 0);
    el['port-out-net'].parentElement.classList.toggle('calculator__card--bad', net < 0);

    var verdict = el['port-verdict'];
    verdict.className = 'calculator__verdict';
    if (monthlySavings <= 0) {
      verdict.textContent = t('port_verdict_worse');
      verdict.classList.add('calculator__verdict--lose');
    } else {
      verdict.textContent = t('port_verdict_ok')
        .replace('{monthly}', C.money(monthlySavings))
        .replace('{total}', C.money(totalSavings))
        .replace('{payback}', payback === null ? 'â€”' : C.num(payback) + ' ' + t('months_abbr'));
      verdict.classList.add('calculator__verdict');
    }

    renderCharts(cur, neu);

    return {
      cells: {
        [t('port_out_current')]: C.money(cur.M),
        [t('port_out_new')]: C.money(neu.M),
        [t('port_out_monthly_savings')]: C.money(Math.max(monthlySavings, 0)),
        [t('port_out_total_savings')]: C.money(Math.max(totalSavings, 0)),
        [t('port_out_interest_saved')]: C.money(interestSaved),
        [t('port_out_payback')]: payback === null ? 'â€”' : C.num(payback) + ' ' + t('months_abbr'),
        [t('port_out_net')]: C.money(net)
      }
    };
  }

  function renderCharts(cur, neu) {
    var labels = [];
    var curSeries = [];
    var newSeries = [];
    var every = Math.max(1, Math.floor(cur.balances.length / 120));
    for (var i = 0; i < cur.balances.length; i += every) {
      labels.push(i === 0 ? '0' : i);
      curSeries.push(Math.round(cur.balances[i]));
      newSeries.push(Math.round(neu.balances[i]));
    }
    var lastIdx = cur.balances.length - 1;
    if (labels[labels.length - 1] !== lastIdx) {
      labels.push(lastIdx);
      curSeries.push(Math.round(cur.balances[lastIdx]));
      newSeries.push(Math.round(neu.balances[lastIdx]));
    }

    C.lineChart('port-chart-balance', labels, [
      { label: t('port_chart_current'), data: curSeries, color: '#c53030', fill: false },
      { label: t('port_chart_new'), data: newSeries, color: '#2f855a', fill: false }
    ]);

    C.barChart('port-chart-pay', [t('port_chart_current'), t('port_chart_new')],
      [{ data: [cur.M, neu.M], color: ['#c53030', '#2f855a'] }]);
  }

  function calculate() {
    var s = read();
    render(s);

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'loan_portability',
        balance: s.balance,
        current_rate: s.rateCur,
        new_rate: s.rateNew,
        remaining_term: s.term,
        costs: s.costs
      });
    }
  }

  function reset() {
    el['port-balance'].value = 250000; el['port-balance-slider'].value = 250000;
    el['port-rate-current'].value = 9; el['port-rate-current-slider'].value = 9;
    el['port-rate-new'].value = 7; el['port-rate-new-slider'].value = 7;
    el['port-term'].value = 30;
    el['port-costs'].value = 2500; el['port-costs-slider'].value = 2500;
    calculate();
  }

  function init() {
    cache();
    if (!el['port-balance']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId, fromSlider) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    bindPair('port-balance-slider', 'port-balance', false);
    bindPair('port-rate-current-slider', 'port-rate-current', false);
    bindPair('port-rate-new-slider', 'port-rate-new', false);
    bindPair('port-costs-slider', 'port-costs', false);
    el['port-term'].addEventListener('input', recalc);

    el['port-calculate'].addEventListener('click', calculate);
    el['port-reset'].addEventListener('click', reset);

    // Re-render labels and charts when the UI language changes.
    document.addEventListener('i18n:updated', function () {
      C.schedule(calculate);
    });

    // Re-render when the layout crosses a breakpoint or rotates (mobile fonts).
    document.addEventListener('calc:reflow', function () {
      C.schedule(calculate);
    });

    C.scenarios.init({
      container: '#port-scenario-table',
      addButton: '#port-scenario-add',
      clearButton: '#port-scenario-clear',
      nameInput: '#port-scenario-name',
      empty: t('scenario_empty'),
      buildCells: function () {
        var s = read();
        var n = s.term * 12;
        var cur = amortize(s.balance, s.rateCur, n);
        var neu = amortize(s.balance, s.rateNew, n);
        var monthlySavings = cur.M - neu.M;
        var totalSavings = monthlySavings * n;
        var payback = monthlySavings > 0 ? Math.ceil(s.costs / monthlySavings) : null;
        return {
          cells: {
            [t('port_out_current')]: C.money(cur.M),
            [t('port_out_new')]: C.money(neu.M),
            [t('port_out_monthly_savings')]: C.money(Math.max(monthlySavings, 0)),
            [t('port_out_total_savings')]: C.money(Math.max(totalSavings, 0)),
            [t('port_out_payback')]: payback === null ? 'â€”' : C.num(payback) + ' ' + t('months_abbr'),
            [t('port_out_net')]: C.money(totalSavings - s.costs)
          }
        };
      }
    });

    calculate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
