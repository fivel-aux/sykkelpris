type PricePoint = {
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  recordedAt: string;
};

interface PriceHistoryChartProps {
  history: PricePoint[];
}

const W = 600;
const H = 120;
const PL = 12;
const PR = 12;
const PT = 14;
const PB = 4;

/**
 * Server-renderable SVG sparkline showing discounted vs. original price over time.
 * No external chart library — pure SVG computation.
 */
export function PriceHistoryChart({ history }: PriceHistoryChartProps) {
  if (history.length < 2) return null;

  // ── Bounds ────────────────────────────────────────────────────────────────
  const allPrices = history.flatMap((p) => [p.originalPrice, p.discountedPrice]);
  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  // Add 4% headroom so the line doesn't sit on the very edge
  const pad = (rawMax - rawMin) * 0.08 || rawMax * 0.04;
  const minP = rawMin - pad;
  const maxP = rawMax + pad;
  const priceRange = maxP - minP;

  const dateMs = history.map((p) => new Date(p.recordedAt).getTime());
  const minD = Math.min(...dateMs);
  const maxD = Math.max(...dateMs);
  const dateRange = maxD - minD || 1;

  // ── Coordinate helpers ────────────────────────────────────────────────────
  function xOf(iso: string): number {
    const t = new Date(iso).getTime();
    return PL + ((t - minD) / dateRange) * (W - PL - PR);
  }

  function yOf(price: number): number {
    return H - PB - ((price - minP) / priceRange) * (H - PT - PB);
  }

  // ── Point strings ─────────────────────────────────────────────────────────
  function pts(getValue: (p: PricePoint) => number): string {
    return history
      .map((p) => `${xOf(p.recordedAt).toFixed(1)},${yOf(getValue(p)).toFixed(1)}`)
      .join(" ");
  }

  const discountedPts = pts((p) => p.discountedPrice);
  const originalPts = pts((p) => p.originalPrice);

  // Area polygon beneath the discounted line
  const firstX = xOf(history[0].recordedAt).toFixed(1);
  const lastX = xOf(history[history.length - 1].recordedAt).toFixed(1);
  const baseY = (H - PB).toFixed(1);
  const areaPts = `${firstX},${baseY} ${discountedPts} ${lastX},${baseY}`;

  // Only show original-price reference line when there's at least one discounted point
  const hasAnyDiscount = history.some((p) => p.discountPercent > 0);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "120px" }}
        aria-hidden="true"
      >
        {/* Subtle mid-grid line */}
        <line
          x1={PL}
          y1={((PT + H - PB) / 2).toFixed(1)}
          x2={W - PR}
          y2={((PT + H - PB) / 2).toFixed(1)}
          stroke="#f4f4f5"
          strokeWidth={1}
        />

        {/* Fill area below discounted price */}
        <polygon points={areaPts} fill="#fff7ed" opacity={0.9} />

        {/* Original price — dashed reference line */}
        {hasAnyDiscount && (
          <polyline
            points={originalPts}
            fill="none"
            stroke="#d4d4d8"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
        )}

        {/* Discounted price — solid accent line */}
        <polyline
          points={discountedPts}
          fill="none"
          stroke="#f97316"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots at each data point */}
        {history.map((p, i) => (
          <circle
            key={i}
            cx={xOf(p.recordedAt).toFixed(1)}
            cy={yOf(p.discountedPrice).toFixed(1)}
            r={4}
            fill="#f97316"
            stroke="white"
            strokeWidth={2}
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-5 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="3" aria-hidden="true">
            <line
              x1="0"
              y1="1.5"
              x2="16"
              y2="1.5"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          Tilbudspris
        </span>
        {hasAnyDiscount && (
          <span className="flex items-center gap-1.5">
            <svg width="16" height="3" aria-hidden="true">
              <line
                x1="0"
                y1="1.5"
                x2="16"
                y2="1.5"
                stroke="#d4d4d8"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
            </svg>
            Ordinær pris
          </span>
        )}
      </div>
    </div>
  );
}
