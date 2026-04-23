import type { SeedListingInput } from "../helpers";

export const TT_LISTINGS: SeedListingInput[] = [
  {
    storeSlug: "canyon",
    brandSlug: "canyon",
    externalId: "canyon-speedmax-cf-7-di2-race",
    externalUrl: "https://www.canyon.com/en-no/road-bikes/triathlon-bikes/speedmax/cf/speedmax-cf-7-di2-race/4137.html",
    rawTitle: "Canyon Speedmax CF 7 Di2 Race",
    modelName: "Canyon Speedmax CF 7 Di2 Race",
    category: "TT",
    frameMaterial: "CARBON",
    gender: "UNISEX",
    isElectric: false,
    originalPrice: 60599,
    discountedPrice: 60599,
    description:
      "Speedmax CF 7 Di2 Race er Canyons inngangsmodell til triatlonverdenen. Aerodynamisk CF SL-karbonramme med integrert drikkeflaskeholder, Shimano 105 Di2 og DT Swiss ARC 1600 hjul.",
    specifications: {
      Ramme: "Canyon CF SL carbon",
      Gir: "Shimano 105 Di2 2x12",
      Bremser: "Shimano 105 hydraulisk disc",
      Hjul: "DT Swiss ARC 1600 Spline",
      Gaffel: "Canyon carbon, aerodynamisk",
      Vekt: "8.8 kg (M)",
    },
    sizes: [
      { size: "2XS", inStock: false },
      { size: "XS", inStock: true, quantity: 1 },
      { size: "S", inStock: true, quantity: 2 },
      { size: "M", inStock: true, quantity: 2 },
      { size: "L", inStock: true, quantity: 1 },
      { size: "XL", inStock: false },
    ],
  },
];
