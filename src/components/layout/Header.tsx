import { Suspense } from "react";
import Link from "next/link";
import { Container } from "./Container";
import { SearchBar } from "@/components/ui/SearchBar";
import { Bike } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 shadow-sm">
      <Container>
        <div className="flex h-16 items-center gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-zinc-900 shrink-0 hover:text-accent-600 transition-colors"
          >
            <Bike className="h-6 w-6 text-accent-500" />
            <span className="text-lg tracking-tight">sykkelpris</span>
          </Link>

          {/* Search bar — hidden on mobile, shown on md+ */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <Suspense fallback={null}>
              <SearchBar placeholder="Søk etter sykkel, merke eller type..." />
            </Suspense>
          </div>

          {/* Nav */}
          <nav className="ml-auto flex items-center gap-1">
            <Link
              href="/sykler?category=ROAD"
              className="hidden lg:block px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
            >
              Veisykler
            </Link>
            <Link
              href="/sykler?category=GRAVEL"
              className="hidden lg:block px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
            >
              Grusykler
            </Link>
            <Link
              href="/sykler?category=MTB"
              className="hidden lg:block px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
            >
              MTB
            </Link>
            <Link
              href="/sykler?category=EBIKE"
              className="hidden lg:block px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
            >
              Elsykler
            </Link>
            <Link
              href="/sykler"
              className="ml-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-md transition-colors"
            >
              Alle sykler
            </Link>
          </nav>
        </div>

        {/* Mobile search bar */}
        <div className="md:hidden pb-3">
          <Suspense fallback={null}>
            <SearchBar placeholder="Søk etter sykkel..." />
          </Suspense>
        </div>
      </Container>
    </header>
  );
}
