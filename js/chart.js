/**
 * chart.js — Chart.js integration
 * -------------------------------
 * Two charts:
 *   1. Balance over time (line chart, loan balance by month).
 *   2. Monthly payment breakdown (doughnut: P&I / taxes / insurance).
 * Charts are recreated on each calculation (small dataset, cheap to rebuild).
 *
 * Dependency: Chart.js loaded from CDN in index.html BEFORE this file.
 */
(function () {
  'use strict';

  let balanceChart = null;
  let breakdownChart = null;
  let lastBreakdown = null; // { pi, tax, insurance, extra }

  // Charts are responsive (canvas resizes with its container automatically);
  // below 480px we shrink tick/legend fonts so nothing overlaps or gets cut.
  const mobileMQ = window.matchMedia ? window.matchMedia('(max-width: 480px)') : null;
  function isMobile() { return mobileMQ ? mobileMQ.matches : false; }
  function axisFont() { return isMobile() ? 10 : 12; }

  function chartT() {
    return (window.i18n && window.i18n.t) ? window.i18n.t.bind(window.i18n) : (k => k);
  }

  function chartColors() {
    // Keep the site palette: #1a365d, #2b6cb0, #4299e1 (+ green for savings).
    return {
      blue: '#1a365d',
      blueMid: '#2b6cb0',
      blueLight: '#4299e1',
      sky: '#63b3ed',
      green: '#38a169'
    };
  }

  function destroyCharts() {
    if (balanceChart) { balanceChart.destroy(); balanceChart = null; }
    if (breakdownChart) { breakdownChart.destroy(); breakdownChart = null; }
  }

  function renderBalanceChart(sched) {
    const t = chartT();
    const c = chartColors();
    const canvas = document.getElementById('amortization-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    // Sample the balance: plot one point per month, max ~360 points.
    const labels = [];
    const data = [];
    const every = Math.max(1, Math.floor(sched.rows.length / 120)); // cap ~120 points
    for (let i = 0; i < sched.rows.length; i += every) {
      labels.push(i === 0 ? '0' : sched.rows[i].m);
      data.push(Math.round(sched.rows[i].balance));
    }
    // Force the last point to be 0 (payoff).
    const last = sched.rows[sched.rows.length - 1];
    if (last && (labels[labels.length - 1] !== last.m || data[data.length - 1] !== 0)) {
      labels.push(last.m);
      data.push(0);
    }

    balanceChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: t('balance_label'),
          data: data,
          borderColor: c.blueMid,
          backgroundColor: c.sky,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ': ' + fmtUsd(ctx.parsed.y)
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: t('month'), font: { size: axisFont() } },
            ticks: { font: { size: axisFont() } }
          },
          y: {
            title: { display: true, text: t('balance'), font: { size: axisFont() } },
            ticks: { font: { size: axisFont() }, callback: (v) => compactUsd(v) }
          }
        }
      }
    });
  }

  function renderBreakdownChart(bd) {
    const t = chartT();
    const c = chartColors();
    const canvas = document.getElementById('breakdown-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const hasTax = bd.tax > 0.005;
    const hasIns = bd.insurance > 0.005;
    const labels = [t('principal_interest')];
    const data = [bd.pi];
    const colors = [c.blue];
    if (hasTax) { labels.push(t('taxes')); data.push(bd.tax); colors.push(c.blueLight); }
    if (hasIns) { labels.push(t('insurance')); data.push(bd.insurance); colors.push(c.sky); }

    breakdownChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#ffffff' }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: axisFont() } } },
          tooltip: { callbacks: { label: (ctx) => ctx.label + ': ' + fmtUsd(ctx.parsed) } }
        }
      }
    });
  }

  // --- formatting helpers (duplicated locally to keep chart.js standalone) ---
  const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usdFmt2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  function fmtUsd(v) { return usdFmt2.format(v); }
  function compactUsd(v) { return '$' + Number(v).toLocaleString('en-US'); }

  /**
   * Called by calculator.js after every calculation.
   * sched = amortization result; bd = { pi, tax, insurance, extra } (monthly $).
   */
  window.updateCharts = function (sched, bd) {
    lastBreakdown = bd;
    destroyCharts();
    renderBalanceChart(sched);
    renderBreakdownChart(bd);
  };

  // Re-render (labels may have changed language).
  window.refreshCharts = function () {
    if (!lastBreakdown) return;
    const sched = (window.mortgageCalculator && window.mortgageCalculator.getLastSchedule) ? window.mortgageCalculator.getLastSchedule() : null;
    if (!sched) return;
    destroyCharts();
    renderBalanceChart(sched);
    renderBreakdownChart(lastBreakdown);
  };

  // Cross the 480px breakpoint or rotate the device → rebuild charts so the
  // smaller mobile fonts are applied. (Chart.js already handles the resize.)
  let resizeTimer = null;
  function redrawOnReflow() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (window.refreshCharts) window.refreshCharts(); }, 200);
  }
  if (mobileMQ && mobileMQ.addEventListener) {
    mobileMQ.addEventListener('change', redrawOnReflow);
  } else if (mobileMQ && mobileMQ.addListener) {
    mobileMQ.addListener(redrawOnReflow);
  }
  if (window.matchMedia) {
    const landscapeMQ = window.matchMedia('(orientation: landscape)');
    if (landscapeMQ && landscapeMQ.addEventListener) landscapeMQ.addEventListener('change', redrawOnReflow);
  }
})();
