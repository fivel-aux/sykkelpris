import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

/**
 * Scraper for Unaas Cycling (unaascycling.no).
 *
 * Platform: Shopify (Impulse 3.4.0, shop unaas-cycling.myshopify.com).
 *
 * Strategy — single-phase, JSON API only:
 *   Fetch three sale/category collections via the standard Shopify
 *   /collections/{handle}/products.json endpoint. All pricing, sizing,
 *   image, and stock data is present in the JSON response — no detail
 *   page fetches required.
 *
 * Discount gate: at least one variant must have compare_at_price set and
 * greater than price. Full-price products are skipped silently.
 *
 * Collections verified against live site (2026-04):
 *   salg-landevei         → road bikes on sale
 *   salg-gravelsykkel     → gravel bikes on sale
 *   tempo-triathlon-sykkel → TT/triathlon bikes (mostly discounted)
 *
 * Pricing: variants[].price / compare_at_price — string decimals in NOK.
 * Sizes: variants[].option2, format "XL (186-196cm)" — strip height range.
 * Images: products[].images[0].src — Shopify CDN, no lazy loading.
 * Brand: products[].vendor — "Orbea" or "Wilier" in practice.
 */

const BASE_URL = "https://unaascycling.no";

// Triathlon first so products appearing in multiple collections (e.g. Wilier
// Supersonica) are classified as TT rather than road.
const COLLECTIONS: { handle: string; rawCategory: string }[] = [
  { handle: "tempo-triathlon-sykkel", rawCategory: "triathlon bike" },
  { handle: "salg-landevei", rawCategory: "road bike" },
  { handle: "salg-gravelsykkel", rawCategory: "gravel bike" },
];

export class UnaaScraper extends BaseScraper {
  constructor(store: Store) {
    super(store);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    const seenHandles = new Set<string>();
    const results: RawProduct[] = [];

    for (const { handle, rawCategory } of COLLECTIONS) {
      const url = `${BASE_URL}/collections/${handle}/products.json?limit=250`;
      this.log(`Fetching: ${handle}`);

      const data = await this.fetchJson(url);
      if (!data) continue;

      const products: ShopifyProduct[] = data.products ?? [];
      let discountedCount = 0;

      for (const p of products) {
        if (seenHandles.has(p.handle)) continue;

        const raw = parseProduct(p, rawCategory);
        if (!raw) continue;

        seenHandles.add(p.handle);
        results.push(raw);
        discountedCount++;
      }

      this.log(`${handle}: ${products.length} total, ${discountedCount} discounted`);
    }

    return results;
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

function parseProduct(p: ShopifyProduct, rawCategory: string): RawProduct | null {
  // Discount gate: keep only products where at least one variant is discounted
  const discountedVariants = p.variants.filter((v) => {
    const cap = parseFloat(v.compare_at_price ?? "");
    const price = parseFloat(v.price);
    return !isNaN(cap) && cap > price;
  });
  if (discountedVariants.length === 0) return null;

  // Use the cheapest discounted variant for the product-level prices
  const cheapest = discountedVariants.reduce((min, v) =>
    parseFloat(v.price) < parseFloat(min.price) ? v : min
  );
  const currentPrice = Math.round(parseFloat(cheapest.price));
  const originalPrice = Math.round(parseFloat(cheapest.compare_at_price!));

  // Sanity bounds for complete bikes in NOK
  if (currentPrice < 3_000 || originalPrice > 500_000) return null;

  // Size can be in any of the three option fields depending on the product.
  // Scan all three; parseSize rejects non-size values (colors, drivetrains, etc.).
  const sizes: RawSize[] = p.variants.flatMap((v) => {
    const label = parseSize(v.option1) ?? parseSize(v.option2) ?? parseSize(v.option3);
    if (!label) return [];
    return [{ label, isInStock: v.available }];
  });

  return {
    externalId: p.handle,
    externalUrl: `${BASE_URL}/products/${p.handle}`,
    rawTitle: p.title,
    rawBrand: p.vendor || null,
    rawCategory,
    currentPrice,
    originalPrice,
    imageUrl: p.images[0]?.src ?? null,
    isInStock: p.variants.some((v) => v.available),
    sizes,
    description: null,
    scrapedAt: new Date(),
  };
}

// Returns a clean size label or null if the value is not a recognizable bike size.
// Accepts: t-shirt labels (XS–XXL) and numeric frame sizes (two or three digits).
// Optional height range in parentheses is stripped: "XL (186-196cm)" → "XL".
// Rejects: colors, drivetrain strings, wheel specs, "Default Title", etc.
const SIZE_RE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3})(\s*\([^)]*\))?$/i;

function parseSize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(SIZE_RE);
  return m ? m[1].toUpperCase() : null;
}

// ── Shopify types ──────────────────────────────────────────────────────────────

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
  variants: ShopifyVariant[];
  images: { src: string }[];
}

interface ShopifyCollectionResponse {
  products: ShopifyProduct[];
}
