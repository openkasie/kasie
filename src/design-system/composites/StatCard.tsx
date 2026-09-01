import type { ReactNode } from "react";
import { TrendUpIcon, TrendDownIcon } from "@phosphor-icons/react/ssr";
import { GlassCard } from "./GlassCard";
import { cn } from "../utils/cn";

type Trend = {
  value: string;
  direction: "up" | "down" | "flat";
  /** When true, an upward trend is bad (e.g. cost, error rate). */
  invert?: boolean;
};

type StatCardProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  hint?: string;
  trend?: Trend;
  className?: string;
};

function trendTone(direction: Trend["direction"], invert?: boolean) {
  if (direction === "flat") return "text-[var(--fg-muted)]";
  const positive = invert ? direction === "down" : direction === "up";
  return positive ? "text-[var(--success-fg)]" : "text-[var(--danger-fg)]";
}

export function StatCard({ label, value, icon, hint, trend, className }: StatCardProps) {
  return (
    <GlassCard
      elevation="subtle"
      className={cn(
        "relative p-5 transition-colors hover:border-[var(--border-elevated)]",
        className,
      )}
    >
      {icon ? (
        <div className="absolute right-4 top-4 text-[var(--fg-muted)]">{icon}</div>
      ) : null}
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              trendTone(trend.direction, trend.invert),
            )}
          >
            {trend.direction === "up" ? (
              <TrendUpIcon size={13} weight="bold" aria-hidden />
            ) : trend.direction === "down" ? (
              <TrendDownIcon size={13} weight="bold" aria-hidden />
            ) : null}
            {trend.value}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-[var(--fg-muted)]">{hint}</p> : null}
    </GlassCard>
  );
}
