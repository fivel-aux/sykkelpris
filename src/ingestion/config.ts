/**
 * Ingestion pipeline constants.
 * Single source of truth — import from here, not inline magic numbers.
 */

/**
 * Listings with a confidence score below this threshold are skipped during
 * ingestion. Prevents low-quality data (no brand, no image, no sizes) from
 * reaching the frontend.
 *
 * Score is computed in normalizer/index.ts:
 *   1.0 base − 0.2 per missing important field − 0.1 if no discount signal
 * A score of 0.4 means at most 3 important fields are missing.
 */
export const MIN_CONFIDENCE_SCORE = 0.4;

/**
 * A listing is considered stale if it was not seen in the current scrape run.
 * The runner marks stale listings inactive using `lastSeenAt < jobStart`.
 * This constant is informational — the actual cutoff is the job start time.
 */
export const STALE_THRESHOLD_DESCRIPTION =
  "Listings not touched in the current run are marked inactive.";

/**
 * Polite delay between paginated requests within a single scraper (ms).
 * Each scraper may use a different value, but this is the recommended default.
 */
export const DEFAULT_REQUEST_DELAY_MS = 500;

/**
 * HTTP request timeout for all scraper fetch calls (ms).
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Maximum number of pages to scrape per category in a single run.
 * Prevents runaway pagination on misconfigured or unexpectedly large stores.
 */
export const MAX_PAGES_PER_CATEGORY = 20;

/**
 * Minimum price (NOK) for a listing to be considered valid.
 * Filters out accessories priced under this threshold.
 */
export const MIN_PRICE_NOK = 3_000;

/**
 * Maximum price (NOK) for a listing to be considered valid.
 * Filters out obvious data errors.
 */
export const MAX_PRICE_NOK = 500_000;

/**
 * Minimum discount percentage for a listing to enter the catalog.
 * Listings at 0–4% discount are effectively full price (currency-conversion
 * rounding noise, marginal retailer price differences) and should not appear
 * as "deals". Applied centrally in the normalizer so every scraper follows
 * the same rule automatically.
 */
export const MIN_DISCOUNT_PERCENT = 5;
