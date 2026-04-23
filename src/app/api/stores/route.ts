import { getStores } from "@/lib/queries";
import { apiOk, apiServerError } from "@/lib/api";

// Store list changes infrequently — 1-hour cache.
export const revalidate = 3600;

export async function GET() {
  try {
    const stores = await getStores();
    return apiOk(stores);
  } catch (error) {
    return apiServerError(
      "GET /api/stores",
      error,
      "Kunne ikke hente butikker."
    );
  }
}
