/**
 * meta.js — Dynamic meta tags for multilingual SEO
 * --------------------------------------------------
 * Provides per-language metadata that i18n.js uses to update <title>,
 * <meta description/keywords>, Open Graph, and Twitter Card tags when
 * the user switches language.
 *
 * Usage: loaded via <script defer> BEFORE i18n.js.
 *        i18n.js calls window.updateMetaTags(lang) in applyTranslations().
 */
(function () {
  'use strict';

  window.META_DATA = {
    en: {
      title: 'VA & Conventional Mortgage Calculator with Taxes and Insurance — 2026',
      description: 'Calculate your VA or conventional mortgage payment with property taxes, home insurance, and extra payments. Free amortization schedule and graphs. Zero down payment options available.',
      keywords: 'mortgage calculator, VA mortgage, conventional mortgage, VA loan payment, home loan calculator, property tax, PMI, amortization, refinance, mortgage affordability',
      ogTitle: 'VA & Conventional Mortgage Calculator with Taxes & Extra Payments',
      ogDescription: 'Calculate monthly payment, total interest, and payoff date for VA and conventional loans. Includes amortization schedule and interactive graphs.',
      ogLocale: 'en_US',
      twitterTitle: 'VA & Conventional Mortgage Calculator 2026',
      twitterDescription: 'Calculate VA or conventional mortgage payments with taxes and insurance. Zero down payment options. Instant results.'
    },
    va: {
      title: 'VA Mortgage Calculator with Taxes and Insurance — 2026',
      description: 'Calculate your VA home loan payment with property taxes, home insurance, and extra payments. Free amortization schedule. Zero down payment available.',
      keywords: 'VA mortgage calculator, VA loan payment, VA home loan, VA mortgage with taxes, VA loan eligibility, zero down payment',
      ogTitle: 'VA Mortgage Calculator with Taxes & Insurance',
      ogDescription: 'Calculate VA mortgage payments with taxes, insurance, and extra payments. Zero down payment. Free amortization table.',
      ogLocale: 'en_US',
      twitterTitle: 'VA Mortgage Calculator 2026',
      twitterDescription: 'Calculate VA loan payments with taxes and insurance. Instant results.'
    },
    pt: {
      title: 'Calculadora de Financiamento com IPTU e Seguro — 2026',
      description: 'Calcule sua parcela mensal com IPTU, seguro e pagamentos extras. Veja tabela de amortização, gráficos e data de quitação — grátis e instantâneo.',
      keywords: 'calculadora financiamento, parcela mensal, amortização, IPTU, seguro, refinanciamento',
      ogTitle: 'Calculadora de Financiamento com IPTU e Pagamentos Extras',
      ogDescription: 'Calcule parcela, juros totais e data de quitação. Inclui tabela de amortização e gráficos interativos.',
      ogLocale: 'pt_BR',
      twitterTitle: 'Calculadora de Financiamento 2026',
      twitterDescription: 'Calcule parcelas com impostos e seguro. Resultados instantâneos e tabela de amortização.'
    },
    es: {
      title: 'Calculadora de Hipoteca con Impuestos y Seguro — 2026',
      description: 'Calcule su pago mensual con impuestos, seguro y pagos adicionales. Vea tabla de amortización, gráficos y fecha de liquidación — gratis, instantáneo.',
      keywords: 'calculadora hipoteca, pago mensual, amortización, impuesto, seguro, refinanciamiento',
      ogTitle: 'Calculadora de Hipoteca con Impuestos y Pagos Extras',
      ogDescription: 'Calcule pago mensual, interés total y fecha de liquidación. Incluye tabla de amortización y gráficos interactivos.',
      ogLocale: 'es_ES',
      twitterTitle: 'Calculadora de Hipoteca 2026',
      twitterDescription: 'Calcule pagos con impuestos y seguro. Resultados instantáneos y tabla de amortización.'
    },
    fr: {
      title: 'Calculateur de Prêt Immobilier avec Taxes et Assurance — 2026',
      description: 'Calculez votre paiement mensuel avec taxes, assurance et paiements supplémentaires. Obtenez le plan d\'amortissement, graphiques et date de remboursement — gratuit, instantané.',
      keywords: 'calculateur prêt immobilier, paiement mensuel, amortissement, taxe foncière, assurance, refinancement',
      ogTitle: 'Calculateur de Prêt avec Taxes et Paiements Supplémentaires',
      ogDescription: 'Calculez paiement mensuel, intérêts totaux et date de remboursement. Inclut tableau d\'amortissement et graphiques interactifs.',
      ogLocale: 'fr_FR',
      twitterTitle: 'Calculateur de Prêt Immobilier 2026',
      twitterDescription: 'Calculez les paiements avec taxes et assurance. Résultats instantanés et tableau d\'amortissement.'
    },
    de: {
      title: 'Hypothekenrechner mit Steuern und Versicherung — 2026',
      description: 'Berechnen Sie Ihre monatliche Rate mit Steuern, Versicherung und Sondertilgungen. Erhalten Sie Tilgungsplan, Grafiken und Tilgungsdatum — kostenlos, sofort.',
      keywords: 'hypothekenrechner, monatliche rate, tilgung, grundsteuer, versicherung, refinanzierung',
      ogTitle: 'Hypothekenrechner mit Steuern und Sondertilgungen',
      ogDescription: 'Berechnen Sie monatliche Rate, Gesamtzinsen und Tilgungsdatum. Inklusive Tilgungsplan und interaktiven Grafiken.',
      ogLocale: 'de_DE',
      twitterTitle: 'Hypothekenrechner 2026',
      twitterDescription: 'Berechnen Sie Raten mit Steuern und Versicherung. Sofortige Ergebnisse und vollständiger Tilgungsplan.'
    }
  };

  /**
   * Updates all SEO meta tags for the given language.
   * Called by i18n.js applyTranslations().
   */
  window.updateMetaTags = function (lang) {
    var data = window.META_DATA[lang] || window.META_DATA.en;
    var fallback = window.META_DATA.en;

    function set(selector, attr, value) {
      var el = document.querySelector(selector);
      if (el && value) el.setAttribute(attr, value);
    }

    // <title>
    document.title = data.title || fallback.title;

    // <html lang>
    document.documentElement.lang = lang === 'en' ? 'en-US' : lang;

    // Standard meta
    set('meta[name="description"]', 'content', data.description || fallback.description);
    set('meta[name="keywords"]', 'content', data.keywords || fallback.keywords);

    // Open Graph
    set('meta[property="og:title"]', 'content', data.ogTitle || fallback.ogTitle);
    set('meta[property="og:description"]', 'content', data.ogDescription || fallback.ogDescription);
    set('meta[property="og:locale"]', 'content', data.ogLocale || fallback.ogLocale);

    // Twitter Card
    set('meta[name="twitter:title"]', 'content', data.twitterTitle || fallback.twitterTitle);
    set('meta[name="twitter:description"]', 'content', data.twitterDescription || fallback.twitterDescription);
  };
})();
