import { clsx } from "clsx";
import { Bike, Clock, ShieldCheck, Store } from "lucide-react";
import { formatRelativeDate } from "@/lib/formatters";
import { Container } from "@/components/layout/Container";
import type { StatsDTO } from "@/types/bike";

interface TrustBarProps {
  stats: StatsDTO;
}

export function TrustBar({ stats }: TrustBarProps) {
  const items = [
    {
      icon: <Store className="h-4 w-4 text-accent-500 shrink-0" />,
      value: String(stats.storeCount),
      label: "overvåkede nettbutikker",
    },
    {
      icon: <Bike className="h-4 w-4 text-accent-500 shrink-0" />,
      value: stats.listingCount.toLocaleString("nb-NO"),
      label: "sykler registrert",
    },
    {
      icon: <Clock className="h-4 w-4 text-accent-500 shrink-0" />,
      value: stats.lastUpdatedAt ? formatRelativeDate(stats.lastUpdatedAt) : "—",
      label: "sist oppdatert",
    },
    {
      icon: <ShieldCheck className="h-4 w-4 text-accent-500 shrink-0" />,
      value: "Kun seriøse butikker",
      label: "med levering til Norge",
    },
  ];

  return (
    <div className="border-b border-zinc-200 bg-white">
      <Container>
        <dl className="grid grid-cols-2 md:grid-cols-4">
          {items.map((item, i) => (
            <div
              key={item.label}
              className={clsx(
                "flex items-center gap-3 px-3 py-5 md:px-5",
                // Mobile 2-col grid: right border on left column, bottom border on top row
                i % 2 === 0 && "border-r border-zinc-100",
                i < 2 && "border-b border-zinc-100 md:border-b-0",
                // md+ 4-col row: right border between all items except last; flush outer edges
                i < items.length - 1 && "md:border-r md:border-zinc-100",
                i === 0 && "md:pl-0",
                i === items.length - 1 && "md:pr-0",
              )}
            >
              {item.icon}
              <div className="min-w-0">
                <dt className="truncate text-sm font-semibold text-zinc-900">
                  {item.value}
                </dt>
                <dd className="truncate text-xs text-zinc-500">{item.label}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Container>
    </div>
  );
}
