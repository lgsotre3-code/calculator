# TESTING.md — Mobile Responsiveness Test Report

Date: 2026-08-15
Scope: full mobile-responsiveness audit of https://www.mortgage-pro-calc.com
after the mobile-first redesign (hamburger nav, stacked inputs, scrollable
tables, single-column result cards, lazy Chart.js, debounced recalc).

## 1. Lighthouse (mobile emulation, Chrome 151)

Run with `lighthouse <url> --chrome-path=<chrome> --preset=mobile` (Lighthouse
defaults to mobile: Moto G Power, 412×823, 1.75x DPR, Fast 4G throttling).

| Page | Where | Perf | A11y | Best Practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| Home (prod, before) | https://www.mortgage-pro-calc.com/ | 52 | 100 | 77 | 100 | 3.0 s | 1,020 ms | 0.257 |
| Home (local, after) | http://localhost/index.html | 75 | 100 | 58* | 100 | 2.4 s | 840 ms | 0.066 |
| Rent vs. Buy (after) | http://localhost/rent-vs-buy/ | 75 | 100 | 58* | 100 | 2.8 s | 780 ms | 0.024 |

\* The two Best-Practices dings only appear on `http://localhost`:
`is-on-https` (7 insecure requests — a localhost artifact; production is HTTPS)
and third-party cookie / inspector-issues coming from the AdSense/Adcash ad SDKs.
Production scores 77 on the same checks; the remaining points are lost to
ad-monetization cookies, which are intentionally kept (revenue).

**Performance is capped by third-party ad scripts** (Google AdSense auto-ads,
Adcash `aclib.js` in `<head>`, interstitial/push SDKs). Those are outside the
app code; the *first-party* optimizations below recovered +23 points of
performance and cut CLS from 0.257 to 0.066.

### What was done
- Chart.js is now lazy-loaded on the home page (loads only when the charts
  scroll into view) — ~230 KB + parse cost removed from the critical path.
- All home-page scripts are `defer`ed (execute in order after parse).
- Mortgage calculator recalc is debounced (100 ms) — sliders no longer rebuild
  the schedule + both charts on every `input` tick.
- Chart tick/legend fonts drop to 10px below 480px; charts re-render on
  rotation / breakpoint crossing (`calc:reflow` event).
- Render-blocking stylesheets on the four calculator pages (instead of the
  async `media="print"` trick) to keep Cumulative Layout Shift ≈ 0 — measured
  CLS dropped from 0.556 to 0.024 on rent-vs-buy.

### Recommendation (optional, revenue-sensitive)
`aclib.js` (Adcash) is synchronous in `<head>` (~1.3 s render-blocking). Adcash
documents an async integration; switching to it is the single biggest remaining
perf lever, but it affects ad delivery and must be tested for revenue impact by
the site owner.

## 2. Automated layout checks (headless Chrome, Puppeteer)

Viewport 375×812 (iPhone-class), 2x DPR. Ad/ad-network hosts blocked so the
checks measure the site, not the ad SDKs.

| Page | Horizontal overflow | Inputs ≥16px | Touch targets ≥44px | Hamburger |
|---|---|---|---|---|
| index.html | 0 px | pass | pass | pass |
| finance-vs-cash | 0 px | pass | pass | n/a |
| loan-portability | 0 px | pass | pass | n/a |
| renovation-roi | 0 px | pass | pass | n/a |
| rent-vs-buy | 0 px | pass | pass | n/a |
| blog | 0 px | pass | pass | n/a |
| affordability-guide | 0 px | pass | pass | n/a |

Desktop 1280×900 (index.html): 2-column calculator grid, inline desktop nav
(hamburger hidden), no horizontal overflow, `$2,219.79` rendered.

Hamburger interaction on index.html at 375px: `aria-expanded` false → true and
`.main-nav.active` toggled on click. PASS.

## 3. Functional / regression (jsdom + repo validator)

- `node --check` on all 15 `js/**/*.js` files: PASS.
- `node validate.js`: `ALL CHECKS PASSED` — JSON-LD parses on every page;
  all 391 i18n keys covered in en, es, fr, pt, de.
- Calculator smoke tests (jsdom runtime):
  - index.html monthly payment `$2,219.79` (350k, 20%, 6.5%, 30y + taxes/ins).
  - finance-vs-cash → `$1,769.79/mo`, verdict rendered, scenario table built.
  - loan-portability → `$122,888.11` net saving, scenario table built.
  - renovation-roi → `-40%` ROI, verdict rendered, scenario table built.
  - rent-vs-buy → `$2,413.04/mo`, verdict + `{years}`-substituted label, table.

## 4. Manual checks (recommended on release)

- [ ] Chrome DevTools device mode: iPhone SE, iPhone 12/13/14, Galaxy S21 —
      no overlap, no element escaping its container, smooth table scroll.
- [ ] iOS Safari + Android Chrome on a real device: inputs don't auto-zoom
      (16px font), hamburger opens, sliders have large thumbs, no sideways
      page pan.
- [ ] Firefox mobile: range slider renders with the styled track/thumb.
- [ ] Rotate phone portrait ↔ landscape: charts re-render with correct fonts.
- [ ] Lighthouse on the live URL after deploy (expect ≈ 75 perf, 100 a11y,
      100 SEO, ~77 best-practices).

## 5. Issues found and fixes

| # | Issue | Fix |
|---|---|---|
| 1 | `lang-select` 14.4px → iOS auto-zoom on tap | Set to 16px (base rule) |
| 2 | Async CSS caused CLS 0.556–0.76 (FOUC layout shift) | Reverted to render-blocking stylesheets → CLS 0.024–0.066 |
| 3 | Chart.js (~230 KB) loaded on first paint of home page | Lazy-loaded when charts scroll into view |
| 4 | Slider drag rebuilt schedule + charts per `input` event | Debounced recalculation (100 ms) |
| 5 | Chart labels clipped/overlapping on phones | 10px fonts below 480px + re-render on rotation |
| 6 | Amortization table too wide for phones | ≤480px shows Month/Principal/Interest only; `overflow-x: auto` + `-webkit-overflow-scrolling: touch` |
