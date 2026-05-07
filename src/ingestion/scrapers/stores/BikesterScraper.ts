import * as cheerio from "cheerio";
import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

/**
 * Scraper for Bikester (bikester.no).
 *
 * Architecture: ASP.NET WebForms — no API, no Shopify, no JSON-LD.
 *
 * Strategy — two phases:
 *   Phase 1: Scrape listing pages. Extract URL, title, brand, prices.
 *            Keep only products where originalPrice > currentPrice (discounted).
 *            Images are 100% JS-lazy-loaded on listing pages; only placeholders
 *            appear in HTML. No data-src or equivalent.
 *   Phase 2: Fetch detail pages for discounted products only.
 *            Extract real CDN image URL: img[src*="cdn37.se"]:not([src*="placeholder"])
 *
 * Category URLs verified against live site (2026-04):
 *   Road:    /no/articles/2506/landeveissykler  (~280 products)
 *   MTB:     /no/articles/2495/mtb-sykler
 *   E-bikes: /no/articles/2481/el-sykler
 *
 * TODO: Gravel category URL not found in navigation — Bikester may list gravel
 *       under road bikes or a subcategory. Investigate and add when confirmed.
 */

const BASE_URL = "https://www.bikester.no";

const CATEGORIES: { path: string; rawCategory: string }[] = [
  { path: "/no/articles/2506/landeveissykler", rawCategory: "road bike" },
  { path: "/no/articles/2495/mtb-sykler", rawCategory: "mountain bike" },
  { path: "/no/articles/2481/el-sykler", rawCategory: "e-bike" },
];

const DETAIL_DELAY_MS = 900;
const PAGE_DELAY_MS = 500;
const MAX_PAGES = 25;

// Matches product links: /no/articles/2.SUBCATID.PRODUCTID/slug
// Category links (/no/articles/2506/slug) do NOT match — they have only one number.
const PRODUCT_HREF_RE = /^\/no\/articles\/2\.\d+\.(\d+)\//;

interface Candidate {
  externalId: string;
  externalUrl: string;
  rawTitle: string;
  rawBrand: string | null;
  rawCategory: string;
  currentPrice: number;
  originalPrice: number;
  imageUrl: string | null;
}

export class BikesterScraper extends BaseScraper {
  constructor(store: Store) {
    super(store);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    // Phase 1: collect discounted candidates from listing pages.
    // Each candidate already carries an imageUrl from data-lazysrc (622×508).
    const candidates = await this.collectCandidates();
    this.log(
      `${candidates.length} discounted candidates found — fetching detail pages for hi-res images`
    );

    // Phase 2: fetch detail page for each candidate to upgrade to the main product
    // image (800×516, itemprop="image"). Falls back to the listing-page image when
    // the detail fetch fails so no candidate is dropped solely for lack of an image.
    const products: RawProduct[] = [];
    for (const c of candidates) {
      const detail = await this.fetchDetailPage(c.externalUrl);
      const imageUrl = detail.imageUrl ?? c.imageUrl;

      if (!imageUrl) {
        this.log(`No image — skipping: ${c.rawTitle}`, "warn");
        await sleep(DETAIL_DELAY_MS);
        continue;
      }

      products.push({
        externalId: c.externalId,
        externalUrl: c.externalUrl,
        rawTitle: c.rawTitle,
        rawBrand: c.rawBrand,
        rawCategory: c.rawCategory,
        currentPrice: c.currentPrice,
        originalPrice: c.originalPrice,
        imageUrl,
        isInStock: true,
        sizes: detail.sizes,
        description: null,
        scrapedAt: new Date(),
      });

      await sleep(DETAIL_DELAY_MS);
    }

    this.log(`${products.length} products ready for ingestion`);
    return products;
  }

  // ── Phase 1: collect discounted candidates ────────────────────────────────

  private async collectCandidates(): Promise<Candidate[]> {
    const seenIds = new Set<string>();
    const all: Candidate[] = [];

    for (const { path, rawCategory } of CATEGORIES) {
      this.log(`Scraping category: ${path}`);

      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${BASE_URL}${path}?page=${page}`;
        const html = await this.fetchHtml(url);
        if (!html) break;

        const $ = cheerio.load(html);
        const cards = parseListingPage($, rawCategory);

        if (cards.length === 0) {
          this.log(`${path} page ${page}: empty — done with category`);
          break;
        }

        let newThisPage = 0;
        for (const card of cards) {
          if (seenIds.has(card.externalId)) continue;
          seenIds.add(card.externalId);
          all.push(card);
          newThisPage++;
        }

        this.log(
          `${path} page ${page}: ${cards.length} discounted cards, ${newThisPage} new`
        );

        await sleep(PAGE_DELAY_MS);
      }
    }

    return all;
  }

  // ── Phase 2: get image + sizes from detail page ──────────────────────────

  private async fetchDetailPage(
    url: string
  ): Promise<{ imageUrl: string | null; sizes: RawSize[] }> {
    const html = await this.fetchHtml(url);
    if (!html) return { imageUrl: null, sizes: [] };
    const $ = cheerio.load(html);

    // Image — prefer the structured main product image (itemprop="image", 800×516).
    const main = $('img[itemprop="image"][src*="cdn37.se"]').first().attr("src");
    const imageUrl =
      main && !main.includes("placeholder")
        ? main
        : ($('img[src*="cdn37.se"]').not('[src*="placeholder"]').first().attr("src") ?? null);

    return { imageUrl, sizes: parseDetailSizes($) };
  }

  // ── HTTP ─────────────────────────────────────────────────────────────────

  private async fetchHtml(url: string): Promise<string | null> {
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    } catch (err) {
      this.log(`fetchHtml failed for ${url}: ${err}`, "warn");
      return null;
    }
  }
}

// ── Listing page parser ──────────────────────────────────────────────────────

/**
 * Parse discounted product cards from a Bikester listing page.
 *
 * Confirmed card structure (live HTML, 2026-04):
 *
 *   <div>                                           ← card container
 *     <a href="/no/articles/2.X.Y/slug">            ← image link (no text)
 *       <img src="cdn37.se/placeholder/..." alt="Title">
 *     </a>
 *     <a href="/no/trademarks/brand">BRAND</a>      ← brand link (different href)
 *     <a href="/no/articles/2.X.Y/slug">Title</a>   ← title link (same href)
 *     <span>17 900 kr</span>                        ← current price  ← SIBLING of <a>
 *     <del>19 049 kr</del>                          ← original price ← SIBLING of <a>
 *   </div>
 *
 * Root cause of zero results: the old parser called $(productLink).find("span")
 * which searches INSIDE the <a> tag. Prices are siblings, not children — find()
 * never reaches them. Fix: navigate UP to the card container, then search there.
 */
function parseListingPage(
  $: ReturnType<typeof cheerio.load>,
  rawCategory: string
): Candidate[] {
  const results: Candidate[] = [];
  const seenIds = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(PRODUCT_HREF_RE);
    if (!match) return;

    const externalId = match[1];
    if (seenIds.has(externalId)) return;
    seenIds.add(externalId);

    const externalUrl = `${BASE_URL}${href.split("?")[0]}`;

    // ── Card container ───────────────────────────────────────────────────────
    // Navigate UP so we can reach the sibling price elements.
    let $container = $(el).parent();

    // If the immediate parent has no price text, the image link is nested in
    // an extra wrapper div — go one level higher.
    if (!$container.text().includes(" kr")) {
      $container = $container.parent();
    }

    // Guard: if the container holds more than 3 distinct product IDs it is a
    // list/grid wrapper, not a single card. Fall back to the immediate parent.
    const idsInContainer = new Set<string>();
    $container.find("a[href]").each((_, a) => {
      const m = ($(a).attr("href") ?? "").match(PRODUCT_HREF_RE);
      if (m) idsInContainer.add(m[1]);
    });
    if (idsInContainer.size > 3) {
      $container = $(el).parent();
    }

    // ── Prices ───────────────────────────────────────────────────────────────
    // Include del/s for strikethrough original prices alongside span.
    const prices: number[] = [];
    $container.find("span, del, s, em, strong").each((_, priceEl) => {
      const text = $(priceEl).text().trim().toLowerCase();
      if (text.includes("kr") && !text.includes("innsparing")) {
        const n = parseNok(text);
        if (n !== null && n >= 3_000 && n <= 500_000) prices.push(n);
      }
    });

    const uniquePrices = [...new Set(prices)];
    if (uniquePrices.length < 2) return; // not discounted — skip

    const currentPrice = Math.min(...uniquePrices);
    const originalPrice = Math.max(...uniquePrices);
    if (originalPrice <= currentPrice) return;

    // ── Title ────────────────────────────────────────────────────────────────
    // $(el) is typically the image link. Cheerio exposes the <noscript> inner content
    // as a raw text node, so $(el).text() returns an "<img .../>" HTML string — not a title.
    // Detect this and clear it so the sibling-link fallback always runs.
    let rawTitle = $(el).text().trim();
    if (rawTitle.includes("<")) rawTitle = "";

    if (rawTitle.length < 4) {
      $container.find("a[href]").each((_, a) => {
        const m = ($(a).attr("href") ?? "").match(PRODUCT_HREF_RE);
        if (m && m[1] === externalId) {
          const text = $(a).text().trim();
          if (!text.includes("<") && text.length > rawTitle.length) rawTitle = text;
        }
      });
    }

    // Last fallback: img alt ONLY — attr("title") can contain raw HTML tooltip markup
    if (rawTitle.length < 4) {
      rawTitle = $container.find("img").first().attr("alt") ?? "";
    }

    if (!rawTitle || rawTitle.includes("<")) return;

    // ── Brand ────────────────────────────────────────────────────────────────
    // Brand link has a non-product href (e.g. /no/trademarks/orbea).
    let rawBrand: string | null = null;
    $container.find("a[href]").each((_, a) => {
      if (rawBrand) return;
      const aHref = $(a).attr("href") ?? "";
      if (PRODUCT_HREF_RE.test(aHref)) return;
      const text = $(a).text().trim();
      if (text && text.length <= 30 && !text.includes("kr") && /^[A-Za-z0-9\s&./-]+$/.test(text)) {
        rawBrand = text;
      }
    });

    // ── Listing-page image (fallback) ────────────────────────────────────────
    // The thumbnail img carries the real CDN URL in data-lazysrc (622×508).
    // Phase 2 will upgrade this to the hi-res detail image when available.
    const lazySrc = $container.find(".thumb img").first().attr("data-lazysrc") ?? "";
    const imageUrl =
      lazySrc.includes("cdn37.se") && !lazySrc.includes("placeholder") ? lazySrc : null;

    results.push({ externalId, externalUrl, rawTitle, rawBrand, rawCategory, currentPrice, originalPrice, imageUrl });
  });

  return results;
}

// ── Detail sizes parser ───────────────────────────────────────────────────────

/**
 * Extract size labels from the Bikester detail page size picker.
 *
 * Size select: <select name="mp$cphMain$ctl162$ddlMatrixType_2">
 * Values are either t-shirt labels ("XS", "M", "XL") or numeric frame sizes
 * ("47", "53cm") — the "cm" suffix is inconsistent and stripped before matching.
 *
 * Per-size stock is not present in static HTML (JS-loaded placeholder "- - -"),
 * so all extracted sizes are marked isInStock: true (same as the product-level fallback).
 */
const BIKESTER_SIZE_RE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3})$/i;

function parseDetailSizes($: ReturnType<typeof cheerio.load>): RawSize[] {
  const sizes: RawSize[] = [];
  $('select[name*="ddlMatrixType_2"] option').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    // Strip trailing "cm" (case-insensitive) before matching
    const label = raw.replace(/cm$/i, "").trim().toUpperCase();
    if (!BIKESTER_SIZE_RE.test(label)) return;
    sizes.push({ label, isInStock: true });
  });
  return sizes;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNok(text: string): number | null {
  // "12 999 kr" → remove non-digits → "12999" → 12999
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
