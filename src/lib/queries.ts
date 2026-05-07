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
import { sortSizeLabels } from "./sizes";
import {
  buildWhereClause,
  buildOrderBy,
  parsePagination,
  tokenizeQuery,
  scoreSearchResult,
  scoreRelevance,
  RELIABLE_SIZE_STORE_SLUGS,
} from "./search";

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

  let listings = raws.map(toDTO);

  // Re-sort the fetched page by score.
  //
  // "Mest relevant" (sort === undefined): composite relevance score + optional text score.
  // Explicit sort + active text query: DB sort is primary, text score refines within the page.
  const hasTextQuery = !!filters.q?.trim();

  if (!filters.sort) {
    const tokens = hasTextQuery ? tokenizeQuery(filters.q!) : [];
    listings = listings.sort((a, b) => {
      const sA = scoreRelevance(a, filters) +
        (tokens.length > 0 ? scoreSearchResult(a.modelName, a.rawTitle, a.primaryBrand?.name, tokens) : 0);
      const sB = scoreRelevance(b, filters) +
        (tokens.length > 0 ? scoreSearchResult(b.modelName, b.rawTitle, b.primaryBrand?.name, tokens) : 0);
      return sB - sA;
    });
  } else if (hasTextQuery) {
    const tokens = tokenizeQuery(filters.q!);
    if (tokens.length > 0) {
      listings = listings.sort((a, b) =>
        scoreSearchResult(b.modelName, b.rawTitle, b.primaryBrand?.name, tokens) -
        scoreSearchResult(a.modelName, a.rawTitle, a.primaryBrand?.name, tokens)
      );
    }
  }

  return {
    listings,
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
    sizes: [],
  };
}

/**
 * Fetch filter option counts that reflect the current active filter state.
 *
 * For each filter group, all other active filters are held constant while
 * the count for each option in that group is computed. Within-group logic
 * is OR (matching buildWhereClause): selecting an additional brand/store
 * adds to the result set, not narrows it.
 *
 * Count semantics:
 *   brand X → how many results with all current filters + brand X in brands list
 *   store S → how many results with all current filters + store S in stores list
 *
 * Zero-count options are included if they are currently selected (so users
 * can uncheck them), and omitted if unselected (keeps the list clean).
 */
export async function getDynamicFilterOptions(
  filters: ListingFilters
): Promise<FilterOptionsDTO> {
  const activeBrands = filters.brands ?? [];
  const activeStores = filters.stores ?? [];

  // Base where for each group — strip that group's own filter so we don't
  // double-apply it when we add it back per-option below.
  const brandBase = buildWhereClause({ ...filters, brands: undefined });
  const storeBase = buildWhereClause({ ...filters, stores: undefined });

  // Fetch the global list of eligible brands/stores to iterate over.
  const [allBrands, allStores] = await Promise.all([getBrands(), getStores()]);

  // Run one count per brand in parallel.
  const brandCounts = await Promise.all(
    allBrands.map(async (b) => {
      const slugs = [...new Set([...activeBrands, b.slug])];
      const count = await db.bikeListing.count({
        where: {
          ...brandBase,
          brands: { some: { brand: { slug: { in: slugs } }, isPrimary: true } },
        },
      });
      return { value: b.slug, label: b.name, count };
    })
  );

  // Run one count per store in parallel.
  const storeCounts = await Promise.all(
    allStores.map(async (s) => {
      const slugs = [...new Set([...activeStores, s.slug])];
      const count = await db.bikeListing.count({
        where: {
          ...storeBase,
          store: { slug: { in: slugs } },
        },
      });
      return { value: s.slug, label: s.name, count };
    })
  );

  // Available sizes — only from stores with reliable per-size stock data,
  // and only sizes currently in stock for eligible listings.
  const rawSizes = await db.bikeListingSize.findMany({
    where: {
      isInStock: true,
      listing: {
        ...listingEligibility(),
        store: { slug: { in: [...RELIABLE_SIZE_STORE_SLUGS] } },
      },
    },
    select: { size: true },
    distinct: ["size"],
  });

  return {
    brands: brandCounts,
    stores: storeCounts,
    sizes: sortSizeLabels(rawSizes.map((r) => r.size)),
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

export interface MarketShortcut {
  label: string;
  count: number;
  href: string;
}

/**
 * Fetch live counts for the homepage market shortcuts.
 * Each shortcut maps to a meaningful filtered catalog URL.
 * Runs 4 parallel count queries — cheap and fast.
 */
export async function getMarketShortcuts(): Promise<MarketShortcut[]> {
  const base = listingEligibility();

  const [road, gravel, mtb, ebike, tt] = await Promise.all([
    db.bikeListing.count({ where: { ...base, category: "ROAD" } }),
    db.bikeListing.count({ where: { ...base, category: "GRAVEL" } }),
    db.bikeListing.count({ where: { ...base, category: "MTB" } }),
    db.bikeListing.count({ where: { ...base, category: "EBIKE" } }),
    db.bikeListing.count({ where: { ...base, category: "TT" } }),
  ]);

  return [
    { label: "Landeveissykler", count: road, href: "/sykler?category=ROAD" },
    { label: "Grusykler", count: gravel, href: "/sykler?category=GRAVEL" },
    { label: "Terrengsykler", count: mtb, href: "/sykler?category=MTB" },
    { label: "Elsykler", count: ebike, href: "/sykler?category=EBIKE" },
    { label: "TT / Triatlon", count: tt, href: "/sykler?category=TT" },
  ];
}

/**
 * Fetch stats for the trust bar.
 */
export async function getStats() {
  const [storeCount, listingCount, lastListing] = await Promise.all([
    db.store.count({ where: { isActive: true } }),
    db.bikeListing.count({ where: listingEligibility() }),
    db.bikeListing.findFirst({
      where: listingEligibility(),
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
