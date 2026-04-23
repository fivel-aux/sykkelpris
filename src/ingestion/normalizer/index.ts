import type { BikeCategory, FrameMaterial, Gender } from "@prisma/client";
import type { RawProduct } from "../scrapers/types";
import { matchBrand, extractBrandFromTitle } from "./brand";
import { classifyCategory, isElectric } from "./category";
import { normalizeSizes } from "./size";
import { MIN_PRICE_NOK, MAX_PRICE_NOK } from "../config";

/**
 * A fully normalized listing ready for database upsert.
 */
export interface NormalizedListing {
  externalId: string;
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
 * Normalize a raw scraped product into a NormalizedListing.
 * Returns null if the product should be rejected (e.g. not a complete bike).
 */
export function normalize(
  raw: RawProduct,
  storeSlug: string
): NormalizedListing | null {
  const missingFields: string[] = [];

  // --- Category ---
  const category = classifyCategory(raw.rawCategory, raw.rawTitle);
  if (!category) {
    // Not a recognizable bike — skip it
    return null;
  }

  // --- Brand ---
  const brand =
    matchBrand(raw.rawBrand) ??
    extractBrandFromTitle(raw.rawTitle) ??
    null;
  if (!brand) {
    missingFields.push("brand");
  }

  // --- Price ---
  if (raw.currentPrice === null || raw.currentPrice <= 0) {
    return null; // No valid price — skip
  }
  const discountedPrice = raw.currentPrice;
  const originalPrice = raw.originalPrice ?? raw.currentPrice;

  // Reject prices outside plausible range for complete bikes
  if (discountedPrice < MIN_PRICE_NOK || discountedPrice > MAX_PRICE_NOK) {
    return null;
  }
  const discountPercent =
    originalPrice > discountedPrice
      ? Math.round(((originalPrice - discountedPrice) / originalPrice) * 100)
      : 0;

  // --- Model name ---
  // Strip brand from title if it starts with the brand name
  let modelName = raw.rawTitle.trim();
  if (brand && modelName.toLowerCase().startsWith(brand.name.toLowerCase())) {
    modelName = modelName.slice(brand.name.length).trim();
  }
  // Remove leading separators
  modelName = modelName.replace(/^[-–—|,]\s*/, "").trim();
  if (!modelName) {
    modelName = raw.rawTitle.trim();
  }

  // --- Frame material ---
  const frameMaterial = detectFrameMaterial(raw.rawTitle, raw.rawSpecs);

  // --- Gender ---
  const gender = detectGender(raw.rawTitle, raw.rawGender);

  // --- Electric ---
  const electric = isElectric(raw.rawTitle, raw.rawSpecs) || category === "EBIKE";

  // --- Image ---
  const imageUrls = [raw.imageUrl, ...(raw.additionalImageUrls ?? [])].filter(
    Boolean
  ) as string[];
  if (imageUrls.length === 0) {
    missingFields.push("image");
  }

  // --- Sizes ---
  const sizes = normalizeSizes(raw.sizes ?? []);
  if (sizes.length === 0) {
    missingFields.push("sizes");
  }

  // --- Description ---
  if (!raw.description) {
    missingFields.push("description");
  }

  // --- Confidence score ---
  // Each missing important field reduces confidence
  const importantFields = ["brand", "image", "sizes", "description"];
  const missingImportant = missingFields.filter((f) =>
    importantFields.includes(f)
  );
  const confidenceScore = Math.max(
    0,
    1 - missingImportant.length * 0.2 - (discountPercent === 0 ? 0.1 : 0)
  );

  return {
    externalId: raw.externalId,
    externalUrl: raw.externalUrl,
    rawTitle: raw.rawTitle,
    modelName: `${brand?.name ?? ""} ${modelName}`.trim() || raw.rawTitle,
    category,
    frameMaterial,
    gender,
    isElectric: electric,
    originalPrice,
    discountedPrice,
    discountPercent,
    primaryImageUrl: imageUrls[0] ?? null,
    imageUrls,
    description: raw.description ?? null,
    specifications: raw.rawSpecs ?? null,
    isInStock: raw.isInStock ?? sizes.some((s) => s.isInStock),
    missingFields,
    confidenceScore,
    brand,
    sizes,
  };
}

function detectFrameMaterial(
  title: string,
  specs?: Record<string, string>
): FrameMaterial {
  const combined =
    `${title} ${Object.values(specs ?? {}).join(" ")}`.toLowerCase();

  if (combined.includes("carbon")) return "CARBON";
  if (
    combined.includes("aluminium") ||
    combined.includes("aluminum") ||
    combined.includes("alloy") ||
    combined.includes("alu ") ||
    combined.includes("al ")
  )
    return "ALUMINUM";
  if (combined.includes("steel") || combined.includes("stål") || combined.includes("cromoly"))
    return "STEEL";
  if (combined.includes("titan")) return "TITANIUM";

  return "UNKNOWN";
}

function detectGender(title: string, rawGender?: string | null): Gender {
  const combined = `${title} ${rawGender ?? ""}`.toLowerCase();
  if (
    combined.includes("dame") ||
    combined.includes("women") ||
    combined.includes("ladies") ||
    combined.includes("femme") ||
    combined.includes("damen")
  )
    return "WOMENS";
  if (
    combined.includes("herre") ||
    combined.includes("herren") ||
    combined.includes("men's") ||
    combined.includes("mens ")
  )
    return "MENS";
  return "UNISEX";
}
