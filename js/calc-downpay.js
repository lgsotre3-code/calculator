/**
 * calc-downpay.js — Down payment calculator
 * ------------------------------------------
 * Computes what a down payment really buys you:
 *   • Down payment amount and loan amount.
 *   • Monthly payment (P&I), PMI when the down payment is under 20%, and
 *     total interest over the loan term.
 *   • A side-by-side comparison of 5%, 10%, 15% and 20% down payments.
 *
 * Dependency: CalcCore + Chart.js. Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['downpay-price', 'downpay-price-slider', 'downpay-pct', 'downpay-pct-slider',
     'downpay-rate', 'downpay-rate-slider', 'downpay-term', 'downpay-term-slider',
     'downpay-verdict', 'downpay-out-amount', 'downpay-out-loan', 'downpay-out-monthly',
     'downpay-out-pmi', 'downpay-out-interest', 'downpay-out-ltv',
     'downpay-cmp-1-down', 'downpay-cmp-1-loan', 'downpay-cmp-1-pay', 'downpay-cmp-1-pmi',
     'downpay-cmp-2-down', 'downpay-cmp-2-loan', 'downpay-cmp-2-pay', 'downpay-cmp-2-pmi',
     'downpay-cmp-3-down', 'downpay-cmp-3-loan', 'downpay-cmp-3-pay', 'downpay-cmp-3-pmi',
     'downpay-cmp-4-down', 'downpay-cmp-4-loan', 'downpay-cmp-4-pay', 'downpay-cmp-4-pmi',
     'downpay-chart-payment', 'downpay-calculate', 'downpay-reset']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

  function amortize(principal, annualRate, termYears) {
    var r = annualRate / 100 / 12;
    var months = termYears * 12;
    if (principal <= 0 || months <= 0) return { M: 0, totalInterest: 0 };
    if (r === 0) return { M: principal / months, totalInterest: 0 };
    var M = principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    return { M: M, totalInterest: M * months - principal };
  }

  /** Annual PMI rate as a % of the loan: higher when the LTV is higher. */
  function pmiRate(ltv) {
    if (ltv <= 80) return 0;
    if (ltv <= 85) return 0.30;
    if (ltv <= 90) return 0.50;
    if (ltv <= 95) return 0.70;
    return 0.85;
  }

  function read() {
    return {
      price: C.clamp(C.val(el['downpay-price'], 0), 50000, 5000000),
      pct: C.clamp(C.val(el['downpay-pct'], 0), 0, 50),
      rate: C.clamp(C.val(el['downpay-rate'], 0), 0, 15),
      term: C.clamp(Math.round(C.val(el['downpay-term'], 1)), 1, 40)
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

  function scenario(pct) {
    var down = pct / 100 * s.price;
    var loan = s.price - down;
    var ltv = 100 - pct;
    var pmi = pmiRate(ltv);
    var pmt = amortize(loan, s.rate, s.term);
    return {
      pct: pct, down: down, loan: loan, ltv: ltv,
      monthly: pmt.M,
      pmiMonthly: (loan * pmi / 100) / 12,
      totalInterest: pmt.totalInterest
    };
  }

  var s = null;

  function calculate() {
    s = read();
    var sc = scenario(s.pct);

    el['downpay-out-amount'].textContent = C.money(sc.down);
    el['downpay-out-loan'].textContent = C.money(sc.loan);
    el['downpay-out-monthly'].textContent = C.money(sc.monthly + sc.pmiMonthly);
    el['downpay-out-pmi'].textContent = sc.pmiMonthly > 0 ? C.money(sc.pmiMonthly) : '—';
    el['downpay-out-interest'].textContent = C.money(sc.totalInterest);
    el['downpay-out-ltv'].textContent = C.pct(sc.ltv);

    var verdict = el['downpay-verdict'];
    verdict.className = 'calculator__verdict';
    if (sc.ltv <= 80) {
      verdict.textContent = t('downpay_verdict_ok');
      verdict.classList.add('calculator__verdict');
    } else {
      verdict.textContent = t('downpay_verdict_pmi').replace('{pct}', s.pct);
      verdict.classList.add('calculator__verdict--cash');
    }

    // Comparison: 5%, 10%, 15%, 20%
    [5, 10, 15, 20].forEach(function (pct, i) {
      var c = scenario(pct);
      el['downpay-cmp-' + (i + 1) + '-down'].textContent = C.money(c.down);
      el['downpay-cmp-' + (i + 1) + '-loan'].textContent = C.money(c.loan);
      el['downpay-cmp-' + (i + 1) + '-pay'].textContent = C.money(c.monthly + c.pmiMonthly);
      el['downpay-cmp-' + (i + 1) + '-pmi'].textContent = c.pmiMonthly > 0 ? C.money(c.pmiMonthly) : '—';
    });

    renderChart();

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'down_payment',
        home_price: s.price,
        down_payment_pct: s.pct,
        interest_rate: s.rate,
        loan_term: s.term,
        down_payment_amount: sc.down,
        loan_amount: sc.loan,
        monthly_payment: sc.monthly + sc.pmiMonthly,
        pmi_monthly: sc.pmiMonthly
      });
    }
  }

  function renderChart() {
    var labels = ['5%', '10%', '15%', '20%'];
    var data = labels.map(function (p) { var c = scenario(parseFloat(p)); return c.monthly + c.pmiMonthly; });
    C.barChart('downpay-chart-payment', labels, [{ data: data, color: '#2b6cb0' }]);
  }

  function reset() {
    el['downpay-price'].value = 400000; el['downpay-price-slider'].value = 400000;
    el['downpay-pct'].value = 10; el['downpay-pct-slider'].value = 10;
    el['downpay-rate'].value = 6.5; el['downpay-rate-slider'].value = 6.5;
    el['downpay-term'].value = 30; el['downpay-term-slider'].value = 30;
    calculate();
  }

  function init() {
    cache();
    if (!el['downpay-price']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    [
      ['downpay-price-slider', 'downpay-price'],
      ['downpay-pct-slider', 'downpay-pct'],
      ['downpay-rate-slider', 'downpay-rate'],
      ['downpay-term-slider', 'downpay-term']
    ].forEach(function (p) { bindPair(p[0], p[1]); });

    el['downpay-calculate'].addEventListener('click', calculate);
    el['downpay-reset'].addEventListener('click', reset);

    document.addEventListener('i18n:updated', function () { C.schedule(calculate); });
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
