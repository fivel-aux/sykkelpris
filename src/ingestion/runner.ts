import { db } from "../lib/db";
import { ScrapeJobStatus } from "@prisma/client";
import type { Store } from "@prisma/client";
import { XXLScraper } from "./scrapers/stores/XXLScraper";
import { BikesterScraper } from "./scrapers/stores/BikesterScraper";
import { StifScraper } from "./scrapers/stores/StifScraper";
import { CanyonScraper } from "./scrapers/stores/CanyonScraper";
import { normalize } from "./normalizer";
import type { NormalizedListing } from "./normalizer";
import { validateListing } from "./validator/listing";
import type { ValidatedListing } from "./validator/listing";
import type { BaseScraper } from "./scrapers/BaseScraper";
import { MIN_CONFIDENCE_SCORE } from "./config";

// ── Store registry ─────────────────────────────────────────────────────────────

/**
 * Map of store slugs to their scraper constructor.
 * Add new stores here as they are onboarded — no other file needs to change.
 */
const SCRAPERS: Record<string, new (store: Store) => BaseScraper> = {
  xxl: XXLScraper,
  bikester: BikesterScraper,
  stif: StifScraper,
  canyon: CanyonScraper,
};

// ── Stats types ────────────────────────────────────────────────────────────────

interface StoreStats {
  newCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
}

interface RunSummary {
  storesProcessed: number;
  storesFailed: number;
  totalNew: number;
  totalUpdated: number;
  totalSkipped: number;
  totalFailed: number;
  totalInactive: number;
  durationMs: number;
}

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * Main ingestion runner.
 *
 * For each active store with a registered scraper:
 *   1. Run the scraper — errors are caught per-store (no store can crash others)
 *   2. Normalize each raw product
 *   3. Reject low-confidence listings (below MIN_CONFIDENCE_SCORE)
 *   4. Validate with Zod
 *   5. Upsert into the database
 *   6. Record a PriceSnapshot when the price changes
 *   7. Mark unseen listings as inactive
 *   8. Write final stats back to the ScrapeJob record
 *
 * @param targetStoreSlug  Run only this store. Omit to run all active stores.
 */
export async function runIngestion(targetStoreSlug?: string): Promise<RunSummary> {
  console.log("🚴 Starting ingestion run...");
  const startTime = Date.now();

  const stores = await db.store.findMany({
    where: {
      isActive: true,
      ...(targetStoreSlug ? { slug: targetStoreSlug } : {}),
    },
  });

  if (stores.length === 0) {
    const msg = targetStoreSlug
      ? `No active store found with slug "${targetStoreSlug}"`
      : "No active stores found";
    console.log(msg);
    return emptySummary(Date.now() - startTime);
  }

  const summary: RunSummary = {
    storesProcessed: 0,
    storesFailed: 0,
    totalNew: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    totalFailed: 0,
    totalInactive: 0,
    durationMs: 0,
  };

  for (const store of stores) {
    const ScraperClass = SCRAPERS[store.slug];
    if (!ScraperClass) {
      console.log(`[${store.slug}] No scraper registered — skipping`);
      continue;
    }

    try {
      const storeStats = await ingestStore(store, ScraperClass);
      summary.storesProcessed++;
      summary.totalNew += storeStats.newCount;
      summary.totalUpdated += storeStats.updatedCount;
      summary.totalSkipped += storeStats.skippedCount;
      summary.totalFailed += storeStats.failedCount;
    } catch (err) {
      // Per-store errors are isolated — log and continue with the next store.
      // The ScrapeJob record is already marked FAILED by BaseScraper.
      console.error(`[${store.slug}] Fatal error during ingestion:`, err);
      summary.storesFailed++;
    }
  }

  summary.durationMs = Date.now() - startTime;

  console.log(`\n✅ Ingestion complete in ${(summary.durationMs / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(summary, null, 2));

  return summary;
}

// ── Per-store ingestion ───────────────────────────────────────────────────────

async function ingestStore(
  store: Store,
  ScraperClass: new (store: Store) => BaseScraper
): Promise<StoreStats> {
  console.log(`\n[${store.slug}] Starting...`);
  const jobStart = new Date();

  const scraper = new ScraperClass(store);

  // run() creates the ScrapeJob, fetches products, and marks SUCCESS/FAILED.
  // Returns null if the scrape itself failed (network error, HTTP error, etc.).
  const rawProducts = await scraper.run();

  if (!rawProducts) {
    console.error(`[${store.slug}] Scraper failed — see ScrapeJob table`);
    // scraper.run() already marked the job FAILED; just bubble up.
    throw new Error(`Scraper failed for store ${store.slug}`);
  }

  // Ingest each product independently — one bad product cannot stop the rest.
  const stats: StoreStats = {
    newCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };

  for (const raw of rawProducts) {
    try {
      // Step 1: Normalize
      const normalized = normalize(raw, store.slug);
      if (!normalized) {
        stats.skippedCount++;
        continue;
      }

      // Step 2: Confidence threshold — skip low-quality listings
      if (normalized.confidenceScore < MIN_CONFIDENCE_SCORE) {
        console.log(
          `[${store.slug}] Low confidence (${normalized.confidenceScore.toFixed(2)}) — skipping: ${normalized.rawTitle}`
        );
        stats.skippedCount++;
        continue;
      }

      // Step 3: Validate with Zod
      const validated = validateListing(normalized);
      if (!validated) {
        stats.skippedCount++;
        continue;
      }

      // Step 4: Upsert
      const isNew = await upsertListing(store.id, validated);
      if (isNew) {
        stats.newCount++;
      } else {
        stats.updatedCount++;
      }
    } catch (err) {
      console.warn(
        `[${store.slug}] Error processing "${raw.externalId}":`,
        err instanceof Error ? err.message : err
      );
      stats.failedCount++;
    }
  }

  // Step 5: Mark listings not seen in this run as inactive
  const inactiveCount = await markStaleListings(store.id, jobStart);

  // Step 6: Write per-item stats back to the ScrapeJob record.
  // BaseScraper already set status=SUCCESS and itemsFound=rawProducts.length.
  // We now update with post-ingestion counts and potentially downgrade to PARTIAL.
  if (scraper.jobId) {
    const finalStatus =
      stats.failedCount > 0 &&
      stats.newCount + stats.updatedCount > 0
        ? ScrapeJobStatus.PARTIAL
        : ScrapeJobStatus.SUCCESS;

    await db.scrapeJob.update({
      where: { id: scraper.jobId },
      data: {
        status: finalStatus,
        itemsFound: rawProducts.length,
        itemsNew: stats.newCount,
        itemsUpdated: stats.updatedCount,
        itemsFailed: stats.failedCount + stats.skippedCount,
      },
    });
  }

  console.log(
    `[${store.slug}] Done — ${stats.newCount} new, ${stats.updatedCount} updated, ` +
    `${stats.skippedCount} skipped, ${stats.failedCount} failed, ${inactiveCount} deactivated`
  );

  return stats;
}

// ── Upsert ────────────────────────────────────────────────────────────────────

/**
 * Upsert a validated listing into the database.
 * Returns true if the listing was newly created, false if updated.
 *
 * On create: writes all fields + initial PriceSnapshot.
 * On update: refreshes mutable fields (price, stock, images, specs).
 *            Writes a PriceSnapshot only when price actually changed.
 *            Refreshes brand association if it was missing or changed.
 */
async function upsertListing(
  storeId: string,
  listing: ValidatedListing
): Promise<boolean> {
  const now = new Date();

  // Resolve brand — upsert so new brands discovered via scraping are created.
  let brandId: string | null = null;
  if (listing.brand) {
    const brand = await db.brand.upsert({
      where: { slug: listing.brand.slug },
      create: { name: listing.brand.name, slug: listing.brand.slug },
      update: { name: listing.brand.name },
    });
    brandId = brand.id;
  }

  const existing = await db.bikeListing.findUnique({
    where: { storeId_externalId: { storeId, externalId: listing.externalId } },
    select: {
      id: true,
      originalPrice: true,
      discountedPrice: true,
      brands: { where: { isPrimary: true }, select: { brandId: true } },
    },
  });

  if (!existing) {
    // ── Create ────────────────────────────────────────────────────────────
    await db.bikeListing.create({
      data: {
        storeId,
        externalId: listing.externalId,
        externalUrl: listing.externalUrl,
        rawTitle: listing.rawTitle,
        modelName: listing.modelName,
        category: listing.category,
        frameMaterial: listing.frameMaterial,
        gender: listing.gender,
        isElectric: listing.isElectric,
        originalPrice: listing.originalPrice,
        discountedPrice: listing.discountedPrice,
        discountPercent: listing.discountPercent,
        currency: "NOK",
        primaryImageUrl: listing.primaryImageUrl,
        imageUrls: listing.imageUrls,
        description: listing.description,
        specifications: listing.specifications ?? undefined,
        isInStock: listing.isInStock,
        isActive: true,
        firstSeenAt: now,
        lastSeenAt: now,
        lastPriceChangeAt: listing.discountPercent > 0 ? now : null,
        confidenceScore: listing.confidenceScore,
        missingFields: listing.missingFields,
        brands: brandId
          ? { create: { brandId, isPrimary: true } }
          : undefined,
        sizes: {
          create: listing.sizes.map((s) => ({
            size: s.size,
            isInStock: s.isInStock,
            quantity: s.quantity ?? null,
          })),
        },
        priceSnapshots: {
          create: {
            originalPrice: listing.originalPrice,
            discountedPrice: listing.discountedPrice,
            discountPercent: listing.discountPercent,
            recordedAt: now,
          },
        },
      },
    });
    return true; // newly created
  }

  // ── Update ──────────────────────────────────────────────────────────────
  const prevDiscounted = Number(existing.discountedPrice);
  const prevOriginal = Number(existing.originalPrice);
  const priceChanged =
    Math.abs(prevDiscounted - listing.discountedPrice) > 0.01 ||
    Math.abs(prevOriginal - listing.originalPrice) > 0.01;

  await db.bikeListing.update({
    where: { id: existing.id },
    data: {
      rawTitle: listing.rawTitle,
      modelName: listing.modelName,
      originalPrice: listing.originalPrice,
      discountedPrice: listing.discountedPrice,
      discountPercent: listing.discountPercent,
      primaryImageUrl: listing.primaryImageUrl,
      imageUrls: listing.imageUrls,
      description: listing.description,
      specifications: listing.specifications ?? undefined,
      isInStock: listing.isInStock,
      isActive: true,
      lastSeenAt: now,
      confidenceScore: listing.confidenceScore,
      missingFields: listing.missingFields,
      ...(priceChanged ? { lastPriceChangeAt: now } : {}),
    },
  });

  // Refresh sizes (delete-and-recreate is simpler than diffing)
  await db.bikeListingSize.deleteMany({ where: { listingId: existing.id } });
  await db.bikeListingSize.createMany({
    data: listing.sizes.map((s) => ({
      listingId: existing.id,
      size: s.size,
      isInStock: s.isInStock,
      quantity: s.quantity ?? null,
    })),
  });

  // Refresh brand association if it changed or was previously missing
  if (brandId) {
    const currentBrandId = existing.brands[0]?.brandId ?? null;
    if (currentBrandId !== brandId) {
      await db.bikeListingBrand.deleteMany({
        where: { listingId: existing.id, isPrimary: true },
      });
      await db.bikeListingBrand.create({
        data: { listingId: existing.id, brandId, isPrimary: true },
      });
    }
  }

  // Record a PriceSnapshot only when price actually changed
  if (priceChanged) {
    await db.priceSnapshot.create({
      data: {
        listingId: existing.id,
        originalPrice: listing.originalPrice,
        discountedPrice: listing.discountedPrice,
        discountPercent: listing.discountPercent,
        recordedAt: now,
      },
    });
  }

  return false; // updated, not new
}

// ── Stale detection ───────────────────────────────────────────────────────────

/**
 * Mark all listings for a store that were NOT seen in this run as inactive.
 * "Not seen" = lastSeenAt is before the job started.
 *
 * This handles products that have been removed from the store's catalogue —
 * they are deactivated rather than deleted, preserving price history.
 */
async function markStaleListings(
  storeId: string,
  jobStart: Date
): Promise<number> {
  const result = await db.bikeListing.updateMany({
    where: {
      storeId,
      isActive: true,
      lastSeenAt: { lt: jobStart },
    },
    data: { isActive: false },
  });
  return result.count;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptySummary(durationMs: number): RunSummary {
  return {
    storesProcessed: 0,
    storesFailed: 0,
    totalNew: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    totalFailed: 0,
    totalInactive: 0,
    durationMs,
  };
}
