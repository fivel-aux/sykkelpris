import { NextRequest, NextResponse } from "next/server";
import { runIngestion } from "@/ingestion/runner";

/**
 * Manual / smoke-test trigger for the ingestion pipeline.
 *
 * Production scheduling is handled by GitHub Actions (.github/workflows/ingest.yml),
 * which runs outside Vercel's function timeout limits. The real scraper runtime
 * (~18 minutes for Canyon) far exceeds any Vercel function maxDuration.
 *
 * This endpoint is retained for quick smoke tests:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        "https://your-domain.com/api/cron/ingest?store=canyon"
 *
 * Security: requires Authorization: Bearer <CRON_SECRET> header.
 * Optional query param `?store=<slug>` runs only one store.
 */
export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/ingest] CRON_SECRET is not set");
    return NextResponse.json(
      { ok: false, error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ── Run ─────────────────────────────────────────────────────────────────────
  const store = req.nextUrl.searchParams.get("store") ?? undefined;

  console.log(
    `[cron/ingest] Run started${store ? ` — store: ${store}` : " — all stores"}`
  );

  try {
    const summary = await runIngestion(store);
    console.log("[cron/ingest] Run complete", summary);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/ingest] Fatal error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
