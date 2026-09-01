import {
  EmptyState,
  GlassCard,
  PageHeader,
  RunStatusBadge,
} from "@/design-system";
import { listRunsForProject } from "@/lib/db/queries/projects";
import { requireActiveProject } from "@/lib/auth/session";

export default async function RunsPage() {
  const { projectId } = await requireActiveProject();
  const runs = await listRunsForProject(projectId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Runs"
        description="Agent execution history for this workspace."
      />

      {runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          description="Runs appear here when your agent processes messages or scheduled tasks."
        />
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <GlassCard key={run.id} elevation="subtle" className="p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-[var(--fg-muted)]">
                  {run.id.slice(0, 8)}
                </span>
                <RunStatusBadge status={run.status} />
              </div>
              <p className="mt-2 truncate text-sm">
                {(run.input as { message?: string }).message ?? "No message"}
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                {run.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
