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

  // Dictionaries live in the same folder as i18n.js. Resolve them relative to
  // this script's own URL so subpages (/blog/, /about/, /contact/, /404.html)
  // load them correctly regardless of the page depth.
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  const DICT_BASE = SCRIPT_SRC
    ? SCRIPT_SRC.substring(0, SCRIPT_SRC.lastIndexOf('/') + 1)
    : 'js/i18n/';

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
        s.src = DICT_BASE + lang + '.js';
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
        if (val !== key) el.textContent = val;
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

      // Language selector: highlight current language.
      const sel = document.getElementById('lang-select');
      if (sel && sel.value !== this.currentLang) sel.value = this.currentLang;

      // Recompute dynamic captions + refresh charts with the new labels.
      if (window.mortgageCalculator) {
        window.mortgageCalculator.calculate(false);
      }

      // Notify other scripts (charts, analytics) that the UI language changed.
      document.dispatchEvent(new CustomEvent('i18n:updated', {
        detail: { lang: this.currentLang }
      }));
    }

    /** Called by the <select id="lang-select"> change handler. */
    switchLanguage(lang) {
      if (!this.isSupported(lang)) return;
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
      this.load(lang).then(() => {
        // Keep a shareable URL without forcing a reload.
        const url = new URL(window.location.href);
        url.searchParams.set('lang', lang);
        window.history.replaceState({}, '', url.toString());
      });
    }
  }

  window.i18n = new I18n();
})();
