import type { PrismaClient } from "@prisma/client";
import type { BikeCategory, FrameMaterial, Gender } from "@prisma/client";

/**
 * Fallback placeholder images per category.
 * Uses picsum.photos seeded URLs — returns real JPEG photographs,
 * consistent per seed string across reseeds, and compatible with next/image.
 */
const CATEGORY_PLACEHOLDER_IMAGES: Record<BikeCategory, string> = {
  ROAD:   "https://picsum.photos/seed/road-cycling/800/600",
  GRAVEL: "https://picsum.photos/seed/gravel-cycling/800/600",
  MTB:    "https://picsum.photos/seed/mountain-biking/800/600",
  EBIKE:  "https://picsum.photos/seed/electric-bicycle/800/600",
  TT:     "https://picsum.photos/seed/triathlon-cycling/800/600",
};

export type SeedSize = {
  size: string;
  inStock: boolean;
  quantity?: number;
};

export type SeedPricePoint = {
  originalPrice: number;
  discountedPrice: number;
  daysAgo: number;
};

export type SeedListingInput = {
  storeSlug: string;
  brandSlug: string;
  externalId: string;
  externalUrl: string;
  rawTitle: string;
  modelName: string;
  category: BikeCategory;
  frameMaterial: FrameMaterial;
  gender: Gender;
  isElectric: boolean;
  originalPrice: number;
  discountedPrice: number;
  description: string;
  specifications: Record<string, string>;
  sizes: SeedSize[];
  /** Optional image URL. Falls back to a per-category placeholder when omitted. */
  primaryImageUrl?: string;
  /**
   * Explicit price history. Each point is recorded `daysAgo` days in the past.
   * If omitted, a default 3-point history is generated:
   *   - 90 days ago at full price
   *   - 35 days ago at discounted price
   *   - today at discounted price
   */
  priceHistory?: SeedPricePoint[];
};

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function calcDiscountPercent(original: number, discounted: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - discounted) / original) * 100);
}

/**
 * Seed a single listing idempotently. Skips if already exists.
 */
export async function seedListing(
  db: PrismaClient,
  stores: Map<string, string>,
  brands: Map<string, string>,
  data: SeedListingInput
): Promise<void> {
  const storeId = stores.get(data.storeSlug);
  const brandId = brands.get(data.brandSlug);

  if (!storeId) throw new Error(`Store not found in seed map: ${data.storeSlug}`);
  if (!brandId) throw new Error(`Brand not found in seed map: ${data.brandSlug}`);

  const existing = await db.bikeListing.findUnique({
    where: { storeId_externalId: { storeId, externalId: data.externalId } },
    select: { id: true },
  });
  if (existing) return;

  const discountPercent = calcDiscountPercent(data.originalPrice, data.discountedPrice);
  const isInStock = data.sizes.some((s) => s.inStock);
  const now = new Date();
  const firstSeen = daysAgo(90);

  const history: SeedPricePoint[] = data.priceHistory ?? [
    { originalPrice: data.originalPrice, discountedPrice: data.originalPrice, daysAgo: 90 },
    { originalPrice: data.originalPrice, discountedPrice: data.discountedPrice, daysAgo: 35 },
    { originalPrice: data.originalPrice, discountedPrice: data.discountedPrice, daysAgo: 0 },
  ];

  const listing = await db.bikeListing.create({
    data: {
      storeId,
      externalId: data.externalId,
      externalUrl: data.externalUrl,
      rawTitle: data.rawTitle,
      modelName: data.modelName,
      category: data.category,
      frameMaterial: data.frameMaterial,
      gender: data.gender,
      isElectric: data.isElectric,
      originalPrice: data.originalPrice,
      discountedPrice: data.discountedPrice,
      discountPercent,
      currency: "NOK",
      primaryImageUrl: data.primaryImageUrl ?? CATEGORY_PLACEHOLDER_IMAGES[data.category],
      imageUrls: [data.primaryImageUrl ?? CATEGORY_PLACEHOLDER_IMAGES[data.category]],
      description: data.description,
      specifications: data.specifications,
      isInStock,
      isActive: true,
      firstSeenAt: firstSeen,
      lastSeenAt: now,
      lastPriceChangeAt: daysAgo(35),
      confidenceScore: 0.9,
      missingFields: [],
      brands: { create: { brandId, isPrimary: true } },
      sizes: {
        create: data.sizes.map((s) => ({
          size: s.size,
          isInStock: s.inStock,
          quantity: s.quantity ?? null,
        })),
      },
    },
  });

  for (const snap of history) {
    await db.priceSnapshot.create({
      data: {
        listingId: listing.id,
        originalPrice: snap.originalPrice,
        discountedPrice: snap.discountedPrice,
        discountPercent: calcDiscountPercent(snap.originalPrice, snap.discountedPrice),
        recordedAt: daysAgo(snap.daysAgo),
      },
    });
  }
}
