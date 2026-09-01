import Link from "next/link";
import { AppShell, KasieLogo, SidebarNav, WorkspaceSwitcher } from "@/design-system";
import { requireActiveProject } from "@/lib/auth/session";
import { formatUsdFromCents, formatUsdFromMicros } from "@/lib/format";
import { CENTS_TO_MICROS } from "@/lib/usage/cost";
import { getProjectsForUser } from "../queries";
import { getProjectDashboard } from "./queries";

export default async function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, projectId } = await requireActiveProject();

  const [data, projects] = await Promise.all([
    getProjectDashboard(projectId),
    getProjectsForUser(session.user.id, session.user.isSuperadmin),
  ]);

  if (!data) {
    return <p className="p-6">Project not found</p>;
  }

  return (
    <AppShell
      logo={
        <Link
          href="/dashboard"
          className="rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <KasieLogo size="sm" showWordmark />
        </Link>
      }
      sidebar={
        <>
          <div className="border-b border-[var(--border-subtle)] px-4 py-4">
            <Link
              href="/dashboard"
              className="rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <KasieLogo size="sm" showWordmark />
            </Link>
          </div>
          <SidebarNav pendingCount={data.pendingCount} />
          <div className="mt-auto border-t border-[var(--border-subtle)] pt-2">
            <WorkspaceSwitcher
              current={{
                id: data.project.id,
                name: data.project.name,
                agentName: data.project.agentName,
              }}
              workspaces={projects}
              budget={
                data.monthlyBudgetCents != null
                  ? {
                    spentLabel: formatUsdFromMicros(data.monthSpendMicros),
                    capLabel: formatUsdFromCents(data.monthlyBudgetCents),
                    percent:
                      data.monthlyBudgetCents > 0
                        ? Math.min(
                          100,
                          Math.round(
                            (data.monthSpendMicros /
                              (data.monthlyBudgetCents * CENTS_TO_MICROS)) *
                            100,
                          ),
                        )
                        : data.monthSpendMicros > 0
                          ? 100
                          : 0,
                  }
                  : null
              }
              user={session.user}
            />
          </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
