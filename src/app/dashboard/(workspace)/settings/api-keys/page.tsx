import { notFound } from "next/navigation";
import { getOrgMembership } from "@/lib/db/queries/orgs";
import { requireActiveProject } from "@/lib/auth/session";
import { getProjectDashboard } from "../../queries";
import { listProjectApiKeys } from "../actions";
import { ApiKeysPanel } from "../components/ApiKeysPanel";

export default async function ApiKeysPage() {
  const { session, projectId } = await requireActiveProject();

  const data = await getProjectDashboard(projectId);
  if (!data?.project.orgId) notFound();

  const [keys, membership] = await Promise.all([
    listProjectApiKeys(),
    getOrgMembership(session.user.id, data.project.orgId),
  ]);

  const canManage =
    membership?.role === "owner" || session.user.isSuperadmin;

  return <ApiKeysPanel keys={keys} canManage={canManage} />;
}
