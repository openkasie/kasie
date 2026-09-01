import Link from "next/link";
import {
  CalendarCheckIcon,
  ChartLineIcon,
  PlugIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  ConfigPanel,
  GlassCard,
  PageHeader,
  RunStatusBadge,
  StatCard,
} from "@/design-system";
import { formatUsdFromMicros } from "@/lib/format";
import { requireActiveProject } from "@/lib/auth/session";
import { getProjectDashboard } from "./queries";

export default async function ProjectDashboardPage() {
  const { projectId } = await requireActiveProject();
  const data = await getProjectDashboard(projectId);
  if (!data) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your agent workspace."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Estimated spend (30d)"
          value={
            data.spend30dMicros != null
              ? formatUsdFromMicros(data.spend30dMicros)
              : "N/A"
          }
          icon={<ChartLineIcon size={20} weight="regular" />}
        />
        <StatCard
          label="Scheduled tasks"
          value={String(data.scheduleCount)}
          icon={<CalendarCheckIcon size={20} weight="regular" />}
        />
        <StatCard
          label="Connected integrations"
          value={String(data.integrations.length)}
          icon={<PlugIcon size={20} weight="regular" />}
        />
        <StatCard
          label="Pending approvals"
          value={String(data.pendingCount)}
          icon={<ShieldCheckIcon size={20} weight="regular" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConfigPanel title="Agent" description="Current tenant configuration">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-[var(--fg-muted)]">Agent name</dt>
              <dd className="font-medium">{data.project.agentName}</dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)]">Model tier</dt>
              <dd className="capitalize">{data.config?.modelTier ?? "smart"}</dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)]">Slack team</dt>
              <dd className="font-mono text-xs">
                {data.project.platformTeamId.startsWith("pending:")
                  ? "Not connected"
                  : data.project.platformTeamId}
              </dd>
            </div>
          </dl>
          <Link
            href="/dashboard/settings/preferences"
            className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline"
          >
            Edit agent settings
          </Link>
        </ConfigPanel>

        <ConfigPanel title="Latest run" description="Most recent agent execution">
          {data.latestRun ? (
            <div className="space-y-2">
              <RunStatusBadge status={data.latestRun.status} />
              <p className="text-sm text-[var(--fg-muted)] truncate">
                {(data.latestRun.input as { message?: string }).message ??
                  "No message"}
              </p>
              <Link
                href="/dashboard/runs"
                className="text-sm text-[var(--accent)] hover:underline"
              >
                View all runs
              </Link>
            </div>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">No runs yet.</p>
          )}
        </ConfigPanel>
      </div>

      {data.recentRuns.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Recent runs</h2>
          <div className="space-y-2">
            {data.recentRuns.map((run) => (
              <GlassCard key={run.id} elevation="subtle" className="flex items-center justify-between py-3">
                <p className="truncate text-sm text-[var(--fg-muted)]">
                  {(run.input as { message?: string }).message ?? run.id.slice(0, 8)}
                </p>
                <RunStatusBadge status={run.status} />
              </GlassCard>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
