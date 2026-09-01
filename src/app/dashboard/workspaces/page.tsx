import { redirect } from "next/navigation";
import { PageHeader } from "@/design-system";
import { requireSession } from "@/lib/auth/session";
import { getProjectsForUser } from "../queries";
import { WorkspacePickerList } from "./WorkspacePickerList";

export default async function WorkspacesPage() {
  const session = await requireSession();
  const projects = await getProjectsForUser(
    session.user.id,
    session.user.isSuperadmin,
  );

  if (projects.length === 0) redirect("/onboarding");

  return (
    <div className="mx-auto min-h-[100dvh] max-w-5xl px-8 py-10">
      <PageHeader
        title="Workspaces"
        description="Switch between tenants or request access to a new workspace."
      />

      <WorkspacePickerList workspaces={projects} />
    </div>
  );
}
