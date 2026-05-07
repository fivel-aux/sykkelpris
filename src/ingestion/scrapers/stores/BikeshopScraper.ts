import * as cheerio from "cheerio";
import type { Store } from "@prisma/client";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

/**
 * Scraper for Bikeshop (bikeshop.no).
 *
 * Platform: Dynamicweb (ASP.NET-based CMS) — server-rendered HTML.
 *
 * Strategy — two phases (road and gravel only):
 *
 *   Phase 1 (listing pages):
 *     One fetch per category — no pagination exists.
 *     Discount gate: span.AddPriceLabel must carry the "has-discount" class,
 *     which the server renders statically even though price values are JS-loaded.
 *     Extract: title (AddHeader1 + AddHeader2), URL, externalId (SKU from path),
 *     rawBrand (ls-brand), 1024px image (ls-image-url), stock (ls-availability).
 *
 *   Phase 2 (detail pages):
 *     Fetch only the discounted candidates from Phase 1 — skips all full-price bikes.
 *     Extract prices from span.product-price-api data attributes:
 *       data-priceincvat   → current price (NOK incl. VAT)
 *       data-priceretail   → original/RRP price; non-empty = genuinely discounted
 *       data-yousavepercent → discount % (used for validation log)
 *
 * Category URLs verified against live site (2026-04):
 *   Road:   /sykkel/landeveissykkel/landeveissykkel
 *   Gravel: /sykkel/landeveissykkel/grussykkel
 *
 * Note: must use bare domain bikeshop.no — www. has TLS issues from server environments.
 */

const BASE_URL = "https://bikeshop.no";

const CATEGORIES: { path: string; rawCategory: string }[] = [
  { path: "/sykkel/landeveissykkel/landeveissykkel", rawCategory: "road bike" },
  { path: "/sykkel/landeveissykkel/grussykkel", rawCategory: "gravel bike" },
];

const DETAIL_DELAY_MS = 500;

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
  rawBrand: string | null;
  imageUrl: string | null;
  isInStock: boolean;
}

export class BikeshopScraper extends BaseScraper {
  constructor(store: Store) {
    super(store);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    // Phase 1: collect discounted candidates from listing pages
    const candidates = await this.collectCandidates();
    this.log(`${candidates.length} discounted candidates found`);

    const products: RawProduct[] = [];

    // Phase 2: fetch each candidate's detail page for actual prices
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const detail = await this.fetchDetailPrices(c.externalUrl);

      if (!detail) {
        this.log(`[${i + 1}/${candidates.length}] ${c.rawTitle} — skipped (no discount on detail page)`, "warn");
        continue;
      }

      const inStockCount = detail.sizes.filter((s) => s.isInStock).length;
      this.log(
        `[${i + 1}/${candidates.length}] ${c.rawTitle} — ` +
        `${detail.currentPrice} / ${detail.originalPrice} kr (${detail.discountPercent}%) ` +
        `— ${detail.sizes.length} sizes (${inStockCount} in stock)`
      );

      products.push({
        externalId: c.externalId,
        externalUrl: c.externalUrl,
        rawTitle: c.rawTitle,
        rawCategory: c.rawCategory,
        rawBrand: c.rawBrand,
        currentPrice: detail.currentPrice,
        originalPrice: detail.originalPrice,
        imageUrl: c.imageUrl,
        isInStock: c.isInStock,
        sizes: detail.sizes,
        description: null,
        scrapedAt: new Date(),
      });

      if (i < candidates.length - 1) {
        await sleep(DETAIL_DELAY_MS);
      }
    }

    return products;
  }

  // ── Phase 1 ─────────────────────────────────────────────────────────────────

  private async collectCandidates(): Promise<Candidate[]> {
    const seenIds = new Set<string>();
    const all: Candidate[] = [];

    for (const { path, rawCategory } of CATEGORIES) {
      this.log(`Scraping category: ${path}`);
      const html = await this.fetchHtml(`${BASE_URL}${path}`);
      if (!html) continue;

      const $ = cheerio.load(html);
      const cards = parseListingPage($, rawCategory);

      let newCount = 0;
      for (const card of cards) {
        if (seenIds.has(card.externalId)) continue;
        seenIds.add(card.externalId);
        all.push(card);
        newCount++;
      }

      this.log(`${path}: ${cards.length} discounted, ${newCount} new`);
    }

    return all;
  }

  // ── Phase 2 ─────────────────────────────────────────────────────────────────

  private async fetchDetailPrices(
    externalUrl: string
  ): Promise<{ currentPrice: number; originalPrice: number; discountPercent: number; sizes: RawSize[] } | null> {
    const html = await this.fetchHtml(externalUrl);
    if (!html) return null;
    const prices = parseDetailPrices(html);
    if (!prices) return null;
    return { ...prices, sizes: parseDetailSizes(html) };
  }

  // ── HTTP ─────────────────────────────────────────────────────────────────────

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
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

// ── Listing page parser ───────────────────────────────────────────────────────

/**
 * Parse discounted product candidates from one Bikeshop listing page.
 *
 * Card structure (verified against live HTML, 2026-04):
 *
 *   <div class="WebPubElement pub-topsellercurrent" data-plid="735574">
 *     <div class="D4Standard">
 *       <span class="lipscore-rating-small"
 *             ls-brand="Bianchi"
 *             ls-image-url="https://bikeshop.no:443https://bikeshop.no/thumbnails/.../img.1024.webp"
 *             ls-availability="4">
 *       </span>
 *       <span class="InfoOverlay">
 *         <div class="AddHeaderContainer">
 *           <a href="/bianchi/nybianchiyub86/bianchi-impulso-..." class="AdProductLink">
 *             <span class="AddHeader1">Bianchi Impulso Comp Grussykkel</span>
 *             <span class="AddHeader2">Karbon, GRX610 2x12, Velomann</span>
 *           </a>
 *         </div>
 *         <div class="AddPriceContainer">
 *           <div class="PriceLabelContainer">
 *             <span class="locate-prices-21957 has-discount AddPriceLabel"></span>  ← discount gate
 *           </div>
 *         </div>
 *       </span>
 *     </div>
 *   </div>
 *
 * Key observations:
 *   - "has-discount" is server-rendered in the class attribute (price values are JS-loaded)
 *   - ls-image-url has a buggy "https://bikeshop.no:443" prefix prepended to the real URL
 *   - ls-availability gives in-stock count (0 = out of stock)
 *   - externalId = middle URL path segment (the SKU): /brand/[SKU]/slug
 */
function parseListingPage(
  $: ReturnType<typeof cheerio.load>,
  rawCategory: string
): Candidate[] {
  const results: Candidate[] = [];

  $("div.WebPubElement").each((_, el) => {
    // ── Discount gate ────────────────────────────────────────────────────────
    const $priceLabel = $(el).find("span.AddPriceLabel").first();
    if (!$priceLabel.hasClass("has-discount")) return;

    // ── URL + externalId ──────────────────────────────────────────────────────
    const href = $(el).find("a.AdProductLink").first().attr("href");
    if (!href) return;

    const pathParts = href.split("/").filter(Boolean);
    if (pathParts.length < 2) return;
    const externalId = pathParts[1]; // SKU is always the middle segment
    const externalUrl = `${BASE_URL}${href}`;

    // ── Title ─────────────────────────────────────────────────────────────────
    const header1 = $(el).find("span.AddHeader1").first().text().trim();
    const header2 = $(el).find("span.AddHeader2").first().text().trim();
    if (!header1) return;
    const rawTitle = header2 ? `${header1} ${header2}` : header1;

    // ── Brand + image + stock from lipscore data attributes ───────────────────
    const $ls = $(el).find("span.lipscore-rating-small").first();
    const rawBrand = $ls.attr("ls-brand") ?? null;
    const imageUrl = extractLsImageUrl($ls.attr("ls-image-url") ?? "");
    const availability = parseInt($ls.attr("ls-availability") ?? "0", 10);
    const isInStock = availability > 0;

    results.push({ externalId, externalUrl, rawTitle, rawCategory, rawBrand, imageUrl, isInStock });
  });

  return results;
}

// ── Detail page parser ────────────────────────────────────────────────────────

/**
 * Extract prices from a Bikeshop product detail page.
 *
 * Verified structure (2026-04) for a discounted product:
 *
 *   <span class="PriceLabel has-discount product-price-api"
 *         data-priceincvat="65 442,-"
 *         data-priceretail=" "           ← always a space, not useful
 *         data-yousavepercent="15%">
 *     65 442,-
 *   </span>
 *   <span class="OldPriceLabel product-price-api"
 *         data-oldprice="76 990,-">      ← original price lives here
 *     76 990,-
 *   </span>
 *
 * data-priceretail is always a space and cannot be used as a discount gate.
 * The correct gate is: span.OldPriceLabel[data-oldprice] exists and is non-empty.
 *
 * Returns null if the product is not discounted (no OldPriceLabel present).
 */
function parseDetailPrices(
  html: string
): { currentPrice: number; originalPrice: number; discountPercent: number } | null {
  const $ = cheerio.load(html);

  // Current price
  const $priceSpan = $("span.PriceLabel.product-price-api").first();
  if (!$priceSpan.length) return null;

  const priceIncVat = $priceSpan.attr("data-priceincvat") ?? "";
  const youSavePctRaw = $priceSpan.attr("data-yousavepercent") ?? "";

  // Original price — in a separate OldPriceLabel element
  const $oldSpan = $("span.OldPriceLabel.product-price-api").first();
  const oldPriceRaw = $oldSpan.attr("data-oldprice") ?? "";

  // Discount gate: OldPriceLabel with a real price value must be present
  if (!oldPriceRaw.trim()) return null;

  const currentPrice = parseBikeshopPrice(priceIncVat);
  const originalPrice = parseBikeshopPrice(oldPriceRaw);
  if (!currentPrice || !originalPrice) return null;
  if (originalPrice <= currentPrice) return null;

  // Sanity: complete bikes 3 000–500 000 NOK
  if (currentPrice < 3_000 || originalPrice > 500_000) return null;

  // data-yousavepercent is "15%" (includes % suffix)
  const discountPercent = parseInt(youSavePctRaw.replace("%", ""), 10);

  return { currentPrice, originalPrice, discountPercent: isNaN(discountPercent) ? 0 : discountPercent };
}

// ── Detail sizes parser ───────────────────────────────────────────────────────

/**
 * Extract per-size availability from the JSON-LD ProductGroup block.
 *
 * Bikeshop renders a ProductGroup with hasVariant[] server-side. Each entry
 * carries a clean size label and a schema.org availability URL:
 *   "size": "55", "offers.availability": "https://schema.org/InStock"
 *
 * Multi-color products repeat the same size across variants. Stock is OR-combined:
 * a size is in stock if any variant for that size is InStock.
 *
 * Returns [] if the JSON-LD block is absent or unparseable — callers treat
 * missing sizes as unknown, not as out-of-stock.
 */
function parseDetailSizes(html: string): RawSize[] {
  try {
    // Iterate all JSON-LD blocks — pages often have multiple (e.g. Organization +
    // ProductGroup). Single .match() would only find the first and miss ProductGroup.
    const allMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    if (allMatches.length === 0) return [];

    let group: Record<string, unknown> | undefined;
    for (const m of allMatches) {
      let parsed: unknown;
      try { parsed = JSON.parse(m[1]); } catch { continue; }
      const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      group = items.find((i): i is Record<string, unknown> =>
        typeof i === "object" && i !== null &&
        (i as Record<string, unknown>)["@type"] === "ProductGroup"
      );
      if (group) break;
    }
    if (!group) return [];

    const variants = group["hasVariant"];
    if (!Array.isArray(variants)) return [];

    // Deduplicate by size label, OR stock status across same-size color variants
    const sizeMap = new Map<string, boolean>();
    for (const v of variants) {
      if (typeof v !== "object" || v === null) continue;
      const size = (v as Record<string, unknown>)["size"];
      if (typeof size !== "string" || !size.trim()) continue;
      const label = size.trim();
      const avail = (v as Record<string, unknown>)["offers"];
      const availability = typeof avail === "object" && avail !== null
        ? String((avail as Record<string, unknown>)["availability"] ?? "")
        : "";
      const inStock = availability.endsWith("InStock");
      sizeMap.set(label, (sizeMap.get(label) ?? false) || inStock);
    }

    return [...sizeMap.entries()].map(([label, isInStock]) => ({ label, isInStock }));
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a Bikeshop price string to an integer NOK value.
 *
 * Format: "29 990,-" (space = thousands separator, ",–" = suffix)
 * Also handles "Fra 29 990,-" (range pricing with "from" prefix).
 *   "29 990,-" → 29990
 *   "Fra 1 279,-" → 1279
 */
function parseBikeshopPrice(text: string): number | null {
  const cleaned = text
    .replace(/fra\s*/gi, "")
    .replace(/,-$/, "")
    .replace(/\s/g, "")
    .trim();
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

/**
 * Extract the usable image URL from the ls-image-url attribute.
 *
 * Bikeshop has a server-side bug: the attribute value is the real URL
 * prepended with "https://bikeshop.no:443", e.g.:
 *   "https://bikeshop.no:443https://bikeshop.no/thumbnails/.../img.1024.webp"
 *
 * Strip the bogus host:port prefix to recover the actual URL.
 */
function extractLsImageUrl(raw: string): string | null {
  if (!raw) return null;
  // Remove leading "https://hostname:port" prefix (the real URL follows immediately)
  const clean = raw.replace(/^https?:\/\/[^/]+:\d+/, "");
  return clean.startsWith("https://") ? clean : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
