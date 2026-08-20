/**
 * calc-reno.js — Renovation ROI calculator
 * ----------------------------------------
 * Estimates the return on investment of a home renovation.
 *   • New value = current value × (1 + expected increase / 100)
 *   • Profit / loss = value increase − renovation cost
 *   • ROI = profit / cost × 100
 * Also charts the typical cost recovery by renovation type (static,
 * industry-reference data) and current vs. renovated value.
 *
 * Dependency: CalcCore + Chart.js. Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['reno-value', 'reno-value-slider', 'reno-cost', 'reno-cost-slider',
     'reno-gain', 'reno-gain-slider', 'reno-verdict', 'reno-out-new-value',
     'reno-out-increase', 'reno-out-profit', 'reno-out-roi',
     'reno-chart-value', 'reno-chart-types', 'reno-calculate', 'reno-reset']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

  function read() {
    return {
      value: C.clamp(C.val(el['reno-value'], 0), 0, 2000000),
      cost: C.clamp(C.val(el['reno-cost'], 0), 0, 500000),
      gain: C.clamp(C.val(el['reno-gain'], 0), 0, 100)
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
    var newValue = s.value * (1 + s.gain / 100);
    var increase = newValue - s.value;
    var profit = increase - s.cost;
    var roi = s.cost > 0 ? (profit / s.cost) * 100 : 0;

    el['reno-out-new-value'].textContent = C.money(newValue);
    el['reno-out-increase'].textContent = C.money(increase);
    el['reno-out-profit'].textContent = C.money(profit);
    el['reno-out-roi'].textContent = (roi >= 0 ? '+' : '') + C.pct(roi);

    el['reno-out-profit'].parentElement.classList.toggle('calculator__card--good', profit >= 0);
    el['reno-out-profit'].parentElement.classList.toggle('calculator__card--bad', profit < 0);

    var verdict = el['reno-verdict'];
    verdict.className = 'calculator__verdict';
    if (profit >= 0) {
      verdict.textContent = t('reno_verdict_positive')
        .replace('{amount}', C.money(profit))
        .replace('{roi}', C.pct(roi));
    } else {
      verdict.textContent = t('reno_verdict_negative')
        .replace('{amount}', C.money(-profit))
        .replace('{roi}', C.pct(roi));
      verdict.classList.add('calculator__verdict--lose');
    }

    renderCharts(s, newValue);

    return {
      cells: {
        [t('reno_out_new_value')]: C.money(newValue),
        [t('reno_out_increase')]: C.money(increase),
        [t('reno_out_profit')]: C.money(profit),
        [t('reno_out_roi')]: (roi >= 0 ? '+' : '') + C.pct(roi)
      }
    };
  }

  function renderCharts(s, newValue) {
    C.barChart('reno-chart-value', [t('reno_chart_current'), t('reno_chart_renovated')],
      [{ data: [s.value, newValue], color: ['#8ba9c9', '#2b6cb0'] }]);

    // Typical share of the renovation cost recovered at resale (industry data).
    C.barChart('reno-chart-types',
      [t('reno_type_kitchen'), t('reno_type_bath'), t('reno_type_paint'),
       t('reno_type_floor'), t('reno_type_roof'), t('reno_type_exterior')],
      [{ data: [81, 67, 53, 50, 60, 51], color: '#4299e1' }],
      { format: 'pct' });
  }

  function calculate() {
    var s = read();
    render(s);

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'renovation_roi',
        home_value: s.value,
        renovation_cost: s.cost,
        expected_gain_pct: s.gain
      });
    }
  }

  function reset() {
    el['reno-value'].value = 300000; el['reno-value-slider'].value = 300000;
    el['reno-cost'].value = 25000; el['reno-cost-slider'].value = 25000;
    el['reno-gain'].value = 5; el['reno-gain-slider'].value = 5;
    calculate();
  }

  function init() {
    cache();
    if (!el['reno-value']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId, fromSlider) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    bindPair('reno-value-slider', 'reno-value', false);
    bindPair('reno-cost-slider', 'reno-cost', false);
    bindPair('reno-gain-slider', 'reno-gain', false);

    el['reno-calculate'].addEventListener('click', calculate);
    el['reno-reset'].addEventListener('click', reset);

    // Re-render labels and charts when the UI language changes.
    document.addEventListener('i18n:updated', function () {
      C.schedule(calculate);
    });

    // Re-render when the layout crosses a breakpoint or rotates (mobile fonts).
    document.addEventListener('calc:reflow', function () {
      C.schedule(calculate);
    });

    C.scenarios.init({
      container: '#reno-scenario-table',
      addButton: '#reno-scenario-add',
      clearButton: '#reno-scenario-clear',
      nameInput: '#reno-scenario-name',
      empty: t('scenario_empty'),
      buildCells: function () {
        var s = read();
        var newValue = s.value * (1 + s.gain / 100);
        var profit = (newValue - s.value) - s.cost;
        var roi = s.cost > 0 ? (profit / s.cost) * 100 : 0;
        return {
          cells: {
            [t('reno_out_new_value')]: C.money(newValue),
            [t('reno_out_increase')]: C.money(newValue - s.value),
            [t('reno_out_profit')]: C.money(profit),
            [t('reno_out_roi')]: (roi >= 0 ? '+' : '') + C.pct(roi)
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
