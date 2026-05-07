import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { clsx } from "clsx";
import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/formatters";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { BikeListingDTO } from "@/types/bike";
import { sortSizeObjects } from "@/lib/sizes";

interface BikeListItemProps {
  listing: BikeListingDTO;
}

export function BikeListItem({ listing }: BikeListItemProps) {
  const sortedSizes = sortSizeObjects(listing.sizes);
  const inStockSizes = sortedSizes.filter((s) => s.isInStock);
  const sizeStockKnown = listing.store.slug !== "bikester";

  return (
    <Link
      href={`/sykler/${listing.id}`}
      className="group flex gap-4 rounded-xl border border-zinc-200 bg-white p-3 transition-all duration-150 hover:border-zinc-300 hover:shadow-md"
    >
      {/* Thumbnail */}
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-100 sm:h-36 sm:w-36">
        {listing.primaryImageUrl ? (
          <Image
            src={listing.primaryImageUrl}
            alt={listing.modelName}
            fill
            className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            sizes="144px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-8 w-8 text-zinc-300" />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1 py-1">
        {/* Top row: brand + badge | price block */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-600">
                {listing.primaryBrand?.name ?? "—"}
              </span>
              <Badge variant="category">{CATEGORY_LABELS[listing.category]}</Badge>
            </div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 transition-colors group-hover:text-accent-600">
              {listing.modelName}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-400">{listing.store.name}</p>
          </div>

          {/* Price */}
          <div className="shrink-0 text-right">
            {listing.discountPercent > 0 && (
              <span className="mb-1 inline-block rounded bg-accent-500 px-2 py-0.5 text-xs font-bold text-white">
                -{listing.discountPercent}%
              </span>
            )}
            <p className="tabular-nums text-base font-bold text-zinc-900">
              {formatPrice(listing.discountedPrice)}
            </p>
            {listing.discountPercent > 0 && (
              <p className="tabular-nums text-xs text-zinc-400 line-through">
                {formatPrice(listing.originalPrice)}
              </p>
            )}
          </div>
        </div>

        {/* Sizes + stock */}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {sortedSizes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sortedSizes.slice(0, 8).map((s) => (
                <span
                  key={s.size}
                  className={clsx(
                    "rounded border px-1.5 py-0.5 text-xs font-medium",
                    s.isInStock
                      ? "border-zinc-300 bg-white text-zinc-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-300 line-through"
                  )}
                >
                  {s.size}
                </span>
              ))}
            </div>
          )}
          {listing.isInStock ? (
            sizeStockKnown ? (
              <span className="text-xs font-medium text-green-600">
                ✓ På lager
                {inStockSizes.length > 0 ? ` (${inStockSizes.length} str.)` : ""}
              </span>
            ) : (
              <span className="text-xs text-zinc-400">Lagerstatus er ikke bekreftet</span>
            )
          ) : (
            <span className="text-xs text-zinc-400">Utsolgt</span>
          )}
        </div>
      </div>

      {/* CTA — only visible on sm+ to avoid cramping small screens */}
      <div className="hidden shrink-0 items-center sm:flex">
        <span className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-accent-600">
          Se tilbud
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
