import { cache } from "react";
import {
  countEnabledSchedules,
  getLatestRun,
  getProjectWithConfig,
  listIntegrations,
  listPendingActionsForProject,
  listRunsForProject,
} from "@/lib/db/queries/projects";
import { getUsageStats } from "@/lib/db/queries/orgs";

export const getProjectDashboard = cache(async (projectId: string) => {
  const data = await getProjectWithConfig(projectId);
  if (!data) return null;

  const [integrations, pending, latestRun, scheduleCount, recentRuns, usage] =
    await Promise.all([
      listIntegrations(projectId),
      listPendingActionsForProject(projectId),
      getLatestRun(projectId),
      countEnabledSchedules(projectId),
      listRunsForProject(projectId, 5),
      data.project.orgId
        ? getUsageStats(data.project.orgId)
        : Promise.resolve(null),
    ]);

  return {
    ...data,
    integrations,
    pendingCount: pending.length,
    pending,
    latestRun,
    scheduleCount,
    recentRuns,
    spend30dMicros: usage?.totalSpendMicros ?? null,
    monthSpendMicros: usage?.monthSpendMicros ?? 0,
    monthlyBudgetCents: usage?.monthlyBudgetCents ?? null,
    burnRateMicros: usage?.burnRateMicros ?? 0,
    dailyData: usage?.dailyData ?? [],
  };
});
