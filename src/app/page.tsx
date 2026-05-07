import type { Metadata } from "next";
import { HeroSection } from "@/components/home/HeroSection";
import { TrustBar } from "@/components/home/TrustBar";
import { CategoryShortcuts } from "@/components/home/CategoryShortcuts";
import { FeaturedDeals } from "@/components/home/FeaturedDeals";
import { getFeaturedDeals, getStats, getMarketShortcuts } from "@/lib/queries";

export const revalidate = 300; // Revalidate every 5 minutes

export const metadata: Metadata = {
  title: "Sykkelpris — Finn beste sykkeltilbud i Norge",
};

export default async function HomePage() {
  const [stats, deals, shortcuts] = await Promise.all([
    getStats(),
    getFeaturedDeals(6),
    getMarketShortcuts(),
  ]);

  return (
    <>
      <HeroSection />
      <TrustBar stats={stats} />
      <CategoryShortcuts shortcuts={shortcuts} />
      <FeaturedDeals deals={deals} />
    </>
  );
}
