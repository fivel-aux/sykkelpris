# New Store Onboarding Checklist

> Companion to `docs/new-store-onboarding.md`. Fill this in per store during implementation.

---

## Store

- **Store name:**
- **Domain:**
- **Slug:**
- **Date started:**
- **Owner / responsible:**
- **Target status:** Full candidate / Partial candidate / Skip

---

## Phase 0: Catalog scope check

- [ ] Store sells products that belong in the catalog (road, gravel, MTB, TT, sport e-bikes)
- [ ] Out-of-scope product mix assessed (scooters, BMX, cargo, city, commuter, accessories)
- [ ] If broad e-bike catalog: EBIKE scope explicitly decided and documented
- [ ] Decision: proceed / skip

---

## Phase 1: Pre-Audit

- [ ] Platform / source type identified
- [ ] Category and scope coverage mapped (which bike types, how many out-of-scope products)
- [ ] Listing pages inspected (server-rendered vs JS-rendered)
- [ ] Detail page need assessed (listing-only vs two-phase)
- [ ] Pricing reliability assessed (current price, old price, discount)
- [ ] Image and link stability assessed
- [ ] Product-level stock status assessed
- [ ] Size / variant data assessed (existence, structure, selector)
- [ ] Per-size stock status assessed
- [ ] Structured data checked (JSON-LD, script blobs, public API)
- [ ] Rate limiting / anti-bot risk assessed
- [ ] Implementation decision made

**Notes:**

**Verdict:** Full candidate / Partial candidate / Skip

---

## Phase 2: MVP

- [ ] Product name
- [ ] Product URL (stable, canonical)
- [ ] Product image
- [ ] Current price (NOK integer)
- [ ] Old / original price (if available)
- [ ] Discount (derived or explicit)
- [ ] Category correctly assigned
- [ ] Brand extracted (if available)
- [ ] Product-level stock status (if available)
- [ ] No broken links
- [ ] No wrong or placeholder images
- [ ] No wrong categories
- [ ] No out-of-scope products (scooters, BMX, cargo, city, accessories, etc.)
- [ ] No duplicate or junk listings

**Notes:**

---

## Phase 3: Full Standard

- [ ] Detail-page scraping added where needed
- [ ] Size extraction implemented (correct selector / source identified)
- [ ] Per-size stock extraction implemented
- [ ] Product-level `isInStock` logic reviewed (derived from sizes or scraper flag)
- [ ] All-size-OOS exclusion assessed and active if appropriate
- [ ] Failure-safe data preservation implemented (`sizesConfident` flag)
- [ ] Rerun behavior verified (no corruption, no duplicate size rows)
- [ ] Logging is clear (size count, in-stock count per product)

**Notes:**

---

## Phase 4: Trusted Size Store Assessment

- [ ] Size data is reliably available (structured, stable, consistent)
- [ ] Per-size stock status is reliably available
- [ ] Safe to derive `isInStock` from size data
- [ ] Safe to exclude listings where all sizes are out of stock
- [ ] Safe to include this store in the size filter

**Final classification:** Trusted / Lower-trust

**Notes:**

---

## Phase 5: QA

- [ ] Ingestion run completed (full scrape, no crashes)
- [ ] Pre-run and post-run active listing counts compared (record both)
- [ ] `npx tsx scripts/qa-sizes.ts <slug>` run and reviewed
- [ ] No `isInStock=true` while all sizes are OOS
- [ ] No `isInStock=false` while some sizes are in stock
- [ ] `isInStock=true, no sizes` cases reviewed and explained
- [ ] Product scope verified — no scooters, BMX, cargo, city, commuter, or accessories in active listings
- [ ] EBIKE listings spot-checked if store has a broad e-bike catalog
- [ ] Category distribution plausible for this store's actual inventory
- [ ] Manual listing-page checks done (multiple pages, multiple products)
- [ ] Manual detail-page checks done (multi-size, single-size / OS, partial OOS)
- [ ] Fully OOS product behavior verified (if source exposes one)
- [ ] Size filter behavior verified (if store is trusted)
- [ ] Store appears in the **Butikk** filter panel in the browser with correct name and non-zero count
- [ ] Selecting the store in the Butikk filter returns its listings correctly
- [ ] Store's listings visible in the main catalog when no store filter is active

**QA outcome:** QA-approved / QA-approved with limitations / Not QA-approved

**Notes:**

---

## Phase 6: Documentation

- [ ] Store entry added to `docs/store-parser-status.md`
- [ ] Size data source documented
- [ ] Reliability level documented
- [ ] Trusted size store status documented
- [ ] Known acceptable fallbacks documented
- [ ] Known caveats / failure modes documented
- [ ] Operational notes documented (delay settings, retry behavior, rate limit guidance)

**Notes:**

---

## Final Signoff

- **Ingestion runs without errors:** Yes / No
- **QA sizes script passed:** Yes / No
- **Store visible in Butikk filter with correct count:** Yes / No
- **Listings visible in catalog UI:** Yes / No
- **Documentation added to store-parser-status.md:** Yes / No
- **Ready for production:** Yes / No
- **Remaining issues:**
- **Follow-up tasks:**
- **Date completed:**
