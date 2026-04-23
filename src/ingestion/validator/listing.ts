import { z } from "zod";
import type { NormalizedListing } from "../normalizer";
import { MIN_PRICE_NOK, MAX_PRICE_NOK } from "../config";

/**
 * Zod schema for a normalized listing before database upsert.
 * This is the last safety net — catches any normalization bugs.
 */
export const normalizedListingSchema = z.object({
  externalId: z.string().min(1),
  externalUrl: z.string().url(),
  rawTitle: z.string().min(2).max(500),
  modelName: z.string().min(2).max(300),
  category: z.enum(["ROAD", "GRAVEL", "MTB", "EBIKE", "TT"]),
  frameMaterial: z.enum(["CARBON", "ALUMINUM", "STEEL", "TITANIUM", "UNKNOWN"]),
  gender: z.enum(["MENS", "WOMENS", "UNISEX"]),
  isElectric: z.boolean(),
  originalPrice: z.number().min(MIN_PRICE_NOK).max(MAX_PRICE_NOK),
  discountedPrice: z.number().min(MIN_PRICE_NOK).max(MAX_PRICE_NOK),
  discountPercent: z.number().int().min(0).max(100),
  primaryImageUrl: z.string().url().nullable(),
  imageUrls: z.array(z.string().url()),
  description: z.string().nullable(),
  specifications: z.record(z.string()).nullable(),
  isInStock: z.boolean(),
  missingFields: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
  brand: z
    .object({ name: z.string().min(1), slug: z.string().min(1) })
    .nullable(),
  sizes: z.array(
    z.object({
      size: z.string().min(1).max(20),
      isInStock: z.boolean(),
      quantity: z.number().int().min(0).optional(),
    })
  ),
});

export interface ValidatedListing {
  externalId: string;
  externalUrl: string;
  rawTitle: string;
  modelName: string;
  category: "ROAD" | "GRAVEL" | "MTB" | "EBIKE" | "TT";
  frameMaterial: "CARBON" | "ALUMINUM" | "STEEL" | "TITANIUM" | "UNKNOWN";
  gender: "MENS" | "WOMENS" | "UNISEX";
  isElectric: boolean;
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  primaryImageUrl: string | null;
  imageUrls: string[];
  description: string | null;
  specifications: Record<string, string> | null;
  isInStock: boolean;
  missingFields: string[];
  confidenceScore: number;
  brand: { name: string; slug: string } | null;
  sizes: Array<{ size: string; isInStock: boolean; quantity?: number }>;
}

/**
 * Validate a normalized listing. Returns the validated listing or null with an error log.
 */
export function validateListing(
  listing: NormalizedListing
): ValidatedListing | null {
  const result = normalizedListingSchema.safeParse(listing);
  if (!result.success) {
    console.warn(
      `[validator] Invalid listing "${listing.rawTitle}":`,
      result.error.flatten().fieldErrors
    );
    return null;
  }
  return result.data as ValidatedListing;
}
