import * as cheerio from "cheerio";
import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

const BASE_URL = "https://www.canyon.com";
const OUTLET_FIRST_PAGE = `${BASE_URL}/en-no/outlet-bikes/`;
const PAGE_SIZE = 24;
const FIRST_PAGE_COUNT = 22;
const DETAIL_DELAY_MS = 1000;
const RATE_LIMIT_BACKOFF_MS = 10_000;

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

        const sizes = parseDetailSizes(html);
        const inStockCount = sizes.filter((s) => s.isInStock).length;
        if (sizes.length === 0) {
          this.log(`  no sizes parsed — sizes will be preserved from DB`, "warn");
        } else {
          this.log(`  ${sizes.length} sizes parsed (${inStockCount} in stock)`);
        }

        const detailImageUrl = parseDetailImage(html);
        if (!detailImageUrl) {
          this.log(`  no product image found in detail page`, "warn");
        }

        results.push({
          externalId: candidate.externalId,
          externalUrl: candidate.externalUrl,
          rawTitle: candidate.rawTitle,
          originalPrice: prices.originalPrice,
          currentPrice: prices.currentPrice,
          imageUrl: detailImageUrl ?? candidate.imageUrl,
          rawCategory: candidate.rawCategory,
          rawBrand: "Canyon",
          isInStock: true, // outlet listings are live for-sale products
          sizes,
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
      const rawImageUrl =
        imgEl.attr("src") ||
        imgEl.attr("data-src") ||
        imgEl.attr("data-lazy-src") ||
        null;
      const imageUrl = rewriteCanyonImageUrl(rawImageUrl);

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
    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-NO,en;q=0.9,nb;q=0.8",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) return res.text();

      if (res.status === 429 && attempt === 1) {
        this.log(`Rate limited (429) — backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s before retry: ${url}`, "warn");
        await sleep(RATE_LIMIT_BACKOFF_MS);
        continue;
      }

      throw new Error(`CanyonScraper: HTTP ${res.status} for ${url}`);
    }

    throw new Error(`CanyonScraper: still rate limited after retry: ${url}`);
  }
}

/**
 * Extract the main product image from a Canyon detail page HTML.
 *
 * Canyon serves outlet products from two CDN systems:
 *   - Cloudinary:   dma.canyon.com/image/upload/...  (road/race bikes)
 *   - Demandware:   www.canyon.com/dw/image/...      (some gravel/MTB/e-bikes)
 *
 * og:image is the most reliable source — Canyon sets it to the hero product
 * image on all outlet product pages. Falls back to the first Cloudinary URL
 * found in the page body.
 *
 * Cloudinary URLs are passed through rewriteCanyonImageUrl to fix the 4:3
 * aspect ratio and canvas colour. Demandware URLs are returned as-is.
 *
 * Returns null (and logs a warning) when no Canyon CDN image is found, so
 * the caller can fall back to whatever was scraped from the listing page.
 */
function parseDetailImage(html: string): string | null {
  // 1. og:image — Canyon sets this to the hero product image on outlet pages
  const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  let url = ogMatch?.[1]?.trim() ?? null;

  // 2. twitter:image — same image, different meta tag
  if (!url) {
    const twMatch = html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/);
    url = twMatch?.[1]?.trim() ?? null;
  }

  // 3. First Cloudinary image URL in the body (product gallery fallback)
  if (!url) {
    const cdnMatch = html.match(/(https:\/\/dma\.canyon\.com\/image\/upload[^"'\s,]+)/);
    url = cdnMatch?.[1] ?? null;
  }

  if (!url) return null;

  // Decode HTML entities — og:image content often encodes & as &amp; in Demandware URLs
  url = url.replace(/&amp;/g, "&");

  // Cloudinary (dma.canyon.com) — always product-specific; normalise to 4:3 white canvas
  if (url.includes("dma.canyon.com")) return rewriteCanyonImageUrl(url);

  // Demandware (canyon.com/dw/image) — only accept product-specific images from the
  // master catalog. Reject storefront/category-landing paths which are generic
  // marketing shots used as fallback og:image on some pages (e.g. outlet hero banners).
  if (
    url.includes("canyon.com/dw/image") &&
    url.includes("Sites-canyon-master") &&
    !url.includes("category-landing")
  ) return url;

  return null;
}

/**
 * Extract per-size availability from Canyon's JSON-LD Product block.
 *
 * Canyon embeds a Schema.org Product in each detail page with one Offer per
 * size × color variant. Offer name format: "Product Name | Color Name | SIZE"
 * Size is always the last pipe-delimited segment.
 *
 * Canyon uses numeric-prefix notation for extreme sizes:
 *   "2XS" → "XXS",  "2XL" → "XXL",  "3XS" → "XXXS"
 *
 * Availability is OR-combined across color variants: a size is InStock if
 * any color for that size is InStock.
 *
 * Returns [] if the JSON-LD block is absent or unparseable.
 */
const CANYON_SIZE_RE = /^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3})$/i;

function normalizeCanyonSize(raw: string): string | null {
  const s = raw.trim()
    .replace(/^3XS$/i, "XXXS")
    .replace(/^2XS$/i, "XXS")
    .replace(/^2XL$/i, "XXL")
    .toUpperCase();
  return CANYON_SIZE_RE.test(s) ? s : null;
}

function parseDetailSizes(html: string): RawSize[] {
  try {
    const allMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    if (allMatches.length === 0) return [];

    let product: Record<string, unknown> | undefined;
    for (const m of allMatches) {
      let parsed: unknown;
      try { parsed = JSON.parse(m[1]); } catch { continue; }
      const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      product = items.find(
        (i): i is Record<string, unknown> =>
          typeof i === "object" && i !== null &&
          (i as Record<string, unknown>)["@type"] === "Product"
      );
      if (product) break;
    }
    if (!product) return [];

    // Build size map from JSON-LD offers whose names use the "Product | Color | SIZE" format.
    const offers = product["offers"];
    const sizeMap = new Map<string, boolean>();

    if (Array.isArray(offers)) {
      for (const offer of offers) {
        if (typeof offer !== "object" || offer === null) continue;
        const name = (offer as Record<string, unknown>)["name"];
        if (typeof name !== "string") continue;

        // Size is the last pipe-delimited segment
        const segments = name.split("|");
        const rawSize = segments[segments.length - 1]?.trim() ?? "";
        const label = normalizeCanyonSize(rawSize);
        if (!label) continue;

        const availability = String((offer as Record<string, unknown>)["availability"] ?? "");
        const inStock = availability.endsWith("InStock");
        sizeMap.set(label, (sizeMap.get(label) ?? false) || inStock);
      }
    }

    if (sizeMap.size > 0) {
      return [...sizeMap.entries()].map(([label, isInStock]) => ({ label, isInStock }));
    }

    // Fallback for Canyon Underdog / batch-number products where each offer is an
    // individual refurbished bike identified by batch number, not a size×color
    // variant. Offer names are plain product names with no "| SIZE" segment.
    // The currently-selected (default) variant's frame size is server-rendered
    // in the Frame Size picker heading and/or the variant type label.
    const $fb = cheerio.load(html);

    let fallbackSize: string | null = null;

    // Primary: "Frame Size:" label followed by its value span
    $fb(".colorPicker__headingLabel").each((_, el) => {
      if (!fallbackSize && $fb(el).text().trim().toLowerCase().startsWith("frame size")) {
        fallbackSize = $fb(el).siblings(".colorPicker__headingValue").first().text().trim() || null;
      }
    });

    // Secondary: variant type text in format "XL - #0001119409"
    if (!fallbackSize) {
      const variantText = $fb(".productConfiguration__selectVariantType").first().text().trim();
      const m = variantText.match(/^(.+?)\s*-\s*#/);
      if (m) fallbackSize = m[1].trim();
    }

    if (fallbackSize) {
      const label = normalizeCanyonSize(fallbackSize);
      if (label) return [{ label, isInStock: true }];
    }

    return [];
  } catch {
    return [];
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize a Canyon Cloudinary image URL to 4:3 card proportions with a white canvas.
 *
 * Canyon serves images with hardcoded Cloudinary transforms, e.g.:
 *   /image/upload/w_511,h_288,c_fit/b_rgb:F2F2F2/f_auto/q_auto/v.../filename  (listing, 16:9)
 *   /image/upload/w_1145,h_645,c_fit/f_auto/q_auto/v.../filename              (og:image, 16:9)
 *
 * We normalise all Cloudinary URLs to w_511,h_383 (4:3 ≈ 1.33:1), with a white
 * canvas fill so the bike renders cleanly on a white card background.
 *
 * Demandware URLs (canyon.com/dw/image) are returned unchanged — they don't use
 * Cloudinary transforms and are already acceptable quality for card display.
 *
 * Returns the original URL unchanged if it doesn't match the expected pattern,
 * so this is safe to call on any URL.
 */
function rewriteCanyonImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes("dma.canyon.com")) return url;

  return url
    .replace(/\bw_\d+\b/, "w_511")                      // normalize width
    .replace(/\bh_\d+\b/, "h_383")                      // 4:3 to match w_511
    .replace(/\bb_rgb:[0-9A-Fa-f]+\b/, "b_rgb:FFFFFF"); // white canvas fill
}
