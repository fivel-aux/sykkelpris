import { z } from "zod";
import { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from "./constants";

// ── Valid enum values (string literals matching Prisma enums) ─────────────────

const VALID_CATEGORIES = ["ROAD", "GRAVEL", "MTB", "EBIKE", "TT"] as const;
const VALID_MATERIALS = [
  "CARBON",
  "ALUMINUM",
  "STEEL",
  "TITANIUM",
  "UNKNOWN",
] as const;
const VALID_GENDERS = ["MENS", "WOMENS", "UNISEX"] as const;
const VALID_SORTS = [
  "price_asc",
  "price_desc",
  "discount_desc",
  "newest",
] as const;

// ── Reusable field transforms ─────────────────────────────────────────────────

/**
 * Split a comma-separated string into a trimmed, non-empty array.
 * "ROAD,MTB" → ["ROAD", "MTB"]
 */
function csvSplit(s: string): string[] {
  return s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Convert "true"/"false" strings to booleans.
 * Any other value falls through to .catch(undefined).
 */
const boolString = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

// ── Main schema ───────────────────────────────────────────────────────────────

/**
 * Validates and transforms raw URLSearchParams values into a typed filter object.
 *
 * Design choices:
 * - `.catch(undefined)` on all optional fields: invalid values silently degrade
 *   to undefined instead of crashing. This is intentional — query params come
 *   from the browser URL and we never want a bad param to 500 the page.
 * - Unknown keys are stripped (Zod default).
 * - Numbers use `z.coerce` to handle string → number conversion from URLSearchParams.
 * - The output type is structurally compatible with `ListingFilters` from types/bike.ts.
 */
export const listingQuerySchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),

  category: z
    .string()
    .transform((s) =>
      csvSplit(s).filter(
        (v): v is (typeof VALID_CATEGORIES)[number] =>
          (VALID_CATEGORIES as readonly string[]).includes(v)
      )
    )
    .optional()
    .catch(undefined),

  minPrice: z.coerce.number().nonnegative().optional().catch(undefined),
  maxPrice: z.coerce.number().positive().optional().catch(undefined),
  minDiscount: z.coerce.number().min(0).max(100).optional().catch(undefined),

  brands: z.string().transform(csvSplit).optional().catch(undefined),
  stores: z.string().transform(csvSplit).optional().catch(undefined),
  sizes: z.string().transform(csvSplit).optional().catch(undefined),

  gender: z.enum(VALID_GENDERS).optional().catch(undefined),
  frameMaterial: z.enum(VALID_MATERIALS).optional().catch(undefined),

  electric: boolString.optional().catch(undefined),
  inStock: boolString.optional().catch(undefined),

  sort: z.enum(VALID_SORTS).optional().catch(undefined),

  page: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .catch(undefined),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .optional()
    .catch(undefined),
});

export type ListingQueryParsed = z.output<typeof listingQuerySchema>;

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parse URLSearchParams into a validated, typed object using the Zod schema.
 * Never throws — all fields use `.catch()` for graceful degradation.
 *
 * Used by:
 * - `parseFiltersFromSearchParams()` (server component pages)
 * - `/api/listings` route (REST API)
 */
export function parseAndValidateParams(
  params: URLSearchParams
): ListingQueryParsed {
  // Convert URLSearchParams to a plain object Zod can process.
  // For repeated keys (e.g., ?category=ROAD&category=MTB), only the last value
  // is taken — callers should prefer comma-separated notation (?category=ROAD,MTB).
  const raw: Record<string, string> = {};
  params.forEach((value, key) => {
    raw[key] = value;
  });
  return listingQuerySchema.parse(raw);
}
