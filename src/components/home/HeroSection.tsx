import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { SearchBar } from "@/components/ui/SearchBar";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HeroVideo } from "./HeroVideo";

const QUICK_LINKS = [
  { label: "Carbon veisykler", href: "/sykler?category=ROAD&frameMaterial=CARBON" },
  { label: "Elsykler under 30 000 kr", href: "/sykler?category=EBIKE&maxPrice=30000" },
  { label: "Beste MTB-tilbud", href: "/sykler?category=MTB&minDiscount=20&sort=discount_desc" },
  { label: "Grusykler på lager", href: "/sykler?category=GRAVEL&inStock=true" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-zinc-900 py-16 md:py-24">
      {/* Background video — sequential playlist, falls back to bg-zinc-900 if unavailable. */}
      <HeroVideo />

      {/* Solid dark overlay — keeps text readable regardless of video brightness */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-zinc-900/60" />

      {/* Dot grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Fade edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-900/50 via-transparent to-zinc-900"
      />

      <Container className="relative">
        <div className="max-w-2xl">
          {/* Eyebrow */}
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-accent-400">
            Sykkelsøk for Norge
          </p>

          {/* Heading */}
          <h1 className="mb-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Finn din neste sykkel
            <br />
            <span className="text-accent-400">til best pris</span>
          </h1>

          {/* Subtitle */}
          <p className="mb-8 max-w-lg text-base leading-relaxed text-zinc-400 md:text-lg">
            Vi samler og oppdaterer tilbud på komplette sykler fra utvalgte
            nettbutikker som leverer til Norge — slik at du slipper å sjekke
            alle selv.
          </p>

          {/* Search */}
          <div className="mb-7 max-w-lg">
            <Suspense fallback={null}>
              <SearchBar
                placeholder="Søk etter merke, modell eller type..."
                variant="hero"
              />
            </Suspense>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-sm text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.12] hover:text-white"
              >
                {link.label}
                <ArrowRight className="h-3 w-3 opacity-50" />
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
