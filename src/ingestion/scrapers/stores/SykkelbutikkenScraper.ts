import * as cheerio from "cheerio";
import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

/**
 * Scraper for Sykkelbutikken (sykkelbutikken.no).
 *
 * Platform: PrestaShop — server-rendered HTML, no API required.
 *
 * Strategy — single phase (listing pages only):
 *   The listing page HTML contains everything needed:
 *     - Base product ID:  article[data-id-product]
 *     - Current price:   span.product-price[content]  (integer NOK, no parsing)
 *     - Original price:  span.regular-price            (only present when discounted)
 *     - Full-size image: img[data-full-size-image-url] (1000×1000 CDN URL)
 *     - Title:           h2.product-title > a
 *   No Phase 2 detail-page fetch required.
 *
 * Category URLs verified against live site (2026-04):
 *   MTB:     /15-terreng   (Fulldemper + Halvdemper subcategories)
 *   Road:    /18-landevei  (Landeveissykkel + Grussykkel subcategories)
 *   E-bike:  /29-elsykkel
 *
 * Pagination: ?page=N (24 products per page).
 *
 * Deduplication: a base product appears multiple times on the listing page
 * (once per colour/size variant). We keep only the first occurrence by
 * base product ID (data-id-product), which is stable across variants.
 */

const BASE_URL = "https://www.sykkelbutikken.no";

const CATEGORIES: { path: string; rawCategory: string }[] = [
  { path: "/15-terreng", rawCategory: "mountain bike" },
  { path: "/18-landevei", rawCategory: "road bike" },
  { path: "/29-elsykkel", rawCategory: "e-bike" },
];

const PAGE_DELAY_MS = 600;
const DETAIL_DELAY_MS = 1200;
const RATE_LIMIT_BACKOFF_MS = 10_000;
const MAX_PAGES = 30;

interface Candidate {
  externalId: string;
  externalUrl: string;
  rawTitle: string;
  rawCategory: string;
  currentPrice: number;
  originalPrice: number;
  imageUrl: string | null;
}

export class SykkelbutikkenScraper extends BaseScraper {
  constructor(store: Store) {
    super(store);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    const candidates = await this.collectCandidates();
    this.log(`${candidates.length} discounted candidates found`);

    const results: RawProduct[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      this.log(`Detail ${i + 1}/${candidates.length}: ${c.rawTitle}`);

      let sizes: RawSize[] = [];
      let sizesConfident = false;

      const detailHtml = await this.fetchHtml(c.externalUrl);
      if (detailHtml === null) {
        this.log(`  detail fetch failed — sizes+isInStock will be preserved from DB`, "warn");
      } else {
        sizesConfident = true;
        const $detail = cheerio.load(detailHtml);
        sizes = parseDetailSizes($detail);
        if (sizes.length === 0) {
          this.log(`  no sizes found on page — sizes preserved from DB`, "warn");
        } else {
          const inStockCount = sizes.filter((s) => s.isInStock).length;
          this.log(`  ${sizes.length} sizes parsed (${inStockCount} in stock)`);
        }
      }

      results.push({
        externalId: c.externalId,
        externalUrl: c.externalUrl,
        rawTitle: c.rawTitle,
        rawCategory: c.rawCategory,
        currentPrice: c.currentPrice,
        originalPrice: c.originalPrice,
        imageUrl: c.imageUrl,
        isInStock: true,
        sizes,
        sizesConfident,
        description: null,
        scrapedAt: new Date(),
      });

      if (i < candidates.length - 1) await sleep(DETAIL_DELAY_MS);
    }

    return results;
  }

  private async collectCandidates(): Promise<Candidate[]> {
    const seenIds = new Set<string>();
    const all: Candidate[] = [];

    for (const { path, rawCategory } of CATEGORIES) {
      this.log(`Scraping category: ${path}`);

      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${BASE_URL}${path}${page > 1 ? `?page=${page}` : ""}`;
        const html = await this.fetchHtml(url);
        if (!html) break;

        const $ = cheerio.load(html);
        const cards = parseListingPage($, rawCategory);

        if (cards.length === 0) {
          this.log(`${path} page ${page}: no cards — done`);
          break;
        }

        let newThisPage = 0;
        for (const card of cards) {
          if (seenIds.has(card.externalId)) continue;
          seenIds.add(card.externalId);
          all.push(card);
          newThisPage++;
        }

        this.log(`${path} page ${page}: ${cards.length} discounted, ${newThisPage} new`);

        // Stop paginating if we got fewer than a full page (last page)
        const totalOnPage = $("article.js-product-miniature").length;
        if (totalOnPage < 24) break;

        await sleep(PAGE_DELAY_MS);
      }
    }

    return all;
  }

  private async fetchHtml(url: string): Promise<string | null> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "nb-NO,nb;q=0.9,en;q=0.8",
          },
          signal: AbortSignal.timeout(15_000),
        });
        if (res.status === 404) return null;
        if (res.status === 429) {
          if (attempt === 1) {
            this.log(`Rate limited (429) — backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s before retry`, "warn");
            await sleep(RATE_LIMIT_BACKOFF_MS);
            continue;
          }
          this.log(`Rate limited (429) on retry — giving up for ${url}`, "warn");
          return null;
        }
        if (!res.ok) {
          this.log(`fetchHtml HTTP ${res.status} for ${url}`, "warn");
          return null;
        }
        return res.text();
      } catch (err) {
        this.log(`fetchHtml failed for ${url}: ${err}`, "warn");
        return null;
      }
    }
    return null;
  }
}

// ── Listing page parser ───────────────────────────────────────────────────────

/**
 * Parse discounted product candidates from one PrestaShop listing page.
 *
 * Card structure (verified against live HTML, 2026-04):
 *
 *   <article class="js-product-miniature"
 *            data-id-product="5088"
 *            data-id-product-attribute="11264">
 *     <a class="thumbnail product-thumbnail"
 *        href="https://sykkelbutikken.no/landeveissykkel/5088-11264-ridley-grifn-a-105.html#/...">
 *       <img data-full-size-image-url="https://sykkelbutikken.no/14996-produkt_1000x1000/ridley-grifn-a-105.jpg"
 *            data-src="https://sykkelbutikken.no/14996-home_default/ridley-grifn-a-105.jpg" ...>
 *     </a>
 *     <h2 class="h3 product-title"><a href="...">Ridley Grifn A 105</a></h2>
 *     <span class="product-price" content="25999">kr 25,999.00</span>
 *     <span class="regular-price text-muted">kr 34,499.00</span>  ← only when discounted
 *   </article>
 *
 * Key observations:
 *   - span.product-price[content] holds the integer NOK value — no text parsing needed
 *   - span.regular-price is only present for discounted products — safe discount gate
 *   - img[data-full-size-image-url] gives the 1000×1000 image URL from listing HTML
 *   - data-id-product is the stable base product ID for deduplication
 */
function parseListingPage(
  $: ReturnType<typeof cheerio.load>,
  rawCategory: string
): Candidate[] {
  const results: Candidate[] = [];
  const seenIds = new Set<string>();

  $("article.js-product-miniature").each((_, el) => {
    // ── Product ID ──────────────────────────────────────────────────────────
    const externalId = $(el).attr("data-id-product");
    if (!externalId) return;
    if (seenIds.has(externalId)) return;

    // ── Discount gate ────────────────────────────────────────────────────────
    // span.regular-price is only rendered by PrestaShop when a reduction is active.
    const $regularPrice = $(el).find("span.regular-price");
    if ($regularPrice.length === 0) return; // not discounted — skip

    // ── Prices ───────────────────────────────────────────────────────────────
    // content attribute on span.product-price holds the clean integer NOK value.
    const currentPriceStr = $(el).find("span.product-price").attr("content");
    if (!currentPriceStr) return;
    const currentPrice = parseInt(currentPriceStr, 10);
    if (isNaN(currentPrice) || currentPrice <= 0) return;

    const originalPrice = parseNok($regularPrice.text());
    if (originalPrice === null || originalPrice <= currentPrice) return;

    // Price sanity: complete bikes are >= 3 000 NOK
    if (currentPrice < 3_000 || originalPrice > 500_000) return;

    // ── URL ──────────────────────────────────────────────────────────────────
    // Strip the #/variant-fragment — canonical URL is fragment-free.
    const rawHref = $(el).find("a.product-thumbnail").attr("href") ?? "";
    if (!rawHref) return;
    const externalUrl = rawHref.split("#")[0];

    // ── Title ─────────────────────────────────────────────────────────────────
    const rawTitle = $(el).find("h2.product-title a").text().trim();
    if (!rawTitle) return;

    // ── Image ─────────────────────────────────────────────────────────────────
    // data-full-size-image-url provides the 1000×1000 image directly in HTML.
    const imageUrl =
      $(el).find("img[data-full-size-image-url]").first().attr("data-full-size-image-url") ?? null;

    seenIds.add(externalId);
    results.push({ externalId, externalUrl, rawTitle, rawCategory, currentPrice, originalPrice, imageUrl });
  });

  return results;
}

// ── Detail page size parser ───────────────────────────────────────────────────

const SYKKELBUTIKKEN_SIZE_RE = /^(OS|XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3})$/i; // OS = One Size

// Norwegian color words that indicate a selector is for color, not size.
const COLOR_WORDS = new Set([
  "hvit", "svart", "rød", "grønn", "blå", "gul", "grå", "oransje",
  "lilla", "rosa", "brun", "beige", "silver", "gull", "sort",
  "white", "black", "red", "green", "blue", "grey", "gray",
]);

function isColorOption(text: string): boolean {
  return COLOR_WORDS.has(text.toLowerCase());
}

/**
 * Find the size <select> on a PrestaShop detail page and return per-size stock.
 *
 * PrestaShop renders one <select data-product-attribute="N"> per attribute group
 * (typically group 1 = color, group 2 = size). We identify the size selector by
 * checking that its options are NOT color words.
 *
 * Stock status: class="attribute-not-in-stock" on option → out of stock.
 */
function parseDetailSizes($: ReturnType<typeof cheerio.load>): RawSize[] {
  const selects = $("select[data-product-attribute]").toArray();

  for (const sel of selects) {
    const options = $(sel).find("option").toArray();
    if (options.length === 0) continue;

    // Skip selects where any option is a color word
    const hasColorOption = options.some((opt) =>
      isColorOption(($(opt).attr("title") ?? $(opt).text()).trim())
    );
    if (hasColorOption) continue;

    const sizes: RawSize[] = [];
    for (const opt of options) {
      const raw = ($(opt).attr("title") ?? $(opt).text()).trim();
      const label = raw.replace(/cm$/i, "").trim().toUpperCase();
      if (!SYKKELBUTIKKEN_SIZE_RE.test(label)) continue;

      const isInStock = !$(opt).hasClass("attribute-not-in-stock");
      sizes.push({ label, isInStock });
    }

    if (sizes.length > 0) return sizes;
  }

  return [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a Norwegian price string like "kr 34,499.00" → 34499.
 * Comma is the thousands separator; period is the decimal separator.
 */
function parseNok(text: string): number | null {
  // Strip currency symbol and whitespace, remove thousands comma, drop decimals
  const cleaned = text.replace(/kr\s*/i, "").replace(/,/g, "").replace(/\.\d+$/, "").trim();
  const n = parseInt(cleaned, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
