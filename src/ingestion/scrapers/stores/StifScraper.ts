import type { Store } from "@prisma/client";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { BaseScraper } from "../BaseScraper";
import type { RawProduct, RawSize } from "../types";

/**
 * Scraper for Stif (stif.no).
 *
 * Strategy: Stif renders product listings server-side. We fetch the bike
 * category pages with cheerio and parse the HTML product cards.
 *
 * Each category page is paginated with ?page=N. We continue until
 * a page returns zero product cards.
 *
 * NOTE: Selectors must be verified against the live site. The selectors
 * below are based on common WooCommerce/theme patterns — adjust as needed
 * after inspecting actual markup.
 */

const CATEGORY_PATHS = [
  "/sykler/veisykkel",
  "/sykler/grusykkel",
  "/sykler/terrengsykkel",
  "/sykler/elsykkel",
  "/sykler/tt-triatlon",
];

const BASE_URL = "https://www.stif.no";

export class StifScraper extends BaseScraper {
  constructor(store: Store) {
    super(store);
  }

  async fetchProducts(): Promise<RawProduct[]> {
    const all: RawProduct[] = [];

    for (const path of CATEGORY_PATHS) {
      const products = await this.scrapeCategory(path);
      all.push(...products);
      await sleep(600);
    }

    return all;
  }

  private async scrapeCategory(categoryPath: string): Promise<RawProduct[]> {
    const products: RawProduct[] = [];
    let page = 1;

    while (true) {
      const url = `${BASE_URL}${categoryPath}?page=${page}`;
      const html = await this.fetchHtml(url);
      if (!html) break;

      const $ = cheerio.load(html);
      const cards = $(".product-card, .wc-product-card, article.product");

      if (cards.length === 0) break;

      cards.each((_, el) => {
        try {
          const product = this.parseCard($, el, categoryPath);
          if (product) products.push(product);
        } catch (err) {
          this.log(`Failed to parse product card: ${err}`, "warn");
        }
      });

      this.log(`${categoryPath} page ${page}: ${cards.length} cards`);
      page++;
      await sleep(400);
    }

    return products;
  }

  private parseCard(
    $: ReturnType<typeof cheerio.load>,
    el: Element,
    categoryPath: string
  ): RawProduct | null {
    const card = $(el);

    const relativeUrl = card.find("a.product-link, a.woocommerce-loop-product__link").attr("href") ?? "";
    const externalUrl = relativeUrl.startsWith("http") ? relativeUrl : `${BASE_URL}${relativeUrl}`;
    if (!externalUrl) return null;

    // Extract product ID from URL slug (last segment before query string)
    const externalId = externalUrl.split("/").filter(Boolean).pop()?.split("?")[0] ?? "";
    if (!externalId) return null;

    const rawTitle = card.find(".product-title, .woocommerce-loop-product__title, h2").first().text().trim();
    if (!rawTitle) return null;

    // Prices — WooCommerce typically has <del> for original and <ins> for sale
    const salePriceText = card.find(".price ins .amount, .price .woocommerce-Price-amount").first().text();
    const originalPriceText = card.find(".price del .amount").first().text();

    const currentPrice = parseNokPrice(salePriceText || card.find(".price .amount").first().text());
    const originalPrice = parseNokPrice(originalPriceText) || currentPrice;

    if (!currentPrice) return null;

    const imageUrl = card.find("img.wp-post-image, img.attachment-woocommerce_thumbnail").attr("src") ?? null;
    const rawCategory = categoryPath.split("/").pop() ?? null;
    const rawBrand = card.find(".product-brand, [data-brand]").text().trim() || null;

    const isInStock = !card.hasClass("outofstock") && !card.find(".out-of-stock").length;

    return {
      externalId,
      externalUrl,
      rawTitle,
      originalPrice,
      currentPrice,
      imageUrl,
      rawCategory,
      rawBrand,
      isInStock,
      sizes: [], // populated on product detail fetch if needed
      scrapedAt: new Date(),
    };
  }

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

      if (res.status === 404) return null; // past last page
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      return res.text();
    } catch (err) {
      this.log(`fetchHtml failed for ${url}: ${err}`, "warn");
      return null;
    }
  }
}

function parseNokPrice(raw: string): number | null {
  if (!raw) return null;
  // Remove currency symbols, spaces, thousand separators, then parse
  const cleaned = raw.replace(/[kr\s.]/gi, "").replace(",", ".").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : n;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
