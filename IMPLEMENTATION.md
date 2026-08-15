# IMPLEMENTATION.md

Mobile-responsive overhaul + 4 new advanced calculators for
`https://www.mortgage-pro-calc.com` (repo `lgsotre3-code/calculator`).

## What was done

### 1. Responsive overhaul (`css/style.css`)
- Rewrote the stylesheet mobile-first: base ≤480px, tablet 481–768px, desktop >769px.
- 16px minimum font-size on inputs/selects (prevents iOS zoom on focus).
- Collapsible hamburger navigation below 768px via a `<button class="menu-toggle">`
  with three `<span>` bars; tapping it toggles `.active` on `<nav class="main-nav">`.
- Tables (amortization, scenario comparison) wrap in `.table-scroll` with horizontal
  scroll on small screens; sliders, cards, FAQ, and footer are fluid.
- `prefers-reduced-motion` respected.

### 2. Hamburger navigation (`js/nav.js`)
- Accessible toggle: `aria-expanded`, Escape-to-close (returns focus), outside-click
  close, label swaps via `data-label-open` / `data-label-close`.
- Rolled out to every page with the standard header: index, blog, about, contact,
  404, refinance-guide, fha-vs-conventional, affordability-guide,
  amortization-guide (legacy `.navbar` header migrated to the standard header),
  and the 4 new calculator pages.
- `id="main-nav"` added to every `<nav class="main-nav">` so `aria-controls` is valid.
- New/updated page script order: `i18n.js` → `nav.js` → (calc deps) → `analytics.js`.

### 3. Four new calculators
Shared framework `js/calc-core.js` (`window.CalcCore`): debounce, formatting
(`C.money`/`C.pct`/`C.num`), Chart.js wrappers, a "Compare Scenarios" manager, and
a lazy-loader (`C.whenVisible`) that pulls Chart.js v4.4.1 (jsdelivr) + the page's
module only when the calculator scrolls into view.

- **Finance vs. Cash** — `finance-vs-cash/` + `js/calc-fvc.js`
  Financing: down payment + loan, principal invested at the investment return.
  Cash: full price today, avoided payments invested. Higher end-of-term capital wins.
- **Loan Portability** — `loan-portability/` + `js/calc-port.js`
  Same balance/term at a lower rate; monthly + total savings, interest saved,
  fee payback, and net saving.
- **Renovation ROI** — `renovation-roi/` + `js/calc-reno.js`
  Post-renovation value, value increase, net profit, ROI; industry recovery-share
  chart for common project types.
- **Rent vs. Buy** — `rent-vs-buy/` + `js/calc-rvb.js`
  Month-by-month simulation over the holding period: buyer net worth = home value
  minus loan balance; renter net worth = invested down payment + monthly
  cash-flow difference (buy cost − effective rent) compounded at the return rate.
  Reports break-even year, both net worths, and a verdict with `{years}` /
  `{amount}` placeholders substituted at render time.

Every calculator:
- Validates/normalizes input (clamps to min/max), formats USD consistently.
- Fires a `calculator_calculate` event into `dataLayer` (guarded) for analytics.
- Re-renders labels/charts when the UI language changes
  (`document` `i18n:updated` event → `C.schedule(calculate)`).
- Ships a 3-question FAQ in JSON-LD, `hreflang` alternates, canonical URL,
  Open Graph/Twitter meta, and inline critical CSS + async stylesheet loading.

### 4. i18n (`js/i18n/*.js`)
Added full key blocks for all 5 languages (en, es, fr, pt, de): `scenario_*`,
`calc_nav_*`, `months_abbr`, and the `fvc_*` / `port_*` / `reno_*` / `rvb_*`
namespaces (labels, verdicts, chart legends, FAQ). Added `years_5` (was missing).
Scenario-name inputs use `data-i18n-aria` (already supported by `i18n.js`).
French typo fixed: "Rendement Attend" → "Rendement Attendu".

### 5. SEO / infra
- `sitemap.xml`: added the 4 new URLs.
- `validate.js`: added the 4 new pages to the checked page list.
- `vercel.json` / `robots.txt`: no change needed (directory-index pages work with
  `cleanUrls`; sitemap already referenced).

### 6. Mobile fine-tuning (follow-up)
- **Amortization table on ≤480px**: the "hide Payment/Balance" rule is now scoped
  to `#amortization-table` (the calculator's table only). The generic
  `table.amortization th/td:nth-child(...)` selectors were too broad and would
  have hidden meaningful columns on other pages that reuse `.amortization` with a
  different layout (affordability-guide has 2 columns, fha-vs-conventional has 3).
  Visible on phones: Month / Principal / Interest; the wrapper `.table-scroll`
  keeps horizontal scroll for the full 5-column view when needed.
- **Chart legend fonts**: already 10px below 480px (via `axisFont()` / `chartFont()`
  in `js/chart.js` / `js/calc-core.js`), which also covers the <400px case. The
  legend is drawn on canvas by Chart.js, so there is no `.chart-legend` CSS class
  to style.
- **Loan Term field**: marked with `.input-group--loan-term` and given
  `padding-bottom: 20px` below 768px so the iOS native picker does not overlap the
  field when it opens.

### 7. Post-deployment fine adjustments
- **Inputs on calculators <768px**: `.calculator__input` gets `padding: 14px 12px`
  for a bigger tap area. The rule is written as
  `input.calculator__input, select.calculator__input` to match the specificity
  (0,1,1) of `style.css`'s `input[type="number"]` — a plain `.calculator__input`
  (0,1,0) silently loses the cascade even though it comes later. Font stays 16px
  (no iOS zoom). Desktop keeps `12px 10px`.
- **Charts taller on mobile**: `.calculator__chart-canvas` is now
  `height: 300px` + `min-height: 300px` at ≤768px and
  `height: 350px` + `min-height: 350px` at ≤480px (was 230px), so labels/legend
  fit without squashing.
- **Hamburger menu on every page**: `privacy.html` and `terms.html` (previously
  bare legal pages with no header) were converted to the standard layout —
  shared `css/style.css`, the full site header with `.menu-toggle` hamburger,
  `js/nav.js`, `js/i18n/i18n.js`, `js/analytics.js`, and the site footer with the
  required AdSense legal links. `mobile-verify.cjs` now covers all 12 header
  pages and runs the hamburger open/close test on each one. The `en|es|fr|pt|de`
  language stubs are instant-redirect shells, so they intentionally have no header.
- **Scenario tables scroll**: the 4 calculators' Compare-Scenarios tables already
  scroll horizontally (`.table-scroll--scenarios` with `overflow-x: auto` and
  `-webkit-overflow-scrolling: touch`). For keyboard users the 4 containers now
  also get `tabindex="0"` + `aria-label="Scenario comparison table"` (same
  treatment as the main amortization table). Column hiding is NOT applied to
  scenario tables — every column is part of the comparison and hiding any of them
  would delete information; horizontal scroll preserves all columns.

## Validation (run with Node 24+)

```powershell
# 1. Syntax-check every JS file (repo includes validate.js which needs Node)
node --check js\calc-fvc.js
# ... or loop over js\**\*.js

# 2. Repo validator: JSON-LD parse + every data-i18n key present in all 5 dicts
node validate.js            # → "ALL CHECKS PASSED"

# 3. Runtime smoke test (jsdom): each calculator loads, calculates, renders the
#    Compare Scenarios table, and the rent-vs-buy label has {years} substituted.
#    Requires: npm i jsdom
node smoke.cjs              # → "SMOKE: ALL PAGES PASS"

# 4. Cross-check t('...') keys used in js/calc-*.js exist in all dictionaries

# 5. Browser checks (Puppeteer, see TESTING.md): layout at 375px / 1280px,
#    hamburger toggle, hidden table columns, and input touch targets.
```

Expected `validate.js` output includes informational `WARN: FAQPage has <10
questions (3)` lines — the 3-question FAQ pages are intentional and not failures.
jsdom smoke runs log `HTMLCanvasElement's getContext() ... not implemented`
warnings — a jsdom canvas limitation, not a browser issue.

## Notes / decisions
- US-only site: all money is USD-formatted, defaults match a US buyer
  (e.g. 20% down, 6.5% rate, 30-yr term).
- Chart.js and calculator modules are lazy-loaded for performance; charts are
  re-created on every recalculation (instances destroyed to avoid leaks).
- Scenario tables use localized labels as row headers; rent-vs-buy substitutes
  `{years}` into its scenario row label.
