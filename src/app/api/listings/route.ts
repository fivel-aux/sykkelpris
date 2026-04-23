import { NextRequest } from "next/server";
import { getListings } from "@/lib/queries";
import { parseFiltersFromSearchParams } from "@/lib/search";
import { apiOk, apiServerError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const filters = parseFiltersFromSearchParams(request.nextUrl.searchParams);
    const result = await getListings(filters);
    return apiOk(result);
  } catch (error) {
    return apiServerError(
      "GET /api/listings",
      error,
      "Kunne ikke hente sykler. Prøv igjen."
    );
  }
}
