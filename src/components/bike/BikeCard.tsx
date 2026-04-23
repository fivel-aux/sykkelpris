import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { clsx } from "clsx";
import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/formatters";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { BikeListingDTO } from "@/types/bike";

interface BikeCardProps {
  listing: BikeListingDTO;
}

export function BikeCard({ listing }: BikeCardProps) {
  const inStockSizes = listing.sizes.filter((s) => s.isInStock);
  const brandName = listing.primaryBrand?.name ?? "";

  // Strip brand prefix from title when brand is already shown above the title
  const displayTitle =
    brandName && listing.modelName.toLowerCase().startsWith(brandName.toLowerCase())
      ? listing.modelName.slice(brandName.length).replace(/^[-–—|\s,]+/, "").trim() || listing.modelName
      : listing.modelName;

  // Don't repeat the store name when it's the same as the brand (e.g. Canyon DTC)
  const showStore = listing.store.name.toLowerCase() !== brandName.toLowerCase();

  return (
    <Link
      href={`/sykler/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all duration-150 hover:border-zinc-300 hover:shadow-md"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
        {listing.primaryImageUrl ? (
          <Image
            src={listing.primaryImageUrl}
            alt={listing.modelName}
            fill
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-10 w-10 text-zinc-300" />
          </div>
        )}

        {/* Discount badge */}
        {listing.discountPercent > 0 && (
          <span className="absolute left-3 top-3 rounded-md bg-accent-500 px-2 py-0.5 text-sm font-bold text-white">
            -{listing.discountPercent}%
          </span>
        )}

        {/* Category badge */}
        <span className="absolute right-3 top-3">
          <Badge variant="category">{CATEGORY_LABELS[listing.category]}</Badge>
        </span>
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
        <h3 className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 transition-colors group-hover:text-accent-600">
          {displayTitle}
        </h3>

        {/* Prices */}
        <div className="mb-3 flex items-baseline gap-2">
          <span className="tabular-price text-lg font-bold text-zinc-900">
            {formatPrice(listing.discountedPrice)}
          </span>
          {listing.discountPercent > 0 && (
            <span className="tabular-price text-sm text-zinc-400 line-through">
              {formatPrice(listing.originalPrice)}
            </span>
          )}
        </div>

        {/* Sizes */}
        {listing.sizes.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {listing.sizes.slice(0, 6).map((s) => (
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
            {listing.sizes.length > 6 && (
              <span className="self-center text-xs text-zinc-400">
                +{listing.sizes.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Stock status + CTA — pushed to bottom */}
        <div className="mt-auto space-y-2.5 pt-1">
          {listing.isInStock ? (
            <p className="text-xs font-medium text-green-600">
              På lager
              {inStockSizes.length > 0 && ` · ${inStockSizes.length} størrelser`}
            </p>
          ) : (
            <p className="text-xs text-zinc-400">Utsolgt</p>
          )}

          {/*
            "Se tilbud" — styled as a button but rendered as a div.
            The parent <Link> owns the click interaction; a nested <button>
            would be invalid HTML (<button> inside <a>).
          */}
          <div className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-accent-600">
            Se tilbud
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}
