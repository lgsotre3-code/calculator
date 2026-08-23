/**
 * Test: Price regression + SAC correctness
 * Run: node scripts/test-sac.js
 */

// --- Price (amortize) — same logic as calculator.js ---
function amortize(principal, annualRate, termYears, extraMonthly, frequency) {
  const freq = frequency || 'monthly';
  const periodsPerYear = freq === 'weekly' ? 52 : freq === 'biweekly' ? 26 : 12;
  const r = annualRate / 100 / periodsPerYear;
  const n = termYears * periodsPerYear;
  const M = r === 0 ? principal / n : principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  let balance = principal, period = 0, totalInterest = 0;
  const rows = [];
  while (balance > 0.005 && period < n) {
    period += 1;
    const interest = balance * r;
    const periodExtra = extraMonthly * (12 / periodsPerYear);
    let principalPaid = (M - interest) + periodExtra;
    if (!isFinite(principalPaid) || principalPaid <= 0) principalPaid = Math.max(M, interest);
    if (principalPaid >= balance) principalPaid = balance;
    totalInterest += interest;
    balance -= principalPaid;
    rows.push({ m: period, payment: interest + principalPaid, principal: principalPaid, interest, balance: Math.max(balance, 0) });
  }
  const payoffMonths = Math.round(period * (12 / periodsPerYear));
  return { rows, M, payoffPeriods: period, payoffMonths, totalInterest, totalPaid: principal + totalInterest, periodsPerYear, frequency: freq };
}

// --- SAC (amortizeSAC) — new logic ---
function amortizeSAC(principal, annualRate, termYears, extraMonthly, frequency) {
  const freq = frequency || 'monthly';
  const periodsPerYear = freq === 'weekly' ? 52 : freq === 'biweekly' ? 26 : 12;
  const r = annualRate / 100 / periodsPerYear;
  const n = termYears * periodsPerYear;
  const constantAmort = principal / n;
  let balance = principal, period = 0, totalInterest = 0;
  const rows = [];
  while (balance > 0.005 && period < n) {
    period += 1;
    const interest = balance * r;
    const periodExtra = extraMonthly * (12 / periodsPerYear);
    let principalPaid = constantAmort + periodExtra;
    if (!isFinite(principalPaid) || principalPaid <= 0) principalPaid = Math.max(constantAmort, interest);
    if (principalPaid >= balance) principalPaid = balance;
    totalInterest += interest;
    balance -= principalPaid;
    rows.push({ m: period, payment: interest + principalPaid, principal: principalPaid, interest, balance: Math.max(balance, 0) });
  }
  const payoffMonths = Math.round(period * (12 / periodsPerYear));
  const firstInterest = principal * r;
  const M = rows.length > 0 ? rows[0].payment : principal / n;
  return { rows, M, payoffPeriods: period, payoffMonths, totalInterest, totalPaid: principal + totalInterest, periodsPerYear, frequency: freq };
}

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  PASS: ' + msg); }
  else { fail++; console.log('  FAIL: ' + msg); }
}
function close(a, b, eps) { return Math.abs(a - b) < (eps || 0.01); }

// ===== TEST 1: Price regression (no extra) =====
console.log('\n--- TEST 1: Price regression (no extra) ---');
const P = 280000, R = 6.5, T = 30;
const price = amortize(P, R, T, 0);
assert(close(price.M, 1769.79, 0.02), 'Monthly payment = $1769.79 (got $' + price.M.toFixed(2) + ')');
assert(price.rows.length === 360, '360 periods (got ' + price.rows.length + ')');
assert(close(price.totalInterest, 357125, 1), 'Total interest ~ $357,125 (got $' + Math.round(price.totalInterest) + ')');
assert(close(price.rows[0].balance, 279746.88, 1), 'Row 1 balance ~ $279,747 (got $' + price.rows[0].balance.toFixed(2) + ')');
assert(close(price.rows[359].balance, 0, 0.01), 'Last row balance = 0');

// ===== TEST 2: Price regression (with extra) =====
console.log('\n--- TEST 2: Price regression (with $200 extra) ---');
const priceExtra = amortize(P, R, T, 200);
assert(priceExtra.rows.length < 360, 'Payoff < 360 periods (got ' + priceExtra.rows.length + ')');
assert(priceExtra.totalInterest < price.totalInterest, 'Less total interest with extra');
assert(close(priceExtra.M, 1769.79, 0.02), 'M unchanged (got $' + priceExtra.M.toFixed(2) + ')');

// ===== TEST 3: SAC basic (no extra) =====
console.log('\n--- TEST 3: SAC basic (no extra) ---');
const sac = amortizeSAC(P, R, T, 0);
const constantAmort = P / 360;
assert(close(constantAmort, 777.78, 0.01), 'Constant amortization = $777.78 (got $' + constantAmort.toFixed(2) + ')');
assert(close(sac.rows[0].principal, constantAmort, 0.01), 'Row 1 principal = constant amort');
assert(close(sac.rows[100].principal, constantAmort, 0.01), 'Row 100 principal = constant amort');
assert(close(sac.rows[359].principal, constantAmort, 0.01), 'Row 359 principal = constant amort');
assert(sac.rows[0].payment > sac.rows[100].payment, 'Payment decreases over time');
assert(sac.rows[0].payment > sac.rows[359].payment, 'First payment > last payment');
assert(close(sac.rows[359].balance, 0, 0.01), 'Last row balance = 0');
assert(close(sac.M, sac.rows[0].payment, 0.01), 'M = first payment');
const firstPayment = constantAmort + P * R / 100 / 12;
assert(close(sac.M, firstPayment, 0.02), 'First payment ~ $' + firstPayment.toFixed(2) + ' (got $' + sac.M.toFixed(2) + ')');

// ===== TEST 4: SAC with extra =====
console.log('\n--- TEST 4: SAC with $200 extra ---');
const sacExtra = amortizeSAC(P, R, T, 200);
assert(sacExtra.rows.length < sac.rows.length, 'SAC with extra pays off sooner (' + sacExtra.rows.length + ' vs ' + sac.rows.length + ')');
assert(sacExtra.totalInterest < sac.totalInterest, 'Less total interest with extra');

// ===== TEST 5: Zero rate =====
console.log('\n--- TEST 5: Zero rate (Price + SAC) ---');
const priceZero = amortize(P, 0, T, 0);
assert(close(priceZero.M, P / 360, 0.01), 'Zero rate: M = principal / n');
const sacZero = amortizeSAC(P, 0, T, 0);
assert(close(sacZero.M, P / 360, 0.01), 'Zero rate SAC: M = principal / n');

// ===== TEST 6: Shape compatibility =====
console.log('\n--- TEST 6: Return shape compatibility ---');
const keys = ['rows', 'M', 'payoffPeriods', 'payoffMonths', 'totalInterest', 'totalPaid', 'periodsPerYear', 'frequency'];
const priceKeys = Object.keys(price);
const sacKeys = Object.keys(sac);
assert(JSON.stringify(keys.sort()) === JSON.stringify(priceKeys.sort()), 'Price has all required keys');
assert(JSON.stringify(keys.sort()) === JSON.stringify(sacKeys.sort()), 'SAC has all required keys');
assert(typeof sac.rows[0].payment === 'number', 'SAC rows have payment');
assert(typeof sac.rows[0].principal === 'number', 'SAC rows have principal');
assert(typeof sac.rows[0].interest === 'number', 'SAC rows have interest');
assert(typeof sac.rows[0].balance === 'number', 'SAC rows have balance');

console.log('\n=== Results: ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail > 0 ? 1 : 0);
