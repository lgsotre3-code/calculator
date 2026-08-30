/**
 * i18n.js — Translation manager (client-side, no reload)
 * ------------------------------------------------------
 * Supported languages: en, es, fr, pt, de (extend isSupported to add more).
 *
 * Language resolution order:
 *   1. localStorage "preferred_language" (user's manual choice)
 *   2. URL ?lang=xx parameter
 *   3. navigator.language (browser)
 *   4. "en" (default / x-default)
 *
 * Design notes:
 *   - The page ships with full English content (SEO crawlable).
 *   - Translations are applied to any element tagged with:
 *       data-i18n              → textContent
 *       data-i18n-placeholder  → placeholder attribute
 *       data-i18n-aria         → aria-label attribute
 *   - Switching language rewrites <title>, meta description/OG tags, the
 *     <html lang> attribute, updates hreflang links and re-renders charts.
 *   - The URL is kept shareable with ?lang=xx (static-hosting friendly).
 *     If you serve real folders (/en/, /es/, ...) point switchLanguage() to
 *     those paths instead.
 */
(function () {
  'use strict';

  const SUPPORTED = ['en', 'es', 'fr', 'pt', 'de'];
  const STORAGE_KEY = 'preferred_language';

  // The only two blog posts stored as flat "<slug>.html" files instead of
  // a "<slug>/index.html" directory. With Vercel's cleanUrls:true their
  // canonical/served URL has NO ".html" and NO trailing slash (e.g.
  // "/blog/best-mortgage-lenders"), unlike every other post — so they
  // need to be special-cased rather than detected from the URL shape.
  const FLAT_BLOG_SLUGS = ['best-mortgage-lenders', 'fha-vs-conventional-loans'];

  // Calculator/comparison pages that now ship a real, dedicated locale
  // folder per language (see /es/, /fr/, /pt/, /de/) instead of the old
  // ?lang=xx query-string trick. Kept as an explicit list (like
  // FLAT_BLOG_SLUGS) rather than inferred from the URL shape, since new
  // calculator pages may be added without a locale folder yet.
  const LOCALIZED_CALC_SLUGS = [
    'fha-vs-conventional', 'va-mortgage-calculator', 'discount-points-calculator',
    'renovation-roi', 'loan-portability', 'finance-vs-cash', 'rent-vs-buy',
    'affordability-calculator', 'credit-score-mortgage-calculator',
  ];

  // Dictionaries live in the same folder as i18n.js. Resolve them relative to
  // this script's own URL so subpages (/blog/, /about/, /contact/, /404.html)
  // load them correctly regardless of the page depth.
  // NOTE: document.currentScript is null for deferred scripts, so we also
  // scan the DOM for the <script> tag that loaded this file.
  function resolveDictBase() {
    var cs = document.currentScript;
    if (cs && cs.src) return cs.src.substring(0, cs.src.lastIndexOf('/') + 1);
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (s.src && s.src.indexOf('/js/i18n/i18n.js') !== -1) {
        return s.src.substring(0, s.src.lastIndexOf('/') + 1);
      }
    }
    return 'js/i18n/';
  }
  var DICT_BASE = resolveDictBase();
  var DICT_VERSION = '?v=1';

  class I18n {
    constructor() {
      this.currentLang = 'en';
      this.translations = {};
      this.ready = Promise.resolve();
    }

    isSupported(lang) {
      return SUPPORTED.indexOf(lang) !== -1;
    }

    detectLanguage() {
      // 1) explicit URL (?lang=xx) — deep links and locale folders win
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get('lang');
      if (urlLang && this.isSupported(urlLang)) return urlLang;

      // 2) explicit user preference (persisted by the manual selector)
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && this.isSupported(saved)) return saved;
      } catch (e) { /* storage unavailable — continue */ }

      // 3) browser language
      const browserLang = (navigator.language || 'en').split('-')[0].toLowerCase();
      if (this.isSupported(browserLang)) return browserLang;

      // 4) default
      return 'en';
    }

    /** Loads the English fallback dictionary first (if needed), then `lang`. */
    load(lang) {
      const target = this.isSupported(lang) ? lang : 'en';
      if (this.translations[target]) {
        this.currentLang = target;
        this.applyTranslations();
        return Promise.resolve();
      }
      // Always ensure the English dictionary is available so t() can fall back
      // on keys that are missing in the target language.
      const ensureEn = (target !== 'en' && !this.translations.en)
        ? this.fetchDict('en')
        : Promise.resolve();
      return ensureEn.then(() => this.fetchDict(target));
    }

    /**
     * Injects <script src="js/i18n/{lang}.js">. The dictionary files register
     * themselves on window.TRANSLATIONS; we adopt them into this.translations.
     */
    fetchDict(lang) {
      return new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = DICT_BASE + lang + '.js' + DICT_VERSION;
        s.onload = () => {
          this.adoptDictionaries();
          this.currentLang = lang;
          this.applyTranslations();
          resolve();
        };
        s.onerror = () => {
          // Fall back to English if the dictionary failed to load.
          if (lang !== 'en') { this.fetchDict('en').then(resolve); }
          else resolve();
        };
        document.head.appendChild(s);
      });
    }

    /** Copies every dictionary the loader scripts put on window.TRANSLATIONS. */
    adoptDictionaries() {
      if (!window.TRANSLATIONS) return;
      Object.keys(window.TRANSLATIONS).forEach((k) => {
        if (!this.translations[k]) this.translations[k] = window.TRANSLATIONS[k];
      });
    }

    init() {
      const detected = this.detectLanguage();
      this.ready = this.load(detected);
      return this.ready;
    }

    t(key) {
      const dict = this.translations[this.currentLang];
      if (dict && dict[key]) return dict[key];
      // Fallback: English dictionary, then the raw key.
      const en = this.translations.en;
      if (en && en[key]) return en[key];
      // Dictionaries still loading: applyTranslations() re-renders the page as
      // soon as they arrive, so stay quiet instead of warning on transient
      // misses that happen before the first dictionary finishes loading.
      if (!this.translations[this.currentLang] && !en) return key;
      console.warn('[i18n] Missing translation: "' + key + '" (' + this.currentLang + ')');
      return key;
    }

    applyTranslations() {
      const t = this.t.bind(this);

      // Static text elements
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (val !== key) el.innerHTML = val;
      });

      // Placeholders
      document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        const val = t(key);
        if (val !== key) el.setAttribute('placeholder', val);
      });

      // Value attributes (e.g. translated form field defaults)
      document.querySelectorAll('[data-i18n-value]').forEach((el) => {
        const key = el.getAttribute('data-i18n-value');
        const val = t(key);
        if (val !== key) el.setAttribute('value', val);
      });

      // ARIA labels
      document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
        const key = el.getAttribute('data-i18n-aria');
        const val = t(key);
        if (val !== key) el.setAttribute('aria-label', val);
      });

      // Select options with data-i18n-option (e.g. loan term years)
      document.querySelectorAll('option[data-i18n-option]').forEach((opt) => {
        const key = opt.getAttribute('data-i18n-option');
        const val = t(key);
        if (val !== key) opt.textContent = val;
      });

      // Document-level SEO. Pages may override the shared keys with
      // <title data-i18n-title="..."> and <meta name="description" data-i18n-desc="...">.
      const titleEl = document.querySelector('title');
      const titleKey = (titleEl && titleEl.getAttribute('data-i18n-title')) || 'meta_title';
      const descEl = document.querySelector('meta[name="description"]');
      const descKey = (descEl && descEl.getAttribute('data-i18n-desc')) || 'meta_description';

      document.documentElement.lang = this.currentLang === 'en' ? 'en-US' : this.currentLang;
      document.title = t(titleKey);

      const setMeta = (selector, value) => {
        const m = document.querySelector(selector);
        if (m) m.setAttribute('content', value);
      };
      setMeta('meta[name="description"]', t(descKey));
      setMeta('meta[property="og:title"]', t(titleKey));
      setMeta('meta[property="og:description"]', t(descKey));

      // Extended meta tags (keywords, og:locale, twitter) via meta.js
      if (typeof window.updateMetaTags === 'function') {
        window.updateMetaTags(this.currentLang);
      }

      // Language selector: highlight current language.
      const sel = document.getElementById('lang-select');
      if (sel && sel.value !== this.currentLang) sel.value = this.currentLang;

      this.updateCanonical();

      // Recompute dynamic captions + refresh charts with the new labels.
      if (window.mortgageCalculator) {
        window.mortgageCalculator.calculate(false);
      }

      // Notify other scripts (charts, analytics) that the UI language changed.
      document.dispatchEvent(new CustomEvent('i18n:updated', {
        detail: { lang: this.currentLang }
      }));
    }

    /**
     * Keeps <link rel="canonical"> in sync with the active language on
     * pages that use the ?lang=xx fallback (no dedicated locale folder —
     * e.g. /calculators/). Those pages ship ONE static HTML file whose
     * hreflang block advertises "?lang=es", "?lang=pt", etc. as the
     * per-language URLs, but the canonical tag was hardcoded to the bare
     * English URL. That mismatch told Google every non-English variant's
     * "real" page was the English one, so only English ever got indexed.
     * Self-referencing canonical per ?lang value fixes it: en (or no
     * lang param) canonicalizes to the bare URL (matches x-default),
     * every other language canonicalizes to its own "?lang=xx" URL
     * (matches its own hreflang entry).
     * Pages with a dedicated locale folder, a translated blog post, or a
     * translated calculator page already ship a correct static canonical
     * server-side and are skipped here.
     */
    updateCanonical() {
      const path = window.location.pathname;
      if (this.hasLocaleFolder() || this.blogPostSlugFromPath(path) || this.calculatorSlugFromPath(path)) {
        return;
      }
      const link = document.querySelector('link[rel="canonical"]');
      if (!link) return;

      const url = new URL(window.location.href);
      if (this.currentLang === 'en') {
        url.searchParams.delete('lang');
      } else {
        url.searchParams.set('lang', this.currentLang);
      }
      link.setAttribute('href', url.origin + url.pathname + (url.search || ''));
    }

    /**
     * Pages that ship a real, dedicated locale folder (with its own
     * canonical + hreflang tags). For these, switching language should
     * navigate to that folder instead of tacking on ?lang=xx — otherwise
     * we create a second, competing URL for content Google already has
     * a clean indexable copy of.
     */
    hasLocaleFolder() {
      const path = window.location.pathname;
      return path === '/' || path === '/index.html' ||
        /^\/(es|fr|pt|de)\/?$/.test(path) ||
        !!this.blogPostSlugFromPath(path);
    }

    /**
     * Extracts the slug of a blog POST (not the /blog/ listing page,
     * which has no per-locale index.html) from a path, stripped of any
     * existing locale prefix, trailing slash, and .html extension.
     * Returns the bare slug, or null if this isn't a blog post page.
     */
    blogPostSlugFromPath(path) {
      const m = path.match(/^\/(?:en|es|fr|pt|de)?\/?blog\/(.+)$/);
      if (!m) return null;
      const slug = m[1].replace(/\/$/, '').replace(/\.html$/, '');
      return slug === '' ? null : slug;
    }

    /**
     * Extracts the slug of a localized calculator/comparison page (see
     * LOCALIZED_CALC_SLUGS) from a path, stripped of any existing locale
     * prefix and trailing slash. Returns null if this isn't one of those
     * pages.
     */
    calculatorSlugFromPath(path) {
      const m = path.match(/^\/(?:es|fr|pt|de)?\/?([a-z0-9-]+)\/?$/);
      if (!m) return null;
      return LOCALIZED_CALC_SLUGS.indexOf(m[1]) !== -1 ? m[1] : null;
    }

    /** Called by the <select id="lang-select"> change handler. */
    switchLanguage(lang) {
      if (!this.isSupported(lang)) return;
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }

      const postSlug = this.blogPostSlugFromPath(window.location.pathname);
      if (postSlug) {
        // Dedicated translated post folders exist per language; the root
        // (en) has no /en/blog/ folder, posts live directly at /blog/.
        const base = lang === 'en' ? '/blog/' : '/' + lang + '/blog/';
        // Directory-based posts need a trailing slash; the two flat-file
        // posts must NOT have one (cleanUrls serves them without it).
        window.location.href = FLAT_BLOG_SLUGS.indexOf(postSlug) !== -1
          ? base + postSlug
          : base + postSlug + '/';
        return;
      }

      const calcSlug = this.calculatorSlugFromPath(window.location.pathname);
      if (calcSlug) {
        // Dedicated translated folders exist per language for these pages
        // (same pattern as blog posts above); 'en' has no /en/ prefix.
        const base = lang === 'en' ? '/' : '/' + lang + '/';
        window.location.href = base + calcSlug + '/';
        return;
      }

      if (this.hasLocaleFolder()) {
        // 'en' nao tem pasta propria - a raiz ja serve o conteudo em ingles.
        // Seguindo o mesmo padrao do blog (lang === 'en' ? '/blog/' : '/'+lang+'/blog/').
        window.location.href = lang === 'en' ? '/' : '/' + lang + '/';
        return;
      }

      this.load(lang).then(() => {
        // No dedicated folder for this page — keep the shareable ?lang=xx
        // URL (static-hosting friendly), same as before.
        const url = new URL(window.location.href);
        url.searchParams.set('lang', lang);
        window.history.replaceState({}, '', url.toString());
      });
    }
  }

  window.i18n = new I18n();
})();
