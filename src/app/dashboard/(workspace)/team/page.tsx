import { notFound } from "next/navigation";
import { requireActiveProject } from "@/lib/auth/session";
import { getOrgMembership, listOrgMembers } from "@/lib/db/queries/orgs";
import { getProjectDashboard } from "../queries";
import { TeamList } from "./components/TeamList";

export default async function TeamPage() {
  const { session, projectId } = await requireActiveProject();

  const data = await getProjectDashboard(projectId);
  if (!data?.project.orgId) notFound();

  const [members, membership] = await Promise.all([
    listOrgMembers(data.project.orgId),
    getOrgMembership(session.user.id, data.project.orgId),
  ]);

  return (
    <TeamList
      orgId={data.project.orgId}
      members={members}
      currentUserId={session.user.id}
      isOwner={membership?.role === "owner"}
    />
  );
}
