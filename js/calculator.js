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
    hoa: 0,                // US$ / month (0 – 10000)
    closingCostsPct: 3,    // % of home value (0 – 15); closing costs amount
    financeClosingCosts: false, // if true, closing costs added to loan principal
    pmiRate: 0.5,          // annual % of loan amount (0 – 3); only applies when LTV > 80%
    extraPayment: 0        // US$ / month (0 – 5000)
  };

  const HOME_MIN = 50000, HOME_MAX = 2000000;
  const DOWN_MAX_PCT = 50;
  const RATE_MIN = 1, RATE_MAX = 15;
  const TAX_MAX = 5, INS_MAX = 10000, HOA_MAX = 10000, EXTRA_MAX = 5000;
  const CLOSING_MAX_PCT = 15;
  const PMI_MAX = 3;

  /* ------------------------------------------------------------------
   * Currency / number formatting helpers (delegates to window.Currency)
   * ------------------------------------------------------------------ */
  const usd = { format: function (v) { return window.Currency ? window.Currency.format(v) : '$' + v.toFixed(2); } };
  const usd0 = { format: function (v) { return window.Currency ? window.Currency.format0(v) : '$' + Math.round(v); } };

  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
  function num(id) {
    const el = document.getElementById(id);
    const v = el ? parseFloat(el.value) : NaN; // campo ausente (ex.: VA não tem PMI) => 0
    return isFinite(v) ? v : 0;
  }

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
    hoa: DEFAULTS.hoa,
    closingCostsPct: DEFAULTS.closingCostsPct,
    financeClosingCosts: DEFAULTS.financeClosingCosts,
    pmiRate: DEFAULTS.pmiRate,
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
     'ltv-display',
     'interest-rate-slider', 'interest-rate',
     'loan-term',
      'property-tax', 'insurance', 'hoa', 'closing-costs', 'closing-costs-usd', 'finance-closing-costs', 'pmi-rate', 'pmi-note', 'pmi-group',
      'extra-payment',
      'monthly-payment', 'pi-value', 'tax-value', 'insurance-value', 'hoa-value', 'pmi-value', 'monthly-extra',
      'pmi-removed-note',
      'total-interest', 'total-payment', 'payoff-date', 'interest-saved',
      'closing-costs-card', 'closing-costs-total',
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
    state.hoa = clamp(num('hoa') || 0, 0, HOA_MAX);
    state.closingCostsPct = clamp(num('closing-costs') || 0, 0, CLOSING_MAX_PCT);
    state.financeClosingCosts = document.getElementById('finance-closing-costs').checked;
    state.pmiRate = clamp(num('pmi-rate') || 0, 0, PMI_MAX);
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

    // LTV display
    const ltv = 100 - state.downPercent;
    const ltvT = window.i18n ? window.i18n.t('ltv_display') : null;
    if (el['ltv-display']) {
      el['ltv-display'].textContent = ltvT
        ? ltvT.replace('{ltv}', ltv.toFixed(1).replace(/\.0$/, ''))
        : ltv.toFixed(1).replace(/\.0$/, '') + '% LTV';
    }

    // PMI: only applies when LTV > 80% (down payment < 20%)
    const pmiApplies = state.downPercent < 20;
    const pmiInput = el['pmi-rate'];
    const pmiNote = el['pmi-note'];
    const pmiGroup = el['pmi-group'];
    if (pmiInput) {
      pmiInput.disabled = !pmiApplies;
      pmiInput.style.opacity = pmiApplies ? '1' : '0.5';
    }
    if (pmiNote) {
      if (pmiApplies) {
        pmiNote.textContent = '';
        pmiNote.hidden = true;
      } else {
        const naT = window.i18n ? window.i18n.t('pmi_not_applicable') : null;
        pmiNote.textContent = naT || 'Not applicable — 20%+ down payment avoids PMI';
        pmiNote.hidden = false;
      }
    }
    if (pmiGroup) {
      pmiGroup.style.opacity = pmiApplies ? '1' : '0.6';
    }

    // Closing costs USD display
    if (el['closing-costs-usd']) {
      const ccUsd = state.homeValue * state.closingCostsPct / 100;
      el['closing-costs-usd'].textContent = usd0.format(ccUsd);
    }
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
   * PMI computation
   * PMI (Private Mortgage Insurance) applies when LTV > 80%.
   * It is charged monthly on the remaining loan balance until the
   * balance drops to 80% of the original home value.
   * ------------------------------------------------------------------ */
  function computePmi(sched, principal) {
    const pmiApplies = state.downPercent < 20 && state.pmiRate > 0;
    if (!pmiApplies) return { initialMonthly: 0, removedMonth: 0, totalPmi: 0 };

    const threshold = state.homeValue * 0.80;
    const monthlyRate = state.pmiRate / 100 / 12;
    let totalPmi = 0;
    let removedMonth = 0;

    for (let i = 0; i < sched.rows.length; i++) {
      const row = sched.rows[i];
      const startBalance = i === 0 ? principal : sched.rows[i - 1].balance;
      if (!removedMonth && startBalance <= threshold) {
        removedMonth = row.m;
      }
      if (!removedMonth || row.m <= removedMonth) {
        totalPmi += startBalance * monthlyRate;
      }
    }

    // Initial monthly PMI (based on original loan amount)
    const initialMonthly = principal * monthlyRate;

    return { initialMonthly, removedMonth, totalPmi };
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
  function renderResults(sched, monthlyTax, monthlyIns, monthlyHoa, monthlyExtra, pmiInfo, closingCostsUsd) {
    const monthlyPmi = pmiInfo ? pmiInfo.initialMonthly : 0;
    const totalMonthly = sched.M + monthlyTax + monthlyIns + monthlyHoa + monthlyPmi;
    const t = (window.i18n && window.i18n.t) ? window.i18n.t.bind(window.i18n) : (k => k);

    el['monthly-payment'].textContent = usd.format(totalMonthly);
    el['pi-value'].textContent = usd.format(sched.M);
    el['tax-value'].textContent = usd.format(monthlyTax);
    el['insurance-value'].textContent = usd.format(monthlyIns);
    el['monthly-extra'].textContent = monthlyExtra > 0 ? ' + ' + usd.format(monthlyExtra) + '/' + t('month_abbr') : '';

    // HOA value in breakdown
    if (el['hoa-value']) {
      if (monthlyHoa > 0) {
        el['hoa-value'].textContent = ' · ' + usd.format(monthlyHoa) + ' HOA';
      } else {
        el['hoa-value'].textContent = '';
      }
    }

    // PMI value in breakdown
    if (el['pmi-value']) {
      if (monthlyPmi > 0) {
        el['pmi-value'].textContent = ' · ' + usd.format(monthlyPmi) + ' PMI';
        el['pmi-value'].title = t('pmi_label');
      } else {
        el['pmi-value'].textContent = '';
      }
    }

    // PMI removal note
    if (el['pmi-removed-note']) {
      if (pmiInfo && pmiInfo.removedMonth > 0) {
        const removedNoteT = t('pmi_removed_note');
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const d = new Date();
        d.setMonth(d.getMonth() + pmiInfo.removedMonth);
        const removedDate = d.toLocaleDateString((window.i18n && window.i18n.currentLang) || 'en', { month: 'long', year: 'numeric' });
        el['pmi-removed-note'].textContent = removedNoteT
          ? removedNoteT.replace('{date}', removedDate)
          : 'PMI removed in ' + removedDate;
        el['pmi-removed-note'].hidden = false;
      } else {
        el['pmi-removed-note'].hidden = true;
      }
    }

    el['total-interest'].textContent = usd.format(sched.totalInterest);
    el['total-payment'].textContent = usd.format(sched.totalPaid + (pmiInfo ? pmiInfo.totalPmi : 0));
    el['payoff-date'].textContent = payoffDate(sched.payoffMonths);

    // Closing costs card (only when not financed — show as upfront cost)
    if (el['closing-costs-card'] && el['closing-costs-total']) {
      if (!state.financeClosingCosts && closingCostsUsd > 0) {
        el['closing-costs-total'].textContent = usd.format(closingCostsUsd);
        el['closing-costs-card'].hidden = false;
      } else {
        el['closing-costs-card'].hidden = true;
      }
    }

    // Interest saved thanks to extra payments (0 when there are none).
    const basePrincipal = state.homeValue - state.homeValue * state.downPercent / 100;
    const baseEffective = state.financeClosingCosts ? basePrincipal + closingCostsUsd : basePrincipal;
    const base = amortize(baseEffective, state.interestRate, state.loanTerm, 0);
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
    const summaryRowH = 15;
    const summaryTop = 92;
    summary.forEach((row, i) => {
      const x = margin + (i % 2) * colW;
      const yy = summaryTop + Math.floor(i / 2) * summaryRowH;
      doc.setFont('helvetica', 'bold');
      doc.text(row[0] + ':', x, yy);
      doc.setFont('helvetica', 'normal');
      doc.text(String(row[1]), x + labelW, yy);
    });

    /* ---------- Table ---------- */
    // The summary renders as two columns, so its vertical extent is set by
    // ceil(n/2) rows — not by where the label text happens to end. Start the
    // table only after the whole block has been drawn, with a clear gap.
    const summaryBottom = summaryTop + Math.ceil(summary.length / 2) * summaryRowH;
    const tableTop = summaryBottom + 15;

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
    drawHeader(tableTop);
    let y = tableTop + headerH;

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
    const closingCostsUsd = state.homeValue * state.closingCostsPct / 100;
    // If financing closing costs, add them to the loan principal
    const effectivePrincipal = state.financeClosingCosts ? principal + closingCostsUsd : principal;
    const sched = amortize(effectivePrincipal, state.interestRate, state.loanTerm, state.extraPayment);
    const monthlyTax = state.homeValue * state.propertyTax / 100 / 12;
    const monthlyIns = state.insurance / 12;
    const monthlyHoa = state.hoa;
    const pmiInfo = computePmi(sched, effectivePrincipal);

    lastSchedule = sched;
    lastBaseM = sched.M;

    renderResults(sched, monthlyTax, monthlyIns, monthlyHoa, state.extraPayment, pmiInfo, closingCostsUsd);
    renderTable(sched, 12); // first 12 months; user can expand the full schedule

    // Charts (if chart.js is loaded and Chart is available)
    if (typeof window.updateCharts === 'function') {
      window.updateCharts(sched, { principal: effectivePrincipal, pi: sched.M, tax: monthlyTax, insurance: monthlyIns, hoa: monthlyHoa, pmi: pmiInfo.initialMonthly, extra: state.extraPayment });
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
        hoa: state.hoa,
        pmi_rate: state.pmiRate,
        extra_payment: state.extraPayment,
        monthly_payment: sched.M + monthlyTax + monthlyIns + monthlyHoa + pmiInfo.initialMonthly,
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
    document.getElementById('hoa').value = DEFAULTS.hoa;
    document.getElementById('closing-costs').value = DEFAULTS.closingCostsPct;
    document.getElementById('finance-closing-costs').checked = DEFAULTS.financeClosingCosts;
    const pmiEl = document.getElementById('pmi-rate');
    if (pmiEl) pmiEl.value = DEFAULTS.pmiRate;
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

    ['loan-term', 'property-tax', 'insurance', 'hoa', 'closing-costs', 'extra-payment'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => recalc());
    });

    // PMI rate input
    const pmiInput = document.getElementById('pmi-rate');
    if (pmiInput) pmiInput.addEventListener('input', () => recalc());

    // Closing costs checkbox triggers recalculation
    const financeCcCheckbox = document.getElementById('finance-closing-costs');
    if (financeCcCheckbox) financeCcCheckbox.addEventListener('change', () => recalc());

    const calcBtn = document.getElementById('calculate-btn');
    if (calcBtn) calcBtn.addEventListener('click', () => calculate(true));

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', reset);

    // Re-render when the user switches currency (independent of language).
    document.addEventListener('currency:changed', function () { calculate(false); });

    // Country presets: fill property-tax and insurance when a country is selected.
    const countrySelect = document.getElementById('mortgage-country');
    if (countrySelect && window.MortgageCountryPresets) {
      countrySelect.addEventListener('change', function () {
        const p = window.MortgageCountryPresets.get(this.value);
        if (!p) return; // 'custom' — leave fields as-is
        document.getElementById('property-tax').value = p.propertyTax;
        document.getElementById('insurance').value = p.insurance;
        calculate(false);
      });
    }

    // U.S. state refinement: shown only when country = US; fills tax/insurance
    // with state averages. All accesses guarded (VA page has no such fields).
    const countrySel = document.getElementById('mortgage-country');
    const usStateSel = document.getElementById('mortgage-us-state');
    const usStateGroup = document.getElementById('us-state-group');
    if (countrySel && usStateSel && usStateGroup &&
        window.MortgageCountryPresets && typeof window.MortgageCountryPresets.states === 'function') {
      window.MortgageCountryPresets.states().forEach((code) => {
        const st = window.MortgageCountryPresets.getState(code);
        if (!st) return;
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code + ' — ' + st.name;
        usStateSel.appendChild(opt);
      });
      const syncStateVis = () => { usStateGroup.hidden = countrySel.value !== 'US'; };
      syncStateVis();
      countrySel.addEventListener('change', function () {
        syncStateVis();
        if (this.value !== 'US') usStateSel.value = '';
      });
      usStateSel.addEventListener('change', function () {
        const st = window.MortgageCountryPresets.getState(this.value);
        if (!st) return; // '' = state average (country default)
        const taxEl = document.getElementById('property-tax');
        const insEl = document.getElementById('insurance');
        if (taxEl) taxEl.value = st.propertyTax;
        if (insEl) insEl.value = st.insurance;
        calculate(false);
      });
    }

    // ---- ZIP / CEP auto-fill (Task 4) ----
    const zipGroup = document.getElementById('zip-group');
    const zipInput = document.getElementById('zip-code');
    const zipBtn = document.getElementById('zip-lookup-btn');
    const zipStatus = document.getElementById('zip-status');
    const countryForZip = document.getElementById('mortgage-country');
    const stateForZip = document.getElementById('mortgage-us-state');
    var userEditedTax = false, userEditedIns = false;

    // Show ZIP field when country is BR or US; hide otherwise
    function syncZipVis() {
      if (!zipGroup || !countryForZip) return;
      var c = countryForZip.value;
      zipGroup.hidden = (c !== 'BR' && c !== 'US');
      // Update placeholder based on country
      if (zipInput) {
        zipInput.placeholder = c === 'BR' ? '00000-000' : '00000';
        zipInput.maxLength = c === 'BR' ? 10 : 5;
      }
    }
    syncZipVis();
    if (countryForZip) countryForZip.addEventListener('change', function () {
      syncZipVis();
      userEditedTax = false;
      userEditedIns = false;
      if (zipInput) zipInput.value = '';
      if (zipStatus) zipStatus.textContent = '';
    });

    // Track manual edits to tax/insurance so we don't overwrite them
    var taxEl = document.getElementById('property-tax');
    var insEl = document.getElementById('insurance');
    if (taxEl) taxEl.addEventListener('input', function () { userEditedTax = true; });
    if (insEl) insEl.addEventListener('input', function () { userEditedIns = true; });

    // Debounce timer for ZIP input
    var zipDebounceTimer = null;

    function runZipLookup() {
      if (!window.ZipLookup || !zipInput || !zipStatus) return;
      var raw = (zipInput.value || '').trim();
      if (!raw) { zipStatus.textContent = ''; return; }
      var country = countryForZip ? countryForZip.value : '';
      if (country !== 'BR' && country !== 'US') return;
      var stateAbbr = stateForZip ? stateForZip.value : '';

      // Show spinner
      zipBtn.disabled = true;
      zipBtn.textContent = '...';
      zipStatus.textContent = '';
      zipStatus.style.color = '';

      window.ZipLookup.fetch(raw, country, stateAbbr).then(function (result) {
        zipBtn.disabled = false;
        var t = (window.i18n && window.i18n.t) ? window.i18n.t.bind(window.i18n) : (k => k);

        if (!userEditedTax && taxEl) {
          taxEl.value = result.taxPct;
        }
        if (!userEditedIns && insEl) {
          insEl.value = result.insMonthly * 12; // convert monthly to yearly
        }
        // Suggest median home value (US only) if user hasn't set one
        if (result.medianHomeValue && country === 'US') {
          var hvEl = document.getElementById('home-value');
          if (hvEl && !hvEl.dataset.userEdited) {
            hvEl.value = result.medianHomeValue;
            var slEl = document.getElementById('home-value-slider');
            if (slEl) slEl.value = result.medianHomeValue;
          }
        }

        var city = result.city ? result.city + (result.uf ? ', ' + result.uf : '') : (result.uf || '');
        var label = t('zip_success') || 'Data loaded';
        zipStatus.textContent = city ? label + ' (' + city + ')' : label;
        zipStatus.style.color = 'var(--green)';
        zipBtn.textContent = t('zip_lookup_btn') || 'Fetch data';
        calculate(false);
      }).catch(function (err) {
        zipBtn.disabled = false;
        var t = (window.i18n && window.i18n.t) ? window.i18n.t.bind(window.i18n) : (k => k);
        var msg = t('zip_error') || 'Could not fetch data. Enter values manually.';
        zipStatus.textContent = msg;
        zipStatus.style.color = 'var(--red)';
        zipBtn.textContent = t('zip_lookup_btn') || 'Fetch data';
      });
    }

    if (zipBtn) zipBtn.addEventListener('click', runZipLookup);
    if (zipInput) zipInput.addEventListener('input', function () {
      if (zipDebounceTimer) clearTimeout(zipDebounceTimer);
      var raw = (zipInput.value || '').replace(/\D/g, '');
      var expectedLen = (countryForZip && countryForZip.value === 'BR') ? 8 : 5;
      if (raw.length === expectedLen) {
        zipDebounceTimer = setTimeout(runZipLookup, 500);
      }
    });

    // Track manual edits on home-value to avoid overwriting
    var hvEl = document.getElementById('home-value');
    if (hvEl) hvEl.addEventListener('input', function () { hvEl.dataset.userEdited = '1'; });

    // Expand/collapse the full amortization schedule.
    const toggle = document.getElementById('show-full-schedule');
    if (toggle) toggle.addEventListener('click', () => {
      const showAll = toggle.dataset.mode !== 'less';
      renderTable(lastSchedule || amortize(1, state.interestRate, state.loanTerm, 0), showAll ? 0 : 12);
    });

    // Export the full amortization schedule as a PDF (jsPDF lazy-loaded).
    const exportBtn = document.getElementById('export-pdf');
    if (exportBtn) exportBtn.addEventListener('click', exportPdf);

    // Compare Scenarios: save the current calculation as a named column.
    if (window.CalcCore && window.CalcCore.scenarios) {
      const t = (window.i18n && window.i18n.t) ? window.i18n.t.bind(window.i18n) : (k => k);
      window.CalcCore.scenarios.init({
        container: '#mc-scenario-table',
        addButton: '#mc-scenario-add',
        clearButton: '#mc-scenario-clear',
        nameInput: '#mc-scenario-name',
        emptyKey: 'scenario_empty',
        buildCells: () => {
          readInputs();
          const principal = state.homeValue - state.homeValue * state.downPercent / 100;
          const sched = amortize(principal, state.interestRate, state.loanTerm, state.extraPayment);
          const monthlyTax = state.homeValue * state.propertyTax / 100 / 12;
          const monthlyIns = state.insurance / 12;
          const pmiInfo = computePmi(sched, principal);
          const totalMonthly = sched.M + monthlyTax + monthlyIns + pmiInfo.initialMonthly;
          return {
            cells: {
              [t('monthly_payment')]: usd.format(totalMonthly),
              [t('total_interest')]: usd.format(sched.totalInterest),
              [t('total_payment')]: usd.format(sched.totalPaid + pmiInfo.totalPmi),
              [t('payoff_date')]: payoffDate(sched.payoffMonths),
              [t('extra_payment')]: usd.format(state.extraPayment) + '/mo'
            }
          };
        }
      });
    }

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
