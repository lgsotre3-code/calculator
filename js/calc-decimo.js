/**
 * calc-decimo.js — Décimo Terceiro (Brazilian 13th salary) calculator
 * -------------------------------------------------------------------
 * Computes the 13th salary in two installments (Lei 4.090/1962):
 *   • Gross 13th, proportional to months worked: (salary / 12) × months.
 *   • 1st installment by Nov 30 — up to 50% of the gross 13th, no deductions.
 *   • 2nd installment by Dec 20 — remainder minus progressive INSS (2024
 *     table, capped at R$7,786.02) and monthly IR (2024 table, with a
 *     R$189.59 deduction per dependent).
 *
 * Dependency: CalcCore only (no chart). Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['dec-salario', 'dec-salario-slider', 'dec-meses', 'dec-meses-slider',
     'dec-dependentes',
     'dec-verdict', 'dec-out-gross', 'dec-out-first', 'dec-out-inss',
     'dec-out-ir', 'dec-out-second-net', 'dec-out-total',
     'dec-row-gross', 'dec-row-first', 'dec-row-base', 'dec-row-inss',
     'dec-row-ir', 'dec-row-net', 'dec-row-total',
     'dec-calculate', 'dec-reset']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

  /** t() with an inline pt-BR fallback while dec_* keys are not in the dictionaries. */
  var FALLBACKS = {
    dec_verdict_full: '13º integral: cerca de {total} líquidos, pagos em duas parcelas.',
    dec_verdict_prop: '13º proporcional ({months} de 12 meses): cerca de {total} líquidos.'
  };
  function tr(key, params) {
    var v = t(key);
    var str = (v === key && FALLBACKS[key]) ? FALLBACKS[key] : v;
    return str.replace(/\{(total|months)\}/g, function (_, k) {
      return params && params[k] !== undefined ? params[k] : '';
    });
  }

  function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

  /* INSS 2024 — progressive rates, contribution capped at the ceiling (teto). */
  var INSS_BRACKETS = [
    { limit: 1412.00, rate: 7.5 },
    { limit: 2666.68, rate: 9 },
    { limit: 4000.03, rate: 12 },
    { limit: 7786.02, rate: 14 }
  ];

  function calcINSS(base) {
    if (base <= 0) return 0;
    var prev = 0, total = 0;
    for (var i = 0; i < INSS_BRACKETS.length; i++) {
      var b = INSS_BRACKETS[i];
      if (base <= prev) break;
      total += (Math.min(base, b.limit) - prev) * b.rate / 100;
      prev = b.limit;
    }
    return round2(Math.max(total, 0));
  }

  /* IR 2024 — monthly withholding table (rate minus fixed deduction). */
  var IR_BRACKETS = [
    { limit: 2259.20, rate: 0, deduct: 0 },
    { limit: 2826.65, rate: 7.5, deduct: 169.44 },
    { limit: 3751.05, rate: 15, deduct: 381.44 },
    { limit: 4664.68, rate: 22.5, deduct: 662.77 },
    { limit: Infinity, rate: 27.5, deduct: 896.00 }
  ];

  function calcIR(base) {
    if (base <= IR_BRACKETS[0].limit) return 0;
    for (var i = 1; i < IR_BRACKETS.length; i++) {
      if (base <= IR_BRACKETS[i].limit) {
        return round2(Math.max(base * IR_BRACKETS[i].rate / 100 - IR_BRACKETS[i].deduct, 0));
      }
    }
    return 0;
  }

  function read() {
    return {
      salario: C.clamp(C.val(el['dec-salario'], 0), 0, 200000),
      meses: C.clamp(Math.round(C.val(el['dec-meses'], 12)), 1, 12),
      dependentes: C.clamp(Math.round(C.val(el['dec-dependentes'], 0)), 0, 20)
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

    var gross = round2(s.salario / 12 * s.meses);
    var first = round2(gross * 0.5);
    var secondBase = round2(gross - first);
    var inss = calcINSS(secondBase);
    var irBase = Math.max(round2(secondBase - inss - s.dependentes * 189.59), 0);
    var ir = calcIR(irBase);
    var secondNet = round2(secondBase - inss - ir);
    var totalNet = round2(first + secondNet);

    el['dec-out-gross'].textContent = C.money(gross);
    el['dec-out-first'].textContent = C.money(first);
    el['dec-out-inss'].textContent = inss > 0 ? '− ' + C.money(inss) : C.money(0);
    el['dec-out-ir'].textContent = ir > 0 ? '− ' + C.money(ir) : C.money(0);
    el['dec-out-second-net'].textContent = C.money(secondNet);
    el['dec-out-total'].textContent = C.money(totalNet);

    // Breakdown table
    el['dec-row-gross'].textContent = C.money(gross);
    el['dec-row-first'].textContent = C.money(first);
    el['dec-row-base'].textContent = C.money(secondBase);
    el['dec-row-inss'].textContent = '− ' + C.money(inss);
    el['dec-row-ir'].textContent = '− ' + C.money(ir);
    el['dec-row-net'].textContent = C.money(secondNet);
    el['dec-row-total'].textContent = C.money(totalNet);

    var verdict = el['dec-verdict'];
    verdict.className = 'calculator__verdict';
    var params = { total: C.money(totalNet), months: s.meses };
    verdict.textContent = tr(s.meses >= 12 ? 'dec_verdict_full' : 'dec_verdict_prop', params);
    verdict.classList.add('calculator__verdict--cash');

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'decimo_terceiro',
        gross_salary: s.salario,
        months_worked: s.meses,
        dependents: s.dependentes,
        gross_13th: gross,
        first_installment: first,
        inss_deduction: inss,
        ir_deduction: ir,
        total_net: totalNet
      });
    }
  }

  function reset() {
    el['dec-salario'].value = 5000; el['dec-salario-slider'].value = 5000;
    el['dec-meses'].value = 12; el['dec-meses-slider'].value = 12;
    el['dec-dependentes'].value = 0;
    calculate();
  }

  function init() {
    cache();
    if (!el['dec-salario']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    [
      ['dec-salario-slider', 'dec-salario'],
      ['dec-meses-slider', 'dec-meses']
    ].forEach(function (p) { bindPair(p[0], p[1]); });

    el['dec-dependentes'].addEventListener('input', recalc);

    el['dec-calculate'].addEventListener('click', calculate);
    el['dec-reset'].addEventListener('click', reset);

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
