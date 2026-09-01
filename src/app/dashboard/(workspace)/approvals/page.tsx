import { EmptyState, PageHeader } from "@/design-system";
import { listPendingActionsForProject } from "@/lib/db/queries/projects";
import { requireActiveProject } from "@/lib/auth/session";
import { ApprovalQueue } from "./components/ApprovalQueue";

export default async function ApprovalsPage() {
  const { projectId } = await requireActiveProject();
  const actions = await listPendingActionsForProject(projectId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Human-in-the-loop write actions awaiting your decision."
      />

      {actions.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          description="Write actions that need your approval will appear here."
        />
      ) : (
        <ApprovalQueue actions={actions} />
      )}
    </div>
  );
}
