"use client";

import { Fragment, useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ClockCounterClockwiseIcon,
  ListMagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  Avatar,
  Button,
  Chip,
  GlassCard,
  Label,
  Pagination,
  SearchInput,
  Select,
} from "@/design-system";
import { cn } from "@/design-system/utils/cn";
import { formatRelativeTime, formatUsdFromMicros } from "@/lib/format";
import type { AuditEventCategory } from "@/lib/db/schema";

type ActivityEvent = {
  id: string;
  category: AuditEventCategory;
  action: string;
  actorUserId: string | null;
  actorLabel: string;
  actorName: string | null;
  actorEmail: string | null;
  actorImage: string | null;
  resourceType: string | null;
  resourceId: string | null;
  resourceLabel: string | null;
  metadata: Record<string, unknown>;
  costMicros: number | null;
  createdAt: Date;
  projectName: string | null;
};

type Member = {
  userId: string;
  name: string | null;
  email: string;
};

type Project = {
  id: string;
  name: string;
};

type UsageActivityFeedProps = {
  events: ActivityEvent[];
  members: Member[];
  projects: Project[];
  isOwner: boolean;
  page: number;
  hasNext: boolean;
};

const ACTION_LABELS: Record<string, string> = {
  "run.completed": "Agent run completed",
  "budget.updated": "Monthly spend cap updated",
  "api_key.created": "API key created",
  "api_key.revoked": "API key revoked",
  "member.removed": "Team member removed",
  "config.updated": "Agent preferences updated",
  "workspace.updated": "Workspace identity updated",
  "skill.toggled": "Skill toggled",
  "approval.resolved": "Approval resolved",
  "schedule.toggled": "Scheduled task updated",
  "integration.created": "Integration pending",
  "integration.connected": "Integration connected",
  "integration.disconnected": "Integration disconnected",
  "integration.updated": "Integration updated",
  "slack.disconnected": "Slack disconnected",
  "slack.reconnect_started": "Slack reconnect started",
};

const CATEGORY_VARIANT: Record<
  AuditEventCategory,
  "default" | "info" | "success" | "warning"
> = {
  run: "info",
  approval: "warning",
  schedule: "default",
  admin: "default",
  security: "warning",
};

const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "run", label: "Runs" },
  { id: "approval", label: "Approvals" },
  { id: "schedule", label: "Scheduled" },
] as const;

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label className="text-xs uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

export function UsageActivityFeed({
  events,
  members,
  projects,
  isOwner,
  page,
  hasNext,
}: UsageActivityFeedProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const tabs = useMemo(() => {
    const base: { id: string; label: string }[] = CATEGORY_TABS.map((tab) => ({
      id: tab.id,
      label: tab.label,
    }));
    if (isOwner) base.push({ id: "admin", label: "Admin" });
    return base;
  }, [isOwner]);

  const activeTab = searchParams.get("category") ?? "all";
  const activeUser = searchParams.get("user") ?? "";
  const activeProject = searchParams.get("project") ?? "";
  const activeQuery = searchParams.get("q") ?? "";

  const activeMember = members.find((member) => member.userId === activeUser);
  const activeProjectRow = projects.find((project) => project.id === activeProject);

  const hasActiveFilters =
    Boolean(activeUser) ||
    Boolean(activeProject) ||
    Boolean(activeQuery) ||
    activeTab !== "all";

  function updateParams(patch: Record<string, string | null>) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function clearFilters() {
    setQuery("");
    updateParams({
      user: null,
      project: null,
      q: null,
      category: null,
    });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateParams({ q: query.trim() || null });
  }

  return (
    <GlassCard className="overflow-hidden p-0" elevation="surface">
      <div className="space-y-4 border-b border-[var(--border-subtle)] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="flex flex-wrap gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)]/40 p-1"
            role="tablist"
            aria-label="Activity categories"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                disabled={pending}
                onClick={() =>
                  updateParams({ category: tab.id === "all" ? null : tab.id })
                }
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-[var(--surface-elevated)] text-[var(--fg)] shadow-sm"
                    : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="text-sm text-[var(--fg-muted)]">
            {events.length === 0
              ? "No events in this view"
              : `${events.length} event${events.length === 1 ? "" : "s"} on this page`}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
          <FilterField label="User">
            <Select
              value={activeUser}
              onChange={(event) =>
                updateParams({ user: event.target.value || null })
              }
              disabled={pending}
            >
              <option value="">All users</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name ?? member.email}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField label="Workspace">
            <Select
              value={activeProject}
              onChange={(event) =>
                updateParams({ project: event.target.value || null })
              }
              disabled={pending}
            >
              <option value="">All workspaces</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField label="Search">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Event, actor, or resource"
                className="min-w-0 flex-1"
              />
              <Button type="submit" variant="secondary" disabled={pending}>
                Apply
              </Button>
            </form>
          </FilterField>
        </div>

        {hasActiveFilters ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
              Filters
            </span>
            {activeTab !== "all" ? (
              <button
                type="button"
                onClick={() => updateParams({ category: null })}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                {tabs.find((tab) => tab.id === activeTab)?.label ?? activeTab}
                <XIcon size={12} />
              </button>
            ) : null}
            {activeMember ? (
              <button
                type="button"
                onClick={() => updateParams({ user: null })}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                {activeMember.name ?? activeMember.email}
                <XIcon size={12} />
              </button>
            ) : null}
            {activeProjectRow ? (
              <button
                type="button"
                onClick={() => updateParams({ project: null })}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                {activeProjectRow.name}
                <XIcon size={12} />
              </button>
            ) : null}
            {activeQuery ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  updateParams({ q: null });
                }}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                “{activeQuery}”
                <XIcon size={12} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Clear all
            </button>
          </div>
        ) : null}

        {isOwner ? (
          <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--fg-muted)]">
            As an owner, you see operational activity plus admin and security audit
            events for compliance review.
          </p>
        ) : (
          <p className="text-xs text-[var(--fg-muted)]">
            Operational activity only. Admin and security changes are visible to
            organization owners.
          </p>
        )}
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-20 text-center">
          <div className="mb-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4 text-[var(--fg-muted)]">
            <ListMagnifyingGlassIcon size={28} weight="regular" />
          </div>
          <p className="text-base font-medium">No activity in this range</p>
          <p className="mt-2 max-w-md text-sm text-[var(--fg-muted)]">
            Widen the date range, switch category, or clear filters to see more
            audit events.
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="secondary"
              className="mt-6"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                <th className="px-5 py-3 font-medium">Event</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Workspace</th>
                <th className="px-5 py-3 text-right font-medium">Cost</th>
                <th className="px-5 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const title =
                  event.resourceLabel ??
                  ACTION_LABELS[event.action] ??
                  event.action;
                const subtitle = ACTION_LABELS[event.action] ?? event.action;
                const href =
                  event.resourceType === "run" && event.resourceId
                    ? `/dashboard/runs?run=${event.resourceId}`
                    : null;
                const expanded = expandedId === event.id;
                const hasMetadata = Object.keys(event.metadata).length > 0;

                return (
                  <Fragment key={event.id}>
                    <tr
                      className={cn(
                        "border-b border-[var(--border-subtle)] transition-colors last:border-0",
                        expanded
                          ? "bg-[var(--surface-subtle)]"
                          : "hover:bg-[var(--surface-subtle)]/70",
                      )}
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Chip variant={CATEGORY_VARIANT[event.category]}>
                              {event.category}
                            </Chip>
                            {href ? (
                              <Link
                                href={href}
                                className="font-medium hover:text-[var(--accent)] hover:underline"
                              >
                                {title}
                              </Link>
                            ) : (
                              <span className="font-medium">{title}</span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--fg-muted)]">{subtitle}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={event.actorName ?? event.actorLabel}
                            image={event.actorImage}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {event.actorName ?? event.actorLabel}
                            </p>
                            {event.actorEmail ? (
                              <p className="truncate text-xs text-[var(--fg-muted)]">
                                {event.actorEmail}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-5 py-4 align-top text-[var(--fg-muted)] md:table-cell">
                        {event.projectName ?? "—"}
                      </td>
                      <td className="px-5 py-4 align-top text-right font-mono tabular-nums">
                        {event.costMicros != null
                          ? formatUsdFromMicros(event.costMicros)
                          : "—"}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <button
                          type="button"
                          disabled={!hasMetadata}
                          title={event.createdAt.toISOString()}
                          onClick={() =>
                            setExpandedId((current) =>
                              current === event.id ? null : event.id,
                            )
                          }
                          className={cn(
                            "inline-flex items-center gap-1.5 text-left text-[var(--fg-muted)]",
                            hasMetadata && "hover:text-[var(--fg)]",
                            !hasMetadata && "cursor-default",
                          )}
                        >
                          <ClockCounterClockwiseIcon size={14} />
                          {formatRelativeTime(event.createdAt)}
                        </button>
                      </td>
                    </tr>
                    {expanded && hasMetadata ? (
                      <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)]/60 last:border-0">
                        <td colSpan={5} className="px-5 pb-4 pt-0">
                          <pre className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)]/50 p-4 text-xs leading-relaxed text-[var(--fg-muted)]">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-[var(--border-subtle)] px-5 py-4">
        <Pagination page={page} hasNext={hasNext} />
      </div>
    </GlassCard>
  );
}
