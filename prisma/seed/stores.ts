// ── Production stores ──────────────────────────────────────────────────────────
// isActive: true  = scraper is proven, store appears in public UI
// isActive: false = scraper not yet verified; store is hidden from UI and runner
//
// Onboarding checklist for a new store:
//   1. Ship and verify the scraper (fetchProducts returns real, correct data)
//   2. Add slug to SCRAPERS in src/ingestion/runner.ts
//   3. Set isActive: true here and re-run `npx prisma db seed`

export const STORE_DATA = [
  // ── Live ──────────────────────────────────────────────────────────────────
  {
    slug: "canyon",
    name: "Canyon",
    url: "https://www.canyon.com/en-no",
    logoUrl: null,
    shipsToNorway: true,
    isActive: true,
    scrapingConfig: { type: "cheerio", baseUrl: "https://www.canyon.com/en-no/outlet/" },
  },

  // ── Pending — scrapers written but not verified against live sites ─────────
  {
    slug: "xxl",
    name: "XXL",
    url: "https://www.xxl.no",
    logoUrl: null,
    shipsToNorway: true,
    isActive: false,
    scrapingConfig: { type: "api", baseUrl: "https://www.xxl.no/api/products/search" },
  },
  {
    slug: "bikester",
    name: "Bikester",
    url: "https://www.bikester.no",
    logoUrl: null,
    shipsToNorway: true,
    isActive: false,
    scrapingConfig: { type: "api", baseUrl: "https://www.bikester.no/products.json" },
  },
  {
    slug: "stif",
    name: "Stif",
    url: "https://www.stif.no",
    logoUrl: null,
    shipsToNorway: true,
    isActive: false,
    scrapingConfig: { type: "cheerio", baseUrl: "https://www.stif.no/sykler" },
  },

  // ── Planned — no scraper yet ───────────────────────────────────────────────
  {
    slug: "megasykkel",
    name: "Megasykkel",
    url: "https://www.megasykkel.no",
    logoUrl: null,
    shipsToNorway: true,
    isActive: false,
    scrapingConfig: null,
  },
  {
    slug: "sportamore",
    name: "Sportamore",
    url: "https://www.sportamore.no",
    logoUrl: null,
    shipsToNorway: true,
    isActive: false,
    scrapingConfig: null,
  },
  {
    slug: "sykkelgrossisten",
    name: "Sykkelgrossisten",
    url: "https://www.sykkelgrossisten.no",
    logoUrl: null,
    shipsToNorway: true,
    isActive: false,
    scrapingConfig: null,
  },
  {
    slug: "bikefarm",
    name: "BikeFarm",
    url: "https://www.bikefarm.no",
    logoUrl: null,
    shipsToNorway: true,
    isActive: false,
    scrapingConfig: null,
  },
  {
    slug: "fjellsport",
    name: "Fjellsport",
    url: "https://www.fjellsport.no",
    logoUrl: null,
    shipsToNorway: true,
    isActive: false,
    scrapingConfig: null,
  },
];
