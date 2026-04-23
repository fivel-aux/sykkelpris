import Link from "next/link";
import { Gauge, Compass, Mountain, Zap } from "lucide-react";
import { Container } from "@/components/layout/Container";
import type { BikeCategory } from "@prisma/client";

const CATEGORIES: {
  category: BikeCategory;
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}[] = [
  {
    category: "ROAD",
    label: "Veisykler",
    description: "Raske og lette sykler for asfalt",
    icon: <Gauge className="h-6 w-6" />,
    href: "/sykler?category=ROAD",
  },
  {
    category: "GRAVEL",
    label: "Grusykler",
    description: "Allsidige sykler for alle underlag",
    icon: <Compass className="h-6 w-6" />,
    href: "/sykler?category=GRAVEL",
  },
  {
    category: "MTB",
    label: "Terrengsykler",
    description: "Robuste sykler for sti og terreng",
    icon: <Mountain className="h-6 w-6" />,
    href: "/sykler?category=MTB",
  },
  {
    category: "EBIKE",
    label: "Elsykler",
    description: "Elektrisk assistanse for alle",
    icon: <Zap className="h-6 w-6" />,
    href: "/sykler?category=EBIKE",
  },
];

export function CategoryShortcuts() {
  return (
    <section className="bg-zinc-50 py-10">
      <Container>
        <h2 className="mb-5 text-xl font-bold text-zinc-900">Velg kategori</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map(({ category, label, description, icon, href }) => (
            <Link
              key={category}
              href={href}
              className="group flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 transition-all duration-150 hover:border-accent-300 hover:bg-accent-50 hover:shadow-sm"
            >
              <span className="text-zinc-400 transition-colors group-hover:text-accent-500">
                {icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-900 group-hover:text-accent-700">
                  {label}
                </p>
                <p className="mt-0.5 hidden text-xs leading-snug text-zinc-400 sm:block">
                  {description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
