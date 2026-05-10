"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { CATEGORY_LABELS, FRAME_MATERIAL_LABELS, GENDER_LABELS } from "@/lib/constants";
import { formatPrice } from "@/lib/formatters";
import type { BikeCategory, FrameMaterial, Gender } from "@prisma/client";

type Chip = {
  id: string;
  key: string;
  value?: string; // set for list-based params (category, brands, stores, sizes)
  label: string;
};

interface ActiveFiltersProps {
  brandOptions: { value: string; label: string }[];
  storeOptions: { value: string; label: string }[];
}

function buildChips(
  searchParams: ReturnType<typeof useSearchParams>,
  brandOptions: { value: string; label: string }[],
  storeOptions: { value: string; label: string }[]
): Chip[] {
  const chips: Chip[] = [];

  const q = searchParams.get("q");
  if (q) chips.push({ id: "q", key: "q", label: `"${q}"` });

  for (const cat of searchParams.get("category")?.split(",").filter(Boolean) ?? []) {
    chips.push({
      id: `cat-${cat}`,
      key: "category",
      value: cat,
      label: CATEGORY_LABELS[cat as BikeCategory] ?? cat,
    });
  }

  const minPrice = searchParams.get("minPrice");
  if (minPrice)
    chips.push({ id: "minPrice", key: "minPrice", label: `Fra ${formatPrice(Number(minPrice))}` });

  const maxPrice = searchParams.get("maxPrice");
  if (maxPrice)
    chips.push({ id: "maxPrice", key: "maxPrice", label: `Til ${formatPrice(Number(maxPrice))}` });

  const minDiscount = searchParams.get("minDiscount");
  if (minDiscount)
    chips.push({ id: "minDiscount", key: "minDiscount", label: `Min. -${minDiscount}%` });

  for (const slug of searchParams.get("brands")?.split(",").filter(Boolean) ?? []) {
    const label = brandOptions.find((b) => b.value === slug)?.label ?? slug;
    chips.push({ id: `brand-${slug}`, key: "brands", value: slug, label });
  }

  for (const slug of searchParams.get("stores")?.split(",").filter(Boolean) ?? []) {
    const label = storeOptions.find((s) => s.value === slug)?.label ?? slug;
    chips.push({ id: `store-${slug}`, key: "stores", value: slug, label });
  }

  for (const size of searchParams.get("sizes")?.split(",").filter(Boolean) ?? []) {
    chips.push({ id: `size-${size}`, key: "sizes", value: size, label: `Str. ${size}` });
  }

  const gender = searchParams.get("gender");
  if (gender)
    chips.push({ id: "gender", key: "gender", label: GENDER_LABELS[gender as Gender] ?? gender });

  const material = searchParams.get("frameMaterial");
  if (material)
    chips.push({
      id: "frameMaterial",
      key: "frameMaterial",
      label: FRAME_MATERIAL_LABELS[material as FrameMaterial] ?? material,
    });

  const electric = searchParams.get("electric");
  if (electric === "true")
    chips.push({ id: "electric-true", key: "electric", label: "Kun elsykler" });
  if (electric === "false")
    chips.push({ id: "electric-false", key: "electric", label: "Kun vanlige sykler" });

  return chips;
}

export function ActiveFilters({ brandOptions, storeOptions }: ActiveFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const chips = buildChips(searchParams, brandOptions, storeOptions);

  function remove(chip: Chip) {
    const params = new URLSearchParams(searchParams.toString());

    if (chip.value !== undefined) {
      // List param — remove only this value
      const current = params.get(chip.key)?.split(",").filter(Boolean) ?? [];
      const next = current.filter((v) => v !== chip.value);
      if (next.length === 0) params.delete(chip.key);
      else params.set(chip.key, next.join(","));
    } else {
      params.delete(chip.key);
    }

    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    // Preserve sort + view so UX state isn't lost
    const params = new URLSearchParams();
    const sort = searchParams.get("sort");
    const view = searchParams.get("view");
    if (sort) params.set("sort", sort);
    if (view) params.set("view", view);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          onClick={() => remove(chip)}
          className="inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          {chip.label}
          <X className="h-3 w-3 text-zinc-400" />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          onClick={clearAll}
          className="text-xs text-zinc-400 underline-offset-2 transition-colors hover:text-zinc-700 hover:underline"
        >
          Fjern alle
        </button>
      )}
    </div>
  );
}
