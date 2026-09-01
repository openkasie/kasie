import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  ChartLineIcon,
  PlugIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  Chip,
  ConfigPanel,
  PageHeader,
  RunListItem,
  Sparkline,
  StatCard,
} from "@/design-system";
import {
  formatRelativeTime,
  formatUsdFromCents,
  formatUsdFromMicros,
} from "@/lib/format";
import { CENTS_TO_MICROS } from "@/lib/usage/cost";
import { requireActiveProject } from "@/lib/auth/session";
import { getProjectDashboard } from "./queries";
import { toRunListItem } from "./run-display";

function StatLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
    >
      {children}
    </Link>
  );
}

export default async function ProjectDashboardPage() {
  const { projectId } = await requireActiveProject();
  const data = await getProjectDashboard(projectId);
  if (!data) return null;

  const recentRuns = data.recentRuns.map(toRunListItem);

  const budgetMicros =
    data.monthlyBudgetCents != null ? data.monthlyBudgetCents * CENTS_TO_MICROS : null;
  const budgetPercent =
    budgetMicros != null && budgetMicros > 0
      ? Math.min(100, Math.round((data.monthSpendMicros / budgetMicros) * 100))
      : null;
  const spendSeries = data.dailyData.map((d) => d.amount);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Here's what ${data.project.agentName} has been up to.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatLink href="/dashboard/usage">
          <StatCard
            label="AI spend (30 days)"
            value={
              data.spend30dMicros != null
                ? formatUsdFromMicros(data.spend30dMicros)
                : "N/A"
            }
            hint={
              data.burnRateMicros > 0
                ? `About ${formatUsdFromMicros(data.burnRateMicros)} a day`
                : undefined
            }
            icon={<ChartLineIcon size={20} weight="regular" />}
          />
        </StatLink>
        <StatLink href="/dashboard/tasks">
          <StatCard
            label="Scheduled tasks"
            value={String(data.scheduleCount)}
            icon={<CalendarCheckIcon size={20} weight="regular" />}
          />
        </StatLink>
        <StatLink href="/dashboard/integrations">
          <StatCard
            label="Connected apps"
            value={String(data.integrations.length)}
            icon={<PlugIcon size={20} weight="regular" />}
          />
        </StatLink>
        <StatLink href="/dashboard/approvals">
          <StatCard
            label="Waiting for approval"
            value={String(data.pendingCount)}
            hint={data.pendingCount > 0 ? "Needs your sign-off" : undefined}
            icon={<ShieldCheckIcon size={20} weight="regular" />}
          />
        </StatLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConfigPanel
          title="Your agent"
          description={`How ${data.project.agentName} is currently set up.`}
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-[var(--fg-muted)]">Name</dt>
              <dd className="mt-0.5 font-medium">{data.project.agentName}</dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)]">Intelligence</dt>
              <dd className="mt-0.5">
                <Chip variant="info" className="capitalize">
                  {data.config?.modelTier ?? "smart"}
                </Chip>
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[var(--fg-muted)]">Slack</dt>
              <dd className="mt-0.5">
                {data.project.platformTeamId.startsWith("pending:") ? (
                  <Chip variant="default">Not connected</Chip>
                ) : (
                  <Chip variant="success" dot>
                    Connected
                  </Chip>
                )}
              </dd>
            </div>
          </dl>
          <Link
            href="/dashboard/settings/preferences"
            className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
          >
            Adjust settings
            <ArrowRightIcon size={14} aria-hidden />
          </Link>
        </ConfigPanel>

        <ConfigPanel
          title="This month"
          description={`What ${data.project.agentName} has cost so far this month.`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {formatUsdFromMicros(data.monthSpendMicros)}
            </p>
            <p className="text-sm text-[var(--fg-muted)]">
              {data.monthlyBudgetCents != null
                ? `of ${formatUsdFromCents(data.monthlyBudgetCents)} cap`
                : "No spend cap set"}
            </p>
          </div>

          {budgetPercent != null ? (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                <div
                  className={`h-full rounded-full ${budgetPercent >= 100
                      ? "bg-[var(--danger)]"
                      : budgetPercent >= 80
                        ? "bg-[var(--warning-fg)]"
                        : "bg-[var(--accent)]"
                    }`}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                {budgetPercent}% of monthly cap used
              </p>
            </div>
          ) : null}

          {spendSeries.length >= 2 ? (
            <div className="mt-4">
              <p className="mb-1 text-xs text-[var(--fg-muted)]">Daily spend trend</p>
              <Sparkline data={spendSeries} ariaLabel="Daily spend trend" />
            </div>
          ) : null}

          <Link
            href="/dashboard/usage"
            className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
          >
            View usage details
            <ArrowRightIcon size={14} aria-hidden />
          </Link>
        </ConfigPanel>
      </div>

      {data.pendingCount > 0 ? (
        <ConfigPanel
          title="Needs your review"
          description="Actions your agent is waiting on before it can continue."
        >
          <div className="space-y-2">
            {data.pending.slice(0, 5).map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--warning-border)] bg-[var(--surface-subtle)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium capitalize">
                    {action.toolName.replace(/[._-]/g, " ")}
                  </p>
                  <p className="text-xs text-[var(--fg-muted)]">
                    Requested {formatRelativeTime(action.createdAt)}
                  </p>
                </div>
                <Link
                  href="/dashboard/approvals"
                  className="shrink-0 text-sm text-[var(--accent)] hover:underline"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </ConfigPanel>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Recent activity</h2>
          <Link
            href="/dashboard/runs"
            className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
          >
            View all activity
            <ArrowRightIcon size={14} aria-hidden />
          </Link>
        </div>
        {recentRuns.length > 0 ? (
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <RunListItem key={run.id} run={run} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">
            {`Nothing yet. ${data.project.agentName}'s work will appear here once it gets started.`}
          </p>
        )}
      </section>
    </div>
  );
}
