import { PrismaClient } from "@prisma/client";
import { seedListing } from "./seed/helpers";
import { STORE_DATA } from "./seed/stores";
import { BRAND_DATA } from "./seed/brands";
import { ROAD_LISTINGS } from "./seed/listings/road";
import { GRAVEL_LISTINGS } from "./seed/listings/gravel";
import { MTB_LISTINGS } from "./seed/listings/mtb";
import { EBIKE_LISTINGS } from "./seed/listings/ebike";
import { TT_LISTINGS } from "./seed/listings/tt";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Stores ────────────────────────────────────────────────────────────────
  console.log("  → Upserting stores...");
  const storeMap = new Map<string, string>();

  for (const s of STORE_DATA) {
    const store = await db.store.upsert({
      where: { slug: s.slug },
      update: { name: s.name, url: s.url, shipsToNorway: s.shipsToNorway },
      create: {
        slug: s.slug,
        name: s.name,
        url: s.url,
        logoUrl: s.logoUrl ?? null,
        shipsToNorway: s.shipsToNorway,
        isActive: true,
        scrapingConfig: s.scrapingConfig as object,
      },
    });
    storeMap.set(s.slug, store.id);
  }

  // ── Brands ────────────────────────────────────────────────────────────────
  console.log("  → Upserting brands...");
  const brandMap = new Map<string, string>();

  for (const b of BRAND_DATA) {
    const brand = await db.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name },
      create: { slug: b.slug, name: b.name },
    });
    brandMap.set(b.slug, brand.id);
  }

  // ── Listings ──────────────────────────────────────────────────────────────
  const allListings = [
    ...ROAD_LISTINGS,
    ...GRAVEL_LISTINGS,
    ...MTB_LISTINGS,
    ...EBIKE_LISTINGS,
    ...TT_LISTINGS,
  ];

  console.log(`  → Seeding ${allListings.length} listings...`);

  let created = 0;
  let skipped = 0;

  for (const listing of allListings) {
    const storeId = storeMap.get(listing.storeSlug);
    const brandId = brandMap.get(listing.brandSlug);

    if (!storeId) {
      console.warn(`    ⚠️  Unknown store slug: ${listing.storeSlug} — skipping ${listing.externalId}`);
      skipped++;
      continue;
    }
    if (!brandId) {
      console.warn(`    ⚠️  Unknown brand slug: ${listing.brandSlug} — skipping ${listing.externalId}`);
      skipped++;
      continue;
    }

    const existing = await db.bikeListing.findUnique({
      where: { storeId_externalId: { storeId, externalId: listing.externalId } },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await seedListing(db, storeMap, brandMap, listing);
    created++;
  }

  console.log(`\n✅ Seeding complete — ${created} created, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
