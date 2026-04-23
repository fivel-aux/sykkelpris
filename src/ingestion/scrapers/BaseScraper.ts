import type { Store } from "@prisma/client";
import { ScrapeJobStatus } from "@prisma/client";
import type { RawProduct } from "./types";

/**
 * Abstract base class for all store scrapers.
 *
 * Each store gets its own subclass. The only required method is `fetchProducts()`.
 * The base class handles:
 *   - logging
 *   - error isolation
 *   - creating/updating the ScrapeJob record
 */
export abstract class BaseScraper {
  protected store: Store;
  private _jobId: string | null = null;

  /** The ScrapeJob id for this run — set after run() is called. */
  get jobId(): string | null {
    return this._jobId;
  }

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Fetch all (or updated) products from the store.
   * Must be implemented by each subclass.
   */
  abstract fetchProducts(): Promise<RawProduct[]>;

  /**
   * Called by the runner. Wraps fetchProducts in job tracking and error handling.
   * Returns the products on success, or null on failure.
   */
  async run(): Promise<RawProduct[] | null> {
    // Lazy import so standalone fetchProducts() calls don't require a DB connection
    const { db } = await import("../../lib/db");
    const job = await db.scrapeJob.create({
      data: {
        storeId: this.store.id,
        status: ScrapeJobStatus.RUNNING,
        startedAt: new Date(),
      },
    });
    this._jobId = job.id;

    this.log("Starting scrape...");

    try {
      const products = await this.fetchProducts();
      this.log(`Fetched ${products.length} products`);

      await db.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: ScrapeJobStatus.SUCCESS,
          completedAt: new Date(),
          itemsFound: products.length,
        },
      });

      await db.store.update({
        where: { id: this.store.id },
        data: { lastScrapedAt: new Date() },
      });

      return products;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      this.log(`Failed: ${message}`, "error");

      await db.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: ScrapeJobStatus.FAILED,
          completedAt: new Date(),
          errorLog: { message, stack },
        },
      });

      return null;
    }
  }

  protected log(message: string, level: "info" | "error" | "warn" = "info") {
    const prefix = `[${this.store.slug}]`;
    if (level === "error") {
      console.error(`${prefix} ${message}`);
    } else if (level === "warn") {
      console.warn(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}
