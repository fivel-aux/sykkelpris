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

        {/*
          Mobile: horizontal scroll row — cards at 72% width so the third
          card bleeds into view as a scroll hint. Snaps to each card.
          Desktop (sm+): standard 4-column grid, overflow reset.
        */}
        <div
          className={[
            // mobile: bleed to screen edges, horizontal scroll, snap
            "-mx-4 flex gap-3 overflow-x-auto px-4 pb-3",
            "snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
            // desktop: grid, no scroll
            "sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none",
          ].join(" ")}
        >
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={[
                // layout
                "group flex flex-col justify-between gap-4 rounded-xl border bg-white p-5",
                // mobile sizing + snap
                "w-[72%] shrink-0 snap-start sm:w-auto sm:shrink",
                // colour & border
                "border-zinc-200",
                // transitions — all transforms + colors in one pass
                "transition-all duration-200 ease-out",
                // hover: lift + accent border + stronger shadow
                "hover:-translate-y-0.5 hover:border-accent-300 hover:bg-accent-50 hover:shadow-md",
                // press: push back down, remove shadow
                "active:scale-[0.98] active:translate-y-0 active:shadow-none active:border-accent-400",
              ].join(" ")}
            >
              <p className="text-sm font-semibold leading-snug text-zinc-900 transition-colors duration-200 group-hover:text-accent-700">
                {s.label}
              </p>
              <div className="flex items-center justify-between">
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
