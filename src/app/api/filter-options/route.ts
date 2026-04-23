import { getFilterOptions } from "@/lib/queries";
import { apiOk, apiServerError } from "@/lib/api";

/**
 * GET /api/filter-options
 *
 * Returns all active brands and stores formatted as filter panel options:
 * { brands: [{ value, label, count }], stores: [{ value, label, count }] }
 *
 * Revalidated every 5 minutes — listing counts shift when the scraper runs.
 * This route is the canonical source of truth for the filter panel.
 *
 * The server component page (sykler/page.tsx) calls getFilterOptions() directly
 * rather than fetching this route — this endpoint exists for client-side use
 * (e.g., a future client component that reloads counts after filter changes).
 */
export const revalidate = 300;

export async function GET() {
  try {
    const options = await getFilterOptions();
    return apiOk(options);
  } catch (error) {
    return apiServerError(
      "GET /api/filter-options",
      error,
      "Kunne ikke hente filteralternativer."
    );
  }
}
