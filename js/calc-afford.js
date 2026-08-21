/**
 * calc-afford.js — Affordability calculator (28/36 rule)
 * -------------------------------------------------------
 * Applies the front-end (28% housing) and back-end (36% total debt)
 * ratios to gross monthly income:
 *   • front budget = 28% of monthly income
 *   • back budget  = 36% of monthly income − existing monthly debts
 *   • recommended  = min(front, back)
 * The recommended budget is turned into a maximum home value via reverse
 * amortization (solving for the home price whose total monthly housing
 * cost — P&I + taxes + insurance + HOA — equals the budget).
 *
 * Dependency: CalcCore + Chart.js. Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['afford-income', 'afford-income-slider', 'afford-debt', 'afford-debt-slider',
     'afford-rate', 'afford-rate-slider', 'afford-term', 'afford-term-slider',
     'afford-down', 'afford-down-slider', 'afford-tax', 'afford-tax-slider',
     'afford-insurance', 'afford-insurance-slider', 'afford-hoa', 'afford-hoa-slider',
     'afford-verdict', 'afford-out-front', 'afford-out-back', 'afford-out-recommended',
     'afford-out-home', 'afford-out-loan', 'afford-out-housing',
     'afford-chart', 'afford-calculate', 'afford-reset']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

  /** Monthly payment factor per $1 of principal. */
  function factor(annualRate, termYears) {
    var r = annualRate / 100 / 12;
    var months = termYears * 12;
    if (r === 0 || months <= 0) return months > 0 ? 1 / months : 0;
    var p = Math.pow(1 + r, months);
    return r * p / (p - 1);
  }

  function read() {
    return {
      income: C.clamp(C.val(el['afford-income'], 0), 0, 10000000),
      debt: C.clamp(C.val(el['afford-debt'], 0), 0, 10000000),
      rate: C.clamp(C.val(el['afford-rate'], 0), 0, 15),
      term: C.clamp(Math.round(C.val(el['afford-term'], 1)), 1, 40),
      down: C.clamp(C.val(el['afford-down'], 0), 0, 100),
      tax: C.clamp(C.val(el['afford-tax'], 0), 0, 10),
      insurance: C.clamp(C.val(el['afford-insurance'], 0), 0, 10000000),
      hoa: C.clamp(C.val(el['afford-hoa'], 0), 0, 10000000)
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
   * Reverse amortization: the home value whose total monthly housing cost
   * equals `budget`. Returns 0 when no positive home value fits.
   */
  function maxHomeValue(s, budget) {
    var monthlyFactor = factor(s.rate, s.term);
    var denom = (1 - s.down / 100) * monthlyFactor + s.tax / 100 / 12;
    if (denom <= 0) return 0;
    var fixed = s.insurance / 12 + s.hoa;
    return Math.max((budget - fixed) / denom, 0);
  }

  /** Total monthly housing cost for a given home value. */
  function housingCost(s, homeValue) {
    var pi = homeValue * (1 - s.down / 100) * factor(s.rate, s.term);
    var tax = homeValue * s.tax / 100 / 12;
    return pi + tax + s.insurance / 12 + s.hoa;
  }

  function calculate() {
    var s = read();
    var monthlyIncome = s.income / 12;

    var frontBudget = monthlyIncome * 0.28;
    var backBudget = Math.max(monthlyIncome * 0.36 - s.debt, 0);
    var recommended = Math.min(frontBudget, backBudget);
    var home = maxHomeValue(s, recommended);
    var loan = home * (1 - s.down / 100);
    var monthly = housingCost(s, home);

    el['afford-out-front'].textContent = C.money(frontBudget);
    el['afford-out-back'].textContent = C.money(backBudget);
    el['afford-out-recommended'].textContent = C.money(recommended);
    el['afford-out-home'].textContent = C.money(home);
    el['afford-out-loan'].textContent = C.money(loan);
    el['afford-out-housing'].textContent = C.money(monthly);

    // Verdict: which ratio is the limiting factor?
    var verdict = el['afford-verdict'];
    verdict.className = 'calculator__verdict';
    if (home <= 0) {
      verdict.textContent = t('afford_verdict_none');
      verdict.classList.add('calculator__verdict--lose');
    } else if (backBudget < frontBudget - 0.01) {
      verdict.textContent = t('afford_verdict_back');
      verdict.classList.add('calculator__verdict--cash');
    } else {
      verdict.textContent = t('afford_verdict_front');
    }

    // Ratios actually used (as % of gross monthly income).
    var frontRatio = monthlyIncome > 0 ? monthly / monthlyIncome * 100 : 0;
    var backRatio = monthlyIncome > 0 ? (monthly + s.debt) / monthlyIncome * 100 : 0;

    renderChart(frontRatio, backRatio);

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'affordability',
        annual_income: s.income,
        monthly_debt: s.debt,
        interest_rate: s.rate,
        loan_term: s.term,
        down_payment_pct: s.down,
        property_tax: s.tax,
        insurance: s.insurance,
        hoa: s.hoa,
        front_budget: frontBudget,
        back_budget: backBudget,
        recommended_budget: recommended,
        max_home_value: home,
        loan_amount: loan
      });
    }
  }

  function renderChart(frontRatio, backRatio) {
    C.barChart('afford-chart', [
      t('afford_chart_front'),
      t('afford_chart_back')
    ], [
      { label: t('afford_chart_limit'), color: '#a0aec0', data: [28, 36] },
      { label: t('afford_chart_usage'), color: '#2b6cb0', data: [frontRatio, backRatio] }
    ], { format: 'pct', legend: 'bottom' });
  }

  function reset() {
    el['afford-income'].value = 90000; el['afford-income-slider'].value = 90000;
    el['afford-debt'].value = 500; el['afford-debt-slider'].value = 500;
    el['afford-rate'].value = 6.5; el['afford-rate-slider'].value = 6.5;
    el['afford-term'].value = 30; el['afford-term-slider'].value = 30;
    el['afford-down'].value = 20; el['afford-down-slider'].value = 20;
    el['afford-tax'].value = 1.2; el['afford-tax-slider'].value = 1.2;
    el['afford-insurance'].value = 1200; el['afford-insurance-slider'].value = 1200;
    el['afford-hoa'].value = 0; el['afford-hoa-slider'].value = 0;
    calculate();
  }

  function init() {
    cache();
    if (!el['afford-income']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    [
      ['afford-income-slider', 'afford-income'],
      ['afford-debt-slider', 'afford-debt'],
      ['afford-rate-slider', 'afford-rate'],
      ['afford-term-slider', 'afford-term'],
      ['afford-down-slider', 'afford-down'],
      ['afford-tax-slider', 'afford-tax'],
      ['afford-insurance-slider', 'afford-insurance'],
      ['afford-hoa-slider', 'afford-hoa']
    ].forEach(function (p) { bindPair(p[0], p[1]); });

    el['afford-calculate'].addEventListener('click', calculate);
    el['afford-reset'].addEventListener('click', reset);

    document.addEventListener('i18n:updated', function () { C.schedule(calculate); });
    document.addEventListener('currency:changed', function () { C.schedule(calculate); });
    document.addEventListener('calc:reflow', function () { C.schedule(calculate); });

    if (window.i18n && window.i18n.ready) {
      window.i18n.ready.then(calculate).catch(calculate);
    } else {
      calculate();
    }

    // Prefill the interest rate with the current market rate (FRED via the
    // Vercel function). Best-effort: keeps the default if it fails.
    C.prefillRate({ inputId: 'afford-rate', sliderId: 'afford-rate-slider', noteId: 'current-rate-note', onApplied: calculate });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
