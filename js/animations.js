/**
 * animations.js — UI micro-interactions
 * ---------------------------------------
 * 1. Slider fill-bar updates (visual progress indicator)
 * 2. Animated counters for result values
 * 3. Scroll-reveal entrance for cards
 *
 * Zero dependencies. Runs immediately.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * 1. Slider fill bars
   * ------------------------------------------------------------------ */
  function updateSliderFill(sl) {
    var fill = sl.parentElement ? sl.parentElement.querySelector('.slider-fill') : null;
    if (!fill) return;
    var min = parseFloat(sl.min) || 0;
    var max = parseFloat(sl.max) || 100;
    var val = parseFloat(sl.value) || 0;
    var pct = ((val - min) / (max - min)) * 100;
    fill.style.width = pct + '%';
  }

  function initSliders() {
    var sliders = document.querySelectorAll('input[type="range"]');
    for (var i = 0; i < sliders.length; i++) {
      updateSliderFill(sliders[i]);
      sliders[i].addEventListener('input', function () {
        updateSliderFill(this);
      });
    }
  }

  /* ------------------------------------------------------------------
   * 2. Animated counters — smooth number transitions
   * ------------------------------------------------------------------ */
  var animations = {};

  function animateCounter(el, from, to, duration) {
    if (!el) return;
    var id = el.id || Math.random().toString(36);
    if (animations[id]) cancelAnimationFrame(animations[id]);

    var startTime = null;
    duration = duration || 400;

    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      var current = from + (to - from) * eased;

      // Preserve the format from the original text (currency or plain)
      el.textContent = formatFromTemplate(el, current);

      if (progress < 1) {
        animations[id] = requestAnimationFrame(step);
      } else {
        delete animations[id];
      }
    }

    animations[id] = requestAnimationFrame(step);
  }

  /** Detect the original format and apply it to the new value. */
  function formatFromTemplate(el, value) {
    var original = el.dataset.animTemplate;
    if (!original) {
      original = el.textContent;
      el.dataset.animTemplate = original;
    }

    // Currency format: $X,XXX.XX
    if (original.indexOf('$') !== -1) {
      var formatted = '$' + Math.round(value).toLocaleString('en-US');
      // Check if original had decimals
      if (original.indexOf('.00') !== -1 || original.match(/\.\d{2}$/)) {
        formatted = '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return formatted;
    }

    // Percentage format
    if (original.indexOf('%') !== -1) {
      return value.toFixed(1) + '%';
    }

    // Plain number
    return Math.round(value).toLocaleString('en-US');
  }

  // Expose for calculator.js to optionally call
  window.animateResultCounter = function (el, newValue) {
    if (!el) return;
    var template = el.dataset.animTemplate || el.textContent;
    var oldValue = parseValue(template);
    if (Math.abs(oldValue - newValue) < 0.5) {
      el.textContent = formatFromTemplate(el, newValue);
      return;
    }
    animateCounter(el, oldValue, newValue, 400);
  };

  function parseValue(str) {
    return parseFloat(str.replace(/[^0-9.\-]/g, '')) || 0;
  }

  /* ------------------------------------------------------------------
   * 3. Scroll-reveal — fade in cards as they enter viewport
   * ------------------------------------------------------------------ */
  function initReveal() {
    if (!('IntersectionObserver' in window)) return;

    var targets = document.querySelectorAll(
      '.result-card, .chart-box, .schedule, .seo-section, .cta-box'
    );

    // Set initial state
    for (var i = 0; i < targets.length; i++) {
      targets[i].style.opacity = '0';
      targets[i].style.transform = 'translateY(16px)';
      targets[i].style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    for (var j = 0; j < targets.length; j++) {
      observer.observe(targets[j]);
    }
  }

  /* ------------------------------------------------------------------
   * Reduced motion: skip animations
   * ------------------------------------------------------------------ */
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ------------------------------------------------------------------
   * Init
   * ------------------------------------------------------------------ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!prefersReducedMotion()) {
        initSliders();
        initReveal();
      }
    });
  } else {
    if (!prefersReducedMotion()) {
      initSliders();
      initReveal();
    }
  }
})();
