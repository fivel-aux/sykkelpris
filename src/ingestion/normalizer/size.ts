/**
 * Size normalization: maps inconsistent size strings to canonical values.
 *
 * Goal: make sizes filterable and comparable across stores.
 * We preserve the original string but add a canonical value.
 */

// Canonical S/M/L size mappings
const SIZE_ALIASES: Record<string, string> = {
  // Text → canonical
  "x-small": "XS",
  "xs": "XS",
  "xtra small": "XS",
  "extra small": "XS",
  "small": "S",
  "s": "S",
  "str. s": "S",
  "medium": "M",
  "m": "M",
  "str. m": "M",
  "large": "L",
  "l": "L",
  "str. l": "L",
  "x-large": "XL",
  "xl": "XL",
  "xtra large": "XL",
  "extra large": "XL",
  "str. xl": "XL",
  "xx-large": "XXL",
  "xxl": "XXL",
  "2xl": "XXL",
  "3xl": "XXXL",
  "xxxl": "XXXL",
  // Specialized sizes
  "s1": "S1",
  "s2": "S2",
  "s3": "S3",
  "s4": "S4",
  "s5": "S5",
  "s6": "S6",
  // Common road bike cm sizes (normalize to numeric)
  "44 cm": "44",
  "47 cm": "47",
  "49 cm": "49",
  "50 cm": "50",
  "51 cm": "51",
  "52 cm": "52",
  "53 cm": "53",
  "54 cm": "54",
  "55 cm": "55",
  "56 cm": "56",
  "57 cm": "57",
  "58 cm": "58",
  "60 cm": "60",
  "61 cm": "61",
  "62 cm": "62",
};

/**
 * Normalize a raw size label to a canonical representation.
 * Returns the original label if no normalization is found (better than dropping it).
 */
export function normalizeSize(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return SIZE_ALIASES[lower] ?? raw.trim().toUpperCase();
}

/**
 * Normalize an array of raw sizes, deduplicating canonical values.
 */
export function normalizeSizes(
  rawSizes: Array<{ label: string; isInStock: boolean; quantity?: number }>
): Array<{ size: string; isInStock: boolean; quantity?: number }> {
  const seen = new Set<string>();
  const result: Array<{ size: string; isInStock: boolean; quantity?: number }> = [];

  for (const raw of rawSizes) {
    const size = normalizeSize(raw.label);
    if (!seen.has(size)) {
      seen.add(size);
      result.push({ size, isInStock: raw.isInStock, quantity: raw.quantity });
    } else {
      // If we've seen this size, update stock status (in-stock wins)
      const existing = result.find((r) => r.size === size);
      if (existing && raw.isInStock) {
        existing.isInStock = true;
        if (raw.quantity !== undefined) {
          existing.quantity = (existing.quantity ?? 0) + raw.quantity;
        }
      }
    }
  }

  return result;
}
