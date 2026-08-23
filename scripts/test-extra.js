/**
 * test-extra.js — Combinable extra payments (monthly, quarterly, yearly, one-time)
 * Run: node scripts/test-extra.js
 */

// --- Copy of amortize from calculator.js (with object support) ---
function amortize(principal, annualRate, termYears, extraMonthly, frequency) {
  var extras = typeof extraMonthly === 'object' && extraMonthly !== null
    ? { monthly: extraMonthly.monthly || 0, quarterly: extraMonthly.quarterly || 0,
        yearly: extraMonthly.yearly || 0, oneTime: extraMonthly.oneTime || 0,
        oneTimeAtMonth: extraMonthly.oneTimeAtMonth || 0 }
    : { monthly: extraMonthly || 0, quarterly: 0, yearly: 0, oneTime: 0, oneTimeAtMonth: 0 };

  var freq = frequency || 'monthly';
  var periodsPerYear = freq === 'weekly' ? 52 : freq === 'biweekly' ? 26 : 12;
  var r = annualRate / 100 / periodsPerYear;
  var n = termYears * periodsPerYear;
  var M = r === 0 ? principal / n : principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);

  var oneTimePeriod = extras.oneTimeAtMonth > 0
    ? Math.max(1, Math.round(extras.oneTimeAtMonth * (periodsPerYear / 12)))
    : 0;

  var balance = principal, period = 0, totalInterest = 0;
  var rows = [];

  while (balance > 0.005 && period < n) {
    period += 1;
    var interest = balance * r;
    var periodExtra = extras.monthly * (12 / periodsPerYear);
    if (extras.quarterly > 0) {
      var monthInLoan = Math.round(period * (12 / periodsPerYear));
      if (monthInLoan % 3 === 0) periodExtra += extras.quarterly;
    }
    if (extras.yearly > 0) {
      var monthInLoan = Math.round(period * (12 / periodsPerYear));
      if (monthInLoan % 12 === 0) periodExtra += extras.yearly;
    }
    if (extras.oneTime > 0 && period === oneTimePeriod) {
      periodExtra += extras.oneTime;
    }

    var principalPaid = (M - interest) + periodExtra;
    if (!isFinite(principalPaid) || principalPaid <= 0) principalPaid = Math.max(M, interest);
    if (principalPaid >= balance) principalPaid = balance;
    totalInterest += interest;
    balance -= principalPaid;
    rows.push({ m: period, payment: interest + principalPaid, principal: principalPaid, interest: interest, balance: Math.max(balance, 0), extra: periodExtra });
  }

  var payoffMonths = Math.round(period * (12 / periodsPerYear));
  return { rows: rows, M: M, payoffPeriods: period, payoffMonths: payoffMonths, totalInterest: totalInterest, totalPaid: principal + totalInterest, periodsPerYear: periodsPerYear, frequency: freq };
}

// --- Copy of amortizeSAC from calculator.js (with object support) ---
function amortizeSAC(principal, annualRate, termYears, extraMonthly, frequency) {
  var extras = typeof extraMonthly === 'object' && extraMonthly !== null
    ? { monthly: extraMonthly.monthly || 0, quarterly: extraMonthly.quarterly || 0,
        yearly: extraMonthly.yearly || 0, oneTime: extraMonthly.oneTime || 0,
        oneTimeAtMonth: extraMonthly.oneTimeAtMonth || 0 }
    : { monthly: extraMonthly || 0, quarterly: 0, yearly: 0, oneTime: 0, oneTimeAtMonth: 0 };

  var freq = frequency || 'monthly';
  var periodsPerYear = freq === 'weekly' ? 52 : freq === 'biweekly' ? 26 : 12;
  var r = annualRate / 100 / periodsPerYear;
  var n = termYears * periodsPerYear;
  var constantAmort = principal / n;

  var oneTimePeriod = extras.oneTimeAtMonth > 0
    ? Math.max(1, Math.round(extras.oneTimeAtMonth * (periodsPerYear / 12)))
    : 0;

  var balance = principal, period = 0, totalInterest = 0;
  var rows = [];

  while (balance > 0.005 && period < n) {
    period += 1;
    var interest = balance * r;
    var periodExtra = extras.monthly * (12 / periodsPerYear);
    if (extras.quarterly > 0) {
      var monthInLoan = Math.round(period * (12 / periodsPerYear));
      if (monthInLoan % 3 === 0) periodExtra += extras.quarterly;
    }
    if (extras.yearly > 0) {
      var monthInLoan = Math.round(period * (12 / periodsPerYear));
      if (monthInLoan % 12 === 0) periodExtra += extras.yearly;
    }
    if (extras.oneTime > 0 && period === oneTimePeriod) {
      periodExtra += extras.oneTime;
    }

    var principalPaid = constantAmort + periodExtra;
    if (!isFinite(principalPaid) || principalPaid <= 0) principalPaid = Math.max(constantAmort, interest);
    if (principalPaid >= balance) principalPaid = balance;
    totalInterest += interest;
    balance -= principalPaid;
    rows.push({ m: period, payment: interest + principalPaid, principal: principalPaid, interest: interest, balance: Math.max(balance, 0), extra: periodExtra });
  }

  var payoffMonths = Math.round(period * (12 / periodsPerYear));
  var M = rows.length > 0 ? rows[0].payment : principal / n;
  return { rows: rows, M: M, payoffPeriods: period, payoffMonths: payoffMonths, totalInterest: totalInterest, totalPaid: principal + totalInterest, periodsPerYear: periodsPerYear, frequency: freq };
}

var pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  PASS: ' + msg); }
  else { fail++; console.log('  FAIL: ' + msg); }
}
function close(a, b, eps) { return Math.abs(a - b) < (eps || 0.01); }

var P = 280000, R = 6.5, T = 30;

// ===== TEST 1: Legacy number still works (from test-sac.js) =====
console.log('\n--- TEST 1: Legacy number (monthly only) ---');
var price = amortize(P, R, T, 200);
assert(close(price.M, 1769.79, 0.02), 'M unchanged with number arg');
assert(price.rows.length < 360, 'Pays off sooner with $200/mo');

// ===== TEST 2: Quarterly only =====
console.log('\n--- TEST 2: Quarterly only ($500/qtr) ---');
var qOnly = amortize(P, R, T, { monthly: 0, quarterly: 500, yearly: 0, oneTime: 0, oneTimeAtMonth: 0 });
var noExtra = amortize(P, R, T, 0);
assert(qOnly.totalInterest < noExtra.totalInterest, 'Quarterly saves interest');
assert(qOnly.rows.length < noExtra.rows.length, 'Quarterly shortens term');
// Check months 3, 6, 9 have extra
var row3 = qOnly.rows[2]; // period 3
assert(row3.extra === 500, 'Period 3 extra = $500');
var row4 = qOnly.rows[3]; // period 4
assert(row4.extra === 0, 'Period 4 extra = $0');
var row6 = qOnly.rows[5]; // period 6
assert(row6.extra === 500, 'Period 6 extra = $500');

// ===== TEST 3: Yearly only =====
console.log('\n--- TEST 3: Yearly only ($5000/yr) ---');
var yOnly = amortize(P, R, T, { monthly: 0, quarterly: 0, yearly: 5000, oneTime: 0, oneTimeAtMonth: 0 });
assert(yOnly.totalInterest < noExtra.totalInterest, 'Yearly saves interest');
// Check period 12 has extra
var row12 = yOnly.rows[11]; // period 12
assert(row12.extra === 5000, 'Period 12 extra = $5000');
var row11 = yOnly.rows[10]; // period 11
assert(row11.extra === 0, 'Period 11 extra = $0');
var row13 = yOnly.rows[12]; // period 13
assert(row13.extra === 0, 'Period 13 extra = $0');

// ===== TEST 4: One-time only =====
console.log('\n--- TEST 4: One-time only ($5000 at month 24) ---');
var otOnly = amortize(P, R, T, { monthly: 0, quarterly: 0, yearly: 0, oneTime: 5000, oneTimeAtMonth: 24 });
assert(otOnly.totalInterest < noExtra.totalInterest, 'One-time saves interest');
var row24 = otOnly.rows[23]; // period 24
assert(row24.extra === 5000, 'Period 24 extra = $5000');
var row23 = otOnly.rows[22]; // period 23
assert(row23.extra === 0, 'Period 23 extra = $0');
var row25 = otOnly.rows[24]; // period 25
assert(row25.extra === 0, 'Period 25 extra = $0');
// Balance should drop by $5000 more than the normal principal in period 24
var expectedBalanceDrop = row24.principal;
assert(expectedBalanceDrop > row23.principal, 'Period 24 principal > period 23 (one-time applied)');

// ===== TEST 5: All four combined =====
console.log('\n--- TEST 5: All four combined ---');
var combined = amortize(P, R, T, { monthly: 200, quarterly: 500, yearly: 5000, oneTime: 10000, oneTimeAtMonth: 12 });
var qOnlyInt = qOnly.totalInterest;
var yOnlyInt = yOnly.totalInterest;
var otOnlyInt = otOnly.totalInterest;
assert(combined.totalInterest < qOnlyInt, 'Combined < quarterly only interest');
assert(combined.totalInterest < yOnlyInt, 'Combined < yearly only interest');
assert(combined.totalInterest < otOnlyInt, 'Combined < one-time only interest');
assert(combined.payoffMonths < noExtra.payoffMonths, 'Combined shortens term vs no extra');
// Period 12 should have monthly ($200) + quarterly ($500) + yearly ($5000) + one-time ($10000) = $15,700
var cRow12 = combined.rows[11];
assert(cRow12.extra === 15700, 'Period 12: monthly + quarterly + yearly + one-time = $15,700 (got ' + cRow12.extra + ')');
// Period 3 should have monthly ($200) + quarterly ($500) = $700
var cRow3 = combined.rows[2];
assert(cRow3.extra === 700, 'Period 3: monthly + quarterly = $700 (got ' + cRow3.extra + ')');

// ===== TEST 6: SAC with all four =====
console.log('\n--- TEST 6: SAC with all four combined ---');
var sacCombined = amortizeSAC(P, R, T, { monthly: 200, quarterly: 500, yearly: 5000, oneTime: 10000, oneTimeAtMonth: 12 });
var sacNoExtra = amortizeSAC(P, R, T, 0);
assert(sacCombined.totalInterest < sacNoExtra.totalInterest, 'SAC combined saves interest');
assert(sacCombined.payoffMonths < sacNoExtra.payoffMonths, 'SAC combined shortens term');
var sRow12 = sacCombined.rows[11];
assert(sRow12.extra === 15700, 'SAC period 12: monthly + quarterly + yearly + one-time = $15,700');
var sRow3 = sacCombined.rows[2];
assert(sRow3.extra === 700, 'SAC period 3: monthly + quarterly = $700');

// ===== TEST 7: Return shape compatibility =====
console.log('\n--- TEST 7: Rows have extra field ---');
assert(typeof combined.rows[0].extra === 'number', 'Row has extra field');
assert(typeof sacCombined.rows[0].extra === 'number', 'SAC row has extra field');

// ===== TEST 8: One-time at month 0 or empty = not applied =====
console.log('\n--- TEST 8: oneTimeAtMonth=0 means not applied ---');
var otZero = amortize(P, R, T, { monthly: 0, quarterly: 0, yearly: 0, oneTime: 5000, oneTimeAtMonth: 0 });
assert(otZero.totalInterest === noExtra.totalInterest, 'oneTimeAtMonth=0: same as no extra');

console.log('\n=== Results: ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail > 0 ? 1 : 0);
