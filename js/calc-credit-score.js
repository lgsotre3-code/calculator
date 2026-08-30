/**
 * calc-credit-score.js — Credit Score & Mortgage calculator
 * ---------------------------------------------------------------------
 * Estimates the mortgage interest rate a borrower is likely to receive
 * based on their FICO credit score tier, then converts it into a monthly
 * payment and total interest for a given home price, down payment and
 * loan term. Also flags whether the score meets the conventional-lending
 * minimum (620). Tiers match the published rate table on the site.
 *
 *   • Excellent 760-850 → 6.25%
 *   • Good      700-759 → 6.50%
 *   • Fair      660-699 → 6.875%
 *   • Poor      620-659 → 7.25%
 *   • Below 620         → usually won't qualify for a conventional loan
 *
 * Stays consistent with the rest of the site: depends on CalcCore and uses
 * its C.t / C.money / C.pct / C.clamp helpers (no reinvented logic).
 * Loaded lazily via CalcCore.whenVisible.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['cs-score', 'cs-score-slider',
     'cs-price', 'cs-price-slider',
     'cs-down', 'cs-down-slider',
     'cs-term',
     'cs-verdict',
     'cs-out-tier', 'cs-out-rate', 'cs-out-loan',
     'cs-out-payment', 'cs-out-interest',
     'cs-calculate', 'cs-reset']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

  var TIERS = [
    { min: 760, tierKey: 'cscr_tier_excellent', rate: 6.25 },
    { min: 700, tierKey: 'cscr_tier_good', rate: 6.50 },
    { min: 660, tierKey: 'cscr_tier_fair', rate: 6.875 },
    { min: 620, tierKey: 'cscr_tier_poor', rate: 7.25 }
  ];

  /** Monthly payment factor per $1 of principal (12/x/y). */
  function paymentFactor(annualRate, termYears) {
    var r = annualRate / 100 / 12;
    var n = termYears * 12;
    if (r === 0) return 1 / n;
    var p = Math.pow(1 + r, n);
    return r * p / (p - 1);
  }

  function read() {
    return {
      score: Math.round(C.clamp(C.val(el['cs-score'], 740), 300, 850)),
      price: C.clamp(C.val(el['cs-price'], 300000), 10000, 5000000),
      downPct: C.clamp(C.val(el['cs-down'], 20), 0, 50),
      term: parseInt(el['cs-term'].value, 10) || 30
    };
  }

  function tierFor(score) {
    for (var i = 0; i < TIERS.length; i++) {
      if (score >= TIERS[i].min) return TIERS[i];
    }
    return null; // below 620
  }

  function calculate() {
    var s = read();
    var tier = tierFor(s.score);
    var loan = s.price * (1 - s.downPct / 100);

    el['cs-out-loan'].textContent = C.money(loan);

    var verdict = el['cs-verdict'];
    verdict.className = 'calculator__verdict';

    if (!tier) {
      el['cs-out-tier'].textContent = t('cscr_tier_below');
      el['cs-out-rate'].textContent = '\u2014';
      el['cs-out-payment'].textContent = '\u2014';
      el['cs-out-interest'].textContent = '\u2014';
      verdict.textContent = t('cscr_verdict_below');
      verdict.classList.add('calculator__verdict--lose');
      pushData(s, tier, loan, null, null, null);
      return;
    }

    var monthly = loan * paymentFactor(tier.rate, s.term);
    var totalInterest = monthly * s.term * 12 - loan;

    el['cs-out-tier'].textContent = t(tier.tierKey);
    el['cs-out-rate'].textContent = C.pct(tier.rate);
    el['cs-out-payment'].textContent = C.money(monthly);
    el['cs-out-interest'].textContent = C.money(totalInterest);

    if (s.score >= 760) {
      verdict.textContent = t('cscr_verdict_excellent');
    } else if (s.score >= 700) {
      verdict.textContent = t('cscr_verdict_good');
    } else if (s.score >= 660) {
      verdict.textContent = t('cscr_verdict_fair');
    } else {
      verdict.textContent = t('cscr_verdict_poor');
    }

    pushData(s, tier, loan, monthly, totalInterest, tier.rate);
  }

  function pushData(s, tier, loan, monthly, totalInterest, rate) {
    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'credit_score',
        credit_score: s.score,
        home_price: Math.round(s.price),
        down_payment_pct: s.downPct,
        loan_term: s.term,
        loan_amount: Math.round(loan),
        credit_tier: tier ? t(tier.tierKey) : 'below_620',
        est_rate: rate,
        monthly_payment: monthly,
        total_interest: totalInterest
      });
    }
  }

  function reset() {
    el['cs-score'].value = 740; el['cs-score-slider'].value = 740;
    el['cs-price'].value = 300000; el['cs-price-slider'].value = 300000;
    el['cs-down'].value = 20; el['cs-down-slider'].value = 20;
    el['cs-term'].value = '30';
    calculate();
  }

  function syncSlider(sliderId, inputId, fromSlider) {
    if (fromSlider) { el[inputId].value = el[sliderId].value; }
    else {
      var min = parseFloat(el[sliderId].min) || 0;
      var max = parseFloat(el[sliderId].max) || 100;
      el[sliderId].value = C.clamp(C.val(el[inputId], min), min, max);
    }
  }

  function init() {
    cache();
    if (!el['cs-score']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    [['cs-score-slider', 'cs-score'],
     ['cs-price-slider', 'cs-price'],
     ['cs-down-slider', 'cs-down']]
      .forEach(function (p) { bindPair(p[0], p[1]); });

    el['cs-term'].addEventListener('change', recalc);
    el['cs-term'].addEventListener('input', recalc);

    el['cs-calculate'].addEventListener('click', calculate);
    el['cs-reset'].addEventListener('click', reset);

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
