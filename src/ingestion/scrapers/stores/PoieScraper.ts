import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

/**
 * Scraper for Peder Øie (poie.no).
 *
 * Platform: Shopify — fully server-rendered, Shopify JSON API available.
 *
 * Strategy — single-phase, broad products feed with client-side filtering:
 *   Fetch /products.json (all products, paginated by 250).
 *   Filter client-side for:
 *     1. Bike products (BIKE_RE against product_type and tags)
 *     2. Discounted products (at least one variant with compare_at_price > price)
 *
 *   /collections/salg was initially chosen but only exposes ~2 products in practice.
 *   The broader feed is the reliable source.
 *
 * Source verified (2026-04-30):
 *   /products.json → 200, full product catalogue
 *   /collections/salg → 200, only 2 products (too narrow)
 *
 * Discount gate: at least one variant must have compare_at_price set and
 *   greater than price. Products without any discounted variant are skipped.
 *
 * Size option: located dynamically by finding the Shopify option named
 *   "Størrelse" in product.options[]. Falls back to option1 if absent.
 *   "56 cm" notation is stripped to "56" before size validation.
 *
 * Per-size stock: variant.available (boolean) — Shopify native field.
 *   sizesConfident is always true — single-phase, no partial failures.
 *
 * externalId: product.handle — stable Shopify slug.
 */

const BASE_URL = "https://www.poie.no";
const PRODUCTS_URL = `${BASE_URL}/products.json`;

const BIKE_RE = /sykkel|bike|terreng|landevei|gravel|hybrid|el\s*-/i;

export class PoieScraper extends BaseScraper {
  constructor(store: Store) {
    super(store);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    this.log("Source: /products.json (full catalogue, client-side filtered)");

    const all = await this.fetchAllProducts();
    this.log(`${all.length} total products fetched`);

    const bikes = all.filter(
      (p) => BIKE_RE.test(p.product_type ?? "") || p.tags.some((t) => BIKE_RE.test(t))
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

  private async fetchJson(url: string): Promise<ShopifyCollectionResponse | null> {
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

  // Find the size option — "Størrelse" in Norwegian; fall back to first option
  const sizeOptionIdx = findSizeOptionIndex(p.options);

  // Sizes from ALL variants (not just discounted) so full stock picture is shown
  const sizes: RawSize[] = p.variants.flatMap((v) => {
    const raw = variantOption(v, sizeOptionIdx);
    const label = parseSize(raw);
    if (!label) return [];
    return [{ label, isInStock: v.available }];
  });

  return {
    externalId: p.handle,
    externalUrl: `${BASE_URL}/products/${p.handle}`,
    rawTitle: p.title,
    rawBrand: p.vendor || null,
    rawCategory: p.product_type || null,
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

/**
 * Return the 0-based index of the size option in product.options[].
 * Matches "Størrelse" (Norwegian) or "Size" (English). Defaults to 0.
 */
function findSizeOptionIndex(options: ShopifyOption[]): number {
  const idx = options.findIndex((o) => /^(størrelse|size)$/i.test(o.name.trim()));
  return idx !== -1 ? idx : 0;
}

/**
 * Read the variant's option value at the given 0-based option index.
 */
function variantOption(v: ShopifyVariant, index: number): string | null {
  if (index === 0) return v.option1;
  if (index === 1) return v.option2;
  if (index === 2) return v.option3;
  return v.option1;
}

// Accepts: standard letter sizes (XS–XXXL), numeric frame sizes (2–3 digits),
// proprietary codes like S1–S6 / R1–R3, OS. Optional parenthetical stripped.
const SIZE_RE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|OS|\d{2,3}|[A-Z][1-9])(\s*\([^)]*\))?$/i;

function parseSize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Strip trailing " cm" before matching numeric frame sizes: "56 cm" → "56"
  const cleaned = raw.trim().replace(/\s*cm$/i, "");
  const m = cleaned.match(SIZE_RE);
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

interface ShopifyOption {
  name: string;
  position: number;
  values: string[];
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: ShopifyVariant[];
  options: ShopifyOption[];
  images: { src: string }[];
}

interface ShopifyCollectionResponse {
  products: ShopifyProduct[];
}
