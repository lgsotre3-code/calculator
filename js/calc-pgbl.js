/**
 * calc-pgbl.js — PGBL vs VGBL calculator (previdência privada, Brasil)
 * ---------------------------------------------------------------------
 * Compara os dois produtos com os mesmos aportes:
 *   • PGBL — aportes dedutíveis do IR (economia anual = aportes × alíquota
 *     marginal); no resgate, TODO o saldo é tributado pela tabela regressiva.
 *   • VGBL — aportes não dedutíveis; no resgate, apenas os RENDIMENTOS
 *     são tributados pela mesma tabela regressiva.
 *
 * Tabela regressiva de IR: 35% ≤2a · 30% 2–4a · 25% 4–6a · 20% 6–8a ·
 * 15% 8–10a · 10% >10a.
 *
 * Dependency: CalcCore + Chart.js. Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['pgbl-monthly', 'pgbl-monthly-slider', 'pgbl-years', 'pgbl-years-slider',
     'pgbl-return', 'pgbl-return-slider', 'pgbl-tax', 'pgbl-tax-slider',
     'pgbl-increase', 'pgbl-increase-slider',
     'pgbl-verdict', 'pgbl-out-net-pgbl', 'pgbl-out-net-vgbl',
     'pgbl-out-diff', 'pgbl-out-rate',
     'pgbl-cmp-contrib-p', 'pgbl-cmp-contrib-v', 'pgbl-cmp-gross-p', 'pgbl-cmp-gross-v',
     'pgbl-cmp-earn-p', 'pgbl-cmp-earn-v', 'pgbl-cmp-taxrate-p', 'pgbl-cmp-taxrate-v',
     'pgbl-cmp-tax-p', 'pgbl-cmp-tax-v', 'pgbl-cmp-benefit-p', 'pgbl-cmp-benefit-v',
     'pgbl-cmp-net-p', 'pgbl-cmp-net-v',
     'pgbl-calculate', 'pgbl-reset', 'pgbl-chart-net']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

  // Fallbacks pt-BR usados enquanto as chaves pgbl_* não existirem nos
  // dicionários i18n (t() devolve a própria chave quando não encontra).
  var FB = {
    pgbl_cmp_pgbl: 'PGBL',
    pgbl_cmp_vgbl: 'VGBL',
    pgbl_verdict_pgbl: 'O PGBL deixa {amount} a mais na sua aposentadoria — faça a declaração completa do IR para aproveitar a dedução dos aportes.',
    pgbl_verdict_vgbl: 'O VGBL deixa {amount} a mais na sua aposentadoria — com a declaração simplificada (ou isento), tributar só os rendimentos compensa mais.',
    pgbl_verdict_tie: 'Empate técnico: PGBL e VGBL resultam praticamente no mesmo valor líquido nestes números.'
  };
  function tr(key) {
    var v = t(key);
    return (v === key && FB[key]) ? FB[key] : v;
  }

  var DEFAULTS = { monthly: 500, years: 30, returnRate: 8, taxRate: 27.5, increase: 5 };

  /** Alíquota da tabela regressiva de IR conforme o prazo total (anos). */
  function irRate(years) {
    if (years <= 2) return 0.35;
    if (years <= 4) return 0.30;
    if (years <= 6) return 0.25;
    if (years <= 8) return 0.20;
    if (years <= 10) return 0.15;
    return 0.10;
  }

  /**
   * Valor futuro de uma série de aportes mensais que crescem X% por ano,
   * capitalizados mensalmente à taxa informada.
   * Retorna também o total aportado (sem juros).
   */
  function project(monthly, years, annualReturnPct, growthPct) {
    var i = annualReturnPct / 100 / 12;
    var T = Math.round(years) * 12;
    var fv = 0;
    var contributed = 0;
    for (var m = 1; m <= T; m++) {
      var yearIdx = Math.ceil(m / 12); // 1..years
      var c = monthly * Math.pow(1 + growthPct / 100, yearIdx - 1);
      contributed += c;
      fv += c * Math.pow(1 + i, T - m);
    }
    return { fv: fv, contributed: contributed };
  }

  function read() {
    return {
      monthly: C.clamp(C.val(el['pgbl-monthly'], DEFAULTS.monthly), 100, 10000),
      years: C.clamp(Math.round(C.val(el['pgbl-years'], DEFAULTS.years)), 1, 40),
      returnRate: C.clamp(C.val(el['pgbl-return'], DEFAULTS.returnRate), 0, 15),
      taxRate: C.clamp(C.val(el['pgbl-tax'], DEFAULTS.taxRate), 0, 35),
      increase: C.clamp(C.val(el['pgbl-increase'], DEFAULTS.increase), 0, 20)
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
    var p = project(s.monthly, s.years, s.returnRate, s.increase);
    var rate = irRate(p.fv > 0 ? s.years : 0);
    var marginal = s.taxRate / 100;

    // ----- PGBL: dedução anual + tributação do saldo integral no resgate -----
    var pgblGross = p.fv;
    var pgblTax = pgblGross * rate;
    var pgblBenefit = p.contributed * marginal; // economia de IR acumulada
    var pgblNet = pgblGross - pgblTax + pgblBenefit;

    // ----- VGBL: sem dedução; tributa só os rendimentos no resgate -----
    var earnings = Math.max(pgblGross - p.contributed, 0);
    var vgblTax = earnings * rate;
    var vgblNet = pgblGross - vgblTax;

    var diff = pgblNet - vgblNet;

    // ----- Cards -----
    el['pgbl-out-net-pgbl'].textContent = C.money(pgblNet);
    el['pgbl-out-net-vgbl'].textContent = C.money(vgblNet);
    el['pgbl-out-diff'].textContent =
      (diff >= 0 ? 'PGBL' : 'VGBL') + ': +' + C.money(Math.abs(diff));
    el['pgbl-out-rate'].textContent = C.pct(rate * 100);

    // ----- Verdict -----
    var verdict = el['pgbl-verdict'];
    verdict.className = 'calculator__verdict';
    if (Math.abs(diff) < Math.max(1, pgblNet * 0.001)) {
      verdict.textContent = tr('pgbl_verdict_tie');
      verdict.classList.add('calculator__verdict--tie');
    } else if (diff > 0) {
      verdict.textContent = tr('pgbl_verdict_pgbl').replace('{amount}', C.money(diff));
    } else {
      verdict.textContent = tr('pgbl_verdict_vgbl').replace('{amount}', C.money(-diff));
    }

    // ----- Comparison table -----
    el['pgbl-cmp-contrib-p'].textContent = C.money(p.contributed);
    el['pgbl-cmp-contrib-v'].textContent = C.money(p.contributed);
    el['pgbl-cmp-gross-p'].textContent = C.money(pgblGross);
    el['pgbl-cmp-gross-v'].textContent = C.money(pgblGross);
    el['pgbl-cmp-earn-p'].textContent = C.money(earnings);
    el['pgbl-cmp-earn-v'].textContent = C.money(earnings);
    el['pgbl-cmp-taxrate-p'].textContent = C.pct(rate * 100);
    el['pgbl-cmp-taxrate-v'].textContent = C.pct(rate * 100);
    el['pgbl-cmp-tax-p'].textContent = C.money(pgblTax);
    el['pgbl-cmp-tax-v'].textContent = C.money(vgblTax);
    el['pgbl-cmp-benefit-p'].textContent = C.money(pgblBenefit);
    el['pgbl-cmp-benefit-v'].textContent = '—';
    el['pgbl-cmp-net-p'].textContent = C.money(pgblNet);
    el['pgbl-cmp-net-v'].textContent = C.money(vgblNet);

    renderChart(pgblNet, vgblNet);

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'pgbl-vs-vgbl',
        monthly_contribution: s.monthly,
        contribution_years: s.years,
        expected_return: s.returnRate,
        marginal_tax_rate: s.taxRate,
        annual_increase: s.increase,
        pgbl_net: pgblNet,
        vgbl_net: vgblNet,
        difference: diff,
        withdrawal_ir_rate: rate
      });
    }
  }

  function renderChart(pgblNet, vgblNet) {
    C.barChart('pgbl-chart-net',
      [tr('pgbl_cmp_pgbl'), tr('pgbl_cmp_vgbl')],
      [{ data: [pgblNet, vgblNet], color: ['#2b6cb0', '#38a169'] }]);
  }

  function reset() {
    el['pgbl-monthly'].value = DEFAULTS.monthly; el['pgbl-monthly-slider'].value = DEFAULTS.monthly;
    el['pgbl-years'].value = DEFAULTS.years; el['pgbl-years-slider'].value = DEFAULTS.years;
    el['pgbl-return'].value = DEFAULTS.returnRate; el['pgbl-return-slider'].value = DEFAULTS.returnRate;
    el['pgbl-tax'].value = DEFAULTS.taxRate; el['pgbl-tax-slider'].value = DEFAULTS.taxRate;
    el['pgbl-increase'].value = DEFAULTS.increase; el['pgbl-increase-slider'].value = DEFAULTS.increase;
    calculate();
  }

  function init() {
    cache();
    if (!el['pgbl-monthly']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    [
      ['pgbl-monthly-slider', 'pgbl-monthly'],
      ['pgbl-years-slider', 'pgbl-years'],
      ['pgbl-return-slider', 'pgbl-return'],
      ['pgbl-tax-slider', 'pgbl-tax'],
      ['pgbl-increase-slider', 'pgbl-increase']
    ].forEach(function (p) { bindPair(p[0], p[1]); });

    el['pgbl-calculate'].addEventListener('click', calculate);
    el['pgbl-reset'].addEventListener('click', reset);

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
