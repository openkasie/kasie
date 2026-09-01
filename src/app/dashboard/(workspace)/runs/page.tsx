import {
  CheckCircleIcon,
  LightningIcon,
  TimerIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { EmptyState, PageHeader, StatCard } from "@/design-system";
import { formatDuration } from "@/lib/format";
import { listRunsForProject } from "@/lib/db/queries/projects";
import { requireActiveProject } from "@/lib/auth/session";
import { toRunListItem } from "../run-display";
import { RunsList } from "./components/RunsList";

export default async function RunsPage() {
  const { projectId } = await requireActiveProject();
  const runs = await listRunsForProject(projectId);

  const completed = runs.filter((r) => r.status === "completed").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const terminal = completed + failed + runs.filter((r) => r.status === "cancelled").length;
  const successRate = terminal > 0 ? Math.round((completed / terminal) * 100) : null;

  const durations = runs
    .filter((r) => r.startedAt && r.completedAt)
    .map((r) => r.completedAt!.getTime() - r.startedAt!.getTime());
  const avgDuration =
    durations.length > 0
      ? formatDuration(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Everything your agent has been working on."
      />

      {runs.length === 0 ? (
        <EmptyState
          icon={<LightningIcon size={28} />}
          title="Nothing here yet"
          description="Your agent's work shows up here as it handles messages and scheduled tasks."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Tasks handled"
              value={String(runs.length)}
              hint={runs.length >= 50 ? "Most recent 50" : "All time"}
              icon={<LightningIcon size={20} />}
            />
            <StatCard
              label="Success rate"
              value={successRate != null ? `${successRate}%` : "N/A"}
              hint={
                terminal > 0
                  ? `${completed} of ${terminal} finished tasks`
                  : "Nothing finished yet"
              }
              icon={<CheckCircleIcon size={20} />}
            />
            <StatCard
              label="Needs attention"
              value={String(failed)}
              hint={failed > 0 ? "Tasks that hit an error" : undefined}
              icon={<XCircleIcon size={20} />}
            />
            <StatCard
              label="Avg. time to finish"
              value={avgDuration ?? "N/A"}
              icon={<TimerIcon size={20} />}
            />
          </div>

          <RunsList runs={runs.map(toRunListItem)} />
        </>
      )}
    </div>
  );
}
