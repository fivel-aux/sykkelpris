import { getStats } from "@/lib/queries";
import { apiOk, apiServerError } from "@/lib/api";

// Stats update when listings are scraped — 5-minute revalidation matches cron cadence.
export const revalidate = 300;

export async function GET() {
  try {
    const stats = await getStats();
    return apiOk(stats);
  } catch (error) {
    return apiServerError(
      "GET /api/stats",
      error,
      "Kunne ikke hente statistikk."
    );
  }
}
