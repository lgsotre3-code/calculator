# Mortgage Pro Calculator

Responsive mortgage calculator website with 5 calculators in 5 languages
(en, es, fr, pt, de). Live at **https://www.mortgage-pro-calc.com**
(deployed automatically on Vercel from the `main` branch).

## Calculators

| Calculator | URL | Module |
|---|---|---|
| All calculators (hub) | `/calculators/` | — |
| Mortgage Calculator (P&I + taxes + insurance + extra payments) | `/` | `js/calculator.js` |
| Finance vs. Cash | `/finance-vs-cash/` | `js/calc-fvc.js` |
| Loan Portability | `/loan-portability/` | `js/calc-port.js` |
| Renovation ROI | `/renovation-roi/` | `js/calc-reno.js` |
| Rent vs. Buy | `/rent-vs-buy/` | `js/calc-rvb.js` |

Shared framework: `js/calc-core.js` (`CalcCore`). Charts: Chart.js v4.4.1 (CDN,
lazy-loaded). i18n: `js/i18n/i18n.js` + dictionaries in `js/i18n/{lang}.js`.

## Test locally

Prerequisite: Node 18+ (any recent version; the repo validator `validate.js` needs it).

```powershell
# 1. Syntax-check every JS file
Get-ChildItem js -Filter *.js -Recurse | ForEach-Object { node --check $_.FullName }

# 2. Repo validator: JSON-LD parse + all data-i18n keys in all 5 dictionaries
node validate.js          # → "ALL CHECKS PASSED"

# 3. Serve the static site (e.g. with any static server)
npx serve .               # or python -m http.server, vercel dev, etc.

# 4. Open http://localhost:3000 and verify the calculator + mobile layout
```

Responsive design is mobile-first (base ≤480px, tablet 481–768px, desktop >769px).
Use Chrome DevTools device mode (iPhone SE, iPhone 14, Galaxy S21) or resize the
window to verify the hamburger menu, stacked inputs, single-column result cards,
and the horizontally-scrollable amortization table.

## Screenshots

Captured with headless Chrome at 2x device scale (see `screenshots/`):

| Page | Mobile (375px full-page) | Desktop |
|---|---|---|
| Home / Mortgage Calculator | `screenshots/index-mobile-full.png` | `screenshots/index-desktop-1280.png` |
| All calculators (hub) | `screenshots/calculators-index-mobile-full.png` | — |
| Finance vs. Cash | `screenshots/finance-vs-cash-index-mobile-full.png` | — |
| Loan Portability | `screenshots/loan-portability-index-mobile-full.png` | — |
| Renovation ROI | `screenshots/renovation-roi-index-mobile-full.png` | — |
| Rent vs. Buy | `screenshots/rent-vs-buy-index-mobile-full.png` | — |
| Blog | `screenshots/blog-index-mobile-full.png` | — |
| Affordability guide | `screenshots/affordability-guide-index-mobile-full.png` | — |

> The "before" state had no mobile adaptation (desktop-only layout, no hamburger
> menu, inputs/sliders/cards sized for mouse). The "after" state is the current
> mobile-first build; see `TESTING.md` for the automated checks and Lighthouse
> comparison.

## Changelog

### 2026-08 — Mobile responsiveness & performance (this release)
- Mobile-first `css/style.css`: breakpoints 480/768/769, stacked inputs, 16px
  inputs (no iOS auto-zoom), 24px slider thumbs, single-column result cards,
  `overflow-x: auto` tables with native touch scrolling, zebra rows.
- Amortization table on ≤480px shows Month/Principal/Interest (Payment/Balance
  hidden) at 12px type; hamburger navigation below 768px (44px touch targets).
- Content pages: fluid headings (h1 1.8rem / h2 1.4rem / h3 1.2rem), full-width
  images, generous section spacing.
- All 20 HTML pages carry the viewport meta tag.
- Performance: Chart.js lazy-loaded on the home page (~230 KB off the critical
  path), all home-page scripts `defer`ed (execute in order, non-blocking),
  debounced recalculation (100 ms) on the mortgage calculator, and chart fonts
  shrink to 10px below 480px with re-render on rotation/breakpoint crossing
  (`calc:reflow`). Calc pages use render-blocking stylesheets to keep CLS ≈ 0.
- Accessibility: `aria-label` on icon-only controls, keyboard focus styles,
  `prefers-reduced-motion`, WCAG-AA palette (Lighthouse accessibility 100/100).

### 2026-08 — Four advanced calculators (previous release)
Added finance-vs-cash, loan-portability, renovation-roi, rent-vs-buy with full
i18n (en/es/fr/pt/de), JSON-LD FAQ, lazy-loaded Chart.js, and the Compare
Scenarios feature. See `IMPLEMENTATION.md`.

## Project structure

```
├── index.html                # main mortgage calculator
├── css/  style.css, calculators.css
├── js/   calculator.js, calc-core.js, calc-fvc/port/reno/rvb.js,
│         chart.js, nav.js, analytics.js, validate.js, i18n/{en,es,fr,pt,de}.js
├── finance-vs-cash/  loan-portability/  renovation-roi/  rent-vs-buy/
├── blog/  about/  contact/  affordability-guide/  refinance-guide/
│   fha-vs-conventional/  amortization-guide/
├── en/ es/ fr/ pt/ de/      # language redirect stubs
├── screenshots/             # responsive captures for this README
├── IMPLEMENTATION.md        # implementation notes
├── TESTING.md               # test report (Lighthouse + device checks)
├── validate.js              # repo validator
├── sitemap.xml  robots.txt  vercel.json
```

## Deploy

Automatic via Vercel (`vercel.json`, `cleanUrls: true`). Push to `main` to deploy.
