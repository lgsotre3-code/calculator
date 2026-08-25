// Validate: (1) JSON-LD blocks in every HTML page, (2) data-i18n keys vs dictionaries.
const fs = require('fs');
const path = require('path');

const pages = [
  'index.html',
  'calculators/index.html',
  'blog/index.html',
  'blog/best-mortgage-lenders.html',
  'blog/fha-vs-conventional-loans.html',
  'about/index.html',
  'contact/index.html',
  '404.html',
  'amortization-guide/index.html',
  'refinance-guide/index.html',
  'fha-vs-conventional/index.html',
  'affordability-guide/index.html',
  'finance-vs-cash/index.html',
  'loan-portability/index.html',
  'renovation-roi/index.html',
  'rent-vs-buy/index.html',
  'refinance-calculator/index.html',
  'down-payment-calculator/index.html',
  'affordability-calculator/index.html',
  'blog/mortgage-affordability-28-36-rule/index.html',
  'blog/va-loan-vs-conventional/index.html',
  'blog/mortgage-payments-guide/index.html',
  'blog/arm-vs-fixed-rate/index.html',
  'blog/refinance-break-even/index.html',
];

let jsonOk = true;
const keysUsed = new Set();

for (const page of pages) {
  const html = fs.readFileSync(path.join(__dirname, page), 'utf8');

  // 1) JSON-LD blocks
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const [, json] of blocks) {
    try {
      const data = JSON.parse(json.trim());
      if (data['@type'] === 'FAQPage' && data.mainEntity.length < 10) {
        console.log('WARN: FAQPage has <10 questions (' + data.mainEntity.length + ')');
      }
      console.log('OK  JSON-LD @type=' + data['@type'] + ' (' + page + ')');
    } catch (e) {
      jsonOk = false;
      console.log('FAIL JSON-LD (' + page + '): ' + e.message);
    }
  }

  // 2) data-i18n keys used in this page
  for (const m of html.matchAll(/data-i18n(?:-placeholder|-aria|-option|-value|-title|-desc)?="([^"]+)"/g)) {
    keysUsed.add(m[1]);
  }
}

if (!keysUsed.size) console.log('FAIL: no data-i18n keys found');

// 3) keys defined in each dictionary
const vm = require('vm');
const langs = ['en', 'es', 'fr', 'pt', 'de'];
let allOk = true;
for (const lang of langs) {
  const src = fs.readFileSync(path.join(__dirname, 'js', 'i18n', lang + '.js'), 'utf8');
  const sandbox = { window: {}, console: console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const dict = sandbox.window.TRANSLATIONS[lang];
  const missing = [...keysUsed].filter(k => !(k in dict));
  // dynamic keys built at runtime (not in dictionaries is fine):
  const dynamicKeys = ['down_payment_caption'];
  const realMissing = missing.filter(k => !dynamicKeys.includes(k));
  if (realMissing.length) {
    allOk = false;
    console.log('FAIL ' + lang + ': missing ' + realMissing.join(', '));
  } else {
    console.log('OK  ' + lang + ': ' + keysUsed.size + ' keys used, all covered');
  }
}
// 4) Locale form parity — ensure {lang}/index.html has same form IDs as root
const ROOT_FORM_IDS = [
  'mortgage-form','home-value-slider','home-value','down-payment-slider','down-payment',
  'down-payment-percent','down-payment-caption','ltv-display','interest-rate-slider',
  'interest-rate','current-rate-note','rate-refresh-btn','rate-cache-note','loan-term','payment-frequency','start-date','mortgage-country','us-state-group',
  'mortgage-us-state','zip-group','zip-code','zip-lookup-btn','zip-status',
  'property-tax','insurance','hoa','closing-costs','closing-costs-usd',
  'finance-closing-costs','pmi-group','pmi-rate','pmi-note','extra-payment','extra-quarterly','extra-yearly','extra-onetime','extra-onetime-month','amortization-system',
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
  for (const m of html.matchAll(/\bid=["']([^"']+)["']/g)) ids.add(m[1]);
  return ids;
}
const rootIds = extractIds(path.join(__dirname, 'index.html'));
const rootFormIds = ROOT_FORM_IDS.filter(id => rootIds.has(id));
let localeOk = true;
for (const lang of ['es','fr','pt','de']) {
  const localeIds = extractIds(path.join(__dirname, lang, 'index.html'));
  const missing = rootFormIds.filter(id => !localeIds.has(id));
  if (missing.length) {
    localeOk = false;
    console.log('FAIL locale /' + lang + '/: missing IDs — ' + missing.join(', '));
  } else {
    console.log('OK  locale /' + lang + '/: ' + rootFormIds.length + ' form IDs, all present');
  }
}
console.log(allOk && jsonOk && localeOk ? '\nALL CHECKS PASSED' : '\nCHECKS FAILED');
