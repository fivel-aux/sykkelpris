/**
 * Brand normalization: maps raw brand strings from stores to canonical brand slugs.
 *
 * Strategy:
 * 1. Exact match against known brands
 * 2. Substring match (handles "Trek Bikes" → "Trek")
 * 3. Return null if unknown (caller decides whether to create or skip)
 */

export interface BrandMatch {
  name: string;
  slug: string;
}

/** Known brands with their canonical name and slug */
const KNOWN_BRANDS: BrandMatch[] = [
  { name: "Trek", slug: "trek" },
  { name: "Specialized", slug: "specialized" },
  { name: "Scott", slug: "scott" },
  { name: "Canyon", slug: "canyon" },
  { name: "Giant", slug: "giant" },
  { name: "Orbea", slug: "orbea" },
  { name: "Merida", slug: "merida" },
  { name: "Cannondale", slug: "cannondale" },
  { name: "Cube", slug: "cube" },
  { name: "Felt", slug: "felt" },
  { name: "Bianchi", slug: "bianchi" },
  { name: "Pinarello", slug: "pinarello" },
  { name: "Cervélo", slug: "cervelo" },
  { name: "BMC", slug: "bmc" },
  { name: "Colnago", slug: "colnago" },
  { name: "Focus", slug: "focus" },
  { name: "Ridley", slug: "ridley" },
  { name: "Look", slug: "look" },
  { name: "De Rosa", slug: "de-rosa" },
  { name: "Wilier", slug: "wilier" },
  { name: "KTM", slug: "ktm" },
  { name: "Haibike", slug: "haibike" },
  { name: "Bosch", slug: "bosch" }, // for e-bike brand disambiguation
  { name: "Riese & Müller", slug: "riese-muller" },
  { name: "Tern", slug: "tern" },
  { name: "Gazelle", slug: "gazelle" },
  { name: "Raleigh", slug: "raleigh" },
  { name: "Lapierre", slug: "lapierre" },
  { name: "Kona", slug: "kona" },
  { name: "Norco", slug: "norco" },
  { name: "Santa Cruz", slug: "santa-cruz" },
  { name: "Yeti", slug: "yeti" },
  { name: "Ibis", slug: "ibis" },
  { name: "Rocky Mountain", slug: "rocky-mountain" },
  { name: "Commencal", slug: "commencal" },
  { name: "Pivot", slug: "pivot" },
  { name: "Evil", slug: "evil" },
  { name: "Transition", slug: "transition" },
  { name: "Devinci", slug: "devinci" },
  // Brands common on Bikester.no
  { name: "Made", slug: "made" },
  { name: "Fuji", slug: "fuji" },
  { name: "Liv", slug: "liv" },
  { name: "Polygon", slug: "polygon" },
  { name: "Niner", slug: "niner" },
  { name: "Whyte", slug: "whyte" },
  { name: "Marin", slug: "marin" },
  { name: "Ghost", slug: "ghost" },
  { name: "Raymon", slug: "raymon" },
  { name: "Nox", slug: "nox" },
  // Brands common on Sykkelbutikken.no
  { name: "Kalkhoff", slug: "kalkhoff" },
  { name: "Hard Rocx", slug: "hard-rocx" },
  // Brands common on Bikeshop.no
  { name: "3T", slug: "3t" },
  { name: "Surly", slug: "surly" },
  { name: "Gavia", slug: "gavia" },
  { name: "Fara", slug: "fara" },
  { name: "Cinelli", slug: "cinelli" },
  { name: "Mondraker", slug: "mondraker" },
  // Brands common on Birk.no
  { name: "BH", slug: "bh" },
  { name: "Rondo", slug: "rondo" },
  { name: "Principia", slug: "principia" },
  { name: "Kross", slug: "kross" },
  { name: "GT", slug: "gt" },
  { name: "NS Bikes", slug: "ns-bikes" },
  { name: "Tunturi", slug: "tunturi" },
  { name: "Skeppshult", slug: "skeppshult" },
];

const BRAND_ALIASES: Record<string, string> = {
  "trek bikes": "trek",
  "specialized bicycles": "specialized",
  "scott sports": "scott",
  "giant bicycles": "giant",
  "giant bike": "giant",
  "cannondale bicycle": "cannondale",
  "merida industry": "merida",
  "cube bikes": "cube",
  "cervelo": "cervelo",
  "r&m": "riese-muller",
  "riese und müller": "riese-muller",
  "santa cruz bicycles": "santa-cruz",
  "rocky mtn": "rocky-mountain",
};

/**
 * Match a raw brand string to a known brand.
 * Returns null if no match found.
 */
export function matchBrand(rawBrand: string | null | undefined): BrandMatch | null {
  if (!rawBrand?.trim()) return null;

  const normalized = rawBrand.trim().toLowerCase();

  // Check aliases first
  if (BRAND_ALIASES[normalized]) {
    const slug = BRAND_ALIASES[normalized];
    const found = KNOWN_BRANDS.find((b) => b.slug === slug);
    if (found) return found;
  }

  // Exact match (case-insensitive)
  const exact = KNOWN_BRANDS.find(
    (b) => b.name.toLowerCase() === normalized
  );
  if (exact) return exact;

  // Substring match: "Trek Domane" → "Trek"
  const substring = KNOWN_BRANDS.find((b) =>
    normalized.startsWith(b.name.toLowerCase())
  );
  if (substring) return substring;

  // Reverse: brand name appears anywhere in the string
  const contains = KNOWN_BRANDS.find((b) =>
    normalized.includes(b.name.toLowerCase())
  );
  if (contains) return contains;

  return null;
}

/**
 * Extract brand from a product title if rawBrand is unknown.
 * Simple heuristic: check if the title starts with a known brand name.
 */
export function extractBrandFromTitle(title: string): BrandMatch | null {
  // Try full title first — matchBrand does startsWith/contains checks that
  // handle multi-word brands like "Hard Rocx" from "Hard Rocx Stone Machine 29"
  return matchBrand(title) ?? matchBrand(title.split(" ")[0]) ?? null;
}
