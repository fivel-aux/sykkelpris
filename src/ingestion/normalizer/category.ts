import type { BikeCategory } from "@prisma/client";

// ── Gate 1: Not a bike at all ─────────────────────────────────────────────────
// Parts, accessories, clothing, components, and non-bike micromobility products.
const NON_BIKE_KEYWORDS = [
  "hjul", "wheel", "saddle", "sete", "pedal", "stem", "styre", "handlebar",
  "fork", "gaffel", "frame", "ramme", "component", "del", "part",
  "shoe", "sko", "helmet", "hjelm", "jersey", "shorts", "gloves", "hansker",
  "light", "lys", "lock", "lås", "pump", "bag", "veske", "tube", "slange",
  "tyre", "tire", "dekk", "chain", "kjede", "cassette", "kassett",
  "crankset", "kranksett", "groupset", "gruppe",
  // Electric kick-scooters — not bikes despite containing "sykkel" as a suffix
  "elsparkesykkel", "sparkesykkel",
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
  "bmx",         // BMX freestyle/park/dirt — not part of the sport performance catalog

  // ── Out-of-scope e-bike model families ──────────────────────────────────────
  // Discovered via Bikester EBIKE audit (2026-05-14). Each pattern is model-name
  // specific and globally correct: these families are city/commuter/trekking
  // regardless of which store carries them. Validated against 27 sport e-bike
  // canary titles with zero false positives before implementation.
  // Phase 2 candidates (Vibe, FX+, Skeppshult, Batavus, Made, etc.) are deferred
  // pending manual decisions on borderline models.
  "sammenleggbar",  // folding bikes (Norwegian: "foldable")
  // Trek city/commuter lines
  "district+",      // Trek District+ — city commuter
  "charter+",       // Trek Charter+ — utility/urban commuter
  "allant+",        // Trek Allant+ — commuter hybrid
  "verve+",         // Trek Verve+ — urban/leisure
  // Orbea city/commuter lines
  "kemen",          // Orbea Kemen — urban commuter (all variants)
  "diem",           // Orbea Diem — city e-bike
  // Cube trekking/city
  "kathmandu",      // Cube Kathmandu — trekking
  "nuride",         // Cube Nuride — trekking allroad
  "compact hybrid", // Cube Compact Hybrid — city/small-wheel
  "editor hybrid",  // Cube Editor Hybrid — city
  // Merida trekking
  "ebig.tour",      // Merida eBig.Tour — trekking
  "efloat",         // Merida eFloat — trekking/commuter
  // Rock Machine trekking
  "crossride",      // Rock Machine Crossride — trekking/hybrid
  // Superior commuter — "superior eway" not bare "eway" (avoids matching "freeway")
  "superior eway",  // Superior eWAY — commuter
  "iblox",          // Superior iBLOX — trekking

  // ── Out-of-scope e-bike model families — Phase 2A (2026-05-14) ──────────────
  // Validated against 34 sport e-bike canary titles with zero false positives.
  // All 120 DB matches were EBIKE — zero collateral across MTB/ROAD/GRAVEL.
  // City-only brands (skeppshult, batavus, kronan, tenways, romet, proeco, frappé):
  // entire brand catalogs are city/commuter — no sport model in any store.
  "skeppshult",     // Skeppshult — Swedish heritage city/commuter brand (all models)
  "batavus",        // Batavus — Dutch city/utility e-bike brand (all models)
  "kronan",         // Kronan — Swedish city e-bike brand (all models)
  "tenways",        // Tenways — urban commuter-only brand (all models)
  "romet",          // Romet — Polish city/commuter e-bike brand (all models)
  "proeco",         // Proeco — city e-bike brand
  "frappé",         // Frappé Fuzed — city lifestyle e-bike
  // Made city/lifestyle models — compound patterns to avoid bare "made" substring risk
  "made alba",      // Made Alba — city e-bike
  "made linum",     // Made Linum — city e-bike (incl. Linum Mid, Linum Plus)
  "made salix",     // Made Salix — city e-bike
  "made larix",     // Made Larix — city e-bike
  "made dahlia",    // Made Dahlia — city e-bike
  "made flow",      // Made Flow — city lifestyle e-bike
  // Trek fitness/commuter lines
  "fx+",            // Trek FX+ — fitness/urban hybrid (FX+ 2, FX+ 7, all variants)
  "dual sport+",    // Trek Dual Sport+ — explicit commuter hybrid
  // Orbea city hybrid
  "vibe",           // Orbea Vibe — city hybrid (Vibe H10/H30/Mid; no sport bike uses this word)
  // Merida city/trekking
  "espresso",       // Merida eSpresso — e-trekking/commuter (eSpresso, CC, City, Espresso L)
  // Haibike fitness/trekking lines
  "alltrack",       // Haibike ALLTRACK — trekking (distinct from ALLTRAIL/ALLMTN which are kept)
  "adventr",        // Haibike Adventr — fitness/adventure hybrid
  // Kross hybrid/trekking — compound to preserve Kross MTBs (Grist Boost, Moon Boost)
  "kross influx",   // Kross Influx — hybrid/trekking e-bike family
  "kross le grand", // Kross Le Grand eLille — city e-bike
  // Others
  "mavaro",         // Cannondale Mavaro — explicit commuter (distinct from Trail Neo/Moterra)
  "tourray",        // Raymon TourRay — trekking e-bike
  "atome suv",      // BH Atome SUV — hybrid SUV (distinct from BH AtomX/iLynx eMTB family)
  "e-teru",         // Ghost E-Teru — trekking/hybrid (distinct from Ghost E-ASX trail eMTB)
  "e-one city",     // Birk E-One City — city e-bike (Birk E-One LTD deferred)
  "e-suv",          // Birk E-SUV — utility SUV e-bike (all variants)
  // Residual gaps patched after Phase 2A ingestion run
  "fx +",           // Trek FX+ title variant with space before plus (e.g. "Fx + 2 Lt")
  "linum",          // Made Linum city e-bike — catches non-adjacent "Made … Linum" title formats
  "tunturi havu",   // Tunturi Havu — city/commuter e-bike
  "tunturi tornio", // Tunturi Tornio — city/commuter e-bike
  "tunturi puro",   // Tunturi Puro — city/commuter e-bike
];

// ── Title-based overrides ─────────────────────────────────────────────────────
// Model families that are definitively one category regardless of rawCategory.
// Applied before Gate 3 so they can override a miscategorised rawCategory.
const TITLE_OVERRIDES: { pattern: RegExp; category: BikeCategory }[] = [
  { pattern: /speedmax/i, category: "TT" },
  // X-road / xroad bikes (e.g. Superior X-road) are allroad/gravel-capable
  // and appear in Bikester's road category URL, so rawCategory alone can't
  // correct them. This override fires before rawCategory matching.
  { pattern: /\bx-road\b|\bxroad\b/i, category: "GRAVEL" },
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
