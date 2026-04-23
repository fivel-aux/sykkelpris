import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

/**
 * Scraper for Bikester (bikester.no).
 *
 * Strategy: Bikester uses a Shopify-compatible JSON API.
 * Products available at /products.json with pagination via page parameter.
 * Filter to bikes only via product_type or tags.
 *
 * NOTE: Skeleton — adapt endpoints and field mapping to match the real API.
 */

interface BikesterProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: Array<{
    id: number;
    title: string;
    price: string;      // "12990.00"
    compare_at_price: string | null;
    inventory_quantity: number;
    option1: string | null; // size
  }>;
  images: Array<{ src: string; position: number }>;
}

interface BikesterResponse {
  products: BikesterProduct[];
}

const BIKE_PRODUCT_TYPES = [
  "Road Bike", "Gravel Bike", "Mountain Bike", "E-Bike", "Electric Bike",
  "TT Bike", "Triathlon Bike", "Sykkel", "Veisykkel", "Terrengsykkel",
];

export class BikesterScraper extends BaseScraper {
  constructor(store: Store) {
    super(store);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    const allProducts: RawProduct[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `https://www.bikester.no/products.json?limit=250&page=${page}`;
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Sykkelpris/1.0)" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Bikester API returned ${response.status}`);
      }

      const data = (await response.json()) as BikesterResponse;

      if (data.products.length === 0) {
        hasMore = false;
        break;
      }

      // Filter to bikes only
      const bikeProducts = data.products.filter((p) =>
        this.isBike(p)
      );

      allProducts.push(...bikeProducts.map((p) => this.mapProduct(p)));
      this.log(`Page ${page}: ${bikeProducts.length}/${data.products.length} bikes`);

      page++;
      hasMore = data.products.length === 250;
      if (hasMore) await sleep(300);
    }

    return allProducts;
  }

  private isBike(product: BikesterProduct): boolean {
    const typeMatch = BIKE_PRODUCT_TYPES.some(
      (t) => product.product_type.toLowerCase().includes(t.toLowerCase())
    );
    const tagMatch = product.tags.some((tag) =>
      ["sykkel", "bike", "bicycle", "vélo"].some((kw) =>
        tag.toLowerCase().includes(kw)
      )
    );
    return typeMatch || tagMatch;
  }

  private mapProduct(p: BikesterProduct): RawProduct {
    // Use the variant with the lowest compare_at_price as "original"
    const variants = p.variants;
    const firstVariant = variants[0];
    if (!firstVariant) {
      throw new Error(`No variants for product ${p.id}`);
    }

    const currentPrice = parseFloat(firstVariant.price);
    const originalPrice = firstVariant.compare_at_price
      ? parseFloat(firstVariant.compare_at_price)
      : currentPrice;

    const primaryImage = p.images.find((i) => i.position === 1) ?? p.images[0];

    // Each variant is a size
    const sizes: RawSize[] = variants.map((v) => ({
      label: v.option1 ?? v.title,
      isInStock: v.inventory_quantity > 0,
      quantity: v.inventory_quantity,
    }));

    // Strip HTML from description
    const description = p.body_html
      ? p.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : null;

    return {
      externalId: String(p.id),
      externalUrl: `https://www.bikester.no/products/${p.handle}`,
      rawTitle: p.title,
      originalPrice,
      currentPrice,
      imageUrl: primaryImage?.src ?? null,
      description,
      sizes,
      rawCategory: p.product_type,
      rawBrand: p.vendor,
      isInStock: sizes.some((s) => s.isInStock),
      scrapedAt: new Date(),
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
