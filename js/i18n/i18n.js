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

  class I18n {
    constructor() {
      this.currentLang = 'en';
      this.translations = {};
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

    /** Loads the dictionary script for `lang`, then applies translations. */
    load(lang) {
      const target = this.isSupported(lang) ? lang : 'en';
      if (this.translations[target]) {
        this.currentLang = target;
        this.applyTranslations();
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'js/i18n/' + target + '.js';
        s.onload = () => {
          this.currentLang = target;
          this.applyTranslations();
          resolve();
        };
        s.onerror = () => {
          // Fall back to English if the dictionary failed to load.
          if (target !== 'en') { this.load('en').then(resolve); }
          else resolve();
        };
        document.head.appendChild(s);
      });
    }

    init() {
      const detected = this.detectLanguage();
      return this.load(detected);
    }

    t(key) {
      const dict = this.translations[this.currentLang];
      if (dict && dict[key]) return dict[key];
      // Fallback: English dictionary, then the raw key.
      const en = this.translations.en;
      return (en && en[key]) ? en[key] : key;
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

      // Document-level SEO
      document.documentElement.lang = this.currentLang === 'en' ? 'en-US' : this.currentLang;
      document.title = t('meta_title');

      const setMeta = (selector, value) => {
        const m = document.querySelector(selector);
        if (m) m.setAttribute('content', value);
      };
      setMeta('meta[name="description"]', t('meta_description'));
      setMeta('meta[property="og:title"]', t('meta_title'));
      setMeta('meta[property="og:description"]', t('meta_description'));

      // Language selector: highlight current language.
      const sel = document.getElementById('lang-select');
      if (sel && sel.value !== this.currentLang) sel.value = this.currentLang;

      // Recompute dynamic captions + refresh charts with the new labels.
      if (window.mortgageCalculator) {
        window.mortgageCalculator.calculate(false);
      }
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
