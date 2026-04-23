import type { SeedListingInput } from "../helpers";

export const GRAVEL_LISTINGS: SeedListingInput[] = [
  {
    storeSlug: "canyon",
    brandSlug: "canyon",
    externalId: "canyon-grizl-cf-7",
    externalUrl: "https://www.canyon.com/en-no/gravel-bikes/adventure/grizl/og/grizl-cf-7/4167.html",
    rawTitle: "Canyon Grizl CF 7",
    modelName: "Canyon Grizl CF 7",
    category: "GRAVEL",
    frameMaterial: "CARBON",
    gender: "UNISEX",
    isElectric: false,
    originalPrice: 30299,
    discountedPrice: 30299,
    description:
      "Grizl CF 7 er Canyons eventyr-rettede grusykkel i carbon. Lett og vibrasjonsdempende ramme klar for alt fra bikepacking til krevende grusstier, med Shimano GRX 1x12 og Schwalbe G-One-dekk.",
    specifications: {
      Ramme: "Canyon CF carbon",
      Gir: "Shimano GRX 1x12 (RD-RX822)",
      Bremser: "Shimano GRX hydraulisk disc (160mm)",
      Dekk: "Schwalbe G-One RX Performance 45mm",
      Vekt: "10.04 kg (M)",
    },
    sizes: [
      { size: "2XS", inStock: false },
      { size: "XS", inStock: true, quantity: 1 },
      { size: "S", inStock: true, quantity: 2 },
      { size: "M", inStock: true, quantity: 2 },
      { size: "L", inStock: false },
      { size: "XL", inStock: false },
    ],
  },
];
