/**
 * calculator.js — Mortgage Calculator logic
 * -----------------------------------------
 * - Reads all inputs (sliders + number fields), keeps them in sync.
 * - Computes the monthly payment (Principal & Interest + Property Tax + Insurance).
 * - Builds a full amortization schedule supporting extra payments.
 * - Renders result cards, payoff date and the amortization table.
 * - Calls window.updateCharts(...) (defined in chart.js) when available.
 * - Fires analytics events (dataLayer) on each calculation.
 *
 * Dependencies: none at load time. Runs when DOMContentLoaded fires.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------ */
  const DEFAULTS = {
    homeValue: 350000,     // US$ (range 50k – 2M, step 1k)
    downPercent: 20,       // % of home value (range 0 – 50, step 0.5)
    interestRate: 6.5,     // annual % (range 1 – 15, step 0.01)
    loanTerm: 30,          // years (10 / 15 / 20 / 25 / 30)
    propertyTax: 1.2,      // annual % of home value (0 – 5)
    insurance: 1200,       // US$ / year (0 – 10000)
    extraPayment: 0        // US$ / month (0 – 5000)
  };

  const HOME_MIN = 50000, HOME_MAX = 2000000;
  const DOWN_MAX_PCT = 50;
  const RATE_MIN = 1, RATE_MAX = 15;
  const TAX_MAX = 5, INS_MAX = 10000, EXTRA_MAX = 5000;

  /* ------------------------------------------------------------------
   * Currency / number formatting helpers (US-style, e.g. $123,456.78)
   * ------------------------------------------------------------------ */
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
  function num(id) { const v = parseFloat(document.getElementById(id).value); return isFinite(v) ? v : 0; }

  /** Debounce — sliders fire many 'input' events per drag; recalc after a pause. */
  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      const self = this;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(self, args), wait);
    };
  }

  /* ------------------------------------------------------------------
   * State (single source of truth for Down Payment is the percentage)
   * ------------------------------------------------------------------ */
  const state = {
    homeValue: DEFAULTS.homeValue,
    downPercent: DEFAULTS.downPercent,
    interestRate: DEFAULTS.interestRate,
    loanTerm: DEFAULTS.loanTerm,
    propertyTax: DEFAULTS.propertyTax,
    insurance: DEFAULTS.insurance,
    extraPayment: DEFAULTS.extraPayment
  };

  let lastSchedule = null;   // amortization rows (used by chart.js)
  let lastBaseM = 0;         // scheduled P&I payment without extra payments

  /* ------------------------------------------------------------------
   * Element references
   * ------------------------------------------------------------------ */
  const el = {};
  function cacheElements() {
    ['home-value-slider', 'home-value',
     'down-payment-slider', 'down-payment', 'down-payment-percent', 'down-payment-caption',
     'interest-rate-slider', 'interest-rate',
     'loan-term',
     'property-tax', 'insurance', 'extra-payment',
     'monthly-payment', 'pi-value', 'tax-value', 'insurance-value', 'monthly-extra',
     'total-interest', 'total-payment', 'payoff-date', 'interest-saved',
      'amortization-body', 'schedule-footer', 'show-full-schedule',
      'export-pdf', 'pdf-status',
      'result-monthly-label']
      .forEach(id => { el[id] = document.getElementById(id); });
  }

  /* ------------------------------------------------------------------
   * Input <-> state sync
   * ------------------------------------------------------------------ */
  function readInputs() {
    state.homeValue = clamp(num('home-value') || HOME_MIN, HOME_MIN, HOME_MAX);
    state.downPercent = clamp(num('down-payment-slider') || 0, 0, DOWN_MAX_PCT);
    state.interestRate = clamp(num('interest-rate') || RATE_MIN, RATE_MIN, RATE_MAX);
    state.loanTerm = parseInt(document.getElementById('loan-term').value, 10) || 30;
    state.propertyTax = clamp(num('property-tax') || 0, 0, TAX_MAX);
    state.insurance = clamp(num('insurance') || 0, 0, INS_MAX);
    state.extraPayment = clamp(num('extra-payment') || 0, 0, EXTRA_MAX);

    // Down payment in dollars always derives from the percentage so the
    // slider and the number field can never disagree.
    const downUsd = state.homeValue * state.downPercent / 100;
    el['down-payment'].value = Math.round(downUsd);
    el['down-payment-percent'].textContent = state.downPercent.toFixed(1).replace(/\.0$/, '') + '%';

    // Caption: "$70,000 (20% of $350,000)"
    const capT = window.i18n ? window.i18n.t('down_payment_caption') : null;
    el['down-payment-caption'].textContent = capT
      ? capT.replace('{usd}', usd0.format(downUsd)).replace('{pct}', state.downPercent.toFixed(1).replace(/\.0$/, '')).replace('{home}', usd0.format(state.homeValue))
      : usd0.format(downUsd) + ' (' + state.downPercent.toFixed(1).replace(/\.0$/, '') + '% of ' + usd0.format(state.homeValue) + ')';
  }

  /** Syncs slider/number pairs (single direction: the changed element wins). */
  function syncPair(sliderId, inputId, fromSlider) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);
    if (fromSlider) { input.value = slider.value; }
    else { slider.value = clamp(num(inputId), parseFloat(slider.min) || 0, parseFloat(slider.max) || 0); }
  }

  /* ------------------------------------------------------------------
   * Core math: amortization schedule with extra payments
   * ------------------------------------------------------------------ */
  function amortize(principal, annualRate, termYears, extraMonthly) {
    const r = annualRate / 100 / 12;              // monthly rate
    const n = termYears * 12;                     // scheduled months
    const M = r === 0
      ? principal / n
      : principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);

    let balance = principal;
    let month = 0;
    let totalInterest = 0;
    const rows = [];

    while (balance > 0.005 && month < n) {
      month += 1;
      const interest = balance * r;
      // Extra payment goes straight to principal; the final month is capped.
      let principalPaid = (M - interest) + extraMonthly;
      if (!isFinite(principalPaid) || principalPaid <= 0) principalPaid = Math.max(M, interest);
      if (principalPaid >= balance) principalPaid = balance;
      totalInterest += interest;
      balance -= principalPaid;
      rows.push({
        m: month,
        payment: interest + principalPaid,
        principal: principalPaid,
        interest: interest,
        balance: Math.max(balance, 0)
      });
    }

    return {
      rows,
      M,
      payoffMonths: month,
      totalInterest,
      totalPaid: principal + totalInterest
    };
  }

  /* ------------------------------------------------------------------
   * Payoff date (loan starts today)
   * ------------------------------------------------------------------ */
  function payoffDate(months) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const locale = (window.i18n && window.i18n.currentLang) || 'en';
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : locale, { month: 'long', year: 'numeric' });
  }

  /* ------------------------------------------------------------------
   * Render
   * ------------------------------------------------------------------ */
  function renderResults(sched, monthlyTax, monthlyIns, monthlyExtra) {
    const totalMonthly = sched.M + monthlyTax + monthlyIns;
    const t = (window.i18n && window.i18n.t) ? window.i18n.t.bind(window.i18n) : (k => k);

    el['monthly-payment'].textContent = usd.format(totalMonthly);
    el['pi-value'].textContent = usd.format(sched.M);
    el['tax-value'].textContent = usd.format(monthlyTax);
    el['insurance-value'].textContent = usd.format(monthlyIns);
    el['monthly-extra'].textContent = monthlyExtra > 0 ? ' + ' + usd.format(monthlyExtra) + '/' + t('month_abbr') : '';
    el['total-interest'].textContent = usd.format(sched.totalInterest);
    el['total-payment'].textContent = usd.format(sched.totalPaid);
    el['payoff-date'].textContent = payoffDate(sched.payoffMonths);

    // Interest saved thanks to extra payments (0 when there are none).
    const base = amortize(state.homeValue - state.homeValue * state.downPercent / 100, state.interestRate, state.loanTerm, 0);
    const saved = Math.max(base.totalInterest - sched.totalInterest, 0);
    el['interest-saved'].textContent = usd.format(saved);
  }

  /** Renders the table. `limit` = max rows; pass 0 for the full schedule. */
  function renderTable(sched, limit) {
    const rows = sched.rows;
    const showAll = limit === 0;
    const count = showAll ? rows.length : Math.min(rows.length, limit);
    const frag = document.createDocumentFragment();
    const t = (window.i18n && window.i18n.t) ? window.i18n.t.bind(window.i18n) : (k => k);

    for (let i = 0; i < count; i += 1) {
      const row = rows[i];
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + row.m + '</td>' +
        '<td>' + usd.format(row.payment) + '</td>' +
        '<td>' + usd.format(row.principal) + '</td>' +
        '<td>' + usd.format(row.interest) + '</td>' +
        '<td>' + usd.format(row.balance) + '</td>';
      frag.appendChild(tr);
    }

    el['amortization-body'].textContent = '';
    el['amortization-body'].appendChild(frag);

    const footer = el['schedule-footer'];
    if (footer) {
      const totalMonths = sched.rows.length;
      footer.textContent = showAll
        ? t('schedule_note').replace('{months}', totalMonths)
        : t('schedule_note').replace('{months}', totalMonths) + ' — ' + t('showing_first').replace('{n}', count) + '.';
    }

    const btn = el['show-full-schedule'];
    if (btn) {
      btn.textContent = showAll ? t('show_less') : t('show_full_schedule');
      btn.style.display = rows.length > count ? '' : 'none';
      btn.dataset.mode = showAll ? 'less' : 'more';
    }
  }

  /* ------------------------------------------------------------------
   * PDF export (full amortization schedule)
   * jsPDF is lazy-loaded from the CDN on first use, so it never blocks
   * the initial page load (mirrors the Chart.js pattern above).
   * ------------------------------------------------------------------ */
  let jspdfPromise = null;
  function loadJspdf() {
    if (!jspdfPromise) {
      jspdfPromise = new Promise((resolve, reject) => {
        if (window.jspdf && window.jspdf.jsPDF) { resolve(window.jspdf); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
        s.defer = true;
        s.onload = () => (window.jspdf && window.jspdf.jsPDF ? resolve(window.jspdf) : reject(new Error('jsPDF unavailable')));
        s.onerror = () => reject(new Error('jsPDF failed to load'));
        document.body.appendChild(s);
      });
    }
    return jspdfPromise;
  }

  function pdfDateStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** Builds the paginated PDF. Rows are never split across page boundaries. */
  function buildPdf(doc, t) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentW = pageW - margin * 2;
    const hasExtra = state.extraPayment > 0;

    const locale = (window.i18n && window.i18n.currentLang) || 'en';
    const genDate = new Date().toLocaleDateString(locale === 'en' ? 'en-US' : locale, { year: 'numeric', month: 'long', day: 'numeric' });

    /* ---------- Header ---------- */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(26, 54, 93);
    doc.text(t('brand_name'), margin, 40);
    doc.setFontSize(12);
    doc.text(t('schedule_title'), margin, 56);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 64, pageW - margin, 64);

    /* ---------- Loan summary ---------- */
    const downUsd = state.homeValue * state.downPercent / 100;
    const summary = [
      [t('pdf_home_value'), usd0.format(state.homeValue)],
      [t('pdf_down_payment'), usd0.format(downUsd) + ' (' + state.downPercent.toFixed(1).replace(/\.0$/, '') + '%)'],
      [t('pdf_interest_rate'), state.interestRate.toFixed(2) + '%'],
      [t('pdf_loan_term'), state.loanTerm + ' ' + t('pdf_years')],
      [t('pdf_monthly_payment'), usd.format(lastSchedule.M)],
      [t('pdf_total_interest'), usd.format(lastSchedule.totalInterest)],
      [t('pdf_payoff_date'), payoffDate(lastSchedule.payoffMonths)]
    ];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(45, 55, 72);
    doc.text(t('pdf_summary'), margin, 78);
    const colW = contentW / 2;
    const labelW = 128;
    summary.forEach((row, i) => {
      const x = margin + (i % 2) * colW;
      const yy = 92 + Math.floor(i / 2) * 15;
      doc.setFont('helvetica', 'bold');
      doc.text(row[0] + ':', x, yy);
      doc.setFont('helvetica', 'normal');
      doc.text(String(row[1]), x + labelW, yy);
    });

    /* ---------- Table ---------- */
    const rowH = 14;
    const headerH = 18;
    const footerH = 30;
    const maxY = pageH - margin - footerH;
    const monthW = 50;
    const moneyW = (contentW - monthW) / (hasExtra ? 5 : 4);

    function drawHeader(yy) {
      doc.setFillColor(237, 242, 247);
      doc.rect(margin, yy, contentW, headerH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(45, 55, 72);
      let x = margin;
      doc.text(t('month'), x + 4, yy + 12);
      x += monthW;
      const labels = [t('payment'), t('principal'), t('interest')];
      if (hasExtra) labels.push(t('pdf_extra_col'));
      labels.push(t('balance'));
      labels.forEach(label => {
        doc.text(label, x + moneyW - 4, yy + 12, { align: 'right' });
        x += moneyW;
      });
      doc.setDrawColor(203, 213, 224);
      doc.line(margin, yy + headerH, pageW - margin, yy + headerH);
      doc.setFont('helvetica', 'normal');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(45, 55, 72);
    drawHeader(margin);
    let y = margin + headerH;

    lastSchedule.rows.forEach(row => {
      // Page break before the row only — a row is never split across pages.
      if (y + rowH > maxY) {
        doc.addPage();
        drawHeader(margin);
        y = margin + headerH;
      }
      let x = margin;
      doc.text(String(row.m), x + 4, y + 11);
      x += monthW;
      const cells = [row.payment, row.principal, row.interest];
      if (hasExtra) cells.push(state.extraPayment);
      cells.push(row.balance);
      cells.forEach(v => {
        doc.text(usd.format(v), x + moneyW - 4, y + 11, { align: 'right' });
        x += moneyW;
      });
      y += rowH;
    });

    /* ---------- Footer (generation date + site URL + page number) ---------- */
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p += 1) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(113, 128, 150);
      doc.text(t('pdf_generated_on').replace('{date}', genDate) + ' — https://www.mortgage-pro-calc.com', margin, pageH - 20);
      doc.text(p + ' / ' + pageCount, pageW - margin, pageH - 20, { align: 'right' });
    }
  }

  function exportPdf() {
    const btn = el['export-pdf'];
    if (!btn || btn.disabled) return;
    if (!lastSchedule || !lastSchedule.rows.length) return;

    const t = (window.i18n && window.i18n.t) ? window.i18n.t.bind(window.i18n) : (k => k);
    const statusEl = el['pdf-status'];
    const originalLabel = btn.textContent;

    btn.disabled = true;
    btn.textContent = t('generating_pdf');
    if (statusEl) statusEl.hidden = true;

    loadJspdf()
      .then(({ jsPDF }) => {
        try {
          const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
          buildPdf(doc, t);
          doc.save('amortization-schedule-' + Math.round(state.homeValue) + '-' + pdfDateStr() + '.pdf');
        } catch (err) {
          if (statusEl) { statusEl.textContent = t('pdf_error'); statusEl.hidden = false; }
        }
      })
      .catch(() => {
        if (statusEl) { statusEl.textContent = t('pdf_error'); statusEl.hidden = false; }
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = originalLabel;
      });
  }

  /* ------------------------------------------------------------------
   * Main calculation pipeline
   * ------------------------------------------------------------------ */
  function calculate(fromButton) {
    readInputs();

    const principal = state.homeValue - state.homeValue * state.downPercent / 100;
    const sched = amortize(principal, state.interestRate, state.loanTerm, state.extraPayment);
    const monthlyTax = state.homeValue * state.propertyTax / 100 / 12;
    const monthlyIns = state.insurance / 12;

    lastSchedule = sched;
    lastBaseM = sched.M;

    renderResults(sched, monthlyTax, monthlyIns, state.extraPayment);
    renderTable(sched, 12); // first 12 months; user can expand the full schedule

    // Charts (if chart.js is loaded and Chart is available)
    if (typeof window.updateCharts === 'function') {
      window.updateCharts(sched, { principal: principal, pi: sched.M, tax: monthlyTax, insurance: monthlyIns, extra: state.extraPayment });
    }

    // Analytics (if analytics.js / GTM are present)
    if (typeof window.dataLayer !== 'undefined') {
      window.dataLayer.push({
        event: 'calculator_calculate',
        calculator: 'mortgage',
        home_value: state.homeValue,
        down_payment_pct: state.downPercent,
        interest_rate: state.interestRate,
        loan_term: state.loanTerm,
        property_tax: state.propertyTax,
        insurance: state.insurance,
        extra_payment: state.extraPayment,
        monthly_payment: sched.M + monthlyTax + monthlyIns,
        trigger: fromButton ? 'button' : 'input'
      });
    }
  }

  /* ------------------------------------------------------------------
   * Wire up events
   * ------------------------------------------------------------------ */
  function reset() {
    Object.assign(state, DEFAULTS);
    document.getElementById('home-value').value = DEFAULTS.homeValue;
    document.getElementById('home-value-slider').value = DEFAULTS.homeValue;
    document.getElementById('down-payment-slider').value = DEFAULTS.downPercent;
    document.getElementById('interest-rate').value = DEFAULTS.interestRate;
    document.getElementById('interest-rate-slider').value = DEFAULTS.interestRate;
    document.getElementById('loan-term').value = DEFAULTS.loanTerm;
    document.getElementById('property-tax').value = DEFAULTS.propertyTax;
    document.getElementById('insurance').value = DEFAULTS.insurance;
    document.getElementById('extra-payment').value = DEFAULTS.extraPayment;
    calculate(false);
  }

  function init() {
    cacheElements();

    // Number fields sync their sliders immediately; the heavy recalc
    // (schedule + charts + table) is debounced to keep drags smooth.
    const recalc = debounce(() => calculate(false), 100);

    // Live updates on every input change.
    document.getElementById('home-value-slider').addEventListener('input', () => { syncPair('home-value-slider', 'home-value', true); recalc(); });
    document.getElementById('home-value').addEventListener('input', () => { syncPair('home-value-slider', 'home-value', false); recalc(); });

    document.getElementById('down-payment-slider').addEventListener('input', () => { recalc(); });
    document.getElementById('down-payment').addEventListener('input', () => {
      const home = clamp(num('home-value') || HOME_MIN, HOME_MIN, HOME_MAX);
      const pct = clamp((num('down-payment') / home) * 100, 0, DOWN_MAX_PCT);
      document.getElementById('down-payment-slider').value = pct;
      recalc();
    });

    document.getElementById('interest-rate-slider').addEventListener('input', () => { syncPair('interest-rate-slider', 'interest-rate', true); recalc(); });
    document.getElementById('interest-rate').addEventListener('input', () => { syncPair('interest-rate-slider', 'interest-rate', false); recalc(); });

    ['loan-term', 'property-tax', 'insurance', 'extra-payment'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => recalc());
    });

    const calcBtn = document.getElementById('calculate-btn');
    if (calcBtn) calcBtn.addEventListener('click', () => calculate(true));

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', reset);

    // Expand/collapse the full amortization schedule.
    const toggle = document.getElementById('show-full-schedule');
    if (toggle) toggle.addEventListener('click', () => {
      const showAll = toggle.dataset.mode !== 'less';
      renderTable(lastSchedule || amortize(1, state.interestRate, state.loanTerm, 0), showAll ? 0 : 12);
    });

    // Export the full amortization schedule as a PDF (jsPDF lazy-loaded).
    const exportBtn = document.getElementById('export-pdf');
    if (exportBtn) exportBtn.addEventListener('click', exportPdf);

    // Prefill the interest rate with the current market rate (FRED via the
    // Vercel function). Best-effort: on any failure the default is kept and
    // the field stays user-editable. Recalculates only when a rate arrives.
    if (window.CalcCore && window.CalcCore.prefillRate) {
      window.CalcCore.prefillRate({
        inputId: 'interest-rate',
        sliderId: 'interest-rate-slider',
        noteId: 'current-rate-note',
        onApplied: () => calculate(false)
      });
    }

    // Initial render: wait for the i18n dictionary so captions and the
    // schedule note are translated on first paint (no transient
    // "Missing translation" warnings / raw-key flicker).
    const render = () => calculate(false);
    if (window.i18n && window.i18n.ready) {
      window.i18n.ready.then(render).catch(render);
    } else {
      render();
    }
  }

  // Expose for manual re-run after i18n switches language.
  window.mortgageCalculator = {
    calculate,
    reset,
    readInputs,
    getLastSchedule: () => lastSchedule
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
