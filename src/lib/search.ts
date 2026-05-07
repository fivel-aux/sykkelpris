import { Prisma } from "@prisma/client";
import type { BikeCategory, FrameMaterial, Gender } from "@prisma/client";
import type { ListingFilters, BikeListingDTO } from "@/types/bike";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./constants";
import { parseAndValidateParams } from "./schemas";
import { listingEligibility } from "./eligibility";

/**
 * Builds a Prisma WhereInput from the filter params sent by the client.
 * All filters are applied as AND conditions.
 */
export function buildWhereClause(
  filters: ListingFilters
): Prisma.BikeListingWhereInput {
  const where: Prisma.BikeListingWhereInput = { ...listingEligibility() };

  if (filters.inStock) {
    where.isInStock = true;
  }

  if (filters.category && filters.category.length > 0) {
    where.category = { in: filters.category };
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.discountedPrice = {
      ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
      ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
    };
  }

  if (filters.minDiscount !== undefined && filters.minDiscount > 0) {
    where.discountPercent = { gte: filters.minDiscount };
  }

  if (filters.brands && filters.brands.length > 0) {
    where.brands = {
      some: {
        brand: { slug: { in: filters.brands } },
        isPrimary: true,
      },
    };
  }

  if (filters.stores && filters.stores.length > 0) {
    where.store = { slug: { in: filters.stores } };
  }

  if (filters.gender) {
    where.gender = filters.gender;
  }

  if (filters.frameMaterial) {
    where.frameMaterial = filters.frameMaterial;
  }

  if (typeof filters.electric === "boolean") {
    where.isElectric = filters.electric;
  }

  if (filters.q && filters.q.trim().length > 0) {
    const tokens = tokenizeQuery(filters.q);
    where.AND = tokens.map((token) => {
      const variants = [token, ...getSynonyms(token)];
      return {
        OR: variants.flatMap((v) => [
          { modelName: { contains: v, mode: "insensitive" as const } },
          { rawTitle: { contains: v, mode: "insensitive" as const } },
          { brands: { some: { brand: { name: { contains: v, mode: "insensitive" as const } } } } },
        ]),
      };
    });
  }

  if (filters.sizes && filters.sizes.length > 0) {
    where.sizes = {
      some: {
        size: { in: filters.sizes },
        isInStock: true,
      },
    };
    // Bikester marks all sizes as isInStock regardless of reality — exclude it
    // when a size filter is active to avoid misleading results.
    const notBikester = { NOT: { store: { slug: "bikester" } } };
    where.AND = Array.isArray(where.AND) ? [...where.AND, notBikester] : [notBikester];
  }

  return where;
}

/**
 * Builds a Prisma OrderByInput from the sort param.
 */
export function buildOrderBy(
  sort?: ListingFilters["sort"]
): Prisma.BikeListingOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ discountedPrice: "asc" }];
    case "price_desc":
      return [{ discountedPrice: "desc" }];
    case "discount_desc":
      return [{ discountPercent: "desc" }, { discountedPrice: "asc" }];
    case "newest":
    default:
      return [{ lastSeenAt: "desc" }];
  }
}

/**
 * Parse and sanitize pagination params.
 */
export function parsePagination(
  page?: number,
  limit?: number
): { skip: number; take: number; page: number } {
  const safePage = Math.max(1, Math.floor(page ?? 1));
  const safeLimit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(limit ?? DEFAULT_PAGE_SIZE))
  );
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    page: safePage,
  };
}

/**
 * Parse URL search params into ListingFilters.
 *
 * Delegates all parsing and validation to the shared Zod schema in `schemas.ts`.
 * Invalid values are silently coerced to `undefined` — never throws.
 * Used by server component pages where a bad URL param should degrade gracefully,
 * not crash the render.
 */
export function parseFiltersFromSearchParams(
  params: URLSearchParams
): ListingFilters {
  const d = parseAndValidateParams(params);

  return {
    q: d.q,
    // Filter out empty arrays so downstream code treats "no selection" as undefined
    category:
      d.category && d.category.length > 0
        ? (d.category as BikeCategory[])
        : undefined,
    minPrice: d.minPrice,
    maxPrice: d.maxPrice,
    minDiscount: d.minDiscount,
    brands: d.brands && d.brands.length > 0 ? d.brands : undefined,
    stores: d.stores && d.stores.length > 0 ? d.stores : undefined,
    sizes: d.sizes && d.sizes.length > 0 ? d.sizes : undefined,
    gender: d.gender as Gender | undefined,
    frameMaterial: d.frameMaterial as FrameMaterial | undefined,
    electric: d.electric,
    inStock: d.inStock ?? false,
    sort: d.sort as ListingFilters["sort"],
    page: d.page,
    limit: d.limit,
  };
}

// ── Synonyms ──────────────────────────────────────────────────────────────────

// High-confidence synonym pairs — Norwegian ↔ English bike vocabulary.
// Each entry is bidirectional: both directions must be listed explicitly.
// Keep this list small and precise. Broad or ambiguous pairs do not belong here.
const SYNONYMS: Record<string, string[]> = {
  "mtb":        ["terreng"],
  "terreng":    ["mtb"],
  "gravel":     ["grus"],
  "grus":       ["gravel"],
  "tt":         ["triatlon"],
  "triatlon":   ["tt"],
  "fulldempet": ["heldempet"],
  "heldempet":  ["fulldempet"],
  "elsykkel":   ["e-bike"],
  "e-bike":     ["elsykkel"],
};

function getSynonyms(token: string): string[] {
  return SYNONYMS[token.toLowerCase()] ?? [];
}

// ── Search utilities ──────────────────────────────────────────────────────────

/**
 * Normalize and split a search query into tokens.
 * Applies lightweight term normalization before splitting.
 *
 * "Trek Fuel EX" → ["Trek", "Fuel", "EX"]
 * "29er MTB"     → ["29", "MTB"]
 */
export function tokenizeQuery(q: string): string[] {
  return q.trim().replace(/\b29er\b/gi, "29").split(/\s+/).filter(Boolean);
}

// Stores that provide reliable per-size in-stock data.
// Must stay in sync with RELIABLE_SIZE_STORES in the normalizer.
export const RELIABLE_SIZE_STORE_SLUGS = [
  "unaas",
  "bikeshop",
  "canyon",
  "birk",
  "sykkelbutikken",
  "lillehammersport",
  "poie",
  "sykkeloutlet",
] as const;

/**
 * Score a listing for the "Mest relevant" default sort mode.
 *
 * Applied in-memory after the DB query — the WHERE clause determines which
 * listings are in the result set; this determines their ordering quality.
 *
 * Score components:
 *   +20 per active size filter value that is in stock on this listing (stackable)
 *   + 8 has ≥1 in-stock size, from a reliable store
 *   + 4 has ≥1 in-stock size, from any other store
 *   + 1 per in-stock size beyond the first, capped at 5
 *   + discountPercent × 0.25   (30% → +7.5, 50% → +12.5)
 *   + up to 3 for freshly confirmed offers (decays linearly over ~6 days)
 */
export function scoreRelevance(
  listing: BikeListingDTO,
  filters: ListingFilters
): number {
  let score = 0;

  // Active size filter match — large per-size boost
  if (filters.sizes && filters.sizes.length > 0) {
    const matchCount = listing.sizes.filter(
      (s) => s.isInStock && filters.sizes!.includes(s.size)
    ).length;
    score += matchCount * 20;
  }

  // Availability quality
  const hasInStockSize = listing.sizes.some((s) => s.isInStock);
  const isReliableStore = (RELIABLE_SIZE_STORE_SLUGS as readonly string[]).includes(
    listing.store.slug
  );
  if (hasInStockSize) score += isReliableStore ? 8 : 4;

  // Breadth of in-stock sizes — small boost, capped so large catalogs don't dominate
  const inStockCount = listing.sizes.filter((s) => s.isInStock).length;
  score += Math.min(inStockCount, 5);

  // Discount — moderate weight, not dominant
  score += listing.discountPercent * 0.25;

  // Recency — small boost for freshly confirmed offers, decays over ~6 days
  const daysSince =
    (Date.now() - new Date(listing.lastSeenAt).getTime()) / 86_400_000;
  score += Math.max(0, 3 - daysSince * 0.5);

  return score;
}

/**
 * Score a listing's relevance to a tokenized search query.
 * Only used to re-order an already-matching result set — does not affect
 * which listings are returned (that is handled by the WHERE clause).
 *
 * Score per token (summed across all tokens):
 *   +4  token found in the first 40% of modelName  → model-identity signal
 *   +2  token found in modelName (anywhere)         → model signal
 *   +1  token found in rawTitle only                → weaker store-text signal
 *   +1  token exactly equals the primary brand name → brand bonus
 *
 * Equal scores preserve the DB's original order (stable sort), which makes
 * the user's active sort option the natural tiebreaker.
 */
export function scoreSearchResult(
  modelName: string,
  rawTitle: string,
  brandName: string | null | undefined,
  tokens: string[]
): number {
  const model = modelName.toLowerCase();
  const title = rawTitle.toLowerCase();
  const brand = (brandName ?? "").toLowerCase();

  let score = 0;

  for (const raw of tokens) {
    const token = raw.toLowerCase();
    const modelIdx = model.indexOf(token);

    if (modelIdx !== -1) {
      score += modelIdx < model.length * 0.4 ? 4 : 2;
    } else if (title.includes(token)) {
      score += 1;
    }

    if (brand === token) {
      score += 1;
    }
  }

  return score;
}
