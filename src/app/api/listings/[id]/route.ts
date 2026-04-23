import { NextRequest } from "next/server";
import { getListingById } from "@/lib/queries";
import { apiOk, apiNotFound, apiServerError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listing = await getListingById(params.id);
    if (!listing) return apiNotFound("Sykkel ikke funnet");
    return apiOk(listing);
  } catch (error) {
    return apiServerError(
      "GET /api/listings/:id",
      error,
      "Kunne ikke hente sykkel. Prøv igjen."
    );
  }
}
