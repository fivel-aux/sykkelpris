import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ExternalLink,
  ArrowLeft,
  Clock,
  Package,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { PriceHistoryChart } from "@/components/bike/PriceHistoryChart";
import { getListingById } from "@/lib/queries";
import { formatPrice, formatRelativeDate, formatDate } from "@/lib/formatters";
import {
  CATEGORY_LABELS,
  FRAME_MATERIAL_LABELS,
  GENDER_LABELS,
} from "@/lib/constants";
import { clsx } from "clsx";
import { sortSizeObjects } from "@/lib/sizes";

interface PageProps {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const listing = await getListingById(params.id);
  if (!listing) return { title: "Sykkel ikke funnet" };
  return {
    title: listing.modelName,
    description:
      listing.description ?? `${listing.modelName} hos ${listing.store.name}`,
  };
}

export default async function BikeDetailPage({ params, searchParams }: PageProps) {
  const listing = await getListingById(params.id);
  if (!listing) notFound();

  // Restore the listing URL the user came from, if any. Only accept /sykler paths.
  const rawFrom = typeof searchParams?.from === "string" ? searchParams.from : undefined;
  const backHref = rawFrom?.startsWith("/sykler") ? rawFrom : "/sykler";

  const savings = listing.originalPrice - listing.discountedPrice;
  const sortedSizes = sortSizeObjects(listing.sizes);
  const inStockSizes = sortedSizes.filter((s) => s.isInStock);
  const sizeStockKnown = listing.store.slug !== "bikester";

  // Strip brand prefix from title when brand is shown separately above h1
  const brandName = listing.primaryBrand?.name ?? "";
  const displayTitle =
    brandName && listing.modelName.toLowerCase().startsWith(brandName.toLowerCase())
      ? listing.modelName.slice(brandName.length).replace(/^[-–—|\s,]+/, "").trim() || listing.modelName
      : listing.modelName;

  // Build spec rows — omit fields that are unknown or carry no useful information
  const specRows: { key: string; val: string }[] = [
    ...(listing.specifications
      ? Object.entries(listing.specifications as Record<string, string>).map(
          ([key, val]) => ({ key, val })
        )
      : []),
    // Only show frame material when we actually know it
    ...(listing.frameMaterial !== "UNKNOWN"
      ? [{ key: "Ramme", val: FRAME_MATERIAL_LABELS[listing.frameMaterial] }]
      : []),
    // Only show gender when it adds information (UNISEX is the default assumption)
    ...(listing.gender !== "UNISEX"
      ? [{ key: "Kjønn", val: GENDER_LABELS[listing.gender] }]
      : []),
    // Only show electric status when it is actually electric
    ...(listing.isElectric ? [{ key: "Elektrisk", val: "Ja" }] : []),
  ];

  return (
    <div className="py-6">
      <Container>
        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <nav className="mb-5 flex items-center gap-1 text-xs text-zinc-400">
          <Link href="/" className="transition-colors hover:text-zinc-700">
            Hjem
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/sykler" className="transition-colors hover:text-zinc-700">
            Sykler
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            href={`/sykler?category=${listing.category}`}
            className="transition-colors hover:text-zinc-700"
          >
            {CATEGORY_LABELS[listing.category]}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="max-w-[200px] truncate text-zinc-600">
            {listing.modelName}
          </span>
        </nav>

        {/* ── Back link ───────────────────────────────────────────────────── */}
        <Link
          href={backHref}
          className="mb-7 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake til søk
        </Link>

        {/* ── Main grid: image left, details right ────────────────────────── */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {listing.primaryImageUrl ? (
              <Image
                src={listing.primaryImageUrl}
                alt={listing.modelName}
                fill
                className="object-contain p-6"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-50">
                <Package className="h-24 w-24 text-zinc-200" />
              </div>
            )}

            {listing.discountPercent > 0 && (
              <div className="absolute left-4 top-4">
                <span className="rounded-xl bg-amber-100 px-3 py-1.5 text-base font-bold text-amber-800">
                  -{listing.discountPercent}%
                </span>
              </div>
            )}
          </div>

          {/* Details panel */}
          <div>
            {/* Store + category */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm text-zinc-500">Tilgjengelig hos</span>
              <a
                href={listing.store.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-zinc-900 transition-colors hover:text-accent-600"
              >
                {listing.store.name}
              </a>
              <Badge variant="category">{CATEGORY_LABELS[listing.category]}</Badge>
            </div>

            {/* Brand + model */}
            {listing.primaryBrand && (
              <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-accent-600">
                {listing.primaryBrand.name}
              </p>
            )}
            <h1 className="mb-5 text-2xl font-bold leading-tight text-zinc-900">
              {displayTitle}
            </h1>

            {/* Price block */}
            <div className="mb-5 rounded-xl bg-zinc-50 p-4">
              <div className="mb-1 flex items-baseline gap-3">
                <span className="tabular-nums text-3xl font-bold text-zinc-900">
                  {formatPrice(listing.discountedPrice)}
                </span>
                {listing.discountPercent > 0 && (
                  <span className="tabular-nums text-lg text-zinc-400 line-through">
                    {formatPrice(listing.originalPrice)}
                  </span>
                )}
              </div>
              {savings > 0 && (
                <p className="text-sm font-medium text-green-700">
                  Du sparer {formatPrice(savings)}&ensp;({listing.discountPercent}% rabatt)
                </p>
              )}
            </div>

            {/* Sizes */}
            {listing.sizes.length > 0 && (
              <div className="mb-5">
                <h2 className="mb-2 text-sm font-semibold text-zinc-700">
                  Størrelser
                </h2>
                <div className="flex flex-wrap gap-2">
                  {sortedSizes.map((s) => (
                    <div
                      key={s.size}
                      className={clsx(
                        "flex flex-col items-center rounded-lg border px-3 py-2 text-sm font-medium",
                        s.isInStock
                          ? "border-zinc-300 bg-white text-zinc-900"
                          : "border-zinc-200 bg-zinc-50 text-zinc-300"
                      )}
                    >
                      <span className={clsx(!s.isInStock && "line-through")}>{s.size}</span>
                      {sizeStockKnown && (
                        <span
                          className={clsx(
                            "mt-0.5 text-xs",
                            s.isInStock ? "text-green-600" : "text-zinc-300"
                          )}
                        >
                          {s.isInStock
                            ? s.quantity != null
                              ? `${s.quantity} stk`
                              : "På lager"
                            : "Utsolgt"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stock status — hidden for reliable stores when sizes already show availability */}
            {!(sizeStockKnown && listing.sizes.length > 0 && listing.isInStock) && (
              <div className="mb-5">
                {listing.isInStock ? (
                  sizeStockKnown ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      På lager
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-400">
                      Lagerstatus per størrelse er ikke bekreftet
                    </span>
                  )
                ) : (
                  <Badge variant="outofstock">Utsolgt</Badge>
                )}
              </div>
            )}

            {/* Primary CTA */}
            <a
              href={listing.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-accent-600 active:bg-accent-700"
            >
              Se tilbud hos {listing.store.name}
              <ExternalLink className="h-4 w-4" />
            </a>

            {/* Last confirmed timestamp */}
            <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                Tilbud sist bekreftet{" "}
                {formatRelativeDate(listing.lastSeenAt)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Description + Specifications ────────────────────────────────── */}
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Description */}
          {listing.description && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-zinc-900">
                Beskrivelse
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600">
                {listing.description}
              </p>
            </section>
          )}

          {/* Specifications — always rendered; normalized fields always visible */}
          {specRows.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-zinc-900">
                Spesifikasjoner
              </h2>
              <dl className="overflow-hidden rounded-xl border border-zinc-200">
                {specRows.map(({ key, val }, i) => (
                  <div
                    key={key}
                    className={clsx(
                      "flex px-4 py-3 text-sm",
                      i % 2 === 0 ? "bg-white" : "bg-zinc-50"
                    )}
                  >
                    <dt className="w-2/5 shrink-0 font-medium text-zinc-700">
                      {key}
                    </dt>
                    <dd className="text-zinc-600">{val}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        {/* ── Price history ────────────────────────────────────────────────── */}
        {listing.priceHistory.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-bold text-zinc-900">
              Prishistorikk
            </h2>

            {/* Visual chart — shown when ≥ 2 snapshots exist */}
            {listing.priceHistory.length >= 2 && (
              <div className="mb-4 overflow-hidden rounded-xl border border-zinc-200 bg-white px-4 pb-4 pt-3">
                <PriceHistoryChart history={listing.priceHistory} />
              </div>
            )}

            {/* Data table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3 font-medium">Dato</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Ordinær pris
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Tilbudspris
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Rabatt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {listing.priceHistory
                    .slice()
                    .reverse()
                    .map((snap, i) => (
                      <tr
                        key={snap.recordedAt}
                        className={
                          i === 0
                            ? "font-semibold text-zinc-900"
                            : "text-zinc-500"
                        }
                      >
                        <td className="px-4 py-3">
                          {formatDate(snap.recordedAt)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatPrice(snap.originalPrice)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatPrice(snap.discountedPrice)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {snap.discountPercent > 0 ? (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              -{snap.discountPercent}%
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Disclaimer ──────────────────────────────────────────────────── */}
        <div className="mt-8 flex gap-2 rounded-xl bg-zinc-50 p-4 text-xs text-zinc-400">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Pris og tilgjengelighet ble sist bekreftet{" "}
            {formatRelativeDate(listing.lastSeenAt)}. Sykkelpris er ikke
            ansvarlig for eventuelle prisendringer hos butikken. Klikk
            &quot;Se tilbud&quot; for å se gjeldende pris hos{" "}
            {listing.store.name}.
          </p>
        </div>
      </Container>
    </div>
  );
}
