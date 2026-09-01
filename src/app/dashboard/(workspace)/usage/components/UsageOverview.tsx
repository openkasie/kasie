import {
  Avatar,
  ConfigPanel,
  GlassCard,
  StatCard,
  UsageStackedChart,
  type DailySourceUsage,
} from "@/design-system";
import { formatUsdFromCents, formatUsdFromMicros } from "@/lib/format";
import type { MemberUsageRow, ProjectUsageRow } from "@/lib/db/queries/usage";
import { BudgetForm } from "./BudgetForm";

type UsageOverviewProps = {
  stats: {
    totalSpendMicros: number;
    burnRateMicros: number;
    monthSpendMicros: number;
    monthlyBudgetCents: number | null;
    dailySourceData: DailySourceUsage[];
  };
  topMembers: MemberUsageRow[];
  topProjects: ProjectUsageRow[];
  isOwner: boolean;
};

export function UsageOverview({
  stats,
  topMembers,
  topProjects,
  isOwner,
}: UsageOverviewProps) {
  const budgetLabel =
    stats.monthlyBudgetCents == null
      ? "Unlimited"
      : `${formatUsdFromMicros(stats.monthSpendMicros)} / ${formatUsdFromCents(stats.monthlyBudgetCents)}`;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Estimated spend"
          value={formatUsdFromMicros(stats.totalSpendMicros)}
        />
        <StatCard
          label="Burn rate"
          value={`${formatUsdFromMicros(stats.burnRateMicros)} / day`}
        />
        <StatCard label="This month vs cap" value={budgetLabel} />
      </div>

      <ConfigPanel
        title="Spend by source"
        description="Daily estimated cost split across Slack, Agent API, and scheduled tasks."
      >
        <UsageStackedChart data={stats.dailySourceData} />
      </ConfigPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <ConfigPanel title="Top members" description="Highest estimated spend in this range.">
          {topMembers.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)]">No usage recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {topMembers.map((member) => (
                <GlassCard
                  key={member.key}
                  elevation="subtle"
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={member.label} image={member.image} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{member.label}</p>
                      <p className="text-sm text-[var(--fg-muted)]">
                        {member.runCount} run{member.runCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 font-mono text-sm tabular-nums">
                    {formatUsdFromMicros(member.spendMicros)}
                  </p>
                </GlassCard>
              ))}
            </div>
          )}
        </ConfigPanel>

        <ConfigPanel title="Top workspaces" description="Estimated spend by project.">
          {topProjects.length === 0 ? (
            <p className="text-sm text-[var(--fg-muted)]">No usage recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {topProjects.map((project) => (
                <GlassCard
                  key={project.projectId}
                  elevation="subtle"
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="text-sm text-[var(--fg-muted)]">
                      {project.runCount} run{project.runCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-sm tabular-nums">
                    {formatUsdFromMicros(project.spendMicros)}
                  </p>
                </GlassCard>
              ))}
            </div>
          )}
        </ConfigPanel>
      </div>

      {isOwner ? (
        <ConfigPanel
          title="Monthly spend cap"
          description="Optional cap on estimated model API spend for the current UTC month."
        >
          <BudgetForm key={String(stats.monthlyBudgetCents)} monthlyBudgetCents={stats.monthlyBudgetCents} />
        </ConfigPanel>
      ) : null}
    </div>
  );
}
