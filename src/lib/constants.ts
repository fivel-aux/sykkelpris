import type { BikeCategory, FrameMaterial, Gender } from "@prisma/client";

export const CATEGORY_LABELS: Record<BikeCategory, string> = {
  ROAD: "Veisykkel",
  GRAVEL: "Grusykkel",
  MTB: "Terrengsykkel",
  EBIKE: "Elsykkel",
  TT: "TT / Triatlon",
};

export const CATEGORY_SLUGS: Record<BikeCategory, string> = {
  ROAD: "veisykkel",
  GRAVEL: "grusykkel",
  MTB: "terrengsykkel",
  EBIKE: "elsykkel",
  TT: "tt-triatlon",
};

export const CATEGORY_FROM_SLUG: Record<string, BikeCategory> = {
  veisykkel: "ROAD",
  grusykkel: "GRAVEL",
  terrengsykkel: "MTB",
  elsykkel: "EBIKE",
  "tt-triatlon": "TT",
};

export const FRAME_MATERIAL_LABELS: Record<FrameMaterial, string> = {
  CARBON: "Carbon",
  ALUMINUM: "Aluminium",
  STEEL: "Stål",
  TITANIUM: "Titan",
  UNKNOWN: "Ukjent",
};

export const GENDER_LABELS: Record<Gender, string> = {
  MENS: "Herre",
  WOMENS: "Dame",
  UNISEX: "Unisex",
};

export const SORT_OPTIONS = [
  { value: "discount_desc", label: "Størst rabatt" },
  { value: "price_asc", label: "Lavest pris" },
  { value: "price_desc", label: "Høyest pris" },
  { value: "newest", label: "Nyeste tilbud" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 48;

export const CATEGORY_ICONS: Record<BikeCategory, string> = {
  ROAD: "🚴",
  GRAVEL: "🪨",
  MTB: "🏔️",
  EBIKE: "⚡",
  TT: "⏱️",
};
