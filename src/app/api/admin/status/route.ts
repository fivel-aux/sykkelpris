import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [recentJobs, listingCount, staleCount] = await Promise.all([
    db.scrapeJob.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { store: { select: { slug: true, name: true } } },
    }),
    db.bikeListing.count({ where: { isActive: true } }),
    db.bikeListing.count({
      where: {
        isActive: true,
        lastSeenAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    activeListings: listingCount,
    staleListings: staleCount,
    recentJobs: recentJobs.map((j) => ({
      id: j.id,
      store: j.store.slug,
      status: j.status,
      startedAt: j.startedAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
      durationMs: j.durationMs ?? null,
      itemsFound: j.itemsFound ?? null,
      itemsNew: j.itemsNew ?? null,
      itemsUpdated: j.itemsUpdated ?? null,
      itemsFailed: j.itemsFailed ?? null,
      itemsInactive: j.itemsInactive ?? null,
    })),
  });
}
