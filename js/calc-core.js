/**
 * calc-core.js — Shared framework for the advanced financial calculators
 * ----------------------------------------------------------------------
 * Provides reusable utilities used by every calculator module:
 *
 *   CalcCore.debounce(fn, wait)  → returns a debounced version of fn
 *   CalcCore.schedule(fn)        → runs fn on the next frame (rAF fallback)
 *   CalcCore.t(key)              → translated string (falls back to key)
 *   CalcCore.money / pct / num   → currency / percent formatting + parsing
 *   CalcCore.lineChart / barChart / doughnutChart  → Chart.js wrappers
 *   CalcCore.scenarios           → "Compare Scenarios" manager
 *   CalcCore.whenVisible(el, cb) → lazy-load hook (IntersectionObserver)
 *   CalcCore.deferScript(src)    → lazy-inject a <script> when in viewport
 *
 * Dependencies: Chart.js (loaded separately, CDN) + js/i18n/i18n.js.
 */
(function () {
  'use strict';

  var C = {};

  /* ------------------------------------------------------------------
   * Translation helper (delegates to window.i18n when available).
   * ------------------------------------------------------------------ */
  C.t = function (key) {
    return (window.i18n && window.i18n.t) ? window.i18n.t(key) : key;
  };

  /* ------------------------------------------------------------------
   * Debounce — prevents heavy recalculation on every keystroke.
   * ------------------------------------------------------------------ */
  C.debounce = function (fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait || 120);
    };
  };

  /* ------------------------------------------------------------------
   * requestAnimationFrame scheduling for smooth UI updates.
   * ------------------------------------------------------------------ */
  C.schedule = function (fn) {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(fn);
    } else {
      setTimeout(fn, 16);
    }
  };

  /* ------------------------------------------------------------------
   * Formatting helpers (US-style, consistent with the main calculator).
   * ------------------------------------------------------------------ */
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  var numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  var pctFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

  C.money = function (v) { return usd.format(v); };
  C.money0 = function (v) { return usd0.format(v); };
  C.num = function (v) { return numFmt.format(v); };
  C.pct = function (v) { return pctFmt.format(v) + '%'; };

  /** Safe parseFloat for an input element. */
  C.val = function (el, fallback) {
    var v = parseFloat(el.value);
    return isFinite(v) ? v : (fallback || 0);
  };

  C.clamp = function (v, min, max) { return Math.min(Math.max(v, min), max); };

  /* ------------------------------------------------------------------
   * Chart.js wrappers — destroy previous chart on the same canvas so
   * repeated recalculations never leak instances.
   * ------------------------------------------------------------------ */
  var charts = {};

  // Chart.js wrappers are responsive by default; below 480px we shrink
  // legend/axis fonts so labels never clip on small screens.
  var mobileMQ = (typeof window.matchMedia === 'function') ? window.matchMedia('(max-width: 480px)') : null;
  function isMobile() { return mobileMQ ? mobileMQ.matches : false; }
  function chartFont() { return isMobile() ? 10 : 11; }

  C.destroyChart = function (id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  };

  function makeChart(id, config) {
    var canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return null;
    C.destroyChart(id);
    var chart = new Chart(canvas.getContext('2d'), config);
    charts[id] = chart;
    return chart;
  }

  var palette = ['#1a365d', '#2b6cb0', '#4299e1', '#63b3ed', '#38a169', '#dd6b20', '#c53030', '#805ad5'];

  C.lineChart = function (id, labels, series, opts) {
    opts = opts || {};
    return makeChart(id, {
      type: 'line',
      data: {
        labels: labels,
        datasets: series.map(function (s, i) {
          return {
            label: s.label,
            data: s.data,
            borderColor: s.color || palette[i],
            backgroundColor: s.color ? s.color + '33' : palette[i] + '33',
            fill: !!s.fill,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: chartFont() } } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var label = ctx.dataset.label || '';
                return label + ': ' + usd0.format(ctx.parsed.y);
              }
            }
          }
        },
        scales: {
          x: { ticks: { maxTicksLimit: 12, font: { size: chartFont() } } },
          y: { ticks: { font: { size: chartFont() }, callback: function (v) { return compactUsd(v); } } }
        }
      }
    });
  };

  C.barChart = function (id, labels, datasets, opts) {
    opts = opts || {};
    var isPct = opts.format === 'pct';
    return makeChart(id, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets.map(function (d, i) {
          return {
            label: d.label,
            data: d.data,
            backgroundColor: d.color || palette[i],
            borderColor: d.color || palette[i],
            borderRadius: 6
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: opts.legend || 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: chartFont() } } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var prefix = ctx.dataset.label ? ctx.dataset.label + ': ' : '';
                return prefix + (isPct ? ctx.parsed.y.toFixed(0) + '%' : usd0.format(ctx.parsed.y));
              }
            }
          }
        },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 0, font: { size: chartFont() } } },
          y: {
            ticks: {
              font: { size: chartFont() },
              callback: function (v) { return isPct ? v.toFixed(0) + '%' : compactUsd(v); }
            },
            suggestedMax: isPct ? 100 : undefined
          }
        }
      }
    });
  };

  C.doughnutChart = function (id, labels, values, colors) {
    return makeChart(id, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors || palette.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: chartFont() } } },
          tooltip: {
            callbacks: {
              label: function (ctx) { return ctx.label + ': ' + usd0.format(ctx.parsed); }
            }
          }
        }
      }
    });
  };

  function compactUsd(v) {
    var abs = Math.abs(v);
    if (abs >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M';
    if (abs >= 1000) return '$' + (v / 1000).toFixed(0) + 'k';
    return '$' + Math.round(v);
  }

  /* ------------------------------------------------------------------
   * "Compare Scenarios" manager.
   *
   * A scenario is { name, cells }, where cells maps a localized label to
   * the pre-formatted display string, e.g.
   *   { "Monthly payment": "$1,234", "Total interest": "$98k", ... }
   * The renderer draws a side-by-side table: one column per scenario.
   * ------------------------------------------------------------------ */
  C.scenarios = (function () {
    var list = [];
    var container = null;
    var emptyMsg = '';
    var emptyKey = '';
    var inputRefs = null;      // optional: { el, key } used to preview names
    var activeColumn = null;   // hidden first column header (localized)

    function render() {
      if (!container) return;
      container.textContent = '';
      if (!list.length) {
        var empty = document.createElement('p');
        empty.className = 'scenario-table__empty';
        if (emptyKey && window.i18n && window.i18n.t) {
          empty.textContent = window.i18n.t(emptyKey);
        } else {
          empty.textContent = emptyMsg;
        }
        container.appendChild(empty);
        return;
      }

      var table = document.createElement('table');
      table.className = 'scenario-table';
      table.setAttribute('role', 'table');

      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      var blank = document.createElement('th');
      blank.scope = 'col';
      headRow.appendChild(blank);
      list.forEach(function (s) {
        var th = document.createElement('th');
        th.scope = 'col';
        th.textContent = s.name;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      var first = list[0];
      Object.keys(first.cells).forEach(function (label) {
        var tr = document.createElement('tr');
        var tdLabel = document.createElement('td');
        tdLabel.textContent = label;
        tr.appendChild(tdLabel);
        list.forEach(function (s) {
          var td = document.createElement('td');
          td.textContent = s.cells[label] != null ? s.cells[label] : '—';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    }

    return {
      /**
       * Wire up the container + buttons.
       * opts: { container, addButton, clearButton, nameInput, empty, nameHint }
       */
      init: function (opts) {
        container = document.querySelector(opts.container);
        if (!container) return;
        emptyMsg = opts.empty || '';
        emptyKey = opts.emptyKey || '';
        if (opts.nameHint) emptyMsg = emptyMsg.replace('{name}', opts.nameHint || '');

        var addBtn = document.querySelector(opts.addButton);
        if (addBtn) {
          addBtn.addEventListener('click', function () {
            var nameInput = document.querySelector(opts.nameInput);
            var name = nameInput ? nameInput.value.trim() : '';
            if (!name) name = C.t('scenario_name_default') + ' ' + (list.length + 1);
            var built = (opts.buildCells) ? opts.buildCells(name) : null;
            if (!built) return;
            list.push({ name: name, cells: built.cells });
            if (nameInput) nameInput.value = '';
            render();
            if (opts.onChange) opts.onChange(list.length);
          });
        }

        var clearBtn = document.querySelector(opts.clearButton);
        if (clearBtn) {
          clearBtn.addEventListener('click', function () {
            list = [];
            render();
            if (opts.onChange) opts.onChange(0);
          });
        }

        render();

        document.addEventListener('i18n:updated', function () {
          render();
        });
      },
      get list() { return list; }
    };
  })();

  /* ------------------------------------------------------------------
   * Lazy loading — run a callback (and inject a script) only when the
   * given element scrolls into view.
   * ------------------------------------------------------------------ */
  C.whenVisible = function (el, cb) {
    if (!el || typeof IntersectionObserver === 'undefined') { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          io.disconnect();
          cb();
        }
      });
    }, { rootMargin: '200px' });
    io.observe(el);
  };

  C.deferScript = function (el, src, onload) {
    C.whenVisible(el, function () {
      if (document.querySelector('script[data-src="' + src + '"]')) { if (onload) onload(); return; }
      var s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.setAttribute('data-src', src);
      if (onload) s.onload = onload;
      document.body.appendChild(s);
    });
  };

  /* ------------------------------------------------------------------
   * Reflow notification — when the layout crosses a breakpoint or the
   * device rotates, tell every calculator module to re-render so charts
   * are recreated with the right (smaller) fonts.
   * ------------------------------------------------------------------ */
  function dispatchReflow() {
    if (typeof document.dispatchEvent === 'function') {
      document.dispatchEvent(new CustomEvent('calc:reflow'));
    }
  }
  var reflowTimer = null;
  function reflowSoon() {
    if (reflowTimer) clearTimeout(reflowTimer);
    reflowTimer = setTimeout(dispatchReflow, 300);
  }
  if (mobileMQ && mobileMQ.addEventListener) mobileMQ.addEventListener('change', reflowSoon);
  else if (mobileMQ && mobileMQ.addListener) mobileMQ.addListener(reflowSoon);
  window.addEventListener('orientationchange', reflowSoon);
  window.addEventListener('resize', reflowSoon);

  /* ------------------------------------------------------------------
   * Current market mortgage rate (FRED MORTGAGE30US via Vercel function)
   * ------------------------------------------------------------------ */

  /**
   * Returns a Promise of the latest 30-year fixed mortgage rate (number)
   * or null when the endpoint is unreachable / returns garbage. Never
   * throws — callers use it as a best-effort prefill.
   */
  C.getCurrentMortgageRate = function () {
    if (typeof fetch !== 'function') return Promise.resolve(null);
    return fetch('/api/mortgage-rate', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var rate = parseFloat(data && data.rate);
        return (isFinite(rate) && rate > 0) ? rate : null;
      })
      .catch(function () { return null; });
  };

  /**
   * Best-effort prefill of a rate input (+ optional slider) with the
   * current market rate, then shows a translated note next to the field.
   *
   * opts: {
   *   inputId,             // required — number input to prefill
   *   sliderId,            // optional — range input to keep in sync
   *   noteId,              // optional — <p id> to reveal with the note text
   *   onApplied(rate)      // optional — called with the applied rate
   * }
   *
   * Falls back silently to the page's default value on any failure. The
   * user's own edits are never overwritten (value is captured at call time
   * and skipped if it changes before the response arrives).
   */
  C.prefillRate = function (opts) {
    opts = opts || {};
    if (!opts.inputId) return;
    var input = document.getElementById(opts.inputId);
    if (!input) return;
    var original = input.value;

    C.getCurrentMortgageRate().then(function (rate) {
      if (!rate || rate <= 0) return;          // silent fallback to default
      if (input.value !== original) return;    // user already edited — respect it
      rate = C.clamp(rate, parseFloat(input.min) || 0, parseFloat(input.max) || 15);
      rate = parseFloat(rate.toFixed(2));
      input.value = rate;
      if (opts.sliderId) {
        var slider = document.getElementById(opts.sliderId);
        if (slider) slider.value = rate;
      }
      if (opts.noteId) {
        var note = document.getElementById(opts.noteId);
        if (note) {
          // Re-translate the note on every language change. The <p> is filled
          // imperatively (with the {rate} placeholder), so applyTranslations
          // cannot update it via data-i18n; re-render it with C.t() using the
          // language that is active at that moment.
          var renderNote = function () {
            note.textContent = C.t('current_rate_note').replace('{rate}', rate.toFixed(2));
            note.hidden = false;
          };
          renderNote();
          document.addEventListener('i18n:updated', renderNote);
        }
      }
      if (opts.onApplied) opts.onApplied(rate);
    });
  };

  window.CalcCore = C;
})();
