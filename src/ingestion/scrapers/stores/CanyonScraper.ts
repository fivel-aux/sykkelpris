import * as cheerio from "cheerio";
import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct } from "../types";

const BASE_URL = "https://www.canyon.com";
const OUTLET_FIRST_PAGE = `${BASE_URL}/en-no/outlet-bikes/`;
const PAGE_SIZE = 24;
const FIRST_PAGE_COUNT = 22;
const DETAIL_DELAY_MS = 1000;

const SKIP_PATH_SEGMENTS = ["refurbished-used", "gear", "accessories", "pro-bikes", "clothing"];
const SKIP_TITLE_WORDS = ["frameset"];

// Bike URL path segments that map to a known category — only these pass through
const BIKE_PATH_SEGMENTS = [
  "/road-bikes/",
  "/mountain-bikes/",
  "/gravel-bikes/",
  "/e-bikes/",
  "/triathlon-bikes/",
];

interface CandidateTile {
  externalId: string;
  externalUrl: string;
  rawTitle: string;
  rawCategory: string;
  imageUrl: string | null;
}

function categoryFromUrl(url: string): string | null {
  // Return strings that classifyCategory() in the normalizer can keyword-match against
  if (url.includes("/road-bikes/")) return "road bike";
  if (url.includes("/triathlon-bikes/")) return "triathlon bike";
  if (url.includes("/mountain-bikes/")) return "mountain bike";
  if (url.includes("/gravel-bikes/")) return "gravel bike";
  if (url.includes("/e-bikes/")) return "e-bike";
  return null;
}

function canonicalUrl(href: string): string {
  const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
  const u = new URL(url);
  u.search = "";
  return u.toString();
}

function productIdFromUrl(url: string): string | null {
  const match = url.match(/\/(\d+)\.html/);
  return match ? match[1] : null;
}

function isBikeUrl(url: string): boolean {
  return BIKE_PATH_SEGMENTS.some((seg) => url.includes(seg));
}

function shouldSkip(url: string, title: string): boolean {
  const lowerUrl = url.toLowerCase();
  if (SKIP_PATH_SEGMENTS.some((seg) => lowerUrl.includes(`/${seg}/`))) return true;
  const lowerTitle = title.toLowerCase();
  if (SKIP_TITLE_WORDS.some((w) => lowerTitle.includes(w))) return true;
  return false;
}

export class CanyonScraper extends BaseScraper {
  constructor(store: Store) {
    super(store);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    // Phase 1: collect candidate bike URLs from all listing pages
    const candidates = await this.collectCandidates();
    this.log(`Collected ${candidates.length} bike candidates`);

    // Phase 2: fetch each detail page and extract prices
    const results: RawProduct[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      this.log(`Detail ${i + 1}/${candidates.length}: ${candidate.rawTitle}`);

      try {
        const html = await this.fetchHtml(candidate.externalUrl);
        const prices = this.parseDetailPrices(html);

        if (prices === null) {
          this.log(`  skipped — no price data`, "warn");
          continue;
        }

        results.push({
          externalId: candidate.externalId,
          externalUrl: candidate.externalUrl,
          rawTitle: candidate.rawTitle,
          originalPrice: prices.originalPrice,
          currentPrice: prices.currentPrice,
          imageUrl: candidate.imageUrl,
          rawCategory: candidate.rawCategory,
          rawBrand: "Canyon",
          isInStock: true, // outlet listings are live for-sale products
          scrapedAt: new Date(),
        });
      } catch (err) {
        this.log(`  failed — ${err instanceof Error ? err.message : err}`, "warn");
      }

      if (i < candidates.length - 1) await sleep(DETAIL_DELAY_MS);
    }

    // Phase 3: keep only genuinely discounted bikes
    const discounted = results.filter(
      (p) =>
        p.originalPrice !== null &&
        p.currentPrice !== null &&
        p.currentPrice < p.originalPrice
    );

    this.log(`Done. ${results.length} priced, ${discounted.length} genuinely discounted`);
    return discounted;
  }

  /**
   * Collect candidate bike tiles from all outlet listing pages.
   * Public for isolated testing.
   */
  public async collectCandidates(): Promise<CandidateTile[]> {
    const seen = new Set<string>();
    const candidates: CandidateTile[] = [];

    const addBatch = (tiles: CandidateTile[]) => {
      for (const t of tiles) {
        if (!seen.has(t.externalId)) {
          seen.add(t.externalId);
          candidates.push(t);
        }
      }
    };

    const firstHtml = await this.fetchHtml(OUTLET_FIRST_PAGE);
    const firstBatch = this.parseTiles(firstHtml);
    addBatch(firstBatch);
    this.log(`Listing page 1: ${firstBatch.length} tiles`);

    let pageNum = 1;
    let start = FIRST_PAGE_COUNT;

    while (true) {
      const url =
        `${BASE_URL}/en-no/outlet-bikes/?srule=outlet_high_stock` +
        `&start=${start}&sz=${PAGE_SIZE}&searchredirect=false&searchType=bikes&pn=${pageNum}`;

      const html = await this.fetchHtml(url);
      const batch = this.parseTiles(html);
      if (batch.length === 0) break;

      addBatch(batch);
      this.log(`Listing page ${pageNum + 1}: ${batch.length} tiles`);

      pageNum++;
      start += PAGE_SIZE;
      await sleep(400);
    }

    return candidates;
  }

  /**
   * Parse bike candidate tiles from a listing page HTML.
   * Excludes non-bike entries. Public for isolated testing.
   */
  public parseTiles(html: string): CandidateTile[] {
    const $ = cheerio.load(html);
    const tiles: CandidateTile[] = [];

    $("a.productTileDefault__imageLink").each((_i, el) => {
      const href = $(el).attr("href") ?? "";
      const ariaLabel = $(el).attr("aria-label") ?? "";

      // aria-label format: "Product Name Price: 48.399 NOK"
      const ariaMatch = ariaLabel.match(/^(.+?)\s+Price:/i);
      const rawTitle = ariaMatch ? ariaMatch[1].trim() : "";

      if (!href || !rawTitle) return;

      const canonical = canonicalUrl(href);

      if (!isBikeUrl(canonical)) return;
      if (shouldSkip(canonical, rawTitle)) return;

      const externalId = productIdFromUrl(canonical);
      if (!externalId) return;

      const rawCategory = categoryFromUrl(canonical);
      if (!rawCategory) return; // allowlist and category map must stay in sync

      const imgEl = $(el).find("img").first();
      const imageUrl =
        imgEl.attr("src") ||
        imgEl.attr("data-src") ||
        imgEl.attr("data-lazy-src") ||
        null;

      tiles.push({
        externalId,
        externalUrl: canonical,
        rawTitle,
        rawCategory,
        imageUrl: imageUrl ?? null,
      });
    });

    return tiles;
  }

  /**
   * Extract current and original price from a Canyon product detail page.
   * Uses machine-readable data attributes — no Norwegian number parsing needed.
   * Returns null if the price element is not found.
   * Public for isolated testing.
   */
  public parseDetailPrices(html: string): { currentPrice: number; originalPrice: number } | null {
    const $ = cheerio.load(html);

    // data-product-price and data-list-price are always decimal strings (e.g. "36399.00")
    const priceEl = $("[data-product-price][data-list-price]").first();
    if (!priceEl.length) return null;

    const current = parseFloat(priceEl.attr("data-product-price") ?? "");
    const original = parseFloat(priceEl.attr("data-list-price") ?? "");

    if (isNaN(current) || isNaN(original)) return null;

    return {
      currentPrice: Math.round(current),
      originalPrice: Math.round(original),
    };
  }

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-NO,en;q=0.9,nb;q=0.8",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`CanyonScraper: HTTP ${res.status} for ${url}`);

    return res.text();
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
