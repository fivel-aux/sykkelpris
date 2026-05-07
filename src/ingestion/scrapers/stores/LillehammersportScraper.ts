import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

/**
 * Scraper for Lillehammer Sport (lillehammersport.no).
 *
 * Platform: WooCommerce 10.7.0 on WordPress — server-rendered shell with
 * product grids loaded client-side via WooCommerce Store REST API.
 *
 * Strategy — API-first, two-phase:
 *   Phase 1 (listing): paginate /wp-json/wc/store/products?on_sale=true
 *     - Filter to bike categories via BIKE_CATEGORY_SLUGS allowlist
 *     - Parse externalId, permalink, name, prices, image, is_in_stock
 *     - Prices in minor units (÷100 → NOK integer)
 *   Phase 2 (variations): per product, fetch each variation ID individually
 *     - /wp-json/wc/store/products/{variation_id} (not /variations — 404s)
 *     - attributes[].name "Size"/"Størrelse" → size label
 *     - is_in_stock → per-size stock boolean
 *     - sizesConfident=false if any variation fetch fails → DB state preserved
 *
 * Bike category slugs verified against live API (2026-04-30):
 *   sykkel, elsykkel, el-hybridsykkel, el-terrengsykkel,
 *   landevei-og-gravel, hardtail, fulldempet, terrengsykkel,
 *   gravelsykkel, landevei, hybrid
 *
 * Trusted-size-store status: PENDING — per-variation is_in_stock is available
 * and structured, but requires QA before committing to reliable status.
 *
 * externalId: String(product.id) — stable numeric WooCommerce product ID.
 */

const BASE_URL = "https://www.lillehammersport.no";
const API_BASE = `${BASE_URL}/wp-json/wc/store`;

// Category slugs indicating a complete bike (not accessories, apparel, or parts).
// These are compared against every slug in product.categories[].slug.
// A product is included if ANY of its categories matches.
const BIKE_CATEGORY_SLUGS = new Set([
  "sykkel",
  "elsykkel",
  "el-hybridsykkel",
  "el-terrengsykkel",
  "landevei-og-gravel",
  "hardtail",
  "fulldempet",
  "terrengsykkel",
  "gravelsykkel",
  "landevei",
  "hybrid",
]);

// Children's bikes are priced under MIN_PRICE_NOK anyway, but explicitly
// excluded here to avoid misleading category assignments.
const EXCLUDED_CATEGORY_SLUGS = new Set([
  "barnesykkel",
  "unisex-barnesykkel",
  "balance-sykkel",
]);

const PAGE_DELAY_MS = 600;
const VARIATION_DELAY_MS = 350;
const RATE_LIMIT_BACKOFF_MS = 12_000;
const PER_PAGE = 100;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

export class LillehammersportScraper extends BaseScraper {
  constructor(store: Store) {
    super(store);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    const all = await this.fetchAllOnSale();
    this.log(`${all.length} on-sale products from API`);

    const bikes = all.filter(isBikeProduct);
    this.log(`${bikes.length} bikes after category filter`);

    const results: RawProduct[] = [];

    for (let i = 0; i < bikes.length; i++) {
      const p = bikes[i];
      const parsed = await this.parseProduct(p, i + 1, bikes.length);
      if (parsed) results.push(parsed);
    }

    return results;
  }

  private async fetchAllOnSale(): Promise<WcProduct[]> {
    const all: WcProduct[] = [];
    let page = 1;

    while (true) {
      const url = `${API_BASE}/products?on_sale=true&per_page=${PER_PAGE}&page=${page}`;
      const data = await this.fetchJson<WcProduct[]>(url);

      if (!data || data.length === 0) break;

      all.push(...data);
      this.log(`Page ${page}: ${data.length} products`);
      if (data.length < PER_PAGE) break;

      page++;
      await sleep(PAGE_DELAY_MS);
    }

    return all;
  }

  private async parseProduct(
    p: WcProduct,
    index: number,
    total: number
  ): Promise<RawProduct | null> {
    const currentPrice = parseWcPrice(p.prices.price);
    const originalPrice = parseWcPrice(p.prices.regular_price);

    if (currentPrice === null || originalPrice === null) {
      this.log(
        `  ${p.name}: unparseable prices (${p.prices.price} / ${p.prices.regular_price}) — skipped`,
        "warn"
      );
      return null;
    }

    if (currentPrice < 3_000 || originalPrice > 500_000) {
      this.log(
        `  ${p.name}: price out of range (${currentPrice} / ${originalPrice}) — skipped`
      );
      return null;
    }

    if (originalPrice <= currentPrice) {
      this.log(`  ${p.name}: no real discount (${currentPrice} / ${originalPrice}) — skipped`);
      return null;
    }

    const rawCategory = bestCategoryHint(p.categories);
    const imageUrl = p.images[0]?.src ?? null;
    const variations = p.variations ?? [];

    let sizes: RawSize[] = [];
    let sizesConfident = false;

    if (variations.length > 0) {
      this.log(`  ${index}/${total} ${p.name}: fetching stock for ${variations.length} variations`);
      const result = await this.fetchVariationSizes(variations);
      sizes = result.sizes;
      sizesConfident = result.confident;
      const inStock = sizes.filter((s) => s.isInStock).length;
      this.log(
        `  → ${sizes.length} sizes (${inStock} in stock), confident=${sizesConfident}`
      );
    } else {
      // Non-variable product — no size picker; treat size data as known-empty
      sizesConfident = true;
      this.log(`  ${index}/${total} ${p.name}: simple product, no variations`);
    }

    return {
      externalId: String(p.id),
      externalUrl: p.permalink,
      rawTitle: p.name,
      rawCategory,
      currentPrice,
      originalPrice,
      imageUrl,
      isInStock: p.is_in_stock,
      sizes,
      sizesConfident,
      description: null,
      scrapedAt: new Date(),
    };
  }

  private async fetchVariationSizes(
    variations: Array<{ id: number; attributes: Array<{ name: string; value: string }> }>
  ): Promise<{ sizes: RawSize[]; confident: boolean }> {
    const sizes: RawSize[] = [];
    let allSucceeded = true;

    for (let i = 0; i < variations.length; i++) {
      const v = variations[i];

      // Size label comes from the PARENT product's variations array.
      // Individual variation fetches return attributes: [] — always empty on this store.
      const sizeAttr = (v.attributes ?? []).find((a) =>
        /^(size|størrelse)$/i.test(a.name.trim())
      );

      if (!sizeAttr) {
        // Not a size variation (color-only, etc.) — skip without fetching
        continue;
      }

      const label = normalizeSizeLabel(sizeAttr.value);
      if (!label) continue;

      // Fetch the individual variation only for its stock status
      const url = `${API_BASE}/products/${v.id}`;
      const detail = await this.fetchJson<WcVariation>(url);

      if (!detail) {
        this.log(`    variation ${v.id} (${label}): stock fetch failed`, "warn");
        allSucceeded = false;
        if (i < variations.length - 1) await sleep(VARIATION_DELAY_MS);
        continue;
      }

      sizes.push({ label, isInStock: detail.is_in_stock });

      if (i < variations.length - 1) await sleep(VARIATION_DELAY_MS);
    }

    return { sizes, confident: allSucceeded };
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: FETCH_HEADERS,
          signal: AbortSignal.timeout(15_000),
        });

        if (res.status === 404) return null;
        if (res.status === 429) {
          if (attempt === 1) {
            this.log(
              `Rate limited (429) — backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s`,
              "warn"
            );
            await sleep(RATE_LIMIT_BACKOFF_MS);
            continue;
          }
          this.log(`Rate limited on retry — skipping ${url}`, "warn");
          return null;
        }
        if (!res.ok) {
          this.log(`HTTP ${res.status} for ${url}`, "warn");
          return null;
        }

        return res.json() as Promise<T>;
      } catch (err) {
        this.log(`fetchJson failed for ${url}: ${err}`, "warn");
        return null;
      }
    }
    return null;
  }
}

// ── Category helpers ──────────────────────────────────────────────────────────

function isBikeProduct(p: WcProduct): boolean {
  const slugs = p.categories.map((c) => c.slug);
  if (slugs.some((s) => EXCLUDED_CATEGORY_SLUGS.has(s))) return false;
  return slugs.some((s) => BIKE_CATEGORY_SLUGS.has(s));
}

/**
 * Pick the most specific category slug and map it to a rawCategory string
 * the normalizer's category classifier can work with.
 */
function bestCategoryHint(categories: WcCategory[]): string {
  const slugs = categories.map((c) => c.slug);

  if (slugs.some((s) => /^el-(terreng|hybrid)sykkel$/.test(s) || s === "elsykkel")) {
    return "elsykkel";
  }
  if (slugs.some((s) => s === "hardtail" || s === "fulldempet" || s === "terrengsykkel")) {
    return "terrengsykkel";
  }
  if (slugs.some((s) => s === "gravelsykkel")) {
    return "gravelsykkel";
  }
  if (slugs.some((s) => s === "landevei-og-gravel")) {
    // Mixed slug — product name will disambiguate in category classifier
    return "landevei gravelsykkel";
  }
  if (slugs.some((s) => s === "landevei")) {
    return "landevei sykkel";
  }

  return "sykkel";
}

// ── Size helpers ──────────────────────────────────────────────────────────────

// Accepts:
//   Standard letter sizes: XS, S, M, L, XL, XXL, etc.
//   Numeric frame sizes:   2–3 digit numbers (52, 54, 56…)
//   Brand alphanumeric:    [letter][digit] codes — Specialized S1–S6, Trek R1–R3, etc.
// Optional parenthetical suffix is stripped: "L (180-190cm)" → "L"
const SIZE_RE =
  /^(XXS|XS|S|M|L|XL|XXL|XXXL|OS|\d{2,3}|[A-Z][1-9])(\s*\([^)]*\))?$/i;

function normalizeSizeLabel(raw: string): string | null {
  if (!raw) return null;
  const m = raw.trim().match(SIZE_RE);
  return m ? m[1].toUpperCase() : null;
}

// ── Price helper ──────────────────────────────────────────────────────────────

/**
 * Parse WooCommerce Store API price strings.
 * The API returns prices in minor currency units (hundredths of NOK).
 * "104990" → 1049 NOK (rounded to integer).
 */
function parseWcPrice(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n / 100);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── WooCommerce Store API types ───────────────────────────────────────────────

interface WcCategory {
  id: number;
  name: string;
  slug: string;
}

interface WcProduct {
  id: number;
  name: string;
  type: string;
  permalink: string;
  on_sale: boolean;
  is_in_stock: boolean;
  prices: {
    price: string;
    regular_price: string;
    sale_price: string;
    currency_code: string;
  };
  categories: WcCategory[];
  images: Array<{ id: number; src: string }>;
  // The listing API includes attribute data on each variation entry.
  // Individual variation fetches return attributes: [] — always empty.
  variations: Array<{ id: number; attributes: Array<{ name: string; value: string }> }>;
}

interface WcVariation {
  id: number;
  is_in_stock: boolean;
  is_purchasable: boolean;
  attributes: Array<{ name: string; value: string }>;
}
