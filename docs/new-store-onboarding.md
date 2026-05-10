# New Store Onboarding Standard

Last updated: 2026-05-10

---

## Purpose

This document defines the required process and quality bar for adding a new store to the bike catalog.

A new store is not considered complete just because products appear in the catalog. It is only complete when it has passed the full onboarding flow, meets the relevant quality requirements, and has been documented.

**Core principle:** We prioritize quality, trustworthiness, and robustness over speed.

Every new store must be implemented as fully as practical, while staying honest about the store's actual data quality.

- If a store supports reliable variant and size-level stock data, we integrate it to the same standard as the current trusted stores.
- If a store does not support that level of quality, it may still be added, but it must be clearly treated as a lower-trust store in logic and UX.

---

## Definition of Done

A store is only considered complete when **all** of the following are true:

1. A pre-audit has been completed
2. The MVP scraper is working
3. The store has been brought up to full standard where feasible
4. A trusted-size-store assessment has been made explicitly
5. QA has been completed and signed off
6. The store has been documented in `docs/store-parser-status.md`

---

## 0. Catalog scope check

Before starting any store, confirm that it sells products that belong in the catalog.

**In scope:** Road, gravel, MTB, TT, and sport-relevant e-bikes (e-MTB, e-gravel, e-road).

**Out of scope by default:** Electric scooters, BMX, folding bikes, city/urban/commuter/trekking/cargo bikes, parts, accessories, clothing, and helmets.

**EBIKE caution:** A store with a broad e-bike catalog must have its scope decided explicitly. City, commuter, folding, and utility e-bikes are out of scope. e-MTB, e-gravel, and e-road are in scope. Do not treat all `EBIKE` as equivalent.

If the store sells predominantly out-of-scope products, classify it as **Do not implement** in the pre-audit verdict.

---

## 1. Phase 1: Pre-Audit

Before writing any implementation code, a pre-audit must be performed. This prevents wasted effort and surfaces blockers early.

### Store Intake

Collect the following before starting:

- **Store name** — the display name used in the catalog
- **Domain** — the primary URL (e.g. `www.example.no`)
- **Store slug** — short, lowercase identifier (e.g. `example`) used in DB and code
- **Main geography / shipping relevance** — does it ship to Norway? Is it a Norwegian store?
- **Main bike categories covered** — road, gravel, MTB, e-bike, TT, or a subset
- **Estimated business value** — approximate listing volume, brand range, discount quality
- **Estimated technical complexity** — rough complexity rating and blockers

### Technical Audit

Inspect the live site and answer:

- **Platform / source type** — Shopify, PrestaShop, WooCommerce, ASP.NET, custom, etc.
- **Category and scope coverage** — which bike categories does the store carry? Are out-of-scope products (scooters, cargo, city, etc.) mixed in and how heavily?
- **Listing scrapeability** — are listing pages server-rendered HTML, or does content require JS execution?
- **Detail pages needed** — can all required data be pulled from listing pages, or are detail fetches required?
- **Price reliability** — are current price, old price, and discount reliably available and clearly marked?
- **Image and link stability** — are image URLs and product URLs stable across visits and pagination?
- **Stock status** — is product-level in-stock/out-of-stock status available anywhere in the HTML or API?
- **Size / variant data** — do size options exist on listing or detail pages? What HTML structure?
- **Per-size stock** — is stock status available at the size/variant level, not just the product level?
- **Structured data** — is JSON-LD, embedded JSON (script blobs), or a public API available?
- **Rate limiting / anti-bot risk** — does the site appear to use rate limiting, Cloudflare, or aggressive bot detection?

### Pre-Audit Outcome

Classify the store as one of:

- **Full candidate** — all required data is available; proceed to implementation
- **Partial candidate** — some data is missing or unreliable; proceed with documented limitations
- **Do not implement now** — critical blockers exist; revisit later or skip

Document the outcome in the intake notes before proceeding.

---

## 2. Phase 2: MVP Requirements

The MVP is the minimum working implementation that produces valid, publishable listings. It is not the finished implementation.

### Required MVP Output

Every listing must provide:

- Product name
- Product URL (stable, canonical)
- Product image URL
- Current price (NOK integer)
- Old / original price (if available from the source)
- Discount (derived if not explicit)
- Category (`ROAD`, `GRAVEL`, `MTB`, `EBIKE`, `TT`)
- Brand (if reliably extractable)
- Basic product-level stock status (if available)

### MVP Quality Rules

Before the MVP is considered shippable:

- No obviously broken or relative links
- No obviously wrong or placeholder images
- No obviously wrong category assignments
- No out-of-scope products in the catalog (scooters, BMX, cargo, city, accessories, etc.)
- No duplicated or near-duplicate listings from the same scrape run
- No obviously stale, zero-discount, or synthetic deals

The MVP does not need full size data. It does need correct products at correct prices.

---

## 3. Phase 3: Full-Standard Implementation

After the MVP passes, the store should be lifted to the project's established quality standard wherever the source data supports it.

### What Full Standard Means

- **Detail-page scraping** — when listing pages do not expose full size/stock data, detail pages must be fetched
- **Variant / size extraction** — all available size options must be parsed from the correct HTML selector or structured data source
- **Per-size stock extraction** — stock status at the size level must be derived from platform-native signals (e.g. CSS classes, JSON-LD availability fields, disabled attributes)
- **Product-level `isInStock` derived from sizes** — for trusted stores, `isInStock` must reflect whether at least one size is in stock, not a hardcoded `true`
- **Exclusion of all-OOS listings** — listings where all trusted sizes are out of stock must not appear in the catalog
- **Protection against data loss on fetch failure** — if a detail page fetch fails, existing size data and `isInStock` must be preserved, not overwritten
- **Clear logging** — every detail fetch and size parse should produce a log line with size count and in-stock count
- **Safe rerun behavior** — running the scraper twice should not corrupt data, flip in-stock status incorrectly, or produce duplicates

### Robustness Rules

Failed detail fetches must not:
- Wipe valid size data that was previously stored
- Overwrite a correct `isInStock: false` with `isInStock: true` via a hardcoded fallback

The implementation must clearly distinguish between:

| State | Meaning |
|---|---|
| `sizesConfident: true`, sizes present | Successful parse — trust the result |
| `sizesConfident: true`, sizes empty | Parsed successfully but no size selector found — acceptable fallback if documented |
| `sizesConfident: false` | Fetch or parse failure — preserve existing DB state |
| Product with no size picker by design | Single-SKU listing — document as acceptable fallback |

### UX Honesty Rule

If a store is not reliably providing per-size stock data, the UX must reflect this. Do not show "På lager" per size for a store where that claim cannot be verified. The `sizeStockKnown` flag in the UI must be set correctly.

---

## 4. Phase 4: Trusted Size Store Assessment

Every new store must be explicitly assessed for eligibility in the trusted size store group. This is not assumed — it must be decided.

### Questions to Answer

- Is size data reliably available on this store? (Structured? Stable? Consistent?)
- Is per-size stock status reliably available? (Not just product-level)
- Can `isInStock` be correctly derived from size data for this store?
- Is it safe to exclude listings where all sizes are out of stock?
- Can this store participate in the size filter in the catalog UI?

### Outcome

The store must be classified as one of:

- **Trusted size store** — add to `RELIABLE_SIZE_STORES` in the normalizer and `RELIABLE_SIZE_STORE_SLUGS` in the query layer; `isInStock` is derived from sizes
- **Partial / lower-trust store** — keep size data for display only; `isInStock` derived from scraper-level flag; excluded from the size filter when active

Only stores that genuinely meet the standard should enter the trusted group. Premature inclusion introduces incorrect availability signals that are hard to detect and erode user trust.

---

## 5. Phase 5: QA Signoff

No store is considered complete without explicit QA. QA must be run after the full-standard implementation is in place, not before.

### Automated QA

```
npx tsx scripts/qa-sizes.ts <slug>
```

Review the output for:

- `isInStock=true, no sizes` — investigate each case; document any that are acceptable fallbacks
- `isInStock=true` but all sizes out of stock — this is a bug; must be resolved before signoff
- `isInStock=false` but some sizes in stock — this is a bug; must be resolved before signoff

If suspicious cases remain, run:

```
npx tsx scripts/diag-no-sizes.ts <slug>
```

Fetch the live HTML for affected listings to determine whether the cause is structural or a parser bug.

### Product scope QA

Before sign-off, verify that:

- No electric scooters, BMX, folding bikes, city/commuter/cargo bikes appear in the active catalog for this store
- Category distribution is plausible for this store's actual inventory
- For stores with broad e-bike catalogs: explicitly review the EBIKE listings and confirm only sport-relevant models are present; document any remaining out-of-scope listings as known limitations if they cannot yet be excluded

### Manual QA

Manually verify at least one example of each of the following:

- A standard multi-size product — verify sizes render correctly in correct order
- A single-size or OS product (if the store sells them) — verify it appears without errors
- A partially out-of-stock product — verify some sizes show as OOS and some as in stock
- A fully out-of-stock product (if the source exposes one) — verify it is excluded from the catalog
- Size filter behavior — if the store is trusted, verify it appears and filters correctly

### Catalog UI Verification

The store is not considered complete until it is visibly working in the live catalog UI. Verify all of the following in the browser:

- The store appears in the **Butikk** filter panel with the correct name
- The listing count next to the store name is non-zero and plausible
- Selecting the store in the Butikk filter returns its listings correctly
- The store's listings appear in the main catalog when no store filter is active

If the store is missing from the Butikk filter despite correct ingestion, the most common causes are:
- The store row in the DB has `isActive: false` or `shipsToNorway: false` — fix via upsert script or seed
- The Next.js router cache is serving a stale RSC payload — hard-refresh the browser (Cmd/Ctrl + Shift + R) or restart the dev server

### QA Outcome

The store must be signed off as one of:

- **QA-approved** — all checks pass; source/category coverage mapped, product scope enforced, category mapping validated, required fields present, real ingestion run and post-run metrics reviewed, no open issues
- **QA-approved with limitations** — known structural edge cases exist but are documented and understood; no bugs, only accepted fallbacks
- **Not QA-approved** — unresolved bugs, missing scope enforcement, or post-run metrics not yet reviewed; do not consider the store complete until resolved

---

## 6. Phase 6: Documentation

Every store must be documented in `docs/store-parser-status.md` before the onboarding is considered complete.

The documentation must include:

- **Store slug** and display name
- **Platform / source type**
- **Size data source** — which HTML element, JSON-LD field, or API provides size data
- **Reliability level** — High / Medium / Low, with justification
- **Trusted size store** — Yes or No
- **Size-based `isInStock` derivation** — active or not
- **All-size-OOS exclusion** — active or not
- **Known acceptable fallbacks** — any structural edge cases that are documented and stable
- **Known caveats / failure modes** — any known ways the scraper can degrade
- **Recommended operational handling** — e.g. delay settings, retry behavior, rate limit guidance

---

## 7. Quality Bar Summary

A store that has completed onboarding must meet all of these:

| Area | Standard |
|---|---|
| Products | Correct, real, non-duplicated listings |
| Prices | Correct current and original prices |
| Links | Stable, canonical, functional URLs |
| Images | Correct product images at usable resolution |
| Categories | Correctly classified |
| Stock handling | Honest — not overclaiming availability |
| Size handling | Full per-size data where the source supports it |
| Fallback handling | Safe — fetch failures do not corrupt existing data |
| QA evidence | Run and reviewed; outcome documented |
| Documentation | Store entry in `store-parser-status.md` |

---

## 8. Practical Working Rule for Future Store Integrations

When onboarding a new store, follow this sequence:

1. **Check catalog scope first** — confirm the store sells products that belong in the catalog before writing any code
2. **Do the pre-audit** — do not write a scraper until you know the platform, data availability, and likely complexity
3. **Build the MVP** — get correct products at correct prices into the catalog
4. **Lift to full standard where feasible** — add sizes, per-size stock, `sizesConfident` handling, and safe fallbacks
5. **Explicitly decide trusted-size-store status** — do not assume; answer the four assessment questions and make a documented decision
6. **Run QA before calling the store complete** — automated scripts first, then product scope audit, then manual spot checks
7. **Document the store before moving on** — add the entry to `store-parser-status.md` with QA status

**Do not treat "products appear in the catalog" as completion.**

Completion means the store has reached the project's quality standard, passed QA (including scope audit), and is documented.

**After improving the normalizer:** Re-run the affected store. The runner refreshes `category`, `frameMaterial`, `gender`, and `isElectric` on every existing listing update, so normalization fixes take effect immediately without a separate migration. Always compare pre- and post-run active listing counts and category distributions to confirm the change had the expected effect.

---

## 9. Recommended Prompting Rule

When starting work on a new store, read this document first and answer the following questions before writing any code:

1. **What is the likely platform?** (Shopify, PrestaShop, WooCommerce, ASP.NET, custom)
2. **What is the size-data source?** (Shopify variants API, JSON-LD, HTML select, none identified)
3. **Is this likely a trusted-size-store candidate?** (Yes / No / Needs investigation)
4. **What is the MVP?** (What fields are reliably available on listing pages alone?)
5. **What is the likely full-standard path?** (Detail pages needed? What selector for sizes? What signal for per-size stock?)
6. **What are the main technical risks?** (Rate limiting, JS-rendered content, unstable URLs, poor size data)

Answering these before implementation prevents the most common onboarding mistakes: building the scraper before understanding the data, hardcoding `isInStock: true` without checking availability signals, and shipping without QA.
