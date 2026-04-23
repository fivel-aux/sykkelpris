"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { clsx } from "clsx";

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  /** "default" = gray input on white background. "hero" = white input on dark background. */
  variant?: "default" | "hero";
}

export function SearchBar({
  placeholder = "Søk...",
  className,
  variant = "default",
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      params.delete("page");
      const target = pathname === "/" ? "/sykler" : pathname;
      startTransition(() => {
        router.push(`${target}?${params.toString()}`);
      });
    },
    [value, searchParams, pathname, router]
  );

  const handleClear = useCallback(() => {
    setValue("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [searchParams, pathname, router]);

  const isHero = variant === "hero";

  return (
    <form onSubmit={handleSubmit} className={clsx("relative w-full", className)}>
      <Search
        className={clsx(
          "absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none",
          isHero ? "h-5 w-5 text-zinc-400" : "h-4 w-4 text-zinc-400"
        )}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={clsx(
          "w-full pl-10 pr-10 rounded-xl border font-normal",
          "placeholder:text-zinc-400 text-zinc-900",
          "focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent",
          "transition-colors",
          isHero
            ? "h-12 text-base bg-white border-zinc-200 shadow-sm focus:shadow-md"
            : "h-10 text-sm bg-zinc-100 border-transparent focus:bg-white",
          isPending && "opacity-70"
        )}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
        >
          <X className={isHero ? "h-5 w-5" : "h-4 w-4"} />
        </button>
      )}
    </form>
  );
}
