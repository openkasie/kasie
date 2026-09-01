import { cn } from "../utils/cn";

type SparklineProps = {
  /** Series values in chronological order. */
  data: number[];
  className?: string;
  ariaLabel?: string;
};

const W = 200;
const H = 40;
const PAD = 2;

export function Sparkline({ data, className, ariaLabel }: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = (W - PAD * 2) / (data.length - 1);

  const points = data.map((v, i) => {
    const x = PAD + i * step;
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${PAD},${H - PAD} ${line} ${(W - PAD).toFixed(1)},${H - PAD}`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn("h-10 w-full", className)}
    >
      <polygon points={area} fill="var(--accent)" opacity={0.12} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill="var(--accent)" />
    </svg>
  );
}
