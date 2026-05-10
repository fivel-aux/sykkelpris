import { Suspense } from "react";
import Link from "next/link";
import { Container } from "./Container";
import { SearchBar } from "@/components/ui/SearchBar";
import { Bike } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-zinc-200">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2 font-bold shrink-0"
          >
            <Bike className="h-6 w-6 text-accent-500" />
            <span className="text-lg tracking-tight text-zinc-900 transition-colors group-hover:text-accent-600">
              sykkelpris
            </span>
          </Link>

          {/* Search bar — hidden on mobile, shown on md+ */}
          <div className="hidden md:flex flex-1">
            <Suspense fallback={null}>
              <SearchBar placeholder="Søk etter sykkel..." />
            </Suspense>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <Link
              href="/sykler?category=ROAD"
              className="hidden lg:block px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Landeveissykler
            </Link>
            <Link
              href="/sykler?category=GRAVEL"
              className="hidden lg:block px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Grusykler
            </Link>
            <Link
              href="/sykler?category=MTB"
              className="hidden lg:block px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              MTB
            </Link>
            <Link
              href="/sykler?category=EBIKE"
              className="hidden lg:block px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Elsykler
            </Link>
            <Link
              href="/sykler?category=TT"
              className="hidden lg:block px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              TT / Triatlon
            </Link>
            <Link
              href="/sykler"
              className="inline-flex items-center rounded-lg border border-accent-700 px-4 py-2.5 text-sm font-semibold text-accent-700 transition-colors hover:bg-accent-700 hover:text-white lg:ml-2"
            >
              Alle sykler
            </Link>
          </nav>
        </div>
      </Container>
    </header>
  );
}
