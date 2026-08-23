const fs = require('fs');
const path = require('path');

const ROOT_FORM_IDS = [
  'mortgage-form','home-value-slider','home-value','down-payment-slider','down-payment',
  'down-payment-percent','down-payment-caption','ltv-display','interest-rate-slider',
  'interest-rate','current-rate-note','loan-term','mortgage-country','us-state-group',
  'mortgage-us-state','zip-group','zip-code','zip-lookup-btn','zip-status',
  'property-tax','insurance','hoa','closing-costs','closing-costs-usd',
  'finance-closing-costs','pmi-group','pmi-rate','pmi-note','extra-payment',
  'calculate-btn','reset-btn','monthly-payment','pi-value','tax-value',
  'insurance-value','hoa-value','pmi-value','monthly-extra','pmi-removed-note',
  'total-interest','total-payment','closing-costs-card','closing-costs-total',
  'payoff-date','interest-saved','ad-container-middle','amortization-chart',
  'breakdown-chart','schedule-footer','amortization-table','amortization-body',
  'show-full-schedule','export-pdf','copy-share-link','pdf-status',
  'mc-scenario-name','mc-scenario-add','mc-scenario-clear','mc-scenario-table'
];

function extractIds(file) {
  const html = fs.readFileSync(file, 'utf8');
  const ids = new Set();
  const re = /\bid=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return [...ids].sort();
}

const rootIds = extractIds(path.join(__dirname, '..', 'index.html'));
const rootFormIds = ROOT_FORM_IDS.filter(id => rootIds.includes(id));

const locales = ['en','es','fr','pt','de'];
let allGood = true;

console.log('=== Form ID Parity Check: Root vs Locale Folders ===\n');
console.log(`Root form IDs: ${rootFormIds.length}\n`);

for (const lang of locales) {
  const localeIds = extractIds(path.join(__dirname, '..', lang, 'index.html'));
  const localeFormIds = rootFormIds.filter(id => localeIds.includes(id));

  const missingInLocale = rootFormIds.filter(id => !localeIds.includes(id));

  console.log(`--- /${lang}/ ---`);
  console.log(`  Form IDs present: ${localeFormIds.length}/${rootFormIds.length}`);

  if (missingInLocale.length > 0) {
    console.log(`  MISSING: ${missingInLocale.join(', ')}`);
    allGood = false;
  } else {
    console.log(`  OK — all root form IDs present`);
  }
  console.log('');
}

if (allGood) {
  console.log('ALL CHECKS PASSED — root and all 5 locale folders have matching form IDs');
  process.exit(0);
} else {
  console.log('FAIL — missing IDs detected (see above)');
  process.exit(1);
}
