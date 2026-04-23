import type { SeedListingInput } from "../helpers";

export const ROAD_LISTINGS: SeedListingInput[] = [
  {
    storeSlug: "canyon",
    brandSlug: "canyon",
    externalId: "canyon-ultimate-cf-slx-8-di2",
    externalUrl: "https://www.canyon.com/en-no/road-bikes/race-bikes/ultimate/cf-slx/ultimate-cf-slx-8-di2/4066.html",
    rawTitle: "Canyon Ultimate CF SLX 8 Di2",
    modelName: "Canyon Ultimate CF SLX 8 Di2",
    category: "ROAD",
    frameMaterial: "CARBON",
    gender: "UNISEX",
    isElectric: false,
    originalPrice: 66699,
    discountedPrice: 66699,
    description:
      "Ultimate CF SLX er Canyons letteste veisykkelramme, bygget av TORAY T1100-karbon. Med elektronisk Shimano Ultegra Di2 og integrert kabelføring er dette en sykkel som taler for seg selv.",
    specifications: {
      Ramme: "Canyon CF SLX carbon (TORAY T1100)",
      Gir: "Shimano Ultegra Di2 2x12",
      Bremser: "Shimano Ultegra hydraulisk disc",
      Hjul: "DT Swiss ARC 1400 Dicut",
      Vekt: "7.2 kg (M)",
    },
    sizes: [
      { size: "2XS", inStock: false },
      { size: "XS", inStock: true, quantity: 1 },
      { size: "S", inStock: true, quantity: 1 },
      { size: "M", inStock: true, quantity: 2 },
      { size: "L", inStock: false },
      { size: "XL", inStock: false },
      { size: "2XL", inStock: false },
    ],
  },
];
