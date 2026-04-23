import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

/**
 * Scraper for XXL (xxl.no).
 *
 * Strategy: XXL exposes a product search API used by their own website.
 * We hit the API directly rather than parsing HTML — more reliable and faster.
 *
 * NOTE: This is a skeleton implementation. The real API endpoint and
 * response shape need to be confirmed by inspecting xxl.no network traffic.
 * Adapt `API_URL` and the mapping in `mapProduct` to match the actual response.
 */

const API_URL =
  "https://www.xxl.no/api/products/search?q=sykkel&category=sykkel&size=100&page=0";

interface XXLApiProduct {
  code: string;
  name: string;
  url: string;
  price: { value: number; formattedValue: string };
  wasPrice?: { value: number; formattedValue: string };
  images: Array<{ url: string; format: string }>;
  summary?: string;
  variantOptions?: Array<{
    displaySizeValue: string;
    stock: { stockLevel: number };
  }>;
  categories?: Array<{ name: string }>;
  brandName?: string;
}

interface XXLApiResponse {
  products: XXLApiProduct[];
  pagination: { totalNumberOfResults: number; currentPage: number; numberOfPages: number };
}

export class XXLScraper extends BaseScraper {
  constructor(store: Store) {
    super(store);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    const allProducts: RawProduct[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const url = `https://www.xxl.no/api/products/search?q=sykkel&category=sykkel&size=100&page=${page}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Sykkelpris/1.0)",
          Accept: "application/json",
        },
        // 10 second timeout
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`XXL API returned ${response.status} for page ${page}`);
      }

      const data = (await response.json()) as XXLApiResponse;
      const mapped = data.products.map((p) => this.mapProduct(p));
      allProducts.push(...mapped);

      this.log(`Page ${page}: ${mapped.length} products (total so far: ${allProducts.length})`);

      page++;
      hasMore = page < data.pagination.numberOfPages;

      // Polite delay between pages
      if (hasMore) {
        await sleep(500);
      }
    }

    return allProducts;
  }

  private mapProduct(p: XXLApiProduct): RawProduct {
    const currentPrice = p.price.value;
    const originalPrice = p.wasPrice?.value ?? p.price.value;

    const primaryImage =
      p.images.find((img) => img.format === "product") ??
      p.images[0];

    const sizes: RawSize[] = (p.variantOptions ?? []).map((v) => ({
      label: v.displaySizeValue,
      isInStock: v.stock.stockLevel > 0,
      quantity: v.stock.stockLevel,
    }));

    return {
      externalId: p.code,
      externalUrl: `https://www.xxl.no${p.url}`,
      rawTitle: p.name,
      originalPrice,
      currentPrice,
      imageUrl: primaryImage?.url ?? null,
      description: p.summary ?? null,
      sizes,
      rawCategory: p.categories?.[0]?.name ?? null,
      rawBrand: p.brandName ?? null,
      isInStock: sizes.some((s) => s.isInStock),
      scrapedAt: new Date(),
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
