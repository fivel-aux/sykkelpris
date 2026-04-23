import { clsx } from "clsx";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-md bg-zinc-200",
        className
      )}
    />
  );
}

export function BikeCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <Skeleton className="w-full aspect-[4/3]" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-6 w-8" />
          ))}
        </div>
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
