import type { BikeCategory } from "@prisma/client";

// ── Gate 1: Not a bike at all ─────────────────────────────────────────────────
// Parts, accessories, clothing, components. These are not complete bikes.
const NON_BIKE_KEYWORDS = [
  "hjul", "wheel", "saddle", "sete", "pedal", "stem", "styre", "handlebar",
  "fork", "gaffel", "frame", "ramme", "component", "del", "part",
  "shoe", "sko", "helmet", "hjelm", "jersey", "shorts", "gloves", "hansker",
  "light", "lys", "lock", "lås", "pump", "bag", "veske", "tube", "slange",
  "tyre", "tire", "dekk", "chain", "kjede", "cassette", "kassett",
  "crankset", "kranksett", "groupset", "gruppe",
];

// ── Gate 2: A bike, but outside the intended catalog scope ───────────────────
// Complete bikes that do not fit the sport/performance catalog profile.
// Extend this list as new out-of-scope bike types are identified.
// Each term here is intentionally high-precision to avoid false positives.
const OUT_OF_SCOPE_BIKE_KEYWORDS = [
  "trekking",    // trekking/touring bikes (e.g. Haibike Trekking line)
  "lastesykkel", // cargo bikes in Norwegian
  "cargo",       // cargo bikes
  "commuter",    // explicit commuter bikes (e.g. Canyon Commuter:ON)
  "citylite",    // explicit city bikes (e.g. Canyon Citylite:ON)
];

// ── Title-based overrides ─────────────────────────────────────────────────────
// Model families that are definitively one category regardless of rawCategory.
// Applied before Gate 3 so they can override a miscategorised rawCategory.
const TITLE_OVERRIDES: { pattern: RegExp; category: BikeCategory }[] = [
  { pattern: /speedmax/i, category: "TT" },
];

// ── Gate 3: Category classification ──────────────────────────────────────────
// Keywords that positively identify a BikeCategory.
// Only reached after gates 1 and 2 pass.
const CATEGORY_KEYWORDS: Record<BikeCategory, string[]> = {
  ROAD: [
    "road bike", "veisykkel", "racing bike", "rennrad", "race bike",
    "aero bike", "endurance bike", "sportive", "gran fondo",
    "landevei",
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
    "el-sykkel", "elektrisk",
  ],
  TT: [
    "time trial", "tt bike", "triathlon bike", "triatlon", "triathlonrad",
    "aero tt", "tt/triathlon",
  ],
};

/**
 * Classify a raw product into a BikeCategory.
 *
 * Three-gate flow:
 *   1. Reject if not a complete bike (parts, accessories, clothing)
 *   2. Reject if a complete bike but outside the catalog scope (trekking, cargo, etc.)
 *   3. Classify into a BikeCategory
 *
 * Returns null if the product should be rejected at any gate.
 */
export function classifyCategory(
  rawCategory: string | null | undefined,
  title: string
): BikeCategory | null {
  const lowerTitle = title.toLowerCase();
  const lowerCategory = rawCategory?.toLowerCase() ?? "";

  // Gate 1: reject non-bikes (parts, accessories, clothing)
  if (NON_BIKE_KEYWORDS.some((kw) => lowerTitle.includes(kw))) {
    return null;
  }

  // Gate 2: reject out-of-scope bikes (complete bikes not in catalog profile)
  if (OUT_OF_SCOPE_BIKE_KEYWORDS.some((kw) => lowerTitle.includes(kw))) {
    return null;
  }

  // Title overrides — fire before rawCategory matching to correct miscategorised sources
  for (const { pattern, category } of TITLE_OVERRIDES) {
    if (pattern.test(lowerTitle)) return category;
  }

  // Gate 3: classify into category (rawCategory first, then title)
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

  // Broad fallback for electric signals not caught above
  if (lowerTitle.includes("e-") || lowerTitle.includes("electric")) return "EBIKE";
  if (lowerTitle.includes("sykkel") || lowerTitle.includes("bike")) return null;

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
