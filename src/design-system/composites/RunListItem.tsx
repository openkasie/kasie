"use client";

import { useState } from "react";
import type { Icon } from "@phosphor-icons/react";
import {
  CalendarCheckIcon,
  CaretDownIcon,
  CodeIcon,
  GearIcon,
  MonitorIcon,
  SlackLogoIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { GlassCard } from "./GlassCard";
import { RunStatusBadge } from "./RunStatusBadge";
import { cn } from "../utils/cn";

const SOURCE_META: Record<string, { label: string; icon: Icon }> = {
  slack: { label: "Slack", icon: SlackLogoIcon },
  api: { label: "API", icon: CodeIcon },
  schedule: { label: "Scheduled", icon: CalendarCheckIcon },
  dashboard: { label: "Dashboard", icon: MonitorIcon },
  system: { label: "System", icon: GearIcon },
  initiative: { label: "Initiative", icon: SparkleIcon },
};

export type RunListItemRun = {
  id: string;
  status: string;
  source: string | null;
  message: string;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  output: Record<string, unknown> | null;
};

type RunListItemProps = {
  run: RunListItemRun;
  /** When false, renders a compact non-expandable row. */
  expandable?: boolean;
};

function runDuration(run: RunListItemRun): string | null {
  if (!run.startedAt || !run.completedAt) return null;
  return formatDuration(run.completedAt.getTime() - run.startedAt.getTime());
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function RunListItem({ run, expandable = true }: RunListItemProps) {
  const [open, setOpen] = useState(false);
  const source = run.source ? SOURCE_META[run.source] : null;
  const SourceIcon = source?.icon;
  const duration = runDuration(run);

  const header = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-subtle)] text-[var(--fg-muted)]">
        {SourceIcon ? <SourceIcon size={16} /> : <CodeIcon size={16} />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm text-[var(--fg)]">{run.message}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--fg-muted)]">
          {source ? <span>{source.label}</span> : null}
          <span aria-hidden>&middot;</span>
          <span>{formatRelativeTime(run.createdAt)}</span>
          {duration ? (
            <>
              <span aria-hidden>&middot;</span>
              <span className="tabular-nums">{duration}</span>
            </>
          ) : null}
        </span>
      </span>
      <RunStatusBadge status={run.status} />
      {expandable ? (
        <CaretDownIcon
          size={14}
          className={cn(
            "shrink-0 text-[var(--fg-muted)] transition-transform duration-[var(--duration-fast)]",
            open && "rotate-180",
          )}
          aria-hidden
        />
      ) : null}
    </>
  );

  return (
    <GlassCard elevation="subtle" className="p-0">
      {expandable ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-4 text-left transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
        >
          {header}
        </button>
      ) : (
        <div className="flex items-center gap-3 p-4">{header}</div>
      )}

      {expandable && open ? (
        <div className="border-t border-[var(--border-subtle)] px-4 py-4">
          <dl className="grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-[var(--fg-muted)]">Started</dt>
              <dd className="mt-0.5">
                {run.startedAt ? DATE_FMT.format(run.startedAt) : "Not started yet"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)]">Finished</dt>
              <dd className="mt-0.5">
                {run.completedAt ? DATE_FMT.format(run.completedAt) : "Still in progress"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)]">Time taken</dt>
              <dd className="mt-0.5 tabular-nums">{duration ?? "N/A"}</dd>
            </div>
          </dl>

          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]">
              Technical details
            </summary>
            <div className="mt-2 space-y-2">
              <p className="font-mono text-[var(--fg-muted)]" title={run.id}>
                Run ID: {run.id}
              </p>
              {run.output && Object.keys(run.output).length > 0 ? (
                <pre className="max-h-64 overflow-auto rounded-lg bg-[var(--surface-subtle)] p-3 font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(run.output, null, 2)}
                </pre>
              ) : (
                <p className="text-[var(--fg-muted)]">No output recorded.</p>
              )}
            </div>
          </details>
        </div>
      ) : null}
    </GlassCard>
  );
}
