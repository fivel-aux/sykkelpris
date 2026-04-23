import { Bike, Clock, ShieldCheck, Store } from "lucide-react";
import { formatRelativeDate } from "@/lib/formatters";
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <dl className="grid grid-cols-2 divide-x divide-zinc-100 md:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 px-5 py-4 first:pl-0 last:pr-0"
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
      </div>
    </div>
  );
}
