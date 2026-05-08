import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import type { MarketShortcut } from "@/lib/queries";

interface Props {
  shortcuts: MarketShortcut[];
}

export function CategoryShortcuts({ shortcuts }: Props) {
  return (
    <section className="bg-zinc-50 py-10">
      <Container>
        <h2 className="mb-5 text-xl font-bold text-zinc-900">
          Utforsk kategorier
        </h2>

        {/* Mobile: 1-column list rows. sm+: 5-column grid cards. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5 sm:gap-3">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={[
                // mobile: horizontal row; sm+: vertical card
                "group flex flex-row items-center justify-between gap-3 rounded-xl border bg-white p-4",
                "sm:flex-col sm:justify-between sm:gap-4 sm:p-5",
                // colour & border
                "border-zinc-200",
                // transitions
                "transition-all duration-200 ease-out",
                // hover
                "hover:-translate-y-0.5 hover:border-accent-300 hover:bg-accent-50 hover:shadow-md",
                // press
                "active:scale-[0.98] active:translate-y-0 active:shadow-none active:border-accent-400",
              ].join(" ")}
            >
              <p className="flex-1 text-sm font-semibold leading-snug text-zinc-900 transition-colors duration-200 group-hover:text-accent-700 sm:flex-none">
                {s.label}
              </p>
              <div className="flex shrink-0 items-center gap-2 sm:w-full sm:shrink sm:justify-between">
                <span className="text-xs text-zinc-400 transition-colors duration-200 group-hover:text-zinc-500">
                  {s.count > 0 ? `${s.count} sykler` : "Ingen nå"}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-all duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-accent-500" />
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
