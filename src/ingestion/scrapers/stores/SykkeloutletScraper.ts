import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

/**
 * Scraper for Sykkeloutlet (sykkeloutlet.no).
 *
 * Platform: Shopify — fully server-rendered, Shopify JSON API available.
 *
 * Strategy — single-phase, broad products feed with client-side filtering:
 *   Fetch /products.json (full catalogue, paginated by 250).
 *   Filter client-side for:
 *     1. Bike products (BIKE_RE against product_type and tags)
 *     2. Discounted products (at least one variant with compare_at_price > price)
 *
 *   This store is a dedicated clearance/outlet shop — no dedicated sale collection
 *   exists. The full products feed is the correct source.
 *
 * Source verified (2026-05-02):
 *   /products.json → 200, 12–15 products (full rotating outlet catalogue)
 *   Named collections (all, de-beste-tilbudene, etc.) → all empty
 *
 * Bike detection: product_type is blank for most products. Tags are the
 *   reliable signal — BIKE_RE is applied to both product_type and all tags.
 *
 * Discount gate: at least one variant must have compare_at_price set and
 *   greater than price. Products without any discounted variant are skipped.
 *
 * Size extraction: option name is inconsistently spelled across products:
 *   - "Størrelse" (correct)
 *   - "Størrlese" (typo — Cube Attention)
 *   - "Sørrelse"  (typo — Cube Litening Aero)
 *   - "Size"      (English)
 *   Rather than matching the option name, we scan option1/option2/option3 in
 *   order and take the first value that passes SIZE_RE. This approach is robust
 *   to all typo variants because SIZE_RE naturally rejects color values
 *   ("Blue", "Silver", etc.) and non-size strings.
 *
 * Per-size stock: variant.available (boolean) — Shopify native field.
 *   sizesConfident is always true — single-phase, no partial failures.
 *
 * externalId: product.handle — stable Shopify slug.
 */

const BASE_URL = "https://www.sykkeloutlet.no";
const PRODUCTS_URL = `${BASE_URL}/products.json`;

// Matches bike-vocabulary in product_type or tags.
// product_type is often blank so tags are the primary signal.
// Covers: sykkel, terrengsykkel, landeveissykkel, gravelsykkel, el-sykkel,
//   elektriskfulldemper, fulldemper, hardtail, stisykkel, bike, etc.
const BIKE_RE =
  /sykkel|bike|terreng|landevei|gravel|hybrid|fulldemper|hardtail|stisykkel|el[-\s]/i;

export class SykkeloutletScraper extends BaseScraper {
  constructor(store: Store) {
    super(store);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    this.log("Source: /products.json (full catalogue, client-side filtered)");

    const all = await this.fetchAllProducts();
    this.log(`${all.length} total products fetched`);

    const bikes = all.filter(
      (p) =>
        BIKE_RE.test(p.product_type ?? "") ||
        p.tags.some((t) => BIKE_RE.test(t))
    );
    this.log(`${bikes.length} bike products found`);

    const results: RawProduct[] = [];
    let skippedNoDiscount = 0;
    let skippedAllOos = 0;

    for (const p of bikes) {
      const parsed = parseProduct(p);
      if (!parsed) {
        skippedNoDiscount++;
        continue;
      }
      if (!parsed.isInStock && (parsed.sizes?.length ?? 0) > 0) {
        skippedAllOos++;
      }
      results.push(parsed);
    }

    this.log(
      `${results.length} discounted bikes ` +
        `(${skippedNoDiscount} skipped — no discount; ${skippedAllOos} all sizes OOS)`
    );
    return results;
  }

  private async fetchAllProducts(): Promise<ShopifyProduct[]> {
    const all: ShopifyProduct[] = [];
    let page = 1;

    while (true) {
      const url = `${PRODUCTS_URL}?limit=250&page=${page}`;
      const data = await this.fetchJson(url);
      if (!data || data.products.length === 0) break;

      all.push(...data.products);
      this.log(`Page ${page}: ${data.products.length} products`);

      if (data.products.length < 250) break;
      page++;
    }

    return all;
  }

  private async fetchJson(
    url: string
  ): Promise<ShopifyCollectionResponse | null> {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ShopifyCollectionResponse>;
    } catch (err) {
      this.log(`fetchJson failed for ${url}: ${err}`, "warn");
      return null;
    }
  }
}

// ── Product parser ─────────────────────────────────────────────────────────────

function parseProduct(p: ShopifyProduct): RawProduct | null {
  // Discount gate: at least one variant must have compare_at_price > price
  const discountedVariants = p.variants.filter((v) => {
    const cap = parseFloat(v.compare_at_price ?? "");
    const price = parseFloat(v.price);
    return !isNaN(cap) && cap > price;
  });
  if (discountedVariants.length === 0) return null;

  // Product-level price: use the cheapest discounted variant
  const cheapest = discountedVariants.reduce((min, v) =>
    parseFloat(v.price) < parseFloat(min.price) ? v : min
  );
  const currentPrice = Math.round(parseFloat(cheapest.price));
  const originalPrice = Math.round(parseFloat(cheapest.compare_at_price!));

  if (currentPrice < 3_000 || originalPrice > 500_000) return null;

  // Size extraction: scan option1/option2/option3 in order, take the first
  // value that passes SIZE_RE. This handles all observed option-name typo
  // variants ("Størrlese", "Sørrelse") without needing to match the name —
  // SIZE_RE rejects colors and non-size strings naturally.
  const sizes: RawSize[] = p.variants.flatMap((v) => {
    const label =
      parseSize(v.option1) ?? parseSize(v.option2) ?? parseSize(v.option3);
    if (!label) return [];
    return [{ label, isInStock: v.available }];
  });

  return {
    externalId: p.handle,
    externalUrl: `${BASE_URL}/products/${p.handle}`,
    rawTitle: p.title,
    rawBrand: p.vendor || null,
    // Concatenate product_type + tags so the category classifier can use
    // bike vocabulary from tags when product_type is blank (which is common
    // on this store — most products have empty product_type).
    rawCategory: [p.product_type, ...p.tags].filter(Boolean).join(" ") || null,
    currentPrice,
    originalPrice,
    imageUrl: p.images[0]?.src ?? null,
    isInStock: p.variants.some((v) => v.available),
    sizes,
    sizesConfident: true,
    description: null,
    scrapedAt: new Date(),
  };
}

// ── Size helpers ──────────────────────────────────────────────────────────────

// Matches the size token after all pre-processing. Parentheticals are stripped
// before this regex runs, so the optional group is kept only as a safety net.
const SIZE_RE =
  /^(XXS|XS|S|M|L|XL|XXL|XXXL|OS|\d{2,3}|[A-Z][1-9])(\s*\([^)]*\))?$/i;

function parseSize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();

  // Normalise spelled-out sizes at the start of the string:
  //   "Medium (170-180cm)" → "M (170-180cm)"
  s = s.replace(/^medium\b/i, "M")
       .replace(/^small\b/i,  "S")
       .replace(/^large\b/i,  "L")
       .replace(/^x-large\b/i, "XL")
       .replace(/^x-small\b/i, "XS");

  // Normalise embedded "cm" attached to digits: "43cm" → "43"
  // Handles "43cm (S 165-175cm)" → "43 (S 165-175)"
  s = s.replace(/(\d+)\s*cm\b/gi, "$1");

  // Strip leading height-range parenthetical (reversed format):
  //   "(150-160) 47" → "47"
  s = s.replace(/^\(\d[^)]*\)\s*/, "");

  // Strip everything from the first "(" onwards — handles both normal
  // parentheticals and unclosed ones: "XL (185-195" → "XL"
  s = s.replace(/\s*\(.*$/, "").trim();

  const m = s.match(SIZE_RE);
  return m ? m[1].toUpperCase() : null;
}

// ── Shopify types ─────────────────────────────────────────────────────────────

interface ShopifyVariant {
  id: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  price: string;
  compare_at_price: string | null;
  available: boolean;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: ShopifyVariant[];
  images: { src: string }[];
}

interface ShopifyCollectionResponse {
  products: ShopifyProduct[];
}
