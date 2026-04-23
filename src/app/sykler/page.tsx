import type { Metadata } from "next";
import { Suspense } from "react";
import { Search, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";

import { Container } from "@/components/layout/Container";
import { BikeCard } from "@/components/bike/BikeCard";
import { BikeListItem } from "@/components/bike/BikeListItem";
import { FilterPanel } from "@/components/filters/FilterPanel";
import { ActiveFilters } from "@/components/filters/ActiveFilters";
import { MobileFilterSheet } from "@/components/filters/MobileFilterSheet";
import { SortSelect } from "@/components/filters/SortSelect";
import { SearchBar } from "@/components/ui/SearchBar";
import { getListings, getFilterOptions } from "@/lib/queries";
import { parseFiltersFromSearchParams } from "@/lib/search";
import { CATEGORY_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "Sykler" };

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function SyklerPage({ searchParams }: PageProps) {
  // Flatten Next.js searchParams into a URLSearchParams instance
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }

  const filters = parseFiltersFromSearchParams(params);
  const view = (searchParams.view as string) === "list" ? "list" : "grid";

  const [{ listings, total, page, totalPages }, filterOptions] = await Promise.all([
    getListings(filters),
    getFilterOptions(),
  ]);

  // Page title reflects the active context
  const activeCategory = filters.category?.[0];
  const pageTitle = activeCategory
    ? CATEGORY_LABELS[activeCategory]
    : filters.q
    ? `Søk: «${filters.q}»`
    : "Alle sykler";

  // Clean URL builders — no inline IIFEs
  function buildPageUrl(p: number) {
    const np = new URLSearchParams(params.toString());
    np.set("page", String(p));
    return `/sykler?${np.toString()}`;
  }

  function buildViewUrl(v: "grid" | "list") {
    const np = new URLSearchParams(params.toString());
    np.set("view", v);
    np.delete("page");
    return `/sykler?${np.toString()}`;
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-6">
      <Container>
        {/* ── Page heading ─────────────────────────────────────────────── */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-zinc-900">{pageTitle}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {total > 0
              ? `${total.toLocaleString("nb-NO")} sykler funnet`
              : "Ingen sykler funnet med disse filtrene"}
          </p>
        </div>

        {/* ── Mobile search ────────────────────────────────────────────── */}
        <div className="mb-4 md:hidden">
          <Suspense fallback={null}>
            <SearchBar placeholder="Søk etter sykkel, merke eller type..." />
          </Suspense>
        </div>

        <div className="flex items-start gap-6">
          {/* ── Desktop sidebar ──────────────────────────────────────────── */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5">
              <Suspense fallback={null}>
                <FilterPanel
                  brands={filterOptions.brands}
                  stores={filterOptions.stores}
                />
              </Suspense>
            </div>
          </aside>

          {/* ── Results column ───────────────────────────────────────────── */}
          <div className="min-w-0 flex-1">
            {/* Toolbar */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              {/* Left side: mobile filter trigger + sort */}
              <div className="flex items-center gap-3">
                <Suspense fallback={null}>
                  <MobileFilterSheet
                    brands={filterOptions.brands}
                    stores={filterOptions.stores}
                  />
                </Suspense>

                <Suspense fallback={null}>
                  <SortSelect />
                </Suspense>
              </div>

              {/* Right side: grid / list toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
                <Link
                  href={buildViewUrl("grid")}
                  aria-label="Rutenett"
                  className={clsx(
                    "rounded p-1.5 transition-colors",
                    view === "grid"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-400 hover:text-zinc-700"
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Link>
                <Link
                  href={buildViewUrl("list")}
                  aria-label="Liste"
                  className={clsx(
                    "rounded p-1.5 transition-colors",
                    view === "list"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-400 hover:text-zinc-700"
                  )}
                >
                  <List className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Active filter chips */}
            <Suspense fallback={null}>
              <ActiveFilters
                brandOptions={filterOptions.brands}
                storeOptions={filterOptions.stores}
              />
            </Suspense>

            {/* ── Results ──────────────────────────────────────────────── */}
            {listings.length === 0 ? (
              <EmptyState query={filters.q} />
            ) : view === "list" ? (
              <div className="space-y-3">
                {listings.map((l) => (
                  <BikeListItem key={l.id} listing={l} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {listings.map((l) => (
                  <BikeCard key={l.id} listing={l} />
                ))}
              </div>
            )}

            {/* ── Pagination ───────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link
                    href={buildPageUrl(page - 1)}
                    className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm transition-colors hover:bg-zinc-50"
                  >
                    ← Forrige
                  </Link>
                )}
                <span className="text-sm text-zinc-500">
                  Side {page} av {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={buildPageUrl(page + 1)}
                    className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm transition-colors hover:bg-zinc-50"
                  >
                    Neste →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
        <Search className="h-6 w-6 text-zinc-400" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-zinc-900">Ingen sykler funnet</h3>
      <p className="mx-auto mb-6 max-w-sm text-sm text-zinc-500">
        {query
          ? `Vi fant ingen sykler som matcher «${query}». Prøv et annet søkeord eller juster filtrene.`
          : "Ingen sykler matcher de valgte filtrene. Prøv å justere eller nullstille filtrene."}
      </p>
      <Link
        href="/sykler"
        className="inline-flex items-center rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
      >
        Vis alle sykler
      </Link>
    </div>
  );
}
