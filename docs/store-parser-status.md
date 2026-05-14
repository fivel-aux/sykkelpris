# Store Parser / Quality Status

Last updated: 2026-05-10

---

## Catalog scope

Sykkelpris is a curated deals site, not a general bike catalog. Only the following product types belong:

**In scope:**
- Road bikes (`ROAD`)
- Gravel bikes (`GRAVEL`)
- Mountain bikes (`MTB`)
- Time trial / triathlon bikes (`TT`)
- Sport-relevant e-bikes (`EBIKE`): e-MTB, e-gravel, e-road

**Out of scope by default:**
- Electric scooters, electric kick-scooters
- BMX
- Folding bikes
- City / urban bikes
- Commuter and trekking bikes
- Cargo and utility bikes
- Parts, frames, wheels, trainers, accessories, clothing, helmets, locks

**EBIKE nuance:** Do not blindly exclude all EBIKE listings. The question is whether the specific model belongs to a sport category. E-MTB, e-gravel, and e-road are in scope. City, commuter, folding, trekking, cargo, and utility e-bikes are not. EBIKE scope for stores with broad e-bike catalogs (e.g. Bikester) must be decided explicitly and documented per store.

The normalizer enforces scope via three gates in `src/ingestion/normalizer/category.ts`:
- **Gate 1** (`NON_BIKE_KEYWORDS`): accessories, parts, clothing, electric scooters → rejected
- **Gate 2** (`OUT_OF_SCOPE_BIKE_KEYWORDS`): trekking, cargo, commuter, citylite, BMX → rejected
- **Gate 3**: classifies into `ROAD`, `GRAVEL`, `MTB`, `EBIKE`, `TT`; unclassifiable products are rejected

---

## QA status

The table below tracks two separate things:

- **Parser/size QA** — historical checks focused on size parsing correctness, `isInStock` derivation, and acceptable fallbacks. Conducted 2026-04-30/05-02. These are not full-store QA under the current standard.
- **Full QA (current standard)** — comprehensive review covering: source/category coverage, product scope, category mapping, field quality, image quality, external URLs, ingestion metrics, and manual sampling. This standard was defined in May 2026. No store has completed this standard yet. Bikester is currently in progress.

| Store | Parser/size QA | Full QA (current standard) |
|---|---|---|
| Unaas Cycling | Passed (2026-04-30) | Pending |
| Bikeshop | Passed with limitations (2026-04-30) | Pending |
| Canyon | Passed with limitations (2026-04-30) | Pending |
| Birk Sport | Passed with limitations (2026-04-30) | Pending |
| Sykkelbutikken | Passed (2026-04-30) | Pending |
| Lillehammer Sport | Passed (2026-04-30) | Pending |
| Peder Øie | Passed (2026-04-30) | Pending |
| Sykkeloutlet | Passed (2026-05-02) | Pending |
| Bikester | Not applicable (size data unreliable by design) | In QA — not approved |

---

## Per-store status

| Store | Slug | Platform | Size data source | Reliability | In RELIABLE_SIZE_STORES | isInStock derived from sizes | All-OOS excluded from catalog |
|---|---|---|---|---|---|---|---|
| Unaas Cycling | `unaas` | Shopify JSON API | Variant options (option1/2/3) from `/collections/{handle}/products.json` | **High** | Yes | Yes | Yes |
| Bikeshop | `bikeshop` | Dynamicweb / ASP.NET | JSON-LD `ProductGroup.hasVariant[].size` + `offers.availability` on detail page | **High** | Yes | Yes | Yes |
| Canyon | `canyon` | Custom (canyon.com) | JSON-LD `Product.offers[]` name parsing (`Product \| Color \| SIZE`) on outlet detail page | **High** | Yes | Yes | Yes |
| Birk Sport | `birk` | ASP.NET WebForms | `select[name*="ddlMatrixType"]` options on detail page | **High** | Yes | Yes | Yes |
| Sykkelbutikken | `sykkelbutikken` | PrestaShop | `select[data-product-attribute]` options on detail page | **High** | Yes | Yes | Yes |
| Lillehammer Sport | `lillehammersport` | WooCommerce 10.7.0 / WordPress | Per-variation `is_in_stock` via WooCommerce Store REST API | **High** | Yes | Yes | Yes |
| Peder Øie | `poie` | Shopify | Variant options (option1/2/3) from `/products.json` | **High** | Yes | Yes | Yes |
| Sykkeloutlet | `sykkeloutlet` | Shopify | Variant options (option1/2/3) from `/products.json` | **High** | Yes | Yes | Yes |
| Bikester | `bikester` | Triton CMS / ASP.NET | `select[name*="ddlMatrixType_2"]` options on detail page | **Low** | No | No | No |

---

## Store notes

### Unaas Cycling
- Single-phase scraper — all data comes from the Shopify products.json API. No separate detail-page fetches, so no fetch-failure or rate-limit risk.
- Sizes are read from `variant.option1/2/3`; a regex rejects non-size values (colors, drivetrains, etc.) and strips height ranges like `"XL (186-196cm)"`.
- **Acceptable fallback:** Products with `option1="Default Title"` and no real variant options are single-SKU listings (no size picker configured in Shopify). These appear in the catalog as in-stock but are not filterable by size. Currently 1 such listing (Wilier Superlegera). Expected and stable.

### Bikeshop
- Two-phase scraper: listing page identifies discounted candidates; detail page fetches price and size data.
- Sizes parsed from JSON-LD `ProductGroup.hasVariant[]`. The `matchAll()` approach handles pages with multiple JSON-LD blocks (Organization + ProductGroup).
- **Acceptable fallback:** Some products are listed as one-SKU-per-size (separate product pages, not variants). These have `@type=Product` (not `ProductGroup`) with a single offer and no `hasVariant` array. Size is encoded in the product title only (e.g. "Bianchi Specialissima Comp … Str. 55"). Currently 1 such listing. Expected and stable; do not parse size from title.
- Detail-page fetch failure returns null → `sizesConfident` not set (defaults to true in normalizer) → `sizes.length=0` → runner preserves existing DB sizes and isInStock.

### Canyon
- Two-phase scraper: listing pages collect outlet candidates; detail pages fetched for price and size.
- JSON-LD `Product.offers[]` name format: `"Product Name | Color Name | SIZE"` — size is the last pipe-delimited segment.
- **Underdog / refurbished edge case:** "Canyon Underdog" and similar single-unit refurbished products have offer names without the `"| SIZE"` pipe format. Parser falls back to `.colorPicker__headingValue` (labeled "Frame Size:"), then to `.productConfiguration__selectVariantType` text (format `"XL - #0001234"`).
- `fetchHtml` retries once on HTTP 429 with a 10-second backoff before throwing. If it still fails, the product is skipped entirely for that run — `lastSeenAt` is not updated. Consistent failures over 7 days would cause stale-deactivation.
- Canyon Speedmax listings are classified as `TT` (not `ROAD`) via the normalizer category classifier. This was set correctly via a one-off migration and is maintained by the scraper's `rawCategory` output.

### Birk Sport
- Two-phase scraper: listing pages collect discounted candidates; detail pages fetched for sizes.
- **Selector:** `select[name*="ddlMatrixType"]` (no suffix constraint). Products with one attribute group (sizes only) use `ddlMatrixType_1`; products with two attribute groups (color + size) use `_1` for color and `_2` for sizes. The broadened selector catches both; the `BIRK_SIZE_RE` filter on each option excludes color values naturally.
- **`sizesConfident` flag:** Set to `false` when detail-page fetch returns null (HTTP error, 429, timeout). Runner then preserves existing DB sizes AND `isInStock` without overwriting.
- `fetchHtml` retries once on HTTP 429 with a 12-second backoff before returning null.
- Delay between detail fetches: 2500ms. Birk has rate-limited aggressively in the past; do not reduce this.
- **Acceptable fallbacks:** Some products have no size selector at all (single-size products with size as a plain spec row, e.g. Lapierre Xelius DRS 10.0 series) or a color-only selector with no size group. Currently ~4 such listings. Expected and stable.

### Sykkelbutikken
- Two-phase scraper: listing pages collect discounted candidates; detail pages fetched for sizes.
- Sizes parsed from `select[data-product-attribute]` options. Color selects are identified and skipped by checking option titles against a Norwegian/English color word list.
- **OS / One Size:** `SYKKELBUTIKKEN_SIZE_RE` includes `OS` to handle products with a single "One Size" option (PrestaShop value `"OS"`). These show as `sizes: [{size: "OS", isInStock: true}]` and are correctly in-stock but do not appear in the size filter dropdown (not in `LETTER_SIZE_ORDER`).
- **`sizesConfident` flag:** Set to `false` when detail-page fetch returns null. Runner preserves existing DB sizes and `isInStock`.
- `fetchHtml` retries once on HTTP 429 with a 10-second backoff before returning null.

### Lillehammer Sport
- API-first scraper: all data (products, prices, sizes, stock) comes from the public WooCommerce Store REST API (`/wp-json/wc/store/products`). No HTML parsing of listing pages.
- **On-sale gate:** `?on_sale=true` query parameter; only discounted products are fetched.
- **Category filter:** In-memory allowlist of bike category slugs (`sykkel`, `elsykkel`, `el-hybridsykkel`, `el-terrengsykkel`, `landevei-og-gravel`, `hardtail`, `fulldempet`, `terrengsykkel`, `gravelsykkel`, `landevei`, `hybrid`). Products in excluded categories (`barnesykkel`, etc.) or with no matching slug are dropped.
- **Prices:** API returns minor units (NOK × 100 as a string). Divided by 100 and rounded to integer NOK.
- **Size data source:** Parent product's `variations[].attributes` array. Each entry has `{ name: "Størrelse", value: "s3" }`. Size label read here — individual variation fetches return `attributes: []` on this WooCommerce install.
- **Per-size stock:** Individual variation fetch (`/wc/store/products/{variation_id}`) for `is_in_stock` boolean. Only in-stock/purchasable variations are returned by the listing API, so the variations list is naturally filtered to available sizes.
- **Size labels:** Standard letter sizes (`S`, `M`, `L`, `XL`…), numeric frame sizes (`52`, `54`…), and brand alphanumeric codes (`S1`–`S6` for Specialized, `R1`–`R3` for Trek Session DH). All normalized to uppercase.
- **`sizesConfident` flag:** Set to `false` if any variation stock fetch fails. Runner preserves existing DB sizes and `isInStock` without overwriting.
- **Operational notes:** 350ms delay between variation fetches. No rate limiting observed. No anti-bot protection detected.
- **QA outcome (2026-04-30):** 27 listings, 27 with size data, 0 no-size, 0 all-sizes-OOS. Approved.

### Peder Øie
- Single-phase scraper — all data comes from the Shopify `/products.json` API. No separate detail-page fetches, so no fetch-failure or rate-limit risk.
- **Source path:** `/products.json?limit=250&page=N` (full catalogue). `/collections/salg` was initially tested but only exposed ~2 products in practice — too narrow.
- **Client-side filtering:** Bike products identified by BIKE_RE against `product_type` and `tags`. Discounted products identified by `compare_at_price > price` on at least one variant.
- **Size data source:** `variant.option1/2/3`, index selected dynamically by finding the "Størrelse" (or "Size") option in `product.options[]`. Falls back to option1 if not found.
- **"56 cm" handling:** Trailing " cm" stripped before size regex match so `"56 cm"` → `"56"`.
- **Per-size stock:** `variant.available` (Shopify native boolean). Gold standard — no inference needed.
- **`sizesConfident`:** Always `true` — single-phase, no fetch failures possible.
- **QA outcome (2026-04-30):** 15 listings, 15 with size data, 0 no-size, 0 isInStock=true/no-sizes. Approved.

### Sykkeloutlet
- Single-phase scraper — all data comes from the Shopify `/products.json` API. No separate detail-page fetches, so no fetch-failure or rate-limit risk.
- **Dedicated outlet store** — no named sale collection exists; the full products feed is the correct source. All named collections (`/collections/all`, `/collections/de-beste-tilbudene`, etc.) return empty JSON.
- **Bike detection:** `product_type` is blank for most products. BIKE_RE is applied to both `product_type` and tags. Tags are the reliable signal (`terrengsykkel`, `landeveissykkel`, `gravelsykkel`, `el-sykkel`, `fulldemper`, `hardtail`, etc.).
- **Size option name inconsistencies:** The size option is spelled four different ways across products: `"Størrelse"` (correct), `"Størrlese"` (typo — Cube Attention), `"Sørrelse"` (typo — Cube Litening Aero), `"Size"` (English). Rather than matching the option name, the scraper scans option1/option2/option3 in order and takes the first value that passes SIZE_RE. SIZE_RE rejects color values naturally, making this approach robust to all variants.
- **Per-size stock:** `variant.available` (Shopify native boolean). Gold standard — same as Unaas and Peder Øie.
- **`sizesConfident`:** Always `true` — single-phase, no fetch failures possible.
- **Small catalog:** 12–20 products (rotating outlet inventory). Expected and stable for this business model.
- **QA outcome (2026-05-02):** 20 listings, 20 with size data, 0 no-size, 0 isInStock=true/no-sizes. Approved.

### Bikester
- Two-phase scraper conceptually similar to Birk, but **all sizes are marked `isInStock: true` by the platform** regardless of actual stock. The `attribute-not-in-stock` class is not reliably applied.
- **Not in `RELIABLE_SIZE_STORES`:** `isInStock` is derived from `raw.isInStock` (scraper-level flag), not from sizes.
- **Excluded from size-filtered catalog results:** When the user applies a size filter, `buildWhereClause` adds `NOT store.slug = "bikester"` to prevent misleadingly showing Bikester listings that match a size label but may not actually be in stock in that size.
- Bikester listings still appear in the un-filtered catalog if `isInStock=true` at the product level.
- Size data is stored but treated as structural/display-only, not for availability derivation.
- **Phase A cleanup (commit 90b4a28, 2026-05-10):** Electric scooters and BMX excluded. Superior X-road bikes reclassified from ROAD → GRAVEL via title override. Added missing brands: Superior, Rock Machine, Besv, Romet, Tenways. Central MIN_DISCOUNT_PERCENT=5 gate applied. Validated with real ingestion: active listings 1253 → 1078, below-5%-discount 136 → 0, scooters 5 → 0, BMX 34 → 0, X-road in ROAD 11 → 0 / in GRAVEL 0 → 11, no-brand 378 → 41.
- **Image quality — root cause and fix (commit b799e89, 2026-05-10):**
  - **Root cause:** The frontend was not responsible for blurry images. Bikester's listing pages serve low-resolution thumbnails (~311px wide, `/mQ/` CDN tier) via lazy-loaded `data-lazysrc`. The detail page fetches in Phase 2 provide better images (`/zY/` CDN tier, up to 800×516). The previous runner always overwrote `primaryImageUrl` unconditionally, so any listing that received a detail-page image in one run could be downgraded back to the listing thumbnail on a subsequent run if it fell outside the 200-fetch cap.
  - **Fix:** Added `imageConfident: boolean` to `RawProduct` and `NormalizedListing`. The Bikester scraper sets `imageConfident: true` when a detail-page image is returned and `false` when the listing-page thumbnail is used as fallback. The runner preserves the existing stored image when `imageConfident=false`; it refreshes the image only when `imageConfident=true`. All other scrapers default `imageConfident` to `true`, so their behavior is unchanged.
  - **High-cap cleanup (`BIKESTER_MAX_DETAIL_FETCHES=1400`, 2026-05-10):** One-time cleanup run to seed best-available images across all active listings. The full Bikester candidate set (1326 products) was processed without hitting the cap. 1078 listings updated, 248 rejected by normalizer (below discount threshold or out of scope). Runtime ~44 min.
  - **Result:** Post-run audit confirmed 1078/1078 active Bikester listings on the `/zY/` CDN tier — 0 active `/mQ/` (311px) thumbnails remaining. Future standard runs (200-fetch cap) preserve the `/zY/` tier via the `imageConfident` flag — no further cleanup needed unless Bikester adds substantially more inventory.
  - **Remaining limitation:** The `/zY/` CDN tier is not uniform — URLs in this tier can be 622×508 or 800×516 depending on what the detail page returns. Some products may be source-limited on Bikester's side and will not improve beyond 622×508. This cannot be resolved from our side. The correct claim is that all active Bikester listings avoid the low-res 311px `/mQ/` thumbnail tier; not that all images are 800×516.
- **EBIKE scope Phase 1 cleanup (commit cc9d522, 2026-05-14):**
  - **Purpose:** Remove clearly out-of-scope e-bike families from the catalog — folding, city, commuter, trekking, and utility e-bikes that do not belong regardless of which store carries them.
  - **Implementation:** 16 model-family keywords added to `OUT_OF_SCOPE_BIKE_KEYWORDS` in `src/ingestion/normalizer/category.ts` — not a Bikester-specific scraper hack. Patterns are globally correct and will apply to any future store selling the same families.
  - **Patterns:** `sammenleggbar`, `district+`, `charter+`, `allant+`, `verve+`, `kemen`, `diem`, `kathmandu`, `nuride`, `compact hybrid`, `editor hybrid`, `ebig.tour`, `efloat`, `crossride`, `superior eway`, `iblox`.
  - **Safety validation:** Simulated against 27 sport e-bike canary titles (Cube Reaction/Stereo Hybrid, Trek Rail+/Fuel+/Powerfly, Merida eBig.Nine/eOne-Sixty, Orbea Rise/Wild/Gain, Rock Machine Blizz/Torrent, Superior eXR/eXF/eXP, BH iLynx+, and others) with zero false positives before implementation.
  - **Real ingestion result:** Active Phase 1 matches 128 → 0, active Bikester listings 1101 → 973, EBIKE 468 → 340, MTB 508 → 508, ROAD 114 → 114, GRAVEL 11 → 11. below-5%/scooters/BMX/X-road-in-ROAD all remained at 0. Runner deactivated 128 listings. ScrapeJob status: SUCCESS.
- **QA status: In QA — not approved.** Remaining open issues:
  - ~~Image quality~~ — resolved: imageConfident preservation fix implemented and high-cap cleanup completed. Residual limitation: some `/zY/` images may be 622×508 rather than 800×516 due to source constraints on Bikester's side.
  - ~~Decide and implement EBIKE scope~~ — Phase 1 resolved (commit cc9d522): 16 out-of-scope model families excluded via shared normalizer; active EBIKE reduced from 468 to 340.
  - EBIKE scope Phase 2 remains: evaluate Vibe, FX+, Skeppshult, Batavus, Made, Kronan, Tenways, Tunturi, Birk E-One/E-SUV, and borderline sport-adjacent models before further exclusions.
  - Investigate whether Bikester has a dedicated gravel category URL (currently none)
  - Investigate TT/triathlon category coverage
  - Investigate sale/outlet-only coverage vs full catalog
  - Manual sampling of active listings after final coverage and scope changes

---

## Current practical interpretation

- **Reliable stores:** `unaas`, `bikeshop`, `canyon`, `birk`, `sykkelbutikken`, `lillehammersport`, `poie`, `sykkeloutlet`
- For these stores, `isInStock` is derived from size data when sizes are present: `sizes.some(s => s.isInStock)`. If no size has `isInStock=true`, the listing is marked out-of-stock and excluded from the catalog by the eligibility gate.
- Products with all sizes out of stock are automatically excluded from catalog queries via `listingEligibility() → isInStock: true`.
- **Small residual no-size counts for Unaas (1) and Bikeshop (1) are expected and acceptable.** These are structurally unresolvable single-SKU products where no size data exists in any structured source. They appear in the catalog as in-stock but are not filterable by size.
- **Bikester is intentionally not on the same trust level.** Its size data cannot be used for availability gating.

---

## Recommended maintenance workflow

1. **After changing any scraper's size parser:** re-run ingestion for that store, then run `npx tsx scripts/qa-sizes.ts <slug>` to verify counts.
2. **After changing `RELIABLE_SIZE_STORES` or normalizer isInStock logic:** re-run all reliable stores and check that no-size counts and "all-OOS excluded" behavior remain correct.
3. **After changing the normalizer (categories, brands, scope rules):** re-run the affected store. The runner now refreshes `category`, `frameMaterial`, `gender`, and `isElectric` on every existing listing update, so normalization improvements take effect without a separate migration. Verify post-run counts against the pre-run snapshot.
4. **Treat unexpected increases in "isInStock=true, no sizes"** as an investigation trigger — run `npx tsx scripts/diag-no-sizes.ts <slug>` to identify affected listings, then fetch their live HTML to determine cause.
5. **Do not parse sizes from product titles** unless no structured source (variant API, JSON-LD, HTML select) exists and the title pattern is clearly safe and consistent across all products for that store. Title parsing introduces false-positive risk.
6. **Birk rate limits:** do not reduce `DETAIL_DELAY_MS` below 2500ms. If 429s recur, wait at least 30 minutes before re-running.
7. **Canyon stale-deactivation risk:** if Canyon detail-page fetches fail consistently (e.g. sustained rate limiting), products are not updated and will go stale after 7 days. Monitor for unexpected drops in Canyon listing count.
