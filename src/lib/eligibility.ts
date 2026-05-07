import type { Prisma } from "@prisma/client";

/**
 * A listing is considered stale after this many days without a confirmed scrape.
 * Scrapers must run at least this frequently to keep their listings visible.
 */
export const MAX_LISTING_AGE_DAYS = 7;

/**
 * Returns the minimum conditions a BikeListing must satisfy to appear in the catalog.
 * Called at query time so the freshness cutoff is always computed against now.
 *
 * Rules:
 *   isActive         — was seen in the most recent scrape run; prevents showing
 *                      bikes removed or sold out at the retailer
 *   discountPercent  — must carry a genuine price reduction; this is a discounted-
 *                      bikes catalog, not a general one
 *   primaryImageUrl  — must have a product image; an imageless card is not fit for
 *                      a visual catalog
 *   lastSeenAt       — must have been confirmed present within MAX_LISTING_AGE_DAYS;
 *                      prevents showing stale data when a scraper stops running
 *
 * To add a new platform rule: extend the returned object. It propagates automatically
 * to the catalog list, featured deals, detail pages, and filter counts.
 */
export function listingEligibility(): Prisma.BikeListingWhereInput {
  const cutoff = new Date(Date.now() - MAX_LISTING_AGE_DAYS * 24 * 60 * 60 * 1000);
  return {
    isActive: true,
    isInStock: true,
    discountPercent: { gte: 5 },
    primaryImageUrl: { not: null },
    lastSeenAt: { gte: cutoff },
  };
}
