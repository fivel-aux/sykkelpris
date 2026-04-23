import type { BikeCategory } from "@prisma/client";

/**
 * Classify a raw product into a BikeCategory based on:
 * 1. The store's raw category string
 * 2. The product title keywords
 *
 * Returns null if the product is not a complete bike (e.g. components, accessories).
 */

// Keywords that strongly indicate a category
const CATEGORY_KEYWORDS: Record<BikeCategory, string[]> = {
  ROAD: [
    "road bike", "veisykkel", "racing bike", "rennrad", "race bike",
    "aero bike", "endurance bike", "sportive", "gran fondo",
  ],
  GRAVEL: [
    "gravel bike", "grusykkel", "gravel", "adventure bike", "all-road",
    "allroad", "cyclocross", "cx bike",
  ],
  MTB: [
    "mountain bike", "terrengsykkel", "mtb", "trail bike", "enduro",
    "downhill", "dh bike", "xc bike", "cross country", "full suspension",
    "hardtail", "27.5", "29er", "27,5",
  ],
  EBIKE: [
    "electric bike", "e-bike", "ebike", "elsykkel", "pedelec",
    "e-mtb", "e-road", "e-gravel", "electric mountain",
    "elektro", "bosch", "shimano steps", "brose", "fazua",
  ],
  TT: [
    "time trial", "tt bike", "triathlon bike", "triatlon", "triathlonrad",
    "aero tt", "tt/triathlon",
  ],
};

// Words that suggest this is NOT a complete bike (skip these)
const NON_BIKE_KEYWORDS = [
  "hjul", "wheel", "saddle", "sete", "pedal", "stem", "styre", "handlebar",
  "fork", "gaffel", "frame", "ramme", "component", "del", "part",
  "shoe", "sko", "helmet", "hjelm", "jersey", "shorts", "gloves", "hansker",
  "light", "lys", "lock", "lås", "pump", "bag", "veske", "tube", "slange",
  "tyre", "tire", "dekk", "chain", "kjede", "cassette", "kassett",
  "crankset", "kranksett", "groupset", "gruppe",
];

export function classifyCategory(
  rawCategory: string | null | undefined,
  title: string
): BikeCategory | null {
  const lowerTitle = title.toLowerCase();
  const lowerCategory = rawCategory?.toLowerCase() ?? "";

  // First: reject non-bikes
  if (NON_BIKE_KEYWORDS.some((kw) => lowerTitle.includes(kw))) {
    return null;
  }

  // Then: match category keywords (check rawCategory first, then title)
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [BikeCategory, string[]][]) {
    if (keywords.some((kw) => lowerCategory.includes(kw))) {
      return category;
    }
  }

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [BikeCategory, string[]][]) {
    if (keywords.some((kw) => lowerTitle.includes(kw))) {
      return category;
    }
  }

  // If it has "sykkel" or "bike" in it but no specific match, default to checking title more broadly
  if (lowerTitle.includes("e-") || lowerTitle.includes("electric")) return "EBIKE";
  if (lowerTitle.includes("sykkel") || lowerTitle.includes("bike")) return null; // Unknown bike type — skip

  return null;
}

/**
 * Determine if a product is likely electric based on title and specs.
 */
export function isElectric(title: string, specs?: Record<string, string>): boolean {
  const lowerTitle = title.toLowerCase();
  const electricKeywords = [
    "e-bike", "ebike", "electric", "elektro", "elsykkel",
    "pedelec", "e-mtb", "e-road", "bosch", "shimano steps",
  ];

  if (electricKeywords.some((kw) => lowerTitle.includes(kw))) return true;
  if (!specs) return false;

  const specValues = Object.values(specs).join(" ").toLowerCase();
  return (
    specValues.includes("motor") ||
    specValues.includes("batteri") ||
    specValues.includes("wh") ||
    specValues.includes("nm torque")
  );
}
