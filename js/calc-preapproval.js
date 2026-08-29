/**
 * calc-preapproval.js — Mortgage Pre-Approval Estimate calculator
 * ---------------------------------------------------------------------
 * Estimates how much a lender is likely to pre-approve based on the
 * standard front-end / back-end DTI (debt-to-income) test used by most
 * conventional and FHA underwriters:
 *   • Front-end ratio  — housing payment (PI + taxes + insurance + HOA)
 *     stays within a cap of gross monthly income (28% conventional,
 *     31% FHA default here).
 *   • Back-end ratio   — housing payment + all other monthly debts stays
 *     within a cap of gross monthly income (36% conventional, 43% FHA).
 * The binding constraint is whichever ratio produces the lower max
 * housing payment. From that payment we back-solve the maximum loan
 * amount via the standard amortization formula, then add the down
 * payment to estimate max home price. PMI is added back into the
 * housing-payment budget when LTV > 80%.
 *
 * Dependency: CalcCore (+ Chart.js via CalcCore.barChart). Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var t = C.t;

  var LOAN_TYPE_CAPS = {
    conventional: { front: 0.28, back: 0.36 },
    fha: { front: 0.31, back: 0.43 },
    va: { front: 0.41, back: 0.41 } // VA uses a single residual/DTI-style cap; 41% back-end is the common guideline
  };

  var el = {};
  function cache() {
    ['pa-income', 'pa-income-slider', 'pa-debts', 'pa-debts-slider',
     'pa-down-payment', 'pa-down-payment-slider', 'pa-rate', 'pa-rate-slider',
     'pa-term', 'pa-loan-type', 'pa-tax-rate', 'pa-insurance-annual', 'pa-hoa',
     'pa-out-max-payment', 'pa-out-max-loan', 'pa-out-max-price',
     'pa-out-front-ratio', 'pa-out-back-ratio', 'pa-out-binding',
     'pa-b-pi', 'pa-b-tax', 'pa-b-ins', 'pa-b-hoa', 'pa-b-pmi', 'pa-b-total',
     'pa-calculate', 'pa-reset', 'pa-chart-split']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  /* ---------- core math ---------- */

  /** Max loan amount supportable by a given monthly P&I payment. */
  function maxLoanFromPI(monthlyPI, annualRate, termYears) {
    var r = annualRate / 100 / 12;
    var n = termYears * 12;
    if (r === 0) return monthlyPI * n;
    return monthlyPI * (1 - Math.pow(1 + r, -n)) / r;
  }

  /** Monthly P&I for a given loan amount (used to size PMI iteratively). */
  function piFromLoan(loan, annualRate, termYears) {
    var r = annualRate / 100 / 12;
    var n = termYears * 12;
    if (r === 0) return loan / n;
    return loan * r / (1 - Math.pow(1 + r, -n));
  }

  function read() {
    return {
      income: C.clamp(C.val(el['pa-income'], 6500), 500, 100000),
      debts: C.clamp(C.val(el['pa-debts'], 400), 0, 20000),
      downPayment: C.clamp(C.val(el['pa-down-payment'], 20000), 0, 2000000),
      rate: C.clamp(parseFloat(el['pa-rate'].value) || 6.5, 1, 15),
      term: parseInt(el['pa-term'].value, 10) || 30,
      loanType: el['pa-loan-type'].value || 'conventional',
      taxRate: C.clamp(parseFloat(el['pa-tax-rate'].value) || 1.1, 0, 5),
      insuranceAnnual: C.clamp(C.val(el['pa-insurance-annual'], 1500), 0, 20000),
      hoa: C.clamp(C.val(el['pa-hoa'], 0), 0, 5000)
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

  function renderChart(pi, tax, ins, hoa, pmi) {
    C.barChart('pa-chart-split',
      [t('pa_chart_pi'), t('pa_chart_tax'), t('pa_chart_ins'), t('pa_chart_pmi_hoa')],
      [{ data: [pi, tax, ins, pmi + hoa], color: ['#1a365d', '#2b6cb0', '#4299e1', '#c53030'] }]);
  }

  function calculate() {
    var s = read();
    var caps = LOAN_TYPE_CAPS[s.loanType] || LOAN_TYPE_CAPS.conventional;

    // Max housing payment allowed by each ratio.
    var maxByFront = s.income * caps.front;
    var maxByBack = s.income * caps.back - s.debts;
    var maxHousingPayment = Math.max(Math.min(maxByFront, maxByBack), 0);
    var bindingFront = maxByFront <= maxByBack;

    // Fixed monthly costs that come out of the housing-payment budget
    // before we know the loan size (tax/insurance/HOA scale with price,
    // so we solve iteratively: guess a price, derive tax, check budget).
    var monthlyInsurance = s.insuranceAnnual / 12;
    var monthlyHoa = s.hoa;

    // Iterative solve: start from a price guess, refine a few passes
    // since property tax and PMI both depend on price/LTV.
    var price = (maxHousingPayment > 0 ? maxHousingPayment : 0) * 130; // rough seed
    var loan = 0, pi = 0, monthlyTax = 0, monthlyPmi = 0;
    for (var i = 0; i < 12; i++) {
      loan = Math.max(price - s.downPayment, 0);
      monthlyTax = (price * s.taxRate / 100) / 12;
      var ltv = price > 0 ? loan / price : 0;
      monthlyPmi = ltv > 0.80 && s.loanType !== 'va' ? loan * 0.0075 / 12 : 0; // ~0.75%/yr typical PMI
      var budgetForPI = maxHousingPayment - monthlyTax - monthlyInsurance - monthlyHoa - monthlyPmi;
      budgetForPI = Math.max(budgetForPI, 0);
      loan = maxLoanFromPI(budgetForPI, s.rate, s.term);
      pi = piFromLoan(loan, s.rate, s.term);
      price = loan + s.downPayment;
    }

    var totalHousing = pi + monthlyTax + monthlyInsurance + monthlyHoa + monthlyPmi;
    var frontRatio = s.income > 0 ? (totalHousing / s.income) * 100 : 0;
    var backRatio = s.income > 0 ? ((totalHousing + s.debts) / s.income) * 100 : 0;

    el['pa-out-max-payment'].textContent = C.money(totalHousing);
    el['pa-out-max-loan'].textContent = C.money(loan);
    el['pa-out-max-price'].textContent = C.money(price);
    el['pa-out-front-ratio'].textContent = C.pct(frontRatio);
    el['pa-out-back-ratio'].textContent = C.pct(backRatio);
    el['pa-out-binding'].textContent = bindingFront ? t('pa_binding_front') : t('pa_binding_back');

    el['pa-b-pi'].textContent = C.money(pi);
    el['pa-b-tax'].textContent = C.money(monthlyTax);
    el['pa-b-ins'].textContent = C.money(monthlyInsurance);
    el['pa-b-hoa'].textContent = C.money(monthlyHoa);
    el['pa-b-pmi'].textContent = C.money(monthlyPmi);
    el['pa-b-total'].textContent = C.money(totalHousing);

    renderChart(pi, monthlyTax, monthlyInsurance, monthlyHoa, monthlyPmi);

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'pre_approval',
        gross_monthly_income: s.income,
        monthly_debts: s.debts,
        down_payment: s.downPayment,
        loan_type: s.loanType,
        max_home_price: Math.round(price),
        max_loan_amount: Math.round(loan),
        front_ratio_pct: Math.round(frontRatio * 10) / 10,
        back_ratio_pct: Math.round(backRatio * 10) / 10
      });
    }
  }

  function reset() {
    el['pa-income'].value = 6500; el['pa-income-slider'].value = 6500;
    el['pa-debts'].value = 400; el['pa-debts-slider'].value = 400;
    el['pa-down-payment'].value = 20000; el['pa-down-payment-slider'].value = 20000;
    el['pa-rate'].value = 6.5; el['pa-rate-slider'].value = 6.5;
    el['pa-term'].value = '30';
    el['pa-loan-type'].value = 'conventional';
    el['pa-tax-rate'].value = 1.1;
    el['pa-insurance-annual'].value = 1500;
    el['pa-hoa'].value = 0;
    calculate();
  }

  function init() {
    cache();
    if (!el['pa-income']) return;

    var recalc = C.debounce(calculate, 120);

    el['pa-income-slider'].addEventListener('input', function () {
      syncSlider('pa-income-slider', 'pa-income', true); recalc();
    });
    el['pa-income'].addEventListener('input', function () {
      syncSlider('pa-income-slider', 'pa-income', false); recalc();
    });
    el['pa-debts-slider'].addEventListener('input', function () {
      syncSlider('pa-debts-slider', 'pa-debts', true); recalc();
    });
    el['pa-debts'].addEventListener('input', function () {
      syncSlider('pa-debts-slider', 'pa-debts', false); recalc();
    });
    el['pa-down-payment-slider'].addEventListener('input', function () {
      syncSlider('pa-down-payment-slider', 'pa-down-payment', true); recalc();
    });
    el['pa-down-payment'].addEventListener('input', function () {
      syncSlider('pa-down-payment-slider', 'pa-down-payment', false); recalc();
    });
    el['pa-rate-slider'].addEventListener('input', function () {
      el['pa-rate'].value = el['pa-rate-slider'].value; recalc();
    });
    el['pa-rate'].addEventListener('input', function () {
      el['pa-rate-slider'].value = C.clamp(C.val(el['pa-rate'], 6.5), 1, 15); recalc();
    });

    ['pa-term', 'pa-loan-type', 'pa-tax-rate', 'pa-insurance-annual', 'pa-hoa'].forEach(function (id) {
      el[id].addEventListener('change', recalc);
      el[id].addEventListener('input', recalc);
    });

    el['pa-calculate'].addEventListener('click', calculate);
    el['pa-reset'].addEventListener('click', reset);

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
