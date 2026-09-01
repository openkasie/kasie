import { cache } from "react";
import {
  getMemberUsageStats,
  getProjectUsageBreakdown,
  getScheduleUsageStats,
  getTeamUsageSummary,
  getUsageStats,
  listAuditEvents,
  listOrgMembers,
  listProjectsForUser,
} from "@/lib/db/queries/orgs";
import { getOrgMembership } from "@/lib/db/queries/orgs";
import { getInitiativeUsageSummary } from "@/lib/db/queries/usage";
import { getProjectById } from "@/lib/db/queries/projects";
import { requireActiveProject } from "@/lib/auth/session";
import type { AuditEventCategory } from "@/lib/db/schema";
import {
  parseUsageRange,
  usageRangeDays,
  usageRangeSince,
} from "@/lib/usage/range";

export type UsageSearchParams = {
  range?: string;
  page?: string;
  q?: string;
  user?: string;
  project?: string;
  category?: string;
};

export const getUsageContext = cache(async (searchParams: UsageSearchParams = {}) => {
  const { session, projectId } = await requireActiveProject();
  const project = await getProjectById(projectId);
  if (!project?.orgId) return null;

  const range = parseUsageRange(searchParams.range);
  const since = usageRangeSince(range);
  const membership = await getOrgMembership(session.user.id, project.orgId);
  const isOwner = membership?.role === "owner" || session.user.isSuperadmin;

  return {
    session,
    project,
    orgId: project.orgId,
    range,
    since,
    days: usageRangeDays(range),
    isOwner,
  };
});

export const getUsageOverviewData = cache(async (searchParams: UsageSearchParams = {}) => {
  const ctx = await getUsageContext(searchParams);
  if (!ctx) return null;

  const [stats, topMembers, topProjects] = await Promise.all([
    getUsageStats(ctx.orgId, ctx.days),
    getMemberUsageStats(ctx.orgId, ctx.since),
    getProjectUsageBreakdown(ctx.orgId, ctx.since),
  ]);

  return { ...ctx, stats, topMembers: topMembers.slice(0, 5), topProjects: topProjects.slice(0, 5) };
});

export const getUsageTeamData = cache(async (searchParams: UsageSearchParams = {}) => {
  const ctx = await getUsageContext(searchParams);
  if (!ctx) return null;

  const summary = await getTeamUsageSummary(ctx.orgId, ctx.since);
  return { ...ctx, ...summary };
});

export const getUsageActivityData = cache(async (searchParams: UsageSearchParams = {}) => {
  const ctx = await getUsageContext(searchParams);
  if (!ctx) return null;

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const categoryFilter: {
    category?: AuditEventCategory;
    categories?: AuditEventCategory[];
  } =
    searchParams.category === "admin"
      ? { categories: ["admin", "security"] }
      : searchParams.category &&
        ["run", "approval", "schedule", "admin", "security"].includes(
          searchParams.category,
        )
        ? { category: searchParams.category as AuditEventCategory }
        : {};

  const [members, projects, events] = await Promise.all([
    listOrgMembers(ctx.orgId),
    listProjectsForUser(ctx.session.user.id),
    listAuditEvents(ctx.orgId, {
      since: ctx.since,
      includeOwnerOnly: ctx.isOwner,
      actorUserId: searchParams.user || undefined,
      projectId: searchParams.project || undefined,
      ...categoryFilter,
      search: searchParams.q,
      offset,
      limit: limit + 1,
    }),
  ]);

  const sliced = events.slice(0, limit);
  const hasNext = events.length > limit;

  return {
    ...ctx,
    page,
    hasNext,
    members,
    projects,
    events: sliced,
  };
});

export const getUsageTasksData = cache(async (searchParams: UsageSearchParams = {}) => {
  const ctx = await getUsageContext(searchParams);
  if (!ctx) return null;

  const [schedules, initiative] = await Promise.all([
    getScheduleUsageStats(ctx.orgId, ctx.since),
    getInitiativeUsageSummary(ctx.orgId, ctx.since),
  ]);
  return { ...ctx, schedules, initiative };
});
