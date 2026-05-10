"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FilterPanel } from "./FilterPanel";
import type { FilterOption } from "./FilterPanel";

const FILTER_PARAM_KEYS = [
  "category",
  "minPrice",
  "maxPrice",
  "minDiscount",
  "brands",
  "stores",
  "sizes",
  "gender",
  "frameMaterial",
  "electric",
] as const;

interface MobileFilterSheetProps {
  brands: FilterOption[];
  stores: FilterOption[];
  availableSizes?: string[];
}

export function MobileFilterSheet({ brands, stores, availableSizes = [] }: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();

  const activeCount = FILTER_PARAM_KEYS.filter((k) => searchParams.has(k)).length;

  return (
    <>
      {/* Trigger — only visible below lg breakpoint */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
        Filtrer
        {activeCount > 0 && (
          <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs font-medium leading-none text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* Sheet — only rendered on mobile/tablet */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Sliding sheet from bottom */}
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-2xl">
            {/* Sheet header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3.5">
              <span className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
                Filtrer
                {activeCount > 0 && (
                  <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs font-medium leading-none text-white">
                    {activeCount}
                  </span>
                )}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Lukk filter"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable filter content */}
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <FilterPanel brands={brands} stores={stores} availableSizes={availableSizes} />
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-100 px-4 py-3">
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600 active:bg-accent-700"
              >
                Vis resultater
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
