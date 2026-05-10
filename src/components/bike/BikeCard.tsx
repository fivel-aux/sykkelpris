import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { formatPrice } from "@/lib/formatters";
import type { BikeListingDTO } from "@/types/bike";
import { sortSizeObjects } from "@/lib/sizes";

interface BikeCardProps {
  listing: BikeListingDTO;
  fromUrl?: string;
}

export function BikeCard({ listing, fromUrl }: BikeCardProps) {
  const sortedSizes = sortSizeObjects(listing.sizes);
  const inStockSizes = sortedSizes.filter((s) => s.isInStock);
  const sizeStockKnown = listing.store.slug !== "bikester";
  const brandName = listing.primaryBrand?.name ?? "";

  // Strip brand prefix from title when brand is already shown above the title
  const displayTitle =
    brandName && listing.modelName.toLowerCase().startsWith(brandName.toLowerCase())
      ? listing.modelName.slice(brandName.length).replace(/^[-–—|\s,]+/, "").trim() || listing.modelName
      : listing.modelName;

  // Don't repeat the store name when it's the same as the brand (e.g. Canyon DTC)
  const showStore = listing.store.name.toLowerCase() !== brandName.toLowerCase();

  const href = fromUrl
    ? `/sykler/${listing.id}?from=${encodeURIComponent(fromUrl)}`
    : `/sykler/${listing.id}`;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all duration-150 hover:border-zinc-300 hover:shadow-md"
    >
      {/* Image — clean, no overlays */}
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-50">
        {listing.primaryImageUrl ? (
          <Image
            src={listing.primaryImageUrl}
            alt={listing.modelName}
            fill
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-10 w-10 text-zinc-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Brand + Store */}
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-600">
            {brandName || "—"}
          </span>
          {showStore && (
            <span className="truncate text-xs text-zinc-400">{listing.store.name}</span>
          )}
        </div>

        {/* Model name */}
        <h3 className="mb-3 line-clamp-2 text-sm font-bold leading-snug text-zinc-900 transition-colors group-hover:text-accent-600">
          {displayTitle}
        </h3>

        {/* Prices — sale price prominent, original + badge on secondary line */}
        <div className="mb-3">
          <div className="tabular-nums text-xl font-bold text-zinc-900">
            {formatPrice(listing.discountedPrice)}
          </div>
          {listing.discountPercent > 0 && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="tabular-nums text-xs text-zinc-400 line-through">
                {formatPrice(listing.originalPrice)}
              </span>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                -{listing.discountPercent}%
              </span>
            </div>
          )}
        </div>

        {/* Sizes — dot-separated, in-stock only, max 4 visible + overflow count */}
        {inStockSizes.length > 0 && (
          <p className="mb-2.5 text-xs leading-relaxed text-zinc-500">
            {inStockSizes.slice(0, 4).map((s, i) => (
              <span key={s.size}>
                {i > 0 && <span className="mx-1 text-zinc-300">·</span>}
                {s.size}
              </span>
            ))}
            {inStockSizes.length > 4 && (
              <span className="ml-1 text-zinc-400">+{inStockSizes.length - 4}</span>
            )}
          </p>
        )}

        {/* Stock status + text CTA — pushed to bottom */}
        <div className="mt-auto flex items-center justify-between pt-1">
          {listing.isInStock ? (
            sizeStockKnown ? (
              <p className="text-xs font-medium text-green-600">
                {sortedSizes.length > 0
                  ? `På lager · ${inStockSizes.length} ${inStockSizes.length === 1 ? "størrelse" : "størrelser"}`
                  : "På lager"}
              </p>
            ) : (
              <p className="text-xs text-zinc-400">Sjekk lager hos butikk</p>
            )
          ) : (
            <p className="text-xs text-zinc-400">Utsolgt</p>
          )}

          <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-accent-600 transition-colors group-hover:text-accent-500">
            Se tilbud
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
