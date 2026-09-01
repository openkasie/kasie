import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getOrgMembership } from "@/lib/db/queries/orgs";
import { isPendingPlatformTeam } from "@/lib/db/queries/projects";
import { requireActiveProject } from "@/lib/auth/session";
import { resolveAppOrigin } from "@/lib/slack/redirect-uri";
import { getProjectDashboard } from "../../queries";
import { DeleteAccountCard } from "../components/DeleteAccountCard";
import { SlackConnectionCard } from "../components/SlackConnectionCard";

export default async function AccountSettingsPage() {
  const { session, projectId } = await requireActiveProject();
  const data = await getProjectDashboard(projectId);
  if (!data?.project.orgId) notFound();

  const membership = await getOrgMembership(session.user.id, data.project.orgId);
  const canManage =
    membership?.role === "owner" || session.user.isSuperadmin;
  const pending = isPendingPlatformTeam(data.project.platformTeamId);

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = resolveAppOrigin(`${proto}://${host}`);

  return (
    <div className="space-y-6">
      <SlackConnectionCard
        workspaceName={data.project.name}
        platformTeamId={data.project.platformTeamId}
        pending={pending}
        canManage={canManage}
        origin={origin}
        projectId={projectId}
      />
      <DeleteAccountCard />
    </div>
  );
}
