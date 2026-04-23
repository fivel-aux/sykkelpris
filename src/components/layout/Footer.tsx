import Link from "next/link";
import { Container } from "./Container";
import { Bike } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white">
      <Container>
        <div className="py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-zinc-900">
              <Bike className="h-5 w-5 text-accent-500" />
              <span>sykkelpris</span>
            </Link>
            <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
              Finn beste pris på sykkel fra seriøse nettbutikker som leverer til Norge.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Kategorier</h3>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link href="/sykler?category=ROAD" className="hover:text-zinc-900">Veisykler</Link></li>
              <li><Link href="/sykler?category=GRAVEL" className="hover:text-zinc-900">Grusykler</Link></li>
              <li><Link href="/sykler?category=MTB" className="hover:text-zinc-900">Terrengsykler</Link></li>
              <li><Link href="/sykler?category=EBIKE" className="hover:text-zinc-900">Elsykler</Link></li>
            </ul>
          </div>

          {/* Browse */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Utforsk</h3>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link href="/sykler?sort=discount_desc" className="hover:text-zinc-900">Beste tilbud</Link></li>
              <li><Link href="/sykler?sort=price_asc" className="hover:text-zinc-900">Billigste sykler</Link></li>
              <li><Link href="/sykler?frameMaterial=CARBON" className="hover:text-zinc-900">Carbon sykler</Link></li>
              <li><Link href="/sykler?electric=true" className="hover:text-zinc-900">Elsykler</Link></li>
              <li><Link href="/sykler?inStock=true" className="hover:text-zinc-900">På lager nå</Link></li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-3">Om Sykkelpris</h3>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li className="text-zinc-400">Vi samler tilbud fra utvalgte seriøse nettbutikker som leverer til Norge.</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-zinc-100 py-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-zinc-400">
          <p>© {new Date().getFullYear()} Sykkelpris. Priser og tilgjengelighet kan ha endret seg.</p>
          <p>Prisene oppdateres automatisk flere ganger daglig.</p>
        </div>
      </Container>
    </footer>
  );
}
