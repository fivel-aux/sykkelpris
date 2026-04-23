/**
 * Format a price in NOK with Norwegian locale formatting.
 * Input is a Prisma Decimal (serialized as string) or number.
 */
export function formatPrice(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format a discount percentage as "-25%"
 */
export function formatDiscount(percent: number): string {
  return `-${percent}%`;
}

/**
 * Format a date as relative time ("2 timer siden") or absolute date
 */
export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  if (diffHours < 1) return "Akkurat nå";
  if (diffHours < 24) return `${Math.floor(diffHours)} timer siden`;
  if (diffDays < 7) return `${Math.floor(diffDays)} dager siden`;

  return d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}

/**
 * Format a full datetime string for timestamps
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a date as day + month + year only (no time) — used in price history tables
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Clamp a number within a range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Convert a Prisma Decimal (serialized as string) to a plain number
 */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  return 0;
}
