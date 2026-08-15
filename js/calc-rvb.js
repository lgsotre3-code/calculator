/**
 * calc-rvb.js â€” Rent vs. Buy calculator
 * -------------------------------------
 * Monthly simulation over the holding period:
 *   â€¢ Buyer net worth  = home equity (home value âˆ’ remaining balance).
 *   â€¢ Renter net worth = the down payment (invested) plus the monthly
 *     cash-flow difference (buy cost âˆ’ effective rent), compounded at the
 *     chosen investment return. Positive differences are invested; if rent
 *     costs more than buying, the renter account is drawn down.
 * The option with the higher net worth at the end of the horizon wins, and
 * the first year buying overtakes renting is reported as the break-even.
 *
 * Dependency: CalcCore + Chart.js. Loaded lazily.
 */
(function () {
  'use strict';

  var C = window.CalcCore;
  if (!C) return;

  var el = {};
  function cache() {
    ['rvb-price', 'rvb-price-slider', 'rvb-down', 'rvb-down-slider', 'rvb-rate', 'rvb-rate-slider',
     'rvb-term', 'rvb-rent', 'rvb-rent-slider', 'rvb-rent-increase', 'rvb-rent-increase-slider',
     'rvb-appreciation', 'rvb-appreciation-slider', 'rvb-tax', 'rvb-tax-slider',
     'rvb-maintenance', 'rvb-maintenance-slider', 'rvb-vacancy', 'rvb-vacancy-slider',
     'rvb-return', 'rvb-return-slider', 'rvb-horizon', 'rvb-horizon-slider',
     'rvb-verdict', 'rvb-out-buy-monthly', 'rvb-out-rent-monthly', 'rvb-out-cashflow',
     'rvb-out-buy-nw', 'rvb-out-rent-nw', 'rvb-out-better', 'rvb-out-break-even',
     'rvb-chart-nw', 'rvb-chart-cost', 'rvb-calculate', 'rvb-reset']
      .forEach(function (id) { el[id] = document.getElementById(id); });
  }

  var t = C.t;

    var labelBetter = document.getElementById('rvb-out-better-label');

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
      price: C.clamp(C.val(el['rvb-price'], 0), 0, 2000000),
      down: C.clamp(C.val(el['rvb-down'], 0), 0, 50),
      rate: C.clamp(C.val(el['rvb-rate'], 0.01), 0.01, 15),
      term: parseInt(el['rvb-term'].value, 10) || 30,
      rent: C.clamp(C.val(el['rvb-rent'], 0), 0, 10000),
      rentInc: C.clamp(C.val(el['rvb-rent-increase'], 0), 0, 15),
      app: C.clamp(C.val(el['rvb-appreciation'], 0), 0, 15),
      tax: C.clamp(C.val(el['rvb-tax'], 0), 0, 5),
      maint: C.clamp(C.val(el['rvb-maintenance'], 0), 0, 5),
      vacancy: C.clamp(C.val(el['rvb-vacancy'], 0), 0, 20),
      ret: C.clamp(C.val(el['rvb-return'], 0), 0, 15),
      horizon: C.clamp(Math.round(C.val(el['rvb-horizon'], 1)), 1, 40)
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

  function run(s) {
    var months = s.term * 12;
    var loan = s.price * (1 - s.down / 100);
    var down = s.price - loan;
    var sched = amortize(loan, s.rate, months);
    var M = sched.M;
    var rM = s.ret / 100 / 12;
    var totalMonths = s.horizon * 12;

    var renter = down;
    var labels = [0];
    var buySeries = [down];
    var rentSeries = [down];

    var buyMonthlyY1 = null;
    var rentMonthlyY1 = null;
    var cashflowY1 = null;
    var buyFinal = 0, rentFinal = 0;
    var breakEven = null;

    for (var m = 1; m <= totalMonths; m++) {
      var year = Math.ceil(m / 12);
      var rentY = s.rent * Math.pow(1 + s.rentInc / 100, year - 1);
      var rentEff = rentY * (1 - s.vacancy / 100);
      var hv = s.price * Math.pow(1 + s.app / 100, m / 12);
      var tax = hv * s.tax / 100 / 12;
      var maint = hv * s.maint / 100 / 12;
      var buyM = M + tax + maint;
      var diff = buyM - rentEff;

      renter = renter * (1 + rM) + diff;

      var balance = m <= months ? sched.balances[m] : 0;
      var equity = hv - balance;

      if (m === 1) {
        buyMonthlyY1 = buyM;
        rentMonthlyY1 = rentEff;
        cashflowY1 = diff;
      }
      if (m === totalMonths) {
        buyFinal = equity;
        rentFinal = renter;
      }
      if (m % 12 === 0) {
        labels.push(year);
        buySeries.push(equity);
        rentSeries.push(renter);
        if (breakEven === null && equity >= renter && year >= 1) breakEven = year;
      }
    }

    return {
      M: M, down: down, buyMonthlyY1: buyMonthlyY1, rentMonthlyY1: rentMonthlyY1,
      cashflowY1: cashflowY1, buyFinal: buyFinal, rentFinal: rentFinal,
      breakEven: breakEven, labels: labels, buySeries: buySeries, rentSeries: rentSeries,
      horizon: s.horizon
    };
  }

  function render(s) {
    var r = run(s);

    if (labelBetter) labelBetter.textContent = t('rvb_out_better').replace('{years}', s.horizon);

    el['rvb-out-buy-monthly'].textContent = C.money(r.buyMonthlyY1);
    el['rvb-out-rent-monthly'].textContent = C.money(r.rentMonthlyY1);
    el['rvb-out-cashflow'].textContent = (r.cashflowY1 >= 0 ? '+' : '') + C.money(r.cashflowY1);
    el['rvb-out-cashflow'].parentElement.classList.toggle('calculator__card--good', r.cashflowY1 <= 0);
    el['rvb-out-cashflow'].parentElement.classList.toggle('calculator__card--bad', r.cashflowY1 > 0);

    el['rvb-out-buy-nw'].textContent = C.money(r.buyFinal);
    el['rvb-out-rent-nw'].textContent = C.money(r.rentFinal);

    var diff = r.buyFinal - r.rentFinal;
    var betterLabel = Math.abs(diff) < 1
      ? t('rvb_tie')
      : (diff > 0 ? t('rvb_buying') : t('rvb_renting')) + ' ' + t('rvb_by') + ' ' + C.money(Math.abs(diff));
    el['rvb-out-better'].textContent = betterLabel;

    el['rvb-out-break-even'].textContent = r.breakEven === null
      ? t('rvb_no_break_even').replace('{years}', s.horizon)
      : t('rvb_break_even_year').replace('{year}', r.breakEven);

    var verdict = el['rvb-verdict'];
    verdict.className = 'calculator__verdict';
    if (Math.abs(diff) < 1) {
      verdict.textContent = t('rvb_verdict_tie').replace('{years}', s.horizon);
      verdict.classList.add('calculator__verdict--tie');
    } else if (diff > 0) {
      verdict.textContent = t('rvb_verdict_buy').replace('{amount}', C.money(diff)).replace('{years}', s.horizon);
      verdict.classList.add('calculator__verdict');
    } else {
      verdict.textContent = t('rvb_verdict_rent').replace('{amount}', C.money(-diff)).replace('{years}', s.horizon);
      verdict.classList.add('calculator__verdict--cash');
    }

    renderCharts(r);

    return {
      cells: {
        [t('rvb_out_buy_monthly')]: C.money(r.buyMonthlyY1),
        [t('rvb_out_rent_monthly')]: C.money(r.rentMonthlyY1),
        [t('rvb_out_cashflow')]: (r.cashflowY1 >= 0 ? '+' : '') + C.money(r.cashflowY1),
        [t('rvb_out_buy_nw')]: C.money(r.buyFinal),
        [t('rvb_out_rent_nw')]: C.money(r.rentFinal),
        [t('rvb_out_break_even')]: r.breakEven === null
          ? t('rvb_no_break_even').replace('{years}', s.horizon)
          : t('rvb_break_even_year').replace('{year}', r.breakEven)
      }
    };
  }

  function renderCharts(r) {
    C.lineChart('rvb-chart-nw', r.labels, [
      { label: t('rvb_chart_buy'), data: r.buySeries, color: '#2b6cb0', fill: false },
      { label: t('rvb_chart_rent'), data: r.rentSeries, color: '#dd6b20', fill: false }
    ]);

    C.barChart('rvb-chart-cost', [t('rvb_chart_buy'), t('rvb_chart_rent')],
      [{ data: [r.buyMonthlyY1, r.rentMonthlyY1], color: ['#2b6cb0', '#dd6b20'] }]);
  }

  function calculate() {
    var s = read();
    render(s);

    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'rent_vs_buy',
        home_value: s.price,
        down_payment_pct: s.down,
        mortgage_rate: s.rate,
        loan_term: s.term,
        monthly_rent: s.rent,
        rent_increase_pct: s.rentInc,
        appreciation_pct: s.app,
        property_tax_pct: s.tax,
        maintenance_pct: s.maint,
        vacancy_pct: s.vacancy,
        investment_return: s.ret,
        holding_period: s.horizon
      });
    }
  }

  function reset() {
    el['rvb-price'].value = 350000; el['rvb-price-slider'].value = 350000;
    el['rvb-down'].value = 20; el['rvb-down-slider'].value = 20;
    el['rvb-rate'].value = 6.5; el['rvb-rate-slider'].value = 6.5;
    el['rvb-term'].value = 30;
    el['rvb-rent'].value = 1800; el['rvb-rent-slider'].value = 1800;
    el['rvb-rent-increase'].value = 4; el['rvb-rent-increase-slider'].value = 4;
    el['rvb-appreciation'].value = 3; el['rvb-appreciation-slider'].value = 3;
    el['rvb-tax'].value = 1.2; el['rvb-tax-slider'].value = 1.2;
    el['rvb-maintenance'].value = 1; el['rvb-maintenance-slider'].value = 1;
    el['rvb-vacancy'].value = 5; el['rvb-vacancy-slider'].value = 5;
    el['rvb-return'].value = 7; el['rvb-return-slider'].value = 7;
    el['rvb-horizon'].value = 10; el['rvb-horizon-slider'].value = 10;
    calculate();
  }

  function init() {
    cache();
    if (!el['rvb-price']) return;

    var recalc = C.debounce(calculate, 120);

    function bindPair(sliderId, inputId, fromSlider) {
      el[sliderId].addEventListener('input', function () { syncSlider(sliderId, inputId, true); recalc(); });
      el[inputId].addEventListener('input', function () { syncSlider(sliderId, inputId, false); recalc(); });
    }
    var pairs = [
      ['rvb-price-slider', 'rvb-price'], ['rvb-down-slider', 'rvb-down'],
      ['rvb-rate-slider', 'rvb-rate'], ['rvb-rent-slider', 'rvb-rent'],
      ['rvb-rent-increase-slider', 'rvb-rent-increase'],
      ['rvb-appreciation-slider', 'rvb-appreciation'],
      ['rvb-tax-slider', 'rvb-tax'], ['rvb-maintenance-slider', 'rvb-maintenance'],
      ['rvb-vacancy-slider', 'rvb-vacancy'], ['rvb-return-slider', 'rvb-return'],
      ['rvb-horizon-slider', 'rvb-horizon']
    ];
    pairs.forEach(function (p) { bindPair(p[0], p[1], false); });
    el['rvb-term'].addEventListener('input', recalc);

    el['rvb-calculate'].addEventListener('click', calculate);
    el['rvb-reset'].addEventListener('click', reset);

    // Re-render labels and charts when the UI language changes.
    document.addEventListener('i18n:updated', function () {
      C.schedule(calculate);
    });

    // Re-render when the layout crosses a breakpoint or rotates (mobile fonts).
    document.addEventListener('calc:reflow', function () {
      C.schedule(calculate);
    });

    C.scenarios.init({
      container: '#rvb-scenario-table',
      addButton: '#rvb-scenario-add',
      clearButton: '#rvb-scenario-clear',
      nameInput: '#rvb-scenario-name',
      empty: t('scenario_empty'),
      buildCells: function () {
        var s = read();
        var r = run(s);
        var diff = r.buyFinal - r.rentFinal;
        return {
          cells: {
            [t('rvb_out_buy_monthly')]: C.money(r.buyMonthlyY1),
            [t('rvb_out_rent_monthly')]: C.money(r.rentMonthlyY1),
            [t('rvb_out_cashflow')]: (r.cashflowY1 >= 0 ? '+' : '') + C.money(r.cashflowY1),
            [t('rvb_out_buy_nw')]: C.money(r.buyFinal),
            [t('rvb_out_rent_nw')]: C.money(r.rentFinal),
            [t('rvb_out_better').replace('{years}', s.horizon)]: Math.abs(diff) < 1
              ? t('rvb_tie')
              : (diff > 0 ? t('rvb_buying') : t('rvb_renting')) + ' ' + t('rvb_by') + ' ' + C.money(Math.abs(diff)),
            [t('rvb_out_break_even')]: r.breakEven === null
              ? t('rvb_no_break_even').replace('{years}', s.horizon)
              : t('rvb_break_even_year').replace('{year}', r.breakEven)
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
