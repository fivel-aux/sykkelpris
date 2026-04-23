import { db } from "./db";
import { listingEligibility } from "./eligibility";
import type {
  BikeListingDTO,
  BikeListingDetailDTO,
  BrandDTO,
  StoreDTO,
  FilterOptionsDTO,
  PriceSnapshotDTO,
  ListingFilters,
} from "@/types/bike";
import { toNumber } from "./formatters";
import { buildWhereClause, buildOrderBy, parsePagination } from "./search";

/**
 * The standard include for listing queries — used by both list and detail endpoints.
 */
const listingInclude = {
  store: {
    select: { id: true, name: true, slug: true, url: true, logoUrl: true },
  },
  brands: {
    include: { brand: { select: { id: true, name: true, slug: true } } },
  },
  sizes: {
    select: { size: true, isInStock: true, quantity: true },
    orderBy: { size: "asc" as const },
  },
} as const;

/**
 * Map a raw Prisma listing result to a serializable BikeListingDTO.
 * Converts Decimal to number and Date to ISO string.
 */
function toDTO(raw: any): BikeListingDTO {
  return {
    id: raw.id,
    externalUrl: raw.externalUrl,
    rawTitle: raw.rawTitle,
    modelName: raw.modelName,
    category: raw.category,
    frameMaterial: raw.frameMaterial,
    gender: raw.gender,
    isElectric: raw.isElectric,
    originalPrice: toNumber(raw.originalPrice),
    discountedPrice: toNumber(raw.discountedPrice),
    discountPercent: raw.discountPercent,
    currency: raw.currency,
    primaryImageUrl: raw.primaryImageUrl,
    imageUrls: raw.imageUrls,
    description: raw.description,
    specifications: raw.specifications as Record<string, string> | null,
    isInStock: raw.isInStock,
    isActive: raw.isActive,
    firstSeenAt: raw.firstSeenAt.toISOString(),
    lastSeenAt: raw.lastSeenAt.toISOString(),
    lastPriceChangeAt: raw.lastPriceChangeAt?.toISOString() ?? null,
    confidenceScore: raw.confidenceScore,
    store: raw.store,
    brands: raw.brands.map((b: any) => ({
      id: b.brand.id,
      name: b.brand.name,
      slug: b.brand.slug,
      isPrimary: b.isPrimary,
    })),
    primaryBrand:
      raw.brands.find((b: any) => b.isPrimary)?.brand ?? raw.brands[0]?.brand ?? null,
    sizes: raw.sizes,
  };
}

/**
 * Fetch paginated listings with filters.
 */
export async function getListings(filters: ListingFilters) {
  const where = buildWhereClause(filters);
  const orderBy = buildOrderBy(filters.sort);
  const { skip, take, page } = parsePagination(filters.page, filters.limit);

  const [total, raws] = await Promise.all([
    db.bikeListing.count({ where }),
    db.bikeListing.findMany({ where, orderBy, skip, take, include: listingInclude }),
  ]);

  return {
    listings: raws.map(toDTO),
    total,
    page,
    pageSize: take,
    totalPages: Math.ceil(total / take),
  };
}

/**
 * Fetch a single listing with price history.
 */
export async function getListingById(id: string): Promise<BikeListingDetailDTO | null> {
  const raw = await db.bikeListing.findFirst({
    where: { id, ...listingEligibility() },
    include: {
      ...listingInclude,
      priceSnapshots: {
        orderBy: { recordedAt: "asc" },
        take: 90, // last 90 data points
      },
    },
  });

  if (!raw) return null;

  const base = toDTO(raw);
  return {
    ...base,
    priceHistory: raw.priceSnapshots.map((s: any) => ({
      originalPrice: toNumber(s.originalPrice),
      discountedPrice: toNumber(s.discountedPrice),
      discountPercent: s.discountPercent,
      recordedAt: s.recordedAt.toISOString(),
    })),
  };
}

/**
 * Fetch featured deals for the homepage — highest discount, in stock.
 */
export async function getFeaturedDeals(limit = 6): Promise<BikeListingDTO[]> {
  const raws = await db.bikeListing.findMany({
    where: { ...listingEligibility(), isInStock: true, discountPercent: { gte: 10 } },
    orderBy: [{ discountPercent: "desc" }, { discountedPrice: "asc" }],
    take: limit,
    include: listingInclude,
  });
  return raws.map(toDTO);
}

/**
 * Fetch all brands that have at least one active primary listing.
 * Used by GET /api/brands.
 */

export async function getBrands(): Promise<BrandDTO[]> {
  const brands = await db.brand.findMany({
    where: {
      listings: {
        some: { isPrimary: true, listing: listingEligibility() },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          listings: {
            where: { isPrimary: true, listing: listingEligibility() },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return brands.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    listingCount: b._count.listings,
  }));
}

/**
 * Fetch all active stores that ship to Norway.
 * Used by GET /api/stores.
 */
export async function getStores(): Promise<StoreDTO[]> {
  const stores = await db.store.findMany({
    where: { isActive: true, shipsToNorway: true },
    select: {
      id: true,
      name: true,
      slug: true,
      url: true,
      logoUrl: true,
      lastScrapedAt: true,
      _count: {
        select: { listings: { where: listingEligibility() } },
      },
    },
    orderBy: { name: "asc" },
  });

  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    url: s.url,
    logoUrl: s.logoUrl,
    lastScrapedAt: s.lastScrapedAt?.toISOString() ?? null,
    listingCount: s._count.listings,
  }));
}

/**
 * Fetch filter panel data — brands and stores formatted as { value, label, count }.
 * Used by GET /api/filter-options and server component pages.
 *
 * Derives from getBrands/getStores so listing counts stay consistent.
 */
export async function getFilterOptions(): Promise<FilterOptionsDTO> {
  const [brands, stores] = await Promise.all([getBrands(), getStores()]);
  return {
    brands: brands
      .filter((b) => b.listingCount > 0)
      .map((b) => ({ value: b.slug, label: b.name, count: b.listingCount })),
    stores: stores
      .filter((s) => s.listingCount > 0)
      .map((s) => ({ value: s.slug, label: s.name, count: s.listingCount })),
  };
}

/**
 * Fetch price history for a single listing.
 * Returns null if the listing does not exist.
 * Used by GET /api/listings/[id]/price-history.
 */
export async function getPriceHistory(
  id: string
): Promise<PriceSnapshotDTO[] | null> {
  const row = await db.bikeListing.findUnique({
    where: { id },
    select: {
      priceSnapshots: {
        orderBy: { recordedAt: "asc" },
        take: 90,
        select: {
          originalPrice: true,
          discountedPrice: true,
          discountPercent: true,
          recordedAt: true,
        },
      },
    },
  });

  if (!row) return null;

  return row.priceSnapshots.map((s) => ({
    originalPrice: toNumber(s.originalPrice),
    discountedPrice: toNumber(s.discountedPrice),
    discountPercent: s.discountPercent,
    recordedAt: s.recordedAt.toISOString(),
  }));
}

/**
 * Fetch stats for the trust bar.
 */
export async function getStats() {
  const [storeCount, listingCount, lastListing] = await Promise.all([
    db.store.count({ where: { isActive: true } }),
    db.bikeListing.count({ where: { isActive: true } }),
    db.bikeListing.findFirst({
      where: { isActive: true },
      orderBy: { lastSeenAt: "desc" },
      select: { lastSeenAt: true },
    }),
  ]);

  return {
    storeCount,
    listingCount,
    lastUpdatedAt: lastListing?.lastSeenAt.toISOString() ?? null,
  };
}
