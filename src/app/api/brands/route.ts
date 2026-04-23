import { getBrands } from "@/lib/queries";
import { apiOk, apiServerError } from "@/lib/api";

// Brands change only when new stores/scrapers are added — 1-hour cache is safe.
export const revalidate = 3600;

export async function GET() {
  try {
    const brands = await getBrands();
    return apiOk(brands);
  } catch (error) {
    return apiServerError(
      "GET /api/brands",
      error,
      "Kunne ikke hente merker."
    );
  }
}
