"use client";

import { useMemo, useState } from "react";
import { EmptyState, RunListItem, Tabs, type RunListItemRun } from "@/design-system";

const ACTIVE_STATUSES = new Set(["queued", "running", "awaiting_approval"]);

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "In progress" },
  { id: "completed", label: "Done" },
  { id: "failed", label: "Issues" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function matches(run: RunListItemRun, filter: FilterId): boolean {
  switch (filter) {
    case "active":
      return ACTIVE_STATUSES.has(run.status);
    case "completed":
      return run.status === "completed";
    case "failed":
      return run.status === "failed" || run.status === "cancelled";
    default:
      return true;
  }
}

export function RunsList({ runs }: { runs: RunListItemRun[] }) {
  const [filter, setFilter] = useState<FilterId>("all");

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = { all: runs.length, active: 0, completed: 0, failed: 0 };
    for (const run of runs) {
      if (ACTIVE_STATUSES.has(run.status)) c.active += 1;
      else if (run.status === "completed") c.completed += 1;
      else c.failed += 1;
    }
    return c;
  }, [runs]);

  const visible = runs.filter((run) => matches(run, filter));

  return (
    <div className="space-y-4">
      <Tabs
        tabs={FILTERS.map((f) => ({ id: f.id, label: f.label, count: counts[f.id] }))}
        active={filter}
        onChange={(id) => setFilter(id as FilterId)}
      />

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing in this view"
          description="Tasks with this status will appear here as your agent works."
        />
      ) : (
        <div className="space-y-2">
          {visible.map((run) => (
            <RunListItem key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
