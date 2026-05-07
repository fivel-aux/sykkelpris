"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { X, SlidersHorizontal } from "lucide-react";
import { clsx } from "clsx";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { BikeCategory } from "@prisma/client";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterPanelProps {
  brands: FilterOption[];
  stores: FilterOption[];
  availableSizes?: string[];
  maxPriceCeiling?: number;
}

export function FilterPanel({
  brands,
  stores,
  availableSizes = [],
  maxPriceCeiling = 100000,
}: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const getParam = (key: string) => searchParams.get(key) ?? "";
  const getList = (key: string) =>
    searchParams.get(key)?.split(",").filter(Boolean) ?? [];

  // Local price state — only pushed to URL on blur or Enter
  const [localMin, setLocalMin] = useState(searchParams.get("minPrice") ?? "");
  const [localMax, setLocalMax] = useState(searchParams.get("maxPrice") ?? "");

  // Sync local state when URL params change externally (e.g. "Nullstill" clears all)
  useEffect(() => { setLocalMin(searchParams.get("minPrice") ?? ""); }, [searchParams.get("minPrice")]);
  useEffect(() => { setLocalMax(searchParams.get("maxPrice") ?? ""); }, [searchParams.get("maxPrice")]);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === "") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function toggleListParam(key: string, value: string) {
    const current = getList(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateParams({ [key]: next.join(",") || null });
  }

  function clearAll() {
    startTransition(() => router.push(pathname));
  }

  const activeCount = [
    "category",
    "minPrice",
    "maxPrice",
    "minDiscount",
    "brands",
    "stores",
    "sizes",
    "electric",
  ].filter((k) => searchParams.has(k)).length;

  const categories: BikeCategory[] = ["ROAD", "GRAVEL", "MTB", "EBIKE", "TT"];
  const discountPresets = [10, 20, 30, 40];

  return (
    <div className={clsx("space-y-6", isPending && "pointer-events-none opacity-60")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <SlidersHorizontal className="h-4 w-4" />
          Filtre
          {activeCount > 0 && (
            <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-xs text-white">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <X className="h-3 w-3" />
            Nullstill
          </button>
        )}
      </div>

      {/* Category */}
      <FilterSection title="Kategori">
        {categories.map((cat) => (
          <CheckItem
            key={cat}
            label={CATEGORY_LABELS[cat]}
            checked={getList("category").includes(cat)}
            onChange={() => toggleListParam("category", cat)}
          />
        ))}
      </FilterSection>

      {/* Price range */}
      <FilterSection title="Pris (NOK)">
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Fra"
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            onBlur={() => updateParams({ minPrice: localMin || null })}
            onKeyDown={(e) => e.key === "Enter" && updateParams({ minPrice: localMin || null })}
            className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
          <input
            type="number"
            placeholder="Til"
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            onBlur={() => updateParams({ maxPrice: localMax || null })}
            onKeyDown={(e) => e.key === "Enter" && updateParams({ maxPrice: localMax || null })}
            className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
      </FilterSection>

      {/* Sizes */}
      {availableSizes.length > 0 && (
        <FilterSection title="Størrelse">
          <div className="flex flex-wrap gap-1.5">
            {availableSizes.map((size) => {
              const isActive = getList("sizes").includes(size);
              return (
                <button
                  key={size}
                  onClick={() => toggleListParam("sizes", size)}
                  className={clsx(
                    "rounded border px-2 py-0.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-accent-500 bg-accent-500 text-white"
                      : "border-zinc-300 text-zinc-700 hover:border-accent-400"
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </FilterSection>
      )}

      {/* Brands */}
      {brands.length > 0 && (
        <FilterSection title="Merke">
          {brands.map((b) => (
            <CheckItem
              key={b.value}
              label={b.label}
              count={b.count}
              checked={getList("brands").includes(b.value)}
              onChange={() => toggleListParam("brands", b.value)}
            />
          ))}
        </FilterSection>
      )}

      {/* Stores */}
      {stores.length > 0 && (
        <FilterSection title="Butikk">
          {stores.map((s) => (
            <CheckItem
              key={s.value}
              label={s.label}
              count={s.count}
              checked={getList("stores").includes(s.value)}
              onChange={() => toggleListParam("stores", s.value)}
            />
          ))}
        </FilterSection>
      )}

      {/* Discount presets */}
      <FilterSection title="Minimum rabatt">
        <div className="flex flex-wrap gap-2">
          {discountPresets.map((pct) => {
            const isActive = getParam("minDiscount") === String(pct);
            return (
              <button
                key={pct}
                onClick={() =>
                  updateParams({ minDiscount: isActive ? null : String(pct) })
                }
                className={clsx(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  isActive
                    ? "border-accent-500 bg-accent-500 text-white"
                    : "border-zinc-300 text-zinc-700 hover:border-accent-400"
                )}
              >
                -{pct}%+
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Gender — hidden until scraper provides reliable gender data
      <FilterSection title="Kjønn">
        {genders.map((g) => ( ... ))}
      </FilterSection> */}

      {/* Frame material — hidden until scraper provides reliable material data
      <FilterSection title="Ramme">
        {materials.map((m) => ( ... ))}
      </FilterSection> */}

      {/* Electric */}
      <FilterSection title="Motor">
        <CheckItem
          label="Kun elsykler"
          checked={getParam("electric") === "true"}
          onChange={() =>
            updateParams({ electric: getParam("electric") === "true" ? null : "true" })
          }
        />
        <CheckItem
          label="Kun vanlige sykler"
          checked={getParam("electric") === "false"}
          onChange={() =>
            updateParams({ electric: getParam("electric") === "false" ? null : "false" })
          }
        />
      </FilterSection>

    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CheckItem({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 cursor-pointer rounded border-zinc-300 text-accent-500 focus:ring-accent-500"
      />
      <span
        className={clsx(
          "flex-1 text-sm transition-colors group-hover:text-zinc-900",
          checked ? "font-medium text-zinc-900" : "text-zinc-600"
        )}
      >
        {label}
      </span>
      {count !== undefined && (
        <span className="text-xs text-zinc-400">{count}</span>
      )}
    </label>
  );
}
