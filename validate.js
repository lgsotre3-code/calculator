// Validate: (1) JSON-LD blocks in index.html, (2) data-i18n keys vs dictionaries.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// 1) JSON-LD blocks
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
let jsonOk = true;
for (const [, json] of blocks) {
  try {
    const data = JSON.parse(json.trim());
    if (data['@type'] === 'FAQPage' && data.mainEntity.length < 10) {
      console.log('WARN: FAQPage has <10 questions (' + data.mainEntity.length + ')');
    }
    console.log('OK  JSON-LD @type=' + data['@type']);
  } catch (e) {
    jsonOk = false;
    console.log('FAIL JSON-LD: ' + e.message);
  }
}
if (!blocks.length) console.log('FAIL: no JSON-LD found');

// 2) data-i18n keys used in HTML
const keysUsed = new Set();
for (const m of html.matchAll(/data-i18n(?:-placeholder|-aria|-option)?="([^"]+)"/g)) keysUsed.add(m[1]);

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
console.log(allOk && jsonOk ? '\nALL CHECKS PASSED' : '\nCHECKS FAILED');
