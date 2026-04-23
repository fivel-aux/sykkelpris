import { clsx } from "clsx";

type BadgeVariant = "discount" | "category" | "stock" | "outofstock" | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  discount: "bg-accent-500 text-white font-semibold",
  category: "bg-zinc-100 text-zinc-700 font-medium",
  stock: "bg-green-100 text-green-800 font-medium",
  outofstock: "bg-zinc-100 text-zinc-500 font-medium",
  neutral: "bg-zinc-100 text-zinc-600",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded text-xs",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
