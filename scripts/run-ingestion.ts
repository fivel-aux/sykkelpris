/**
 * Entry point for the ingestion pipeline.
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/run-ingestion.ts
 *
 * Optional: pass a store slug to run only one store:
 *   ... scripts/run-ingestion.ts xxl
 */

import { runIngestion } from "../src/ingestion/runner";
import { db } from "../src/lib/db";

const targetStore = process.argv[2]; // optional: "xxl", "bikester", etc.

runIngestion(targetStore)
  .catch((err) => {
    console.error("Fatal ingestion error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
