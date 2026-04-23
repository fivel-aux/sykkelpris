import type {
  BikeListing,
  BikeListingSize,
  BikeListingBrand,
  Brand,
  Store,
  PriceSnapshot,
  BikeCategory,
  FrameMaterial,
  Gender,
} from "@prisma/client";

/**
 * A BikeListing as returned by the API — all Decimal fields serialized to numbers,
 * relations included.
 */
export type BikeListingDTO = {
  id: string;
  externalUrl: string;
  rawTitle: string;
  modelName: string;
  category: BikeCategory;
  frameMaterial: FrameMaterial;
  gender: Gender;
  isElectric: boolean;

  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  currency: string;

  primaryImageUrl: string | null;
  imageUrls: string[];

  description: string | null;
  specifications: Record<string, string> | null;

  isInStock: boolean;
  isActive: boolean;

  firstSeenAt: string;
  lastSeenAt: string;
  lastPriceChangeAt: string | null;

  confidenceScore: number;

  store: {
    id: string;
    name: string;
    slug: string;
    url: string;
    logoUrl: string | null;
  };

  brands: {
    id: string;
    name: string;
    slug: string;
    isPrimary: boolean;
  }[];

  primaryBrand: {
    id: string;
    name: string;
    slug: string;
  } | null;

  sizes: {
    size: string;
    isInStock: boolean;
    quantity: number | null;
  }[];
};

/**
 * BikeListingDTO with price history — used on the detail page
 */
export type BikeListingDetailDTO = BikeListingDTO & {
  priceHistory: {
    originalPrice: number;
    discountedPrice: number;
    discountPercent: number;
    recordedAt: string;
  }[];
};

/**
 * Filters accepted by the /api/listings endpoint
 */
export type ListingFilters = {
  q?: string;
  category?: BikeCategory[];
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  brands?: string[]; // brand slugs
  stores?: string[]; // store slugs
  sizes?: string[];
  gender?: Gender;
  frameMaterial?: FrameMaterial;
  electric?: boolean;
  inStock?: boolean;
  sort?: "price_asc" | "price_desc" | "discount_desc" | "newest";
  page?: number;
  limit?: number;
};

/**
 * Paginated response for listing queries
 */
export type ListingsResponse = {
  listings: BikeListingDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type StatsDTO = {
  storeCount: number;
  listingCount: number;
  lastUpdatedAt: string | null;
};

// ── Metadata DTOs ─────────────────────────────────────────────────────────────

export type BrandDTO = {
  id: string;
  name: string;
  slug: string;
  /** Number of active listings where this brand is the primary brand. */
  listingCount: number;
};

export type StoreDTO = {
  id: string;
  name: string;
  slug: string;
  url: string;
  logoUrl: string | null;
  lastScrapedAt: string | null;
  listingCount: number;
};

/**
 * Compact shape used by the filter panel — value/label/count per option.
 * Kept separate from BrandDTO/StoreDTO so each can evolve independently.
 */
export type FilterOption = {
  value: string; // slug
  label: string; // display name
  count: number; // active listing count
};

export type FilterOptionsDTO = {
  brands: FilterOption[];
  stores: FilterOption[];
};

/** A single price snapshot — price-history endpoint and detail page. */
export type PriceSnapshotDTO = {
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  recordedAt: string; // ISO string
};
