import { requireActiveProject } from "@/lib/auth/session";
import { getProjectDashboard } from "../../queries";
import { WorkspaceForm } from "../components/WorkspaceForm";

export default async function WorkspaceSettingsPage() {
  const { projectId } = await requireActiveProject();
  const data = await getProjectDashboard(projectId);
  if (!data) return null;

  return (
    <WorkspaceForm name={data.project.name} projectId={data.project.id} />
  );
}
