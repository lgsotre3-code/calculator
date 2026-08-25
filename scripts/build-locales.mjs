/**
 * build-locales.mjs
 * -----------------
 * Generates static locale pages (/en/, /es/, /fr/, /pt/, /de/) from index.html.
 * Replaces data-i18n text, data-i18n-placeholder, data-i18n-aria, and data-i18n-option
 * with pre-rendered translations. Updates SEO tags (title, description, canonical,
 * hreflang, OG, Twitter Card).
 *
 * Usage:  node scripts/build-locales.mjs
 *         node scripts/build-locales.mjs --locale pt   (generate only one)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOMAIN = 'https://www.mortgage-pro-calc.com';
const ALL_LOCALES = ['en', 'es', 'fr', 'pt', 'de']; // used for hreflang tags only
const LOCALES_WITH_FOLDER = ['es', 'fr', 'pt', 'de'];  // 'en' = raiz, sem pasta fisica

// CLI filter
const localeArg = process.argv.find(a => a.startsWith('--locale='))
  || (process.argv.includes('--locale') ? process.argv[process.argv.indexOf('--locale') + 1] : null);
const LOCALES = localeArg ? [localeArg.replace('--locale=', '')] : LOCALES_WITH_FOLDER;

const LANG_MAP = { en: 'en-US', es: 'es', fr: 'fr', pt: 'pt-BR', de: 'de' };

/* ---------- helpers ---------- */

function loadDictionary(lang) {
  const code = readFileSync(join(ROOT, 'js', 'i18n', `${lang}.js`), 'utf-8');
  const ctx = { window: { TRANSLATIONS: {} } };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.window.TRANSLATIONS[lang];
}

function loadMeta() {
  const code = readFileSync(join(ROOT, 'js', 'i18n', 'meta.js'), 'utf-8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.window.META_DATA;
}

function escRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAll(html, dict, pattern, replacementFn) {
  let result = html;
  for (const [key, value] of Object.entries(dict)) {
    if (typeof value !== 'string') continue;
    const re = new RegExp(pattern(key), 'g');
    result = result.replace(re, (...m) => replacementFn(m, value));
  }
  return result;
}

/* ---------- main ---------- */

const template = readFileSync(join(ROOT, 'index.html'), 'utf-8');
const meta = loadMeta();

for (const lang of LOCALES) {
  const dict = loadDictionary(lang);
  const localeMeta = meta[lang] || meta.en;
  let html = template;

  // 1. data-i18n text content
  html = replaceAll(html, dict,
    key => `(<([\\w-]+)[^>]*\\bdata-i18n="${escRegex(key)}"[^>]*>)([^<]*)(<\\/\\2>)`,
    (m, value) => `${m[1]}${value}${m[4]}`
  );

  // 2. data-i18n-placeholder
  html = replaceAll(html, dict,
    key => `(data-i18n-placeholder="${escRegex(key)}"[^>]*placeholder=")[^"]*(")`,
    (m, value) => `${m[1]}${value}${m[2]}`
  );

  // 3. data-i18n-aria (aria-label)
  html = replaceAll(html, dict,
    key => `(data-i18n-aria="${escRegex(key)}"[^>]*aria-label=")[^"]*(")`,
    (m, value) => `${m[1]}${value}${m[2]}`
  );

  // 4. data-i18n-option text
  html = replaceAll(html, dict,
    key => `(<option[^>]*\\bdata-i18n-option="${escRegex(key)}"[^>]*>)[^<]*(<\\/option>)`,
    (m, value) => `${m[1]}${value}${m[2]}`
  );

  // 5. <html lang>
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${LANG_MAP[lang]}"`);

  // 6. <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${localeMeta.title}</title>`);

  // 7. meta description
  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${localeMeta.description}$2`
  );

  // 8. meta keywords
  html = html.replace(
    /(<meta name="keywords" content=")[^"]*(")/,
    `$1${localeMeta.keywords}$2`
  );

  // 9. canonical
  html = html.replace(
    /(<link rel="canonical" href=")[^"]*(")/,
    `$1${DOMAIN}/${lang}/$2`
  );

  // 10. og:title, og:description, og:locale, og:url
  html = html.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    `$1${localeMeta.ogTitle}$2`
  );
  html = html.replace(
    /(<meta property="og:description" content=")[^"]*(")/,
    `$1${localeMeta.ogDescription}$2`
  );
  html = html.replace(
    /(<meta property="og:locale" content=")[^"]*(")/,
    `$1${localeMeta.ogLocale}$2`
  );
  html = html.replace(
    /(<meta property="og:url" content=")[^"]*(")/,
    `$1${DOMAIN}/${lang}/$2`
  );

  // 11. twitter:title, twitter:description
  html = html.replace(
    /(<meta name="twitter:title" content=")[^"]*(")/,
    `$1${localeMeta.twitterTitle}$2`
  );
  html = html.replace(
    /(<meta name="twitter:description" content=")[^"]*(")/,
    `$1${localeMeta.twitterDescription}$2`
  );

  // 12b. Fix root-relative asset paths (favicon/css/js) so they resolve
  // correctly from the /<lang>/ subdirectory the locale page is written to.
  // The template (root index.html) uses paths like "css/style.css" which
  // are only valid at the site root; once copied into /en/, /es/, etc.
  // those same relative paths incorrectly resolve to /en/css/style.css
  // (404), breaking all styling and calculator JS. Rewrite them to be
  // root-absolute ("/css/style.css") so they work at any depth.
  html = html.replace(
    /((?:href|src)=")(assets\/|css\/|js\/)/g,
    '$1/$2'
  );

  // 12. hreflang block (replace entire block)
  // 'en' usa a raiz do dominio (sem pasta /en/); demais locales usam /lang/
  const hreflangLines = ALL_LOCALES.map(l =>
    l === 'en'
      ? `  <link rel="alternate" hreflang="en" href="${DOMAIN}/">`
      : `  <link rel="alternate" hreflang="${l}" href="${DOMAIN}/${l}/">`
  ).join('\n');
  html = html.replace(
    /<!-- ============ Multilingual SEO: hreflang ============[\s\S]*?hreflang="x-default" href="[^"]*">/,
    `<!-- ============ Multilingual SEO: hreflang ============ -->\n${hreflangLines}\n  <link rel="alternate" hreflang="x-default" href="${DOMAIN}/">`
  );

  // Write
  const outDir = join(ROOT, lang);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf-8');
  console.log(`  /${lang}/index.html`);
}

console.log(`\nDone — ${LOCALES.length} locale page(s) generated.`);
