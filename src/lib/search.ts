import { Prisma } from "@prisma/client";
import type { BikeCategory, FrameMaterial, Gender } from "@prisma/client";
import type { ListingFilters } from "@/types/bike";
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
    const q = filters.q.trim();
    where.OR = [
      { modelName: { contains: q, mode: "insensitive" } },
      { rawTitle: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      {
        brands: {
          some: { brand: { name: { contains: q, mode: "insensitive" } } },
        },
      },
    ];
  }

  if (filters.sizes && filters.sizes.length > 0) {
    where.sizes = {
      some: {
        size: { in: filters.sizes },
        isInStock: true,
      },
    };
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
