/**
 * The raw product shape returned by any scraper before normalization.
 * Fields are loosely typed — normalization will clean them up.
 */
export interface RawProduct {
  /** Store's own product identifier (SKU, slug, numeric ID) */
  externalId: string;
  /** Direct URL to the product page on the store */
  externalUrl: string;
  /** Full product title as shown on the store */
  rawTitle: string;
  /** Original (non-discounted) price in NOK */
  originalPrice: number | null;
  /** Current selling price in NOK */
  currentPrice: number | null;
  /** Main product image URL */
  imageUrl: string | null;
  /** Additional image URLs */
  additionalImageUrls?: string[];
  /** Product description text */
  description?: string | null;
  /** Raw sizes — may be strings like "Small", "M", "52 cm", etc. */
  sizes?: RawSize[];
  /** Free-form key-value specs from the product page */
  rawSpecs?: Record<string, string>;
  /** Raw category hint from the store (e.g. "Road Bikes", "Sykler > Terrengsykkel") */
  rawCategory?: string | null;
  /** Raw brand string as shown on the store */
  rawBrand?: string | null;
  /** Raw gender hint */
  rawGender?: string | null;
  /** Whether the product is listed as in stock (if known) */
  isInStock?: boolean;
  /**
   * Whether the size data for this product is reliable.
   * Set to false by scrapers that fetch a separate detail page when that
   * fetch fails (e.g. 429 / timeout). The runner uses this to decide
   * whether to update stored sizes and isInStock, or preserve existing DB data.
   * Defaults to true (undefined treated as true).
   */
  sizesConfident?: boolean;
  /** Timestamp when this product was scraped */
  scrapedAt: Date;
}

export interface RawSize {
  label: string;        // e.g. "M", "52", "Large"
  isInStock: boolean;
  quantity?: number;
}
