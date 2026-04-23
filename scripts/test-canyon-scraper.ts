/**
 * Standalone test script for CanyonScraper.
 * Calls fetchProducts() directly — no database required.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-canyon-scraper.ts
 */

import { CanyonScraper } from "../src/ingestion/scrapers/stores/CanyonScraper";
import type { Store } from "@prisma/client";

const mockStore: Store = {
  id: "mock-canyon-id",
  slug: "canyon",
  name: "Canyon",
  url: "https://www.canyon.com/en-no",
  logoUrl: null,
  shipsToNorway: true,
  isActive: true,
  scrapingConfig: null,
  lastScrapedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function main() {
  const scraper = new CanyonScraper(mockStore);

  console.log("Fetching Canyon outlet products...\n");

  const products = await scraper.fetchProducts();

  console.log(`\n=== Results: ${products.length} discounted bikes ===\n`);

  for (const p of products) {
    const saving =
      p.originalPrice && p.currentPrice
        ? ` (save ${(p.originalPrice - p.currentPrice).toLocaleString("nb-NO")} NOK)`
        : "";
    console.log(
      `[${p.externalId}] ${p.rawTitle}\n` +
        `  Category : ${p.rawCategory ?? "unknown"}\n` +
        `  Price    : ${p.currentPrice?.toLocaleString("nb-NO")} NOK` +
        ` (was ${p.originalPrice?.toLocaleString("nb-NO")} NOK)${saving}\n` +
        `  URL      : ${p.externalUrl}\n`
    );
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
