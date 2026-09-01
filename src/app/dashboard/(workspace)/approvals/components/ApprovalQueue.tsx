"use client";

import { useTransition } from "react";
import { ApprovalDialog } from "@/design-system";
import { resolveApproval } from "../../actions";

type PendingAction = {
  id: string;
  runId: string;
  toolName: string;
  payload: Record<string, unknown>;
};

type ApprovalQueueProps = {
  actions: PendingAction[];
};

export function ApprovalQueue({ actions }: ApprovalQueueProps) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      {actions.map((action) => (
        <ApprovalDialog
          key={action.id}
          toolName={action.toolName}
          payload={action.payload}
          pending={pending}
          onApprove={() =>
            start(async () => {
              await resolveApproval({
                actionId: action.id,
                decision: "approved",
              });
            })
          }
          onReject={() =>
            start(async () => {
              await resolveApproval({
                actionId: action.id,
                decision: "rejected",
              });
            })
          }
        />
      ))}
    </div>
  );
}
