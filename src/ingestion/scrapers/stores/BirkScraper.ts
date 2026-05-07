import * as cheerio from "cheerio";
import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

/**
 * Scraper for Birk Sport (birk.no).
 *
 * Platform: ASP.NET WebForms — server-rendered HTML, images lazy-loaded via
 * data-lazysrc, CDN served via cdn37.se.
 *
 * Strategy — two phases:
 *   Phase 1 (listing pages): collect discounted candidates
 *     - Card container:   div.item
 *     - Discount gate:    div.rekPriceListing must be present (contains RRP text)
 *     - Title:            div.title > a (href gives product URL + ID)
 *     - Current price:    span.price ("fra 12 345 kr")
 *     - Original price:   div.rekPriceListing text ("Veil. pris: 15 678 kr")
 *     - Image:            img[data-lazysrc] pointing to cdn37.se/zY/images/...
 *   Phase 2 (detail pages): fetch each product page to extract per-size availability
 *     - select[name*="ddlMatrixType"] option (suffix is _1 for single-attribute
 *       products, _2 when color is the first attribute group; match any suffix)
 *     - class="out-of-stock" on option → not in stock; absence → in stock
 *     - availability baked into initial HTML response (no postback needed)
 *
 * Category URLs verified against live site (2026-04):
 *   Road:   /sykkel/landeveissykkel
 *   Gravel: /sykkel/gravelsykkel
 *
 * Pagination: ?page=N (page 1 needs no param). Stop when page returns no cards.
 *
 * externalId: last dotted segment of the articles path component.
 *   e.g. /no/articles/2.479.84892/slug → "84892"
 */

const BASE_URL = "https://www.birk.no";

const CATEGORIES: { path: string; rawCategory: string }[] = [
  { path: "/sykkel/landeveissykkel", rawCategory: "road bike" },
  { path: "/sykkel/gravelsykkel", rawCategory: "gravel bike" },
];

const PAGE_DELAY_MS = 600;
const DETAIL_DELAY_MS = 2500;
const RATE_LIMIT_BACKOFF_MS = 12_000;
const MAX_PAGES = 20;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "nb-NO,nb;q=0.9,en;q=0.8",
};

interface Candidate {
  externalId: string;
  externalUrl: string;
  rawTitle: string;
  rawCategory: string;
  currentPrice: number;
  originalPrice: number;
  imageUrl: string | null;
}

export class BirkScraper extends BaseScraper {
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

        const totalOnPage = $("div.item").length;
        if (totalOnPage < 12) break;

        await sleep(PAGE_DELAY_MS);
      }
    }

    return all;
  }

  private async fetchHtml(url: string): Promise<string | null> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: FETCH_HEADERS,
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
 * Parse discounted product candidates from one Birk listing page.
 *
 * Card structure (verified against live HTML, 2026-04):
 *
 *   <div class="item">
 *     <div class="thumb">
 *       <a href="/no/articles/2.479.84892/slug">
 *         <img class="lazy" data-lazysrc="https://03.cdn37.se/zY/images/2.1751504/slug.jpeg"
 *              src="https://cdn37.se/placeholder/311x254.png">
 *       </a>
 *     </div>
 *     <div class="itemInfo">
 *       <div class="title">
 *         <a href="/no/articles/2.479.84892/slug">Trek Racer Domane AL 2</a>
 *       </div>
 *       <div class="campaignContainer">
 *         <div class="priceContainer">
 *           <span class="price">fra 12 323 kr</span>
 *           <div class="rekPriceListing">
 *             (<span>Veil. pris: 12 999 kr</span>)  ← only when discounted
 *           </div>
 *         </div>
 *       </div>
 *     </div>
 *   </div>
 *
 * Key observations:
 *   - div.rekPriceListing is only rendered when a RRP (veiledende pris) exists
 *   - data-lazysrc on the listing img holds the real CDN image URL
 *   - externalId = last dotted segment of the articles path: "2.479.84892" → "84892"
 */
function parseListingPage(
  $: ReturnType<typeof cheerio.load>,
  rawCategory: string
): Candidate[] {
  const results: Candidate[] = [];
  const seenIds = new Set<string>();

  $("div.item").each((_, el) => {
    // ── Discount gate ────────────────────────────────────────────────────────
    const $rrp = $(el).find("div.rekPriceListing");
    if ($rrp.length === 0) return;
    const rrpText = $rrp.text().trim();
    if (!rrpText) return;

    // ── Original price ────────────────────────────────────────────────────────
    const originalPrice = parseOriginalPrice(rrpText);
    if (originalPrice === null) return;

    // ── Current price ─────────────────────────────────────────────────────────
    const currentPriceText = $(el).find("span.price").first().text();
    const currentPrice = parseBirkPrice(currentPriceText);
    if (currentPrice === null || currentPrice <= 0) return;
    if (originalPrice <= currentPrice) return;

    // Price sanity: complete bikes >= 3 000 NOK
    if (currentPrice < 3_000 || originalPrice > 500_000) return;

    // ── URL + externalId ──────────────────────────────────────────────────────
    const href = $(el).find("div.title a").first().attr("href");
    if (!href) return;

    const articleMatch = href.match(/\/no\/articles\/([^/]+)\//);
    if (!articleMatch) return;

    const idSegment = articleMatch[1]; // e.g. "2.479.84892"
    const parts = idSegment.split(".");
    const externalId = parts[parts.length - 1];
    if (!externalId || !/^\d+$/.test(externalId)) return;
    if (seenIds.has(externalId)) return;

    const externalUrl = `${BASE_URL}${href}`;

    // ── Title ─────────────────────────────────────────────────────────────────
    const rawTitle = $(el).find("div.title a").first().text().trim();
    if (!rawTitle) return;

    // ── Image — data-lazysrc holds the real CDN image URL ────────────────────
    const imageUrl =
      $(el).find("img[data-lazysrc]").first().attr("data-lazysrc") ?? null;

    seenIds.add(externalId);
    results.push({ externalId, externalUrl, rawTitle, rawCategory, currentPrice, originalPrice, imageUrl });
  });

  return results;
}

// ── Detail page size parser ───────────────────────────────────────────────────

const BIRK_SIZE_RE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3})$/i;

function parseDetailSizes($: ReturnType<typeof cheerio.load>): RawSize[] {
  const sizes: RawSize[] = [];
  // Match any suffix (_1, _2, …): single-attribute products use _1 for sizes,
  // multi-attribute products use _1 for color and _2 for sizes. BIRK_SIZE_RE
  // already filters out color/non-size values, so mixing selects is safe.
  $('select[name*="ddlMatrixType"] option').each((_, el) => {
    const val = $(el).attr("value") ?? "";
    if (val === "0") return; // placeholder "- - -"

    const raw = $(el).text().trim();
    if (!raw || raw === "- - -") return;

    const label = raw.replace(/cm$/i, "").trim().toUpperCase();
    if (!BIRK_SIZE_RE.test(label)) return;

    const isInStock = !$(el).hasClass("out-of-stock");
    sizes.push({ label, isInStock });
  });
  return sizes;
}

// ── Price parsers ─────────────────────────────────────────────────────────────

/**
 * Parse the RRP from div.rekPriceListing text.
 * Input: "(Veil. pris: 15 678 kr)" or "Veil. pris: 15 678 kr"
 */
function parseOriginalPrice(text: string): number | null {
  const match = text.match(/Veil\.\s*pris:\s*([\d\s]+)\s*kr/i);
  if (!match) return null;
  return parseBirkPrice(match[1] + " kr");
}

/**
 * Parse a Birk price string to an integer NOK value.
 *
 * Space is the thousands separator. "fra " prefix means "from".
 *   "fra 12 345 kr" → 12345
 *   "15 678 kr"     → 15678
 */
function parseBirkPrice(text: string): number | null {
  const cleaned = text
    .toLowerCase()
    .replace(/fra\s*/g, "")
    .replace(/kr/gi, "")
    .replace(/[.,]\d{2}$/, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
