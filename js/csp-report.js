(function () {
  'use strict';

  function send(v) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'csp_violation',
        csp_directive: v.effectiveDirective || '',
        csp_blocked: String(v.blockedURL || '').slice(0, 120),
        csp_sample: String(v.sample || '').slice(0, 80)
      });
    } catch (err) {}
    if (window.console && console.warn) {
      console.warn('[CSP-REPORT-ONLY]', v.effectiveDirective, v.blockedURL);
    }
  }

  document.addEventListener('securitypolicyviolation', send);
})();
