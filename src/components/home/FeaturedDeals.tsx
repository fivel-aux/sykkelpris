import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { BikeCard } from "@/components/bike/BikeCard";
import type { BikeListingDTO } from "@/types/bike";

interface FeaturedDealsProps {
  deals: BikeListingDTO[];
}

export function FeaturedDeals({ deals }: FeaturedDealsProps) {
  if (deals.length === 0) return null;

  return (
    <section className="border-t border-zinc-200 bg-white py-14">
      <Container>
        {/* Header row */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">
              Beste tilbud akkurat nå
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Høyest rabatt fra verifiserte nettbutikker
            </p>
          </div>
          <Link
            href="/sykler?sort=discount_desc"
            className="hidden items-center gap-1 text-sm font-medium text-accent-600 transition-colors hover:text-accent-700 sm:flex"
          >
            Se alle tilbud
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Grid — 1 col on mobile, 2 on sm+, 3 on md+ */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {deals.map((listing) => (
            <BikeCard key={listing.id} listing={listing} />
          ))}
        </div>

        {/* Mobile "see all" link */}
        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/sykler?sort=discount_desc"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent-600 hover:text-accent-700"
          >
            Se alle tilbud
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
