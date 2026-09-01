import { formatUsdFromMicros } from "@/lib/format";

export type DailySourceUsage = {
  date: string;
  slack: number;
  api: number;
  schedule: number;
  initiative: number;
  other: number;
};

type UsageStackedChartProps = {
  data: DailySourceUsage[];
  className?: string;
};

const SERIES = [
  { key: "slack" as const, label: "Slack", className: "fill-[#6366f1]" },
  { key: "api" as const, label: "Agent API", className: "fill-[#818cf8]" },
  { key: "schedule" as const, label: "Scheduled", className: "fill-[#a5b4fc]" },
  { key: "initiative" as const, label: "Initiative", className: "fill-[#c7d2fe]" },
  { key: "other" as const, label: "Other", className: "fill-[var(--fg-muted)] opacity-60" },
];

function dayTotal(day: DailySourceUsage): number {
  return day.slack + day.api + day.schedule + day.initiative + day.other;
}

export function UsageStackedChart({ data, className }: UsageStackedChartProps) {
  const max = Math.max(...data.map(dayTotal), 1);
  const barWidth = 100 / Math.max(data.length, 1);

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-[var(--fg-muted)]">
        {SERIES.map((series) => {
          const total = data.reduce((sum, day) => sum + day[series.key], 0);
          const pct =
            max > 0
              ? Math.round(
                (total / data.reduce((sum, day) => sum + dayTotal(day), 0)) * 100,
              ) || 0
              : 0;
          return (
            <div key={series.key} className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${series.className}`} />
              <span>
                {series.label}
                {total > 0 ? ` · ${pct}%` : ""}
              </span>
            </div>
          );
        })}
      </div>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label="Estimated spend by source over the selected range"
      >
        {data.map((day, i) => {
          const total = dayTotal(day);
          const x = i * barWidth + barWidth * 0.15;
          const w = barWidth * 0.7;
          let y = 40;

          return (
            <g key={day.date}>
              {SERIES.map((series) => {
                const segment = day[series.key];
                if (segment <= 0) return null;
                const segmentHeight = (segment / max) * 36;
                y -= segmentHeight;
                return (
                  <rect
                    key={series.key}
                    x={x}
                    y={y}
                    width={w}
                    height={Math.max(segmentHeight, 0.4)}
                    className={series.className}
                  />
                );
              })}
              {total <= 0 ? (
                <rect x={x} y={39.5} width={w} height={0.5} className="fill-[var(--border)]" />
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-[var(--fg-muted)]">
        <span>{data[0]?.date.slice(5) ?? ""}</span>
        <span>
          Peak {formatUsdFromMicros(max)} / day
        </span>
        <span>{data[data.length - 1]?.date.slice(5) ?? ""}</span>
      </div>
    </div>
  );
}
