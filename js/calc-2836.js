/**
 * calc-2836.js — Inline 28/36 Rule calculator (blog)
 * --------------------------------------------------
 * A compact version of the affordability calculator used inside the
 * "mortgage-affordability-28-36-rule" blog post. It applies the two
 * ratios of the 28/36 rule to gross monthly income:
 *   • front-end housing limit = 28% of income
 *   • back-end total-debt limit = 36% of income
 *   • room left for housing after debts = 36% of income − existing debts
 *   • recommended housing budget = min(front, room left for housing)
 * The verdict highlights which ratio is the binding constraint and marks
 * the user's position as inside / outside the guideline.
 *
 * Stays consistent with the rest of the site: depends on CalcCore and uses
 * its C.t / C.money / C.clamp helpers (no reinvented formatting/logic).
 * Loaded lazily via CalcCore.whenVisible.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['r28-income', 'r28-income-slider', 'r28-debts', 'r28-debts-slider',
     'r28-verdict', 'r28-out-front', 'r28-out-back', 'r28-out-room',
     'r28-out-recommended',
     'r28-calculate', 'r28-reset']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

  function read() {
    return {
      income: C.clamp(C.val(el['r28-income'], 8000), 0, 1000000),
      debts: C.clamp(C.val(el['r28-debts'], 500), 0, 100000)
    };
  }

  function calculate() {
    var s = read();

    var frontLimit = s.income * 0.28;
    var backLimit = s.income * 0.36;
    var roomForHousing = Math.max(backLimit - s.debts, 0);
    var recommended = Math.min(frontLimit, roomForHousing);

    el['r28-out-front'].textContent = C.money(frontLimit);
    el['r28-out-back'].textContent = C.money(backLimit);
    el['r28-out-room'].textContent = C.money(roomForHousing);
    el['r28-out-recommended'].textContent = C.money(recommended);

    var verdict = el['r28-verdict'];
    verdict.className = 'calculator__verdict';

    if (s.income <= 0) {
      verdict.textContent = t('calc2836_verdict_none');
      verdict.classList.add('calculator__verdict--lose');
    } else if (s.debts >= backLimit) {
      // Existing debts already consume the entire 36% back-end limit.
      verdict.textContent = t('calc2836_verdict_out');
      verdict.classList.add('calculator__verdict--lose');
    } else if (roomForHousing < frontLimit - 0.01) {
      // Back-end ratio (36% minus debts) is the limiting factor.
      verdict.textContent = t('calc2836_verdict_back');
      verdict.classList.add('calculator__verdict--cash');
    } else {
      // Front-end 28% housing ratio is the limiting factor.
      verdict.textContent = t('calc2836_verdict_front');
    }

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: '2836_rule',
        gross_monthly_income: s.income,
        monthly_debts: s.debts,
        front_limit: frontLimit,
        back_limit: backLimit,
        room_for_housing: roomForHousing,
        recommended_budget: recommended
      });
    }
  }

  function reset() {
    el['r28-income'].value = 8000; el['r28-income-slider'].value = 8000;
    el['r28-debts'].value = 500; el['r28-debts-slider'].value = 500;
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
    if (!el['r28-income']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    [['r28-income-slider', 'r28-income'],
     ['r28-debts-slider', 'r28-debts']]
      .forEach(function (p) { bindPair(p[0], p[1]); });

    el['r28-calculate'].addEventListener('click', calculate);
    el['r28-reset'].addEventListener('click', reset);

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
