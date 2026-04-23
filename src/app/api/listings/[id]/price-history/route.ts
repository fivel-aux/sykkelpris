import { NextRequest } from "next/server";
import { getPriceHistory } from "@/lib/queries";
import { apiOk, apiNotFound, apiServerError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/listings/:id/price-history
 *
 * Returns up to 90 price snapshots for a listing, ordered oldest-first.
 * 404 if the listing does not exist.
 *
 * Designed for future client-side chart fetching — the detail page currently
 * fetches price history bundled with the full listing via getListingById(),
 * but having it as a standalone route allows lazy loading later.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const history = await getPriceHistory(params.id);
    if (!history) return apiNotFound("Sykkel ikke funnet");
    return apiOk(history);
  } catch (error) {
    return apiServerError(
      "GET /api/listings/:id/price-history",
      error,
      "Kunne ikke hente prishistorikk."
    );
  }
}
